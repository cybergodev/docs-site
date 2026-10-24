---
sidebar_label: "安全概述"
title: "安全概述 - CyberGo html | 安全防护总览"
description: "CyberGo html 安全防护总览：输入层（MaxInputSize、MaxDepth、ProcessingTimeout、AllowedBaseDir 沙箱）、处理层（HTML 清洗、context 取消、panic 恢复）、审计层（八种事件）与 HighSecurityConfig 预设。"
sidebar_position: 10
---

# 安全概述

CyberGo html 是一个 Go 语言的 HTML 内容提取与清洗库，处理的是来自互联网的不可信输入，因此安全是设计的第一约束。库内置多层独立防护，遵循**纵深防御**：每层独立生效，单层失效不会导致防护整体失效。

本页说明各层防护的作用与失效边界；需要配置审计管道或核对上线清单，见文末[下一步](#下一步)。

## 深度防御架构

三层的划分依据是失败模式，而不是代码位置：输入层在解析前拒绝，处理层在解析后清洗并响应取消与 panic，审计层只负责记录与隔离。

```text
输入层防护（拒绝前过滤）
├── MaxInputSize        字节级大小上限（默认 50MB）
├── MaxDepth            DOM 嵌套深度上限（默认 500，防栈溢出）
├── ProcessingTimeout   单文档处理超时（默认 30s）
├── 路径遍历检测         文件路径中的 .. 组件
└── AllowedBaseDir      文件读取沙箱（OS 句柄解析，防 symlink/junction）

处理层防护（清洗与取消）
├── HTML 清洗           标签 / 属性 / URL / CSS 多维过滤
├── 协作式 context 取消  ExtractWithContext 响应 ctx.Done()
├── Panic 恢复          recoverPanic 泛型包装，返回 ErrInternalPanic
└── Goroutine 泄漏防护   maxTimeoutGoroutines（并发上限 1000）

审计层防护（可观测 + 隔离）
├── AuditSink panic 隔离 SEC-003（审计子系统是 best-effort）
├── 8 种审计事件         blocked_tag/blocked_attr/blocked_url/...
└── 原始值 HTML 转义      防审计日志在 SIEM 仪表盘中触发 XSS
```

:::tip 层与层之间不做耦合假设
清洗层漏过某个恶意 URL 时，输入层的 `MaxInputSize` 仍会挡住超长 payload；`AuditSink` 自己 panic 时，`recoverPanic` 仍保证主流程不崩溃。
:::

## 输入边界防护

### 输入大小限制

默认上限 50MB（`DefaultMaxInputSize`），用于阻断内存耗尽型输入。配置值另受 `maxConfigInputSize`（同为 50MB）约束，无法调到更不安全的值：

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = 10 * 1024 * 1024 // 收紧到 10MB
```

文件读取多一道**预检查**：`os.Stat` 取得大小后，在 `io.ReadAll` 载入内存之前就拒绝超限文件，避免先把整个文件读进内存再发现超限。

### DOM 深度限制

默认上限 500（`DefaultMaxDepth`），配置上限同为 500（`maxConfigDepth`）。校验采用**迭代式**遍历，不会因输入嵌套过深而耗尽调用栈：

```go
cfg.MaxDepth = 200 // 更严格
```

:::warning 深度超限有两个来源
解析器 `golang.org/x/net/html` 自身在约 512 个未闭合元素时先失败，返回 `ErrInvalidHTML`（实测 520 层 → `html: invalid HTML: open stack of elements exceeds 512 nodes`）。解析成功后才轮到库按 `MaxDepth` 判定并返回 `ErrMaxDepthExceeded`。默认值 500 与解析器阈值只差十余层，因此判定深度问题时两个哨兵错误都要检查。
:::

### 处理超时

可配置的单文档处理超时，阻断耗时随输入结构增长的文档：

```go
cfg.ProcessingTimeout = 10 * time.Second
```

超时由独立 goroutine + context deadline 实现，并受进程级计数器 `activeTimeoutGoroutines` 约束（上限 1000），防止高并发下 goroutine 无界堆积。与 `ExtractWithContext` 的调用方 context 同时存在时，两者取较早到期者，但**错误类型按触发源区分**，不做归一化：

| 触发源 | 返回错误 |
|--------|----------|
| 库内 `ProcessingTimeout` 到期（调用方 ctx 仍有效） | `ErrProcessingTimeout` |
| 调用方 ctx deadline 先到期 | `context.DeadlineExceeded`（原样透传） |
| 调用方 `cancel()` | `context.Canceled` |
| `ProcessingTimeout = 0`（不限时）且 ctx 到期 | `context.DeadlineExceeded`（库不启动超时 goroutine） |

## 内容清洗机制

清洗由 `EnableSanitization`（默认 `true`）控制，对已解析的 DOM 就地修改，移除潜在恶意内容。每次拦截都会写入审计日志（需启用审计）。

:::warning 关闭清洗的前提是输入完全可信
只有输入来自**完全可信**的内部数据时才考虑 `EnableSanitization = false`。用户上传、网页抓取、第三方 API 的 HTML 都应保持开启。
:::

### 被移除的标签

以下标签连同其子树被整段移除：

| 标签 | 移除原因 |
|------|----------|
| `<script>`、`<style>`、`<noscript>` | 脚本与样式容器，可执行代码或隐藏载荷 |
| `<iframe>`、`<embed>`、`<object>` | 外部内容嵌入，XSS 与钓鱼的常见载体 |
| `<input>`、`<button>` | 表单控件，可用于 CSRF 或 UI 伪装 |
| `<svg>` | 可内嵌 JavaScript 与事件处理器 |
| `<math>` | MathML，在部分浏览器中可被滥用执行脚本 |

:::tip `<form>` 为何刻意保留
服务端框架（ASP.NET WebForms、JSF、JSP）会把整个 `<body>` 包在单个 `<form>` 里，移除 `<form>` 会连带丢弃页面全部可见内容。文本提取既不渲染也不提交表单，针对 `<input>`/`<button>` 的 CSRF/UI 伪装理由不适用于 `<form>` 容器本身。
:::

### 被移除的属性

| 属性类别 | 检测方式 | 示例 |
|----------|----------|------|
| 事件处理器 | 前缀匹配 `on*` | `onclick`、`onerror`、`onmouseover` |
| 表单 action 覆盖 | 精确匹配 | `formaction`（可劫持表单提交目标） |
| 自动聚焦 | 精确匹配 | `autofocus`（可用于诱导点击） |

事件处理器按前缀匹配（属性名以 `on` 开头），因此覆盖所有现行与未来的 `on*` 变体，不依赖固定黑名单。

### CSS 危险模式

`style` 属性的值会检查下列危险子串，命中即**整段剥离**（当前策略是一旦命中就整体丢弃，不做属性级保留）：

- `expression(` — 旧版 IE 动态表达式
- `behavior:` — IE 行为绑定
- `-moz-binding:` — 旧版 Firefox XBL 绑定
- `javascript:` — 协议注入
- `vbscript:` — 协议注入

### 受检的 URI 属性

下列属性的值会进入 [URL 安全防护](#url-安全防护深度)管道做协议与 data URL 校验：

```text
href  src  cite  action  data  poster  background
longdesc  usemap  profile  xlink:href
```

:::tip 已被整体屏蔽的属性不重复校验
`formaction` 在「被移除的属性」中已整体屏蔽，不再进入 URI 校验管道。
:::

## URL 安全防护深度

URI 属性的值经 `isSafeURIWithAudit` 的固定管道校验。管道存在的理由只有一个：浏览器的 URL 解析比 `strings.HasPrefix` 宽松得多，下面每一步都对应一种浏览器会做、而朴素字符串比较不会做的归一化。

```text
原始 URI
  │
  ├─ 1. NFC 规范化
  ├─ 2. TrimSpace
  ├─ 3. 剥离 C0 控制符与空格
  ├─ 4. 剥离 tab/LF/CR
  ├─ 5. ToLower
  ├─ 6. 长度上限（非 data URL ≤ 2000）
  ├─ 7. 危险协议检测
  ├─ 8. 协议相对 URL 检测
  └─ 9. data URL 白名单
```

1. **NFC 规范化**：把全角与组合字符归一，`ｊａｖａｓｃｒｉｐｔ：` 这类变形无法伪装协议。
2. **首尾空白**：去掉 Unicode 空白，避免前导空格让前缀比较失效。
3. **C0 控制符与空格**：浏览器在 scheme 解析前剥掉 U+0000–U+001F，不模拟就能用 `\x01javascript:` 骗过检测。
4. **tab / LF / CR**：浏览器会把 `java\tscript:` 拼回 `javascript:` 再执行。
5. **大小写归一**：scheme 不区分大小写，`JavaScript:` 与 `javascript:` 等价。
6. **长度上限**：非 data URL 超过 2000 字符即拒绝，data URL 另有 100KB 上限。
7. **危险协议检测**：`javascript:`、`vbscript:`、`file:`，并对全角拉丁字符（U+FF01–U+FF5E）再做一次 ASCII 折叠。
8. **协议相对形式**：`//javascript:` 先去掉 `//` 与前导空白，再套用同一套协议判定。
9. **data URL 白名单**：只放行图片、字体、PDF 的显式 MIME。

顺序是这套设计的关键：所有剥离与归一都发生在协议检测之前，检测对象必须是浏览器最终会看到的形式。纯可打印 ASCII 的 URI 走快速路径，直接做协议前缀比较；含空白、控制符或非 ASCII 字节的 URI 才进入完整管道——伪装手法只可能出现在后者。

### data URL 白名单

data URL 只放行三类 MIME：

| 类别 | 允许的 MIME 类型 |
|------|------------------|
| 图片 | `image/gif`、`image/jpeg`、`image/jpg`、`image/png`、`image/webp`、`image/bmp`、`image/x-icon`、`image/vnd.microsoft.icon`、`image/avif`、`image/apng` |
| 字体 | `font/woff`、`font/woff2`、`font/ttf`、`font/otf`、`application/font-woff`、`application/font-woff2` |
| 文档 | `application/pdf` |

其余情况一律拒绝：

- **`image/svg+xml`**：SVG 可内嵌 JavaScript，是标签移除之外的补丁。
- **空媒体类型**：`data:;base64,<payload>`、`data:;,...` 这类没有声明 MIME 的形式。
- **超长 data URL**：受内部上限 100KB 约束，防止大段 base64 耗尽内存；该上限不可配置。
- **非法 base64 字符**：base64 部分逐字节校验字符集合法性。

:::tip 审计日志把 data URL 截断到 256 字符
data URL 可能含大段 base64，完整写入日志既占空间又可能泄露嵌入内容，`truncateAuditURL` 会在记录前截断。
:::

### 绕过清洗器的路径

`ExtractAllLinks` 与原始 HTML 中的 video/audio 扫描读取**未清洗**的文本，因此同样用 `containsDangerousScheme` 守卫：它复用与清洗器相同的归一管道（NFC、trim、C0 剥离、tab/LF/CR 剥离、全角折叠），两条路径执行同一套协议策略。`javascript:alert(1).mp4` 这类伪装成媒体 URL 的载荷因此被拦下。

## AllowedBaseDir 沙箱机制

通过 `ExtractFromFile` 处理来自不可信来源的文件路径时，`AllowedBaseDir` 把可读范围限制在指定目录内。实现位于 `processor.go` 的 `readContained` / `realPath` / `pathWithin`。

### 为什么需要 OS 文件句柄解析

`filepath.EvalSymlinks` **无法**解析 Windows 目录 junction 与 reparse points——这两者无需任何特权即可创建，是 Windows 上绕过路径限制的主要手段。库的做法是：

1. `os.Open()` 打开目标文件，拿到 OS 文件句柄
2. `realPath(f)` 从**已打开的句柄**解析真实磁盘路径
3. `pathWithin(realBase, realTarget)` 判定真实路径是否落在允许目录内
4. 从**同一个已验证句柄** `io.ReadAll` 读取内容

校验与读取共用同一句柄，关闭了 TOCTOU（check-time-to-use-time）窗口：校验之后、读取之前把路径替换成符号链接已不可能影响结果，读的是当初校验的那个 inode。

### 跨平台真实路径解析

| 平台 | 解析方式 | 覆盖的重定向类型 |
|------|----------|------------------|
| Linux | 读 `/proc/self/fd/<fd>` 的 link | 符号链接（race-free） |
| macOS / BSD | 读 `/dev/fd/<fd>` 的 link | 符号链接（race-free） |
| 其他 Unix | 回退 `filepath.EvalSymlinks` | 符号链接（残留轻微 TOCTOU） |
| Windows | `GetFinalPathNameByHandleW` | 符号链接 + junction + 所有 reparse points |

Windows 路径返回后剥除 `\\?\` 扩展长度前缀并 `filepath.Clean`，与 `filepath.Abs` 的输出形式一致，后续包含性比较才精确。

### 防护层次

`AllowedBaseDir` 模式下的文件读取叠加四道独立检查：

1. **路径遍历检测**：`filepath.Clean` 后检查是否含 `..` 组件
2. **OS 句柄沙箱**：`realPath` 解析真实路径，`pathWithin` 判定包含关系
3. **大小预检查**：在已验证句柄上 `os.Stat` 检查大小，超 `MaxInputSize` 在 `io.ReadAll` 前拒绝
4. **字节级上限**：读取后仍由 `validateInput` 复检字节数

`AllowedBaseDir` 约束「能读哪个文件」，`MaxInputSize` 约束「文件能多大」，两者正交、互不替代。

:::warning AllowedBaseDir 留空 = 不启用沙箱
`AllowedBaseDir` 默认为空字符串，表示**不做目录限制**（仅保留 `..` 组件检测）。文件路径来自用户输入时必须显式设置。
:::

### 配置示例

```go
cfg := html.DefaultConfig()
// 只允许读取 /var/app/uploads 及其子目录下的文件
cfg.AllowedBaseDir = "/var/app/uploads"

p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()

// 正常：文件在允许目录内
_, err = p.ExtractFromFile("/var/app/uploads/page.html")

// 被拒绝：通过 symlink/junction 指向外部
_, err = p.ExtractFromFile("/var/app/uploads/escape.txt") // 若它是 junction → /etc
```

越界访问会记录 `AuditEventPathTraversal` 审计事件，并返回包装了「path outside allowed directory」的 `*FileError`；错误中**不包含**解析出的真实路径（避免泄露文件系统布局）。

## Panic 恢复与隔离

所有公开提取方法都经 `recoverPanic[T]` 泛型函数包装，panic 被捕获并转为 `ErrInternalPanic` 错误返回，恶意输入不会崩溃调用方进程。

```go
func recoverPanic[T any](fn func() (T, error)) (result T, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("%w: %v", ErrInternalPanic, r)
		}
	}()
	return fn()
}
```

### 多层隔离边界

| 隔离边界 | 行为 | 位置 |
|----------|------|------|
| 单次提取 | panic → `ErrInternalPanic` | `extract.go` `recoverPanic` |
| 批量提取单项 | 每项独立 recover，一项 panic 不影响其他项 | `batch.go` |
| 超时 goroutine | `withTimeout` 的 worker goroutine 独立 recover | `extract.go` |
| AuditSink 写入 | sink 自身 panic 被吞掉（SEC-003） | `audit.go` `Record` |
| AuditSink 关闭 | sink.Close panic 转为 `ErrInternalPanic` 经 error 返回 | `audit.go` `Close` |
| 池化 Processor 创建 | `sync.Pool.New` panic → `ErrInternalPanic` | `processor_pool.go` |

### SEC-003：审计子系统是 best-effort

审计子系统**绝不能**把 panic 传播给公开 API 调用方。调用方传入的 `AuditSink`（手写的，或套了过滤/多路扇出器的）其 `Write()` 可能在任意路径 panic。`Record` 用 `defer recover()` 吞掉这类 panic（恢复值被丢弃——审计路径自身没有安全的上报通道）；`Close` 有 error 返回值，会把恢复值包进 `ErrInternalPanic` 返回。

自定义 `Sink` 即使 panic，也不会经由 `Close()` 或提取调用传播到调用方。

### Goroutine 泄漏防护

`withTimeout` 每次调用起一个 worker goroutine 等待 deadline。为防止高并发下无界堆积，进程级计数器 `activeTimeoutGoroutines` 把同时在等待的 goroutine 限制在 `maxTimeoutGoroutines`（1000）：超限时新请求直接返回 `ErrTooManyConcurrentOps`。

这个上限约束的是并发数，不对应固定的内存量级——Go 的 goroutine 栈按需增长，初始约 2 KB。

### 审计原始值的日志注入防护

`AuditConfig.IncludeRawValues = true` 时，审计条目会带上被阻止属性/URL 的原始值。这些值经 `sanitizeRawValue` 做 HTML 转义（`&` `<` `>` `"` `'`），防止审计日志被渲染到浏览器或 SIEM 仪表盘时触发存储型 XSS。

