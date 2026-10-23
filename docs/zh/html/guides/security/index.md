---
sidebar_label: "安全概述"
title: "安全概述 - CyberGo html | 安全防护总览"
description: "CyberGo html 安全防护总览：解析深度防御三层架构（输入层、处理层、审计层），涵盖 MaxInputSize 与 MaxDepth 输入边界限制、HTML 内容清洗与 URL 多层校验、路径遍历防护、AllowedBaseDir 沙箱、panic 恢复、八种审计事件及 HighSecurityConfig 高安全预设应用。"
sidebar_position: 10
---

# 安全概述

HTML 库处理的是来自互联网的不可信输入，因此在设计上将安全作为第一优先级。库内置多层独立防护机制，遵循**纵深防御**理念：每一层都假设其他层可能失效，单层被绕过不会导致整体沦陷。

本页是安全功能的总览。若你想直接动手配置审计管道或核对上线清单，跳到末尾的[下一步](#下一步)。

## 深度防御架构

库的安全防护分布在三个独立层次，每层都有自己的失败模式与恢复策略：

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
└── Goroutine 泄漏防护   maxTimeoutGoroutines（上限 1000）

审计层防护（可观测 + 隔离）
├── AuditSink panic 隔离 SEC-003（审计子系统是 best-effort）
├── 8 种审计事件         blocked_tag/blocked_attr/blocked_url/...
└── 原始值 HTML 转义      防审计日志在 SIEM 仪表盘中触发 XSS
```

:::tip 为什么强调「独立」
纵深防御的价值在于层间无耦合假设。例如即便清洗层漏过某个恶意 URL（处理层失效），输入层的 `MaxInputSize` 仍能挡住超长 payload；即便 AuditSink 自己 panic（审计层失效），`recoverPanic` 仍保证主流程不崩溃。
:::

## 输入边界防护

### 输入大小限制

默认最大输入 50MB（`DefaultMaxInputSize`），防止内存耗尽攻击。配置上限同时受 `maxConfigInputSize` 约束（同样 50MB），即无法通过配置放大到不安全值：

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = 10 * 1024 * 1024 // 收紧到 10MB
```

文件路径还有一道**预检查**：`os.Stat` 取得大小后，在 `io.ReadAll` 将内容载入内存前就拒绝超限文件，关闭「先读完再发现超限」的内存峰值窗口。

### DOM 深度限制

默认最大深度 500（`DefaultMaxDepth`），防止递归嵌套构造的栈溢出炸弹：

```go
cfg.MaxDepth = 200 // 更严格
```

深度校验采用**迭代式**遍历而非递归，本身不会因输入嵌套过深而爆栈。

### 处理超时

可配置的处理超时，防止恶意 HTML 触发指数级处理时间：

```go
cfg.ProcessingTimeout = 10 * time.Second
```

超时机制通过独立 goroutine + context deadline 实现，并受 `maxTimeoutGoroutines`（1000）上限保护，防止高并发下 goroutine 失控。配合 `ExtractWithContext` 可叠加调用方的取消信号。

## 内容清洗机制详解

清洗功能由 `EnableSanitization`（默认 `true`）控制，对已解析的 DOM 树做就地修改，移除潜在恶意内容。整个流程由 `internal/sanitize.go` 实现，每一步拦截都会写入审计日志。

:::warning 何时关闭清洗
仅当输入是**完全可信**的内部数据时才考虑 `EnableSanitization = false`。处理任何来自用户上传、网页抓取、第三方 API 的 HTML 都应保持开启。
:::

### 被移除的标签

以下标签连同其子树被整段移除：

| 标签 | 移除原因 |
|------|----------|
| `<script>`、`<style>`、`<noscript>` | 脚本与样式容器，可执行代码或隐藏载荷 |
| `<iframe>`、`<embed>`、`<object>` | 外部内容嵌入，经典 XSS 与钓鱼向量化 |
| `<input>`、`<button>` | 表单控件，可用于 CSRF 或 UI 伪装 |
| `<svg>` | 可内嵌 JavaScript 与事件处理器 |
| `<math>` | MathML，在部分浏览器中可被滥用执行脚本 |

:::tip 为什么 `<form>` 不被移除
`<form>` 标签**刻意保留**。ASP.NET WebForms、JSF、JSP 等服务端框架会把整个 `<body>` 包在单个 `<form>` 中，移除 `<form>` 会连带丢弃页面全部可见内容。文本提取场景既不渲染也不提交表单，因此对 `<input>`/`<button>` 成立的 CSRF/UI 伪装理由并不适用于 `<form>` 容器本身。
:::

### 被移除的属性

| 属性类别 | 检测方式 | 示例 |
|----------|----------|------|
| 事件处理器 | 前缀匹配 `on*` | `onclick`、`onerror`、`onmouseover` |
| 表单 action 覆盖 | 精确匹配 | `formaction`（可劫持表单提交目标） |
| 自动聚焦 | 精确匹配 | `autofocus`（可用于钓鱼诱导点击） |

事件处理器的检测采用前缀匹配（属性名以 `on` 开头），因此能覆盖所有现行与未来的 `on*` 变体，而非依赖固定黑名单。

### CSS 危险模式

`style` 属性的值会检测以下危险子串，命中则**整段 style 被剥离**（保留安全的 CSS 属性用于元数据提取需要单独评估，当前策略是一旦危险即整体丢弃）：

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

:::tip 已被完全阻止的属性不再重复校验
`formaction` 因在「被移除的属性」中已被整体屏蔽，不再进入 URI 校验管道——避免对同一属性做冗余检查。
:::

## URL 安全防护深度

URI 属性的值经由 `isSafeURIWithAudit` 的多层管道校验。每一层都对应一类已知的浏览器解析行为或攻击绕过手法，缺一不可。

### 多层校验管道

```text
原始 URI
  │
  ├─ 1. NFC 规范化           归一全角/组合字符
  ├─ 2. TrimSpace            去首尾空白
  ├─ 3. 剥离 C0 控制符 + 空格   去首尾 U+0000–U+001F 及空格
  ├─ 4. 剥离 tab/LF/CR       去 URL 内部的 \t \n \r
  ├─ 5. ToLower              大小写归一
  ├─ 6. 长度上限             非 data URL 受 MaxURLLength(2000) 约束
  ├─ 7. 危险协议检测          javascript: / vbscript: / file: + 全角变形
  ├─ 8. 协议相对 URL 检测     //javascript: 等
  └─ 9. data URL 白名单       仅图片/字体/PDF，阻 svg 与空 MIME
```

### Unicode 规范化（NFC）

第一步对 URI 做 NFC 规范化（`normalizeURIForSecurity`），防止用 Unicode 变形伪装危险协议：

- 全角字符 `ｊａｖａｓｃｒｉｐｔ：` 映射回 ASCII
- 组合字符、跨脚本相似字符归一为单一表示

在此之上，`isDangerousScheme` 还会对全角拉丁字符（U+FF01–U+FF5E）做一次专门的 ASCII 折叠（`normalizeFullwidthToASCII`），双重保险——即便某些浏览器/解析器把全角形式当 ASCII 处理，库也能识别。

### 空白与控制字符剥离

浏览器在解析 URL 时会剥离特定的控制字符（遵循 WHATWG URL 标准），库必须在协议检测**之前**模拟同样的剥离，否则攻击者能用这些字符拆散危险协议名绕过检测：

- **tab / LF / CR**：`java\tscript:` 会被浏览器重新拼成 `javascript:` 执行。库用 `stripURLWhitespace` 在协议检测前移除这三个字节。
- **C0 控制符（U+0000–U+001F）+ ASCII 空格**：浏览器在 scheme 解析前剥离首尾的这些字节。`strings.TrimSpace` 只覆盖 Unicode 空白，不覆盖多数 C0 控制符，所以库用专门的 `c0ControlOrSpace` 集合显式剥离。否则 `\x01javascript:…` 能骗过所有 `strings.HasPrefix` 检测。

### 危险协议检测

| 协议 | 阻止方式 |
|------|----------|
| `javascript:` | 直接匹配 + 全角字符归一 |
| `vbscript:` | 同上 |
| `file:` | 同上（访问本地文件系统） |
| `//javascript:`、`//vbscript:`、`//data:`、`//file:` | 协议相对形式单独检测 |

协议相对形式（以 `//` 开头）的检测会先剥离 `//` 后的前导空白，再套用同样的危险协议判定，确保 `// javascript:` 这类变体无法绕过。

### data URL 白名单

data URL 仅允许下列显式声明的 MIME 类型通过：

| 类别 | 允许的 MIME 类型 |
|------|------------------|
| 图片 | `image/gif`、`image/jpeg`、`image/jpg`、`image/png`、`image/webp`、`image/bmp`、`image/x-icon`、`image/vnd.microsoft.icon`、`image/avif`、`image/apng` |
| 字体 | `font/woff`、`font/woff2`、`font/ttf`、`font/otf`、`application/font-woff`、`application/font-woff2` |
| 文档 | `application/pdf` |

明确阻止：

- **`image/svg+xml`**：SVG 可内嵌 JavaScript，作为标签移除后的纵深防御补丁。
- **空媒体类型**：如 `data:;base64,<payload>` 或 `data:;,...`。这类形式曾经能绕过白名单，现在直接拒绝。
- **超长 data URL**：受内部上限（100KB）约束，防止 base64 大块内容耗尽内存（该上限不可配置）。
- **非法 base64 字符**：base64 部分会逐字节校验字符集合法性。

:::tip 审计日志会截断 data URL
data URL 可能含大段 base64，完整写入审计日志既浪费空间又可能泄露嵌入的敏感内容。审计记录会通过 `truncateAuditURL` 截断到 256 字符。
:::

### 绕过清洗器的路径

少数代码路径（如 `ExtractAllLinks`、原始 HTML 中的 video/audio 扫描）会读取**未清洗**的 HTML。这些路径通过 `containsDangerousScheme` 守卫——它复用与清洗器完全相同的归一管道（NFC、trim、C0 剥离、tab/LF/CR 剥离、全角折叠），确保两条路径执行的是**同一套协议策略**，不会出现清洗器拦截、而此处放行的不一致。

例如 `javascript:alert(1).mp4` 这类伪装成媒体 URL 的载荷，因为首字符 `j` 是字母曾能混过简单校验，现在会被 `containsDangerousScheme` 拦下。

## AllowedBaseDir 沙箱机制

当通过 `ExtractFromFile` 处理来自不可信来源的文件路径时，`AllowedBaseDir` 把可读范围限制在指定目录内。该机制由 `processor.go` 的 `readContained` / `realPath` / `pathWithin` 实现。

### 为什么需要 OS 文件句柄解析

普通的 `filepath.EvalSymlinks` **无法**解析 Windows 目录 junction 与 reparse points——而这两者无需任何特权即可创建，是 Windows 上绕过路径限制的主要手段。库的做法是：

1. `os.Open()` 打开目标文件，拿到 OS 文件句柄
2. `realPath(f)` 从**已打开的句柄**解析真实磁盘路径
3. `pathWithin(realBase, realTarget)` 判定真实路径是否落在允许目录内
4. 从**同一个已验证句柄** `io.ReadAll` 读取内容

从同一句柄做校验和读取，关闭了 TOCTOU（check-time-to-use-time）竞态窗口——校验之后、读取之前路径被替换成符号链接已不可能影响结果，因为读的是当初校验的那个 inode。

### 跨平台真实路径解析

| 平台 | 解析方式 | 覆盖的重定向类型 |
|------|----------|------------------|
| Linux | 读 `/proc/self/fd/<fd>` 的 link | 符号链接（race-free） |
| macOS / BSD | 读 `/dev/fd/<fd>` 的 link | 符号链接（race-free） |
| 其他 Unix | 回退 `filepath.EvalSymlinks` | 符号链接（残留轻微 TOCTOU） |
| Windows | `GetFinalPathNameByHandleW` | 符号链接 + junction + 所有 reparse points |

Windows 路径返回后会剥除 `\\?\` 扩展长度前缀并 `filepath.Clean`，使其与 `filepath.Abs` 的输出形式一致，确保后续包含性比较精确。

### 防护层次

`AllowedBaseDir` 模式下的文件读取叠加了四道独立检查：

1. **路径遍历检测**：`filepath.Clean` 后检查是否含 `..` 组件
2. **OS 句柄沙箱**：`realPath` 解析真实路径，`pathWithin` 判定包含关系
3. **大小预检查**：在已验证句柄上 `os.Stat` 检查大小，超 `MaxInputSize` 在 `io.ReadAll` 前拒绝
4. **字节级上限**：读取后仍由 `validateInput` 复检字节数

即便文件位于允许目录内，`AllowedBaseDir` 约束的是「能读哪个文件」，`MaxInputSize` 约束的是「文件能多大」，两者正交、互不替代。

:::warning AllowedBaseDir 留空 = 不启用沙箱
`AllowedBaseDir` 默认为空字符串，表示**不做目录限制**（仅保留 `..` 遍历检测）。只要你的文件路径来自用户输入，就应当显式设置它。
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
result, err := p.ExtractFromFile("/var/app/uploads/page.html")

// 被拒绝：通过 symlink/junction 指向外部
_, err = p.ExtractFromFile("/var/app/uploads/escape.txt") // 若它是 junction → /etc
```

被拒绝的越界访问会记录 `AuditEventPathTraversal` 审计事件，并返回包装了「path outside allowed directory」的 `*FileError`，错误中**不包含**解析出的真实路径（避免泄露文件系统布局）。

## 恐慌恢复与隔离

所有公开提取方法都经 `recoverPanic[T]` 泛型函数包装，panic 被捕获并转为 `ErrInternalPanic` 错误返回，保证恶意输入不会崩溃调用方进程。

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

审计子系统**绝不能**把 panic 传播给公开 API 调用方。用户传入的 `AuditSink`（可能是手写的、可能套了过滤/多路扇出器）其 `Write()` 可能在任意路径 panic。`Record` 用 `defer recover()` 吞掉这类 panic（恢复值被丢弃——审计路径自身没有安全的上报通道）；`Close` 因为有 error 返回值，会把恢复值包进 `ErrInternalPanic` 返回。

这意味着即便你的自定义 Sink 有 bug，`defer processor.Close()` 这一惯用法也不会引爆进程。

### Goroutine 泄漏防护

`withTimeout` 每次调用会起一个 worker goroutine 等待 deadline。为防止高并发下 goroutine 失控，全局计数器 `activeTimeoutGoroutines` 限制并发上限为 `maxTimeoutGoroutines`（1000）。超限时新请求直接返回 `ErrTooManyConcurrentOps`，而不是无限堆积 goroutine（按每 goroutine ~1MB 栈估算，1000 ≈ 1GB 上限）。

### 审计原始值的日志注入防护

当 `AuditConfig.IncludeRawValues = true` 时，审计条目会带上被拦截属性/URL 的原始值。这些值经 `sanitizeRawValue` 做 HTML 转义（`&` `<` `>` `"` `'`），防止当审计日志被渲染到浏览器或 SIEM 仪表盘时触发存储型 XSS。

## 审计系统

安全事件通过审计系统记录，支持 8 种事件类型、多个内置 Sink 与级别过滤。完整配置见[审计系统实战](./audit-pipeline)。

| 事件 | 说明 |
|------|------|
| `AuditEventBlockedTag` | 被阻止的 HTML 标签 |
| `AuditEventBlockedAttr` | 被阻止的属性 |
| `AuditEventBlockedURL` | 被阻止的 URL |
| `AuditEventInputViolation` | 输入大小违规 |
| `AuditEventDepthViolation` | DOM 深度违规 |
| `AuditEventPathTraversal` | 路径遍历尝试（含 AllowedBaseDir 越界） |
| `AuditEventTimeout` | 处理超时 |
| `AuditEventEncodingIssue` | 编码异常 |

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
// 自动设置：
//   MaxInputSize      = 10MB（默认 50MB）
//   MaxDepth          = 100（默认 500）
//   ProcessingTimeout = 10s（默认 30s）
//   WorkerPoolSize    = 2（默认 4）
//   Audit             = HighSecurityAuditConfig()（启用 + 含原始值）
```

## 错误处理

所有安全违规都返回明确的哨兵错误，支持 `errors.Is` 判定类别：

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><body>恶意构造的超深嵌套</body></html>`)
	_, err := html.Extract(data)
	if err != nil {
		switch {
		case errors.Is(err, html.ErrInputTooLarge):
			// 输入超限，记录并拒绝
			fmt.Println("输入过大")
		case errors.Is(err, html.ErrMaxDepthExceeded):
			// 可能是递归炸弹
			fmt.Println("深度违规")
		case errors.Is(err, html.ErrInternalPanic):
			// panic 已恢复，应排查输入与上报
			fmt.Println("内部 panic 已恢复")
		}
	}
	// 输出：深度违规（示例，实际取决于输入）
}
```

:::tip 文件错误用 SafePath
对 `*FileError`，用 `SafePath()` 取得已脱敏的路径字符串，而非直接打印原始 error——避免把解析出的真实路径泄露到日志。
:::

## 下一步

- [审计系统实战](./audit-pipeline) — 8 种事件类型、内置 Sink 对比、分级路由管道
- [生产检查清单](./production-checklist) — 部署前的安全核对清单
- [API 参考：审计系统](../../api-reference/modules/audit) — 完整 API 签名
