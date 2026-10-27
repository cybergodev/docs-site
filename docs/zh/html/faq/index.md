---
sidebar_label: "常见问题"
title: "常见问题 - CyberGo html | 排查与行为差异"
description: "CyberGo html 常见问题排查：提取文本为空的原因、中文乱码与编码兜底、阅读模式与 Extract 的区别、Confidence 与 ExtractionMethod 的分流用法、超时错误差异、缓存 Key 生成、panic 隔离，以及批量与 data URL 等行为边界。"
sidebar_position: 10
---

# 常见问题

以下问题按排查顺序排列：先确认是否拿到错误，再检查输入与配置。

## 为什么提取的文本为空？

按以下顺序排查：

1. **输入为空或全空白** - 空输入与纯空白输入直接返回空 `Result`，不报错
2. **内容在不可见标签中** - `<script>`、`<style>` 中的文本不进入正文
3. **内容被清洗移除** - 正文若只存在于被清洗的标签（如 `<iframe>`、`<object>`）中，结果为空；对可信输入可临时设 `EnableSanitization = false` 排查
4. **文章识别选错了容器** - 关闭 `ExtractArticle` 后重试，看能否提取出内容；若能，说明评分器把非正文节点当成了主体

```go
cfg := html.DefaultConfig()
cfg.ExtractArticle = false // 关闭文章识别后重试
```

:::warning 嵌套过深会报错，而不是返回空文本
超过 `MaxDepth`（默认 500）时库返回 `ErrMaxDepthExceeded`；但 `golang.org/x/net/html` 解析器自身会先拒绝嵌套超过 512 层的文档，此时得到的是 `ErrInvalidHTML`。调用返回了 `error` 时先用 `errors.Is` 判断类型，不要只看文本是否为空。
:::

## 为什么提取的中文是乱码？

自动检测只读 HTML 自身：BOM、`<meta charset>` 声明与字节统计。它**不读 HTTP 响应头**。

因此，没有 `<meta charset>` 的 GBK 或 Shift_JIS 页面会被按 windows-1252 兜底解码，得到乱码且 `err == nil`——没有任何错误信号。

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk" // 已知来源编码时显式指定
result, err := html.Extract(pageData, cfg)
```

生产环境建议按来源显式指定编码：HTTP `Content-Type` 头、站点白名单或离线探测结果。只有声明或强制指定的编码与实际字节冲突时才会得到 `encoding detection failed: ...`。这类错误没有哨兵值，只能按消息前缀判断。详见[编码检测](../guides/core-features/encoding-detection)。

## ProcessingTimeout 和用户 context 超时有什么区别？

错误类型取决于触发源：

| 场景 | 返回错误 |
|------|----------|
| 库内 `ProcessingTimeout` 到期（用户 ctx 仍有效） | `ErrProcessingTimeout` |
| 用户 ctx deadline 到期（早于或等于库内超时） | `context.DeadlineExceeded`（原样返回，**不**归一化） |
| 用户主动 `cancel()` | `context.Canceled` |
| `ProcessingTimeout = 0` 且用户 ctx 到期 | `context.DeadlineExceeded` |

`ProcessingTimeout > 0` 时，库用 `context.WithTimeout(parentCtx, ProcessingTimeout)` 派生子 ctx，取两者中较早的 deadline。只有子 ctx 先到期、且父 ctx 仍然有效时，错误才被归一化为 `ErrProcessingTimeout`。

超时不会强制终止 goroutine：调用方先拿到错误，提取 goroutine 在下一个协作检查点退出。

## 缓存 Key 是如何生成的？

Key 对**完整原始输入字节**计算，并混入配置。算法是 hash/maphash（AES-NI 加速、进程级随机种子）：

1. 写入一个字节的布尔开关位：`ExtractArticle`、四个 `Preserve*` 与 `ExtractMetadata`（共 6 个）
2. 写入三个格式串：`InlineImageFormat`、`InlineLinkFormat`、`TableFormat`
3. 写入 `Encoding`（自动检测时为空串）
4. 写入**全部**输入字节

64 位结果经 splitmix64 扩散出第二个 64 位，拼成 128 位 Key。全量哈希意味着文档任意一处改动都会改变 Key；也意味着同一文档以不同编码存储时字节不同，无法互相命中。`Encoding` 参与计算，是为了区分同一份字节在不同强制编码下的解码结果。

全零 Key（`[16]byte{}`）被缓存视为「无 Key」，对应输入恒 miss。

## 为什么 `ExtractAllLinks` 和 `Extract` 的结果不同？

`Extract` 先清洗 HTML，再取清洗后 DOM 中的 `<a>` 链接，返回 `Result.Links`（`LinkInfo`）。`ExtractAllLinks` 不清洗，枚举页面引用的全部资源（含 `<script src>`、`<link>`、`<iframe>`、`<embed>`），返回 `[]LinkResource`，带 `Type` 分类。

概括：`Extract` 返回清洗后正文中的 `<a>` 链接，`ExtractAllLinks` 返回未清洗页面引用的全部资源。两者可先后调用，互不影响。

:::tip 内外链判定只看 href 形式
`ExtractAllLinks` 判断 `IsExternal` 时只看原始 href：`http(s)://` 或 `//` 开头算外部，相对路径算内部。它**不比较域名**，同域的绝对链接同样算外部。
:::

