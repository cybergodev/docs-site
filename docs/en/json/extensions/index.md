---
sidebar_label: "Extensions Overview"
title: "Extension Interfaces - CyberGo JSON | Hooks & Encoding"
description: "CyberGo JSON extensions: AddHook intercepts Get/Set/Delete for logging, validation and audit; custom encoding via MarshalJSON, MarshalText and CustomEscapes."
sidebar_position: 10
---

# Extensions Overview

The json library offers two complementary extension points: the **hook system** inserts custom logic into the operation flow, while **custom encoding** decides how types shape their JSON output. They work independently or together — e.g. audit writes with a hook while customizing output format with `MarshalJSON`.

## Hook System

Hooks intercept the full `Get`/`Set`/`Delete` flow (package-level wrappers included; `Encode`/`Marshal` paths do not trigger yet), firing before and after each operation — a natural fit for logging, timing, input validation, and audit:

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Runtime registration: attach a logging hook in one line
p.AddHook(json.LoggingHook(slog.Default()))
```

There are two registration routes: at **assembly time** via `Config.Hooks` (loaded at construction), or at **runtime** via `Processor.AddHook`. Beyond the built-in `LoggingHook`/`TimingHook`/`ValidationHook`/`ErrorHook` factories, implement the `Hook` interface for full control.

For trigger points, ordering, panic protection, and more, see the [Hook System](./hooks) page.

## Custom Encoding

Three channels **actually take effect in the current version** for changing "what JSON a type encodes to":

| Channel | Use case |
|---------|----------|
| Implement `json.Marshaler` (`MarshalJSON`) | A type fully controls its own JSON shape |
| Implement `encoding.TextMarshaler` (`MarshalText`) | Textual representation, encoded as a JSON string |
| `Config.CustomEscapes` | Globally rewrite the escaping of certain characters |

::: warning Config.CustomEncoder is deprecated
`Config.CustomEncoder` and `Config.CustomTypeEncoders` are **deprecated**: declared but never wired into the encoding pipeline, setting them does not change output today (kept within v1). Use the three channels above instead.
:::

For complete examples and selection guidance, see [Custom Encoder](./custom-encoder).

## See Also

- [Hook System](./hooks) — interception, monitoring, and audit
- [Custom Encoder](./custom-encoder) — MarshalJSON / MarshalText / CustomEscapes
- [Interface Definitions](../api-reference/interfaces) — signatures for Hook, Marshaler, and more
