---
title: "错误处理 - CyberGo HTML | 健壮错误处理指南"
description: "CyberGo HTML 错误处理指南：五类错误分类、errors.Is 哨兵判断、errors.As 结构化提取、context 取消与批量部分失败处理，构建健壮逻辑。"
---

# 错误处理

## 错误分类

HTML 库的错误分为以下几类：

| 类别 | 哨兵错误 | 说明 |
|------|----------|------|
| 输入错误 | `ErrInputTooLarge`, `ErrInvalidHTML` | 输入内容问题 |
| 配置错误 | `ErrInvalidConfig`, `ErrMultipleConfigs` | 配置问题 |
| 文件错误 | `ErrFileNotFound`, `ErrInvalidFilePath` | 文件操作问题 |
| 处理错误 | `ErrProcessingTimeout`, `ErrMaxDepthExceeded` | 处理过程问题 |
| 系统错误 | `ErrProcessorClosed`, `ErrInternalPanic` | 内部状态问题 |

## errors.Is 模式

使用 `errors.Is` 判断错误类型：

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        slog.Warn("输入过大，请减小文档大小")
    case errors.Is(err, html.ErrInvalidHTML):
        slog.Warn("无效 HTML，请检查输入")
    case errors.Is(err, html.ErrProcessingTimeout):
        slog.Warn("处理超时，文档可能过于复杂")
    case errors.Is(err, html.ErrFileNotFound):
        slog.Warn("文件不存在")
    case errors.Is(err, html.ErrMaxDepthExceeded):
        slog.Warn("DOM 深度过深，可能是恶意构造")
    case errors.Is(err, html.ErrInternalPanic):
        slog.Error("内部恐慌恢复，请报告此问题")
    default:
        slog.Error("未知错误", "err", err)
    }
}
```

## errors.As 模式

提取结构化错误信息：

```go
var inputErr *html.InputError
var configErr *html.ConfigError
var fileErr *html.FileError

if errors.As(err, &inputErr) {
    fmt.Printf("大小 %d 超过限制 %d\n", inputErr.Size, inputErr.MaxSize)
}

if errors.As(err, &configErr) {
    fmt.Printf("字段 %s 值 %v 无效: %s\n", configErr.Field, configErr.Value, configErr.Message)
}

if errors.As(err, &fileErr) {
    fmt.Printf("文件操作: %s\n", fileErr.SafePath())
}
```

## 上下文取消

使用 `WithContext` 版本支持取消：

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
        // 超时
    } else if ctx.Err() == context.Canceled {
        // 手动取消
    }
}
```

## 批量错误

批量处理的结果包含部分成功和部分失败：

```go
batch := p.ExtractBatch(pages)

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("第 %d 项失败: %v\n", i, err)
    }
}

fmt.Printf("成功: %d, 失败: %d, 取消: %d\n",
    batch.Success, batch.Failed, batch.Cancelled)
```