## 阅读模式和 Extract 有什么区别？

`Extract` 选出一篇文章，返回正文与元数据；导航、页脚被当作噪音移除。`ReadPage` 保留整页，把内容切成 header/navigation/main/aside/footer 五类分区，返回带 `Sections` 的 `ReadResult`，内联链接始终以 `[文字](URL)` 保留。

需要「只要正文」时用 `Extract`；要把整页喂给 LLM 或 RAG、需要保留导航与页脚上下文时用 `ReadPage`。`ReadPageToMarkdown` 直接输出一份 Markdown 文档，`ReadResult.Render` / `RenderText` 则在自行筛选分区后拼装。

阅读模式不走缓存。详见[阅读模式](../guides/core-features/reader-mode)。

## Result.Confidence 和 ExtractionMethod 怎么用？

`ExtractionMethod` 说明 `Text` 的来源：`article`（评分器选中正文节点）、`listing`（识别为卡片列表页）、`body`（回退整个 `<body>`）。

`Confidence` 是 `0`–`1` 的粗粒度质量信号，用作分流而非概率：`1.0` 表示正文充足且占页面文本比例达标，`0.6` 常见于列表页或短文章，`0.2`–`0.4` 多为 `<body>` 回退、极短输出或付费墙/同意墙话术。

典型用法是把 `< 1.0` 的结果送去复核或走备用策略：`body` + `0.2` 往往意味着页面由 JS 渲染。分档细节见[内容提取实战](../guides/core-features/content-extraction#质量信号)。

## 内部 panic 会有什么影响？

所有提取调用都被 recover 包装，panic 不会逃逸到调用方，而是转成 `ErrInternalPanic`：

- 单次提取：panic → `ErrInternalPanic`
- 批量处理：单项 panic 独立 recover，只让该项记入 `Failed`，不影响其他项
- 审计 Sink：`Write`/`Close` 的 panic 被隔离，审计是 best-effort，不中断主流程
- 超时 goroutine：内部 panic 也被独立 recover

:::warning 不要对 ErrInternalPanic 直接重试
它表示输入触发了库内部缺陷。记录原始输入或最小复现样本并上报，不要直接重试：同一输入会再次走到同一路径。
:::

## 关闭 Processor 后继续调用会怎样？

提取、格式化、链接与批量方法在入口检查关闭标记，返回 `ErrProcessorClosed`：

- `Close()` 幂等，多次调用安全
- 已关闭的池化实例不会归还到池中（避免下次 `Get` 拿到缓存清理协程已停止的实例），由 `sync.Pool` 重建
- 在已关闭实例上调用批量方法，`BatchResult` 中每项错误都是 `ErrProcessorClosed`
- `GetStatistics`、`GetAuditLog`、`ClearCache`、`ClearAuditLog`、`ResetStatistics` 不检查关闭标记，仍可安全调用

## 包级函数传入 Config 后还走池化吗？

不走。不传 Config 时用内置默认配置（缓存已关闭）并从 `sync.Pool` 取实例；传一个 Config 时新建临时 Processor，用完即弃。因此 `html.Extract(data, cfg)` 每次都会新建并销毁实例。高频调用自定义配置时，应自行 `html.New(cfg)` 并复用。

## 批量处理超过 10000 项会怎样？

整批失败，不做部分处理：`Failed` 等于输入数量，`Results` 全为 `nil`，每项 `Errors` 都是包装了 `ErrBatchTooLarge` 的错误。更大数据集请自行分批（如每批 5000 项）。字段与错误消息见[批量处理](../api-reference/modules/batch)。

## data URL 有什么限制？

清洗器只放行白名单 MIME（图片、字体、PDF），阻止 `image/svg+xml` 与空媒体类型。长度上限为 100KB 且不可配置；超限的 `<img>` 被**静默丢弃**（`Images` 中不出现，`err == nil`）。完整白名单与审计事件见[安全防护](../api-reference/modules/security)。

## 为什么 `.ogg` URL 同时出现在 Videos 和 Audios 中？

`.ogg` 是容器格式，可承载视频（Theora）或音频（Vorbis/Opus）。正则兜底扫描时，`.ogg` 同时匹配视频与音频扩展名列表，因此同时进入 `Result.Videos` 和 `Result.Audios`。仅音频的 `.oga` 只进音频列表。

## 自定义 Scorer 需要注意什么？

`Scorer.Score` 决定正文选取。`ShouldRemove` 只在使用**内置默认评分器**时被查阅（候选过滤与节点移除启发式都依赖它）；配置自定义 `Scorer` 后，清洗阶段的节点移除仍按内置规则执行，自定义 `ShouldRemove` 不决定哪些节点被剥离。要影响选取，请在 `Score` 中给低分/负分，或实现 `ArticleFinder` 单遍选取。

单个 Processor 被多个 goroutine 共享时，`Score` 会并发触发。持有可变状态（缓存、计数器）的实现必须自行加锁。

:::warning 无状态 Scorer 不需要加锁
只依据传入的 `ContentNode` 计算，可以免去锁开销。需要聚合统计时，在调用方加锁记录到自有结构——`Processor` 没有公开的统计写入口。
:::

接口签名见[接口定义](../api-reference/types/interfaces#scorer)，实现与测试写法见[测试与自定义](../guides/integration/testing-custom)。

## TableFormat 怎么影响输出？

`TableFormat` 为 `"markdown"`（默认）时把 `<table>` 渲染成 Markdown 表格，`"html"` 时保留原始标签；格式串大小写不敏感，空值回退 `markdown`。取值与校验规则见[配置参考](../api-reference/core/config)。

## AllowedBaseDir 跨平台行为一致吗？

一致。库从已打开的文件句柄解析真实路径，校验与读取共用同一句柄，堵住 TOCTOU 窗口。Linux/macOS 走 `/proc/self/fd` 与 `/dev/fd`；Windows 用 `GetFinalPathNameByHandleW` 解析 junction 与 reparse point。详见[安全防护](../api-reference/modules/security#路径安全)。

## 缓存命中返回的是原始对象吗？

不是。命中时返回 `cloneResult` 产生的深拷贝，切片都做了复制；未命中路径也是先写缓存再返回克隆。因此调用方修改结果不会污染缓存条目。

## `ProcessingTimeout` 设为 `0` 是什么效果？

不限时：库不启动超时 goroutine。`0` 是显式声明「不限时」，并非「未设置」；默认值是 30 秒（`DefaultConfig()`）。

## `ExtractToMarkdown` 用缓存吗？

不用。它内部创建临时 Processor 完成格式转换，既不读也不写主 Processor 的缓存。见[输出格式](../api-reference/modules/output)。

## 怎么监控处理情况？

用 `p.GetStatistics()` 读 `TotalProcessed`、`CacheHits`、`AverageProcessTime` 等字段；包级函数不提供统计。字段含义见[类型定义](../api-reference/types/type-defs#statistics)。

## 怎么启用审计？

设 `cfg.Audit = html.DefaultAuditConfig()`，把 `cfg.Audit.Enabled` 置为 `true`，再用 `html.New(cfg)` 创建 Processor。Sink 与事件类型见[审计系统](../api-reference/modules/audit)。

## 相关文档

- [概述](../) - 特性与架构
- [快速开始](../getting-started/) - 安装与首次提取
- [API 参考](../api-reference/) - 完整 API 文档