## 审计系统

安全事件通过审计系统记录：8 种事件类型（阻止标签、阻止属性、阻止 URL、输入违规、深度违规、超时、编码问题、路径穿越）、3 个级别（`info` / `warning` / `critical`）、7 个内置 Sink 构造函数。事件与级别的对应关系、Sink 的组合方式见[审计系统实战](./audit-pipeline)，完整签名见[审计系统参考](../../api-reference/modules/audit)。

## 安全配置决策表

| 场景 | 推荐配置 | 说明 |
|------|----------|------|
| 完全可信内部数据 | `DefaultConfig()` + 可选 `EnableSanitization = false` | 性能优先；仅在确认无外部输入时关闭清洗 |
| 用户上传 HTML | `HighSecurityConfig()` | 全面防护：收紧限制 + 完整审计 |
| 处理外部网页 | `DefaultConfig()` | 默认清洗已覆盖常见威胁 |
| 处理用户提供的文件路径 | 设 `AllowedBaseDir` | 启用 OS 句柄沙箱，防 symlink/junction 逃逸 |
| 高吞吐爬虫 | 缩减 `MaxInputSize` + 收紧 `ProcessingTimeout` | 防恶意页面拖垮 Worker |

## 高安全配置

`HighSecurityConfig()` 是一个预设，一次性收紧所有限制并启用完整审计：

