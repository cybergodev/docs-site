---
sidebar_label: "TLS 指纹"
title: "TLS 指纹 - CyberGo HTTPC | 浏览器伪装与 JA3/JA4"
description: "HTTPC TLS 指纹配置指南：Security.TLSFingerprint 与包级 WithTLSFingerprint 的浏览器预设矩阵、JA3/JA4 与 HTTP/2 帧观测点、每连接随机化、头部与重定向一致性，以及证书固定与已知限制。"
sidebar_position: 105
---

# TLS 指纹（浏览器伪装）

`Security.TLSFingerprint` 是浏览器指纹仿真开关，用于替换 HTTPC 的传输层。启用后同时覆盖三类观测点：

- TLS ClientHello（**JA3/JA4**）
- HTTP/2 帧：SETTINGS 顺序与值、连接窗口、初始流 ID、伪头顺序
- 有序头块：浏览器原样大小写，以及与版本匹配的 User-Agent

传输层之上的一切保持 HTTPC 语义不变：重定向、重试、中间件、流式下载与 Cookie 处理照常工作。

## 快速上手

客户端级——同一客户端的所有请求共用一个预设：

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSFingerprint = "chrome-latest" // 或 "chrome-windows"、"firefox-latest"…
client, err := httpc.New(cfg)
```

`TLSFingerprint` 留空（默认）则走标准 Go 栈，不引入额外依赖、无伪装。

包级——把单次调用路由到指纹客户端，无需自建 Client：

```go
result, err := httpc.Get("https://example.com",
    httpc.WithTLSFingerprint("chrome-windows"))
