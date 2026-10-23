---
sidebar_label: "扩展概述"
title: "扩展接口 - CyberGo JSON | Hook 钩子与自定义编码"
description: "CyberGo JSON 扩展接口概览：Hook 钩子系统在 Get/Set/Delete 操作前后拦截，落地日志、计时、校验与审计，支持装配期 Config.Hooks 与运行期 AddHook 两种注册；自定义编码经 MarshalJSON、MarshalText 与 CustomEscapes 三条通道生效。"
sidebar_position: 10
---

# 扩展概述

json 库提供两类互补的扩展接口：**Hook 钩子系统**在操作流程中插入自定义逻辑，**自定义编码**决定类型编码为 JSON 时的形态。两者可独立使用，也可叠加——例如用钩子审计写操作、用 `MarshalJSON` 定制同一份数据的输出格式。

## Hook 钩子系统

Hook 拦截 `Get`/`Set`/`Delete` 全流程（含包级封装；`Encode`/`Marshal` 路径暂不触发），在操作**前后**各触发一次，适合日志、计时、输入校验与审计：

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 运行期注册：一行接入日志钩子
p.AddHook(json.LoggingHook(slog.Default()))
```

注册途径有两种：**装配期**经 `Config.Hooks` 在构造时装载，或**运行期**经 `Processor.AddHook` 随时追加。除内置的 `LoggingHook`/`TimingHook`/`ValidationHook`/`ErrorHook` 工厂外，实现 `Hook` 接口即可完全自定义。

触发点细节、执行顺序与 panic 保护见 [Hook 钩子系统](./hooks)。

## 自定义编码

改变「某个类型编码成什么 JSON」有三条**当前版本实际生效**的通道：

| 通道 | 适用场景 |
|------|----------|
| 实现 `json.Marshaler`（`MarshalJSON`） | 类型完全决定自己的 JSON 形态 |
| 实现 `encoding.TextMarshaler`（`MarshalText`） | 以文本表达形态，编码为 JSON 字符串 |
| `Config.CustomEscapes` | 全局改写某些字符的转义 |

::: warning Config.CustomEncoder 已废弃
`Config.CustomEncoder` 与 `Config.CustomTypeEncoders` **已废弃**：已声明但从未接入编码流水线，当前设置不会改变输出（v1 生命周期内保留）；请使用上表三条通道。
:::

三条通道的完整示例与选型建议见[自定义编码器](./custom-encoder)。

## 相关

- [Hook 钩子系统](./hooks) — 拦截、监控与审计
- [自定义编码器](./custom-encoder) — MarshalJSON / MarshalText / CustomEscapes
- [接口定义](../api-reference/interfaces) — Hook、Marshaler 等接口签名