```go
cfg := html.HighSecurityConfig()
// 相对 DefaultConfig() 的改动：
//   MaxInputSize      = 10MB（默认 50MB）
//   MaxDepth          = 100（默认 500）
//   ProcessingTimeout = 10s（默认 30s）
//   WorkerPoolSize    = 2（默认 4）
//   MaxCacheEntries   = 500（默认 2000）
//   CacheTTL          = 30m（默认 1h）
//   CacheCleanup      = 1m（默认 5m）
//   Audit             = HighSecurityAuditConfig()（启用 + 含原始值）
```

## 错误处理

安全违规返回哨兵错误，用 `errors.Is` 判定类别。深度问题有两个来源，下面的示例分别触发：

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

func classify(err error) {
	switch {
	case err == nil:
		return
	case errors.Is(err, html.ErrInputTooLarge):
		fmt.Println("输入过大")
	case errors.Is(err, html.ErrMaxDepthExceeded):
		fmt.Println("深度违规")
	case errors.Is(err, html.ErrInvalidHTML):
		fmt.Println("解析失败")
	case errors.Is(err, html.ErrInternalPanic):
		fmt.Println("内部 panic 已恢复")
	}
}

func main() {
	// 600 层未闭合 <div>：解析器自身在 512 个未闭合元素时先拒绝
	deep := []byte("<html><body>" + strings.Repeat("<div>", 600) + "</body></html>")
	_, err := html.Extract(deep)
	classify(err)
	// 输出：解析失败

	// 300 层低于解析器阈值，由库的迭代式深度校验按 MaxDepth 拦下
	cfg := html.DefaultConfig()
	cfg.MaxDepth = 200

	data := []byte("<html><body>" +
		strings.Repeat("<div>", 300) + "深层嵌套" + strings.Repeat("</div>", 300) +
		"</body></html>")

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	_, err = p.Extract(data)
	classify(err)
	// 输出：深度违规
}
```

:::tip 文件错误用 SafePath
对 `*FileError`，用 `SafePath()` 取得已脱敏的路径字符串，而非直接打印原始 error——避免把解析出的真实路径泄露到日志。
:::

## 下一步

- [审计系统实战](./audit-pipeline) — 8 种事件类型、内置 Sink 对比、分级路由管道
- [生产检查清单](./production-checklist) — 部署前的安全核对清单
- [API 参考：审计系统](../../api-reference/modules/audit) — 完整 API 签名