```

`WithTLSFingerprint` 是包级**路由选项**。`httpc.Get/Post/Request/Download/...` 提取该选项，把本次调用交给专用的指纹客户端，默认客户端与其他在途请求不受影响。要点：

- 仅包级函数有效：在 client 实例上使用会返回错误，实例上改用 `Config.Security.TLSFingerprint`
- 未知预设使请求以 `ErrInvalidSecurity` 失败
- 路由客户端按**规范化预设名**缓存：预设名匹配大小写不敏感，`chrome` 与其大写拼法共享同一客户端。路由客户端基于 `DefaultConfig()` 构建，继承默认客户端的全部安全默认值（SSRF 防护、TLS、超时、重试）
- `httpc.CloseRoutedClients()` 关闭并释放全部缓存的路由客户端

## 预设清单

预设名由「浏览器版本 + 可选 OS 后缀」组成，大小写不敏感：

| 浏览器 | 基础 / latest / 版本固定 | OS 后缀 | 说明 |
|--------|--------------------------|---------|------|
| Chrome | `chrome` / `chrome-latest` / `chrome-155` / `chrome-152` | `-windows` / `-macos` / `-linux` / `-android` / `-ios` | `chrome-152` 为已退役大版本的固定 pin |
| Firefox | `firefox` / `firefox-latest` / `firefox-158` / `firefox-148` | `-windows` / `-macos` / `-linux` / `-android` / `-ios` | `firefox-148` 为已退役大版本的固定 pin |
| Safari（iOS） | `safari-ios`（= `ios-safari-latest`） | — | iOS 上 Safari 本体，与其它 iOS 预设共用同一套已验证 WebKit 数据 |
| 遗留别名 | `android-chrome-latest` / `ios-chrome-latest` | — | 旧版复合别名，仍可用 |

> **无桌面 Safari 预设**：macOS Safari 的 ClientHello 与 iOS 不同，目前尚无已验证数据。
>
> iOS 预设（`*-ios`，含 `safari-ios`）使用真实 WebKit 数据（Safari 26.3 的 TLS 与 HTTP/2，经在线逐字节验证），但常规头顺序仍为桌面近似值。Android 预设（`*-android`）发出的是桌面指纹字节，属于等待真实设备抓包的占位实现。

预设匹配大小写不敏感，容忍首尾空白（`"  FireFox "` 合法）。`safari`（无 `-ios` 后缀）与清单之外的版本号（如 `chrome-153`）均为非法预设，校验直接拒绝。

## 作用范围

指纹伪装针对**传输层**：TLS、HTTP/2 组帧、有序头块。启用后，这三层在被动观测（JA3/JA4、HTTP/2 指纹、头顺序）下与被仿浏览器不可区分。它**不**复现浏览器侧 JavaScript 或行为信号，纯 HTTP 客户端无法做到这一点。

因此指纹伪装不能替代真实浏览器，也不能替代站点要求验证码或挑战式校验时的合法解决步骤。

预设是某个浏览器构建版本的快照，会随浏览器发版而过时。每周 CI 任务（`.github/workflows/fingerprint-drift.yml`）监测漂移。

## 行为要点

- **头部集是权威的**：预设用浏览器档案值替换同名请求头（User-Agent、Accept、Accept-Language 等），使线上数据与伪造的 ClientHello 自洽。自定义头原样透传。在此路径上，显式设置的 User-Agent **不会**覆盖预设。头名按浏览器自身大小写写出（`sec-ch-ua*` 小写，其余 Title-Case），HTTP/1.1 与 HTTP/2 一致。`Result.Request.Headers` 报告的是这些线上头（浏览器 UA 与大小写），而非引擎侧默认值（如 `httpc/1.0`）。
- **协议由 ALPN 决定**：服务端协商 HTTP/2 则使用 HTTP/2，只支持 HTTP/1.1 则使用 HTTP/1.1，从不重放请求，两种协议之间没有手动回退。**从不尝试 HTTP/3**：QUIC 连接使用独立的 TLS 栈，会绕过 `CertificatePinner`，丢失 pin 的代价高于抢占新协议。`Connection.EnableHTTP2=false` 把路径固定在 HTTP/1.1，并改写 ClientHello 的 ALPN 列表以匹配。
- **代理照常工作**：代理池、轮换与熔断继续生效（HTTP、HTTPS、SOCKS5/5h）。明文目标经 HTTP 代理走 CONNECT 隧道。HTTPS 代理只走 HTTP/1.1 CONNECT，其证书按系统根与代理主机名验证（`Security.InsecureSkipVerify` 可退出该验证，与标准传输一致）。代理固定在各连接池上：轮换选择不同的池，从不重指一个存活的池。
- **重定向自洽**：每一跳按浏览器方式修正首跳值。`sec-fetch-site` 依据上一跳 URL 重算（`same-origin`/`same-site`/`cross-site`），`sec-fetch-user` 在首跳后丢弃。301/302/303 把 fetch 型请求降级为 GET 时保留 fetch 型头，不切换为导航型头。
- **证书固定可用**：`CertificatePinner` 在每次指纹握手时运行（见 [TLS 与证书固定](../security/tls-certpin)）。`Security.TLSConfig` 与该字段互斥，自定义 `tls.Config` 无法塑造伪造的 ClientHello。
- **TLS 元数据照常可读**：指纹路径把 uTLS 连接状态逐字段转换为标准库 `tls.ConnectionState`（密码套件、ALPN 协商协议、对端证书链、是否 PSK 恢复等），读取方式与标准路径一致，指纹路径不是 TLS 元数据盲区。
- **解压**：指纹档案通告 `gzip, deflate, br, zstd`，指纹栈全部解码（保留流式）后以 identity 体交给引擎。引擎看不到原始 `Content-Encoding`，因此解码流由 `MaxResponseBodySize` 封顶，`MaxDecompressedBodySize` 在此路径不生效。多 token `Content-Encoding` 链按 RFC 9110 逆序解码（最后应用的编码最先解码）。`deflate` 同时接受 zlib 包装与裸 deflate 流，按头部嗅探区分。未知 `Content-Encoding` 直接报错，不返回压缩字节。
- **SSRF 防护**：直连经校验解析器拨号：解析一次，过滤到 SSRF 允许的 IP，再拨号已验证的 IP 字面量，从不拨主机名。这与标准传输的拨号层保证相同，无 TOCTOU 窗口，无混合记录放行。请求时预检在每跳重复执行，在拨号前拦截被阻止目标。经代理时目标无法被 pin（由代理解析），预检即实际执行点，与标准路径的代理目标校验采用同一规则和同一「信任代理」残留。

## 会话恢复

Chrome 预设按连接池缓存 TLS 会话票据，以 PSK 恢复重复连接，行为与真实浏览器再次访问同一主机相同（已在 `session_resumption_test.go` 在线验证）。

ClientHello 不带 `pre_shared_key` 扩展的档案（Firefox、iOS WebKit 档案）始终完整握手。设 `Security.TLSFingerprintDisableSessionTickets` 可强制每次连接都完整握手。

## 每连接随机化

Chrome 档案在每次握手时构建全新的 ClientHello 规格，并施加两类**每连接**变换：

- **扩展顺序 shuffle**：扩展列表按 Chrome 自身的方式重新洗牌，真实 Chrome 的扩展顺序本就逐连接变化
- **GREASE 重新随机**：`signature_algorithms` 列表中的 GREASE 值每连接从 16 个 GREASE 码点中重新抽取

因此同一客户端发出的相邻连接 ClientHello **并非字节相同**，与真实浏览器一致。Firefox 档案使用 uTLS 内建 hello，同样每次连接重新构建。两类变换各自只作用于本次握手的副本，连接之间互不可见。

## 已知限制

- 指纹连接不计入连接池指标，且跳过 `Connection.EnableDoH`（后端自行解析 DNS）。
- 指纹路径的传输层参数**固定不可调**：空闲连接超时 20s、读空闲超时 10s、HTTP/2 PING 超时 10s。连接池为 `MaxIdleConns` 512、`MaxIdleConnsPerHost` 128、`MaxConnsPerHost` 128。`Connection.MaxIdleConns` 与 `Connection.MaxConnsPerHost` 只作用于标准传输。请求级超时不受影响，仍由引擎的 deadline 预算管辖，传输层自身不设超时。
- Android 预设（`*-android`）发出桌面指纹字节（等待真实设备抓包）。iOS 预设使用真实 WebKit 数据，但头顺序仍为桌面近似。

## 依赖说明

指纹数据内置于本库（`internal/fingerprint`）。HTTPC 自行构建 ClientHello 规格、HTTP/2 SETTINGS 序列与头表，经 profile API 交给 [`bogdanfinn/tls-client`](https://github.com/bogdanfinn/tls-client)。因此一个档案可以指向早于任何上游发布的浏览器构建。

传输本身（uTLS 握手、HTTP/2 组帧、头顺序与大小写）来自该库。

[`andybalholm/brotli`](https://github.com/andybalholm/brotli) 与 [`klauspost/compress`](https://github.com/klauspost/compress)（zstd）负责解码。

档案数据最初移植自 [`enetx/surf`](https://github.com/enetx/surf)（MIT），HTTPC 不依赖该客户端库本身。

Chrome 152–156 共享同一 ClientHello，各版本仅 UA 与 brand 字符串不同。因此退役 pin `chrome-152` 与 `chrome-155` 的 TLS 指纹一致，差异只在 HTTP 层头。

## 下一步

- [代理与代理池](./proxy) - 指纹路径代理照常工作：池轮换、CONNECT 隧道与 SOCKS5
- [TLS 与证书固定](../security/tls-certpin) - 证书固定与 mTLS，及其在指纹路径的协作
- [安全概述](../security/) - 全部安全特性的纵深防御地图
- [配置 API](../api-reference/client-config/config) - `SecurityConfig.TLSFingerprint` 字段参考
- [请求选项](../api-reference/core/options#withtlsfingerprint) - 包级 `WithTLSFingerprint` 路由选项
