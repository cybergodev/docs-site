---
sidebar_label: "TLS 与证书固定"
title: "TLS 与证书固定 - CyberGo HTTPC | 加密与证书固定"
description: "HTTPC TLS 与证书固定指南：TLS 1.2-1.3 版本控制、SPKI 哈希生成步骤与密钥轮换、三种 Pinner 构造器对比、自定义 CertificatePinner、mTLS 双向认证、自定义 CA 证书与 Let's Encrypt 短周期证书固定策略。"
sidebar_position: 30
---

# TLS 与证书固定

TLS 配置决定握手时使用的协议版本与密码套件，证书固定在此之上增加对端身份的额外校验。本页说明版本控制、套件注入规则、三种 Pinner 构造器与密钥轮换。

## TLS 版本控制

HTTPC 默认要求 TLS 1.2+，拒绝不安全的 TLS 1.0/1.1。推荐 TLS 1.3，以获得更强的前向保密与更简的握手：

```go
cfg := httpc.DefaultConfig()
cfg.Security.MinTLSVersion = tls.VersionTLS12  // 默认
cfg.Security.MaxTLSVersion = tls.VersionTLS13  // 默认
```

版本值遵循两条规则：字段为 `0` 时回退 TLS 1.2/1.3（显式置 0 与不设置等效）；`MinTLSVersion > MaxTLSVersion` 无法通过 `httpc.New()` 的配置校验，启动期即报错。

### 版本说明

| 版本 | 状态 | HTTPC 默认 |
|------|------|-----------|
| TLS 1.0 | 不安全，已弃用（POODLE/BEAST） | 拒绝 |
| TLS 1.1 | 不安全，已弃用 | 拒绝 |
| TLS 1.2 | 安全 | 最低要求 |
| TLS 1.3 | 最安全，推荐（强制前向保密） | 支持 |

:::tip
需要强制仅 TLS 1.3 时（更高安全要求、更简握手），设置 `MinTLSVersion = tls.VersionTLS13`。部分旧客户端与代理不支持 TLS 1.3，启用前确认目标服务兼容。
:::

:::warning
设置 `SecurityConfig.TLSConfig` 后，`MinTLSVersion` 与 `MaxTLSVersion` **被忽略**，以 `TLSConfig` 中的设置为准。在自定义 `TLSConfig` 中控制版本需设置其 MinVersion / MaxVersion 字段。
:::

## 密码套件

默认配置仅允许安全的密码套件（强制前向保密的 ECDHE 系列、AEAD 加密）：

| 密码套件 | 说明 |
|----------|------|
| `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256` | 推荐 |
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | 推荐 |
| `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305` | 推荐 |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` | 推荐 |
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` | 推荐 |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305` | 推荐 |

TLS 1.3 的密码套件由协议自动协商，不受 CipherSuites 字段控制。

上述套件仅在未设置自定义 `TLSConfig` 时生效（由 HTTPC 构建 transport 时注入，见 `internal/connection/pool.go` 的 `createTLSConfig`）。

同时注入的还有：椭圆曲线偏好（X25519 / P-256 / P-384）、`RenegotiateNever`（禁止重协商）、会话票证 LRU 缓存（256 条，减少重复握手开销）。设置 `TLSConfig` 后以自定义配置为准。

## 自定义 TLS 配置

需要细粒度控制（自定义 CA、mTLS、固定密码套件）时，设置 `SecurityConfig.TLSConfig`：

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    MinVersion: tls.VersionTLS13,  // 强制 TLS 1.3
    // 其他自定义配置
}
```

### 自定义 CA 证书

连接内部 CA 签发的服务（企业内部 PKI、自签名证书）时，加载自定义根证书：

```go
package main

import (
	"crypto/tls"
	"crypto/x509"
	"log"
	"os"

	"github.com/cybergodev/httpc"
)

func main() {
	caCert, err := os.ReadFile("custom-ca.pem")
	if err != nil {
		log.Fatal(err)
	}
	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		log.Fatal("无法解析 CA 证书")
	}

	cfg := httpc.DefaultConfig()
	cfg.Security.TLSConfig = &tls.Config{
		RootCAs:    caCertPool,
		MinVersion: tls.VersionTLS12,
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()
	log.Println("自定义 CA 客户端已就绪")
}
```

### 双向 TLS (mTLS)

服务端要求客户端证书（mTLS）时，配置 Certificates 字段：

```go
package main

import (
	"crypto/tls"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cert, err := tls.LoadX509KeyPair("client-cert.pem", "client-key.pem")
	if err != nil {
		log.Fatal(err)
	}

	cfg := httpc.DefaultConfig()
	cfg.Security.TLSConfig = &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()
	log.Println("mTLS 客户端已就绪")
}
```

:::tip
mTLS 常用于零信任网络、服务网格内部认证、金融 API。服务端通过客户端证书识别调用方身份，无需额外 token。证书轮换时需同步更新 `client-cert.pem` / `client-key.pem`。
:::

## 证书固定

证书固定（Certificate Pinning）在标准证书链验证**之上**叠加一层校验：要求服务端证书链中存在已知的固定公钥或证书。可信 CA 被攻破或被胁迫签发伪造证书时，攻击者仍无法完成中间人攻击，因为其证书的公钥不匹配固定值。

### 工作原理

标准 TLS 验证：客户端信任任何由可信 CA 签发的证书。证书固定：客户端额外要求证书的公钥哈希匹配预存值。

```text
标准验证：信任 CA → 信任 CA 签发的任何证书
证书固定：信任 CA + 证书公钥必须匹配预存哈希
```

固定叠加在标准验证之上，无需设置 `InsecureSkipVerify`。HTTPC 校验已验证链中的**任意一层**证书（叶子与中间证书），固定中间证书时，叶子证书续期后固定值仍然有效。

### SPKI 哈希生成步骤

SPKI（SubjectPublicKeyInfo）哈希是最常用的固定格式（HPKP 标准）。生成步骤：

**步骤 1**：获取服务端证书（从浏览器导出，或用 openssl 获取）

```bash
# 从服务端获取证书链
openssl s_client -connect example.com:443 -showcerts < /dev/null 2>/dev/null \
  | openssl x509 -outform pem > cert.pem
```

**步骤 2**：从证书提取公钥 → DER 编码 → SHA-256 → base64

```bash
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
# 输出：YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=
```

三步分解：

| 步骤 | 命令片段 | 作用 |
|------|---------|------|
| 提取公钥 | `openssl x509 -pubkey -noout` | 从 X.509 证书提取 PEM 格式公钥 |
| DER 编码 | `openssl pkey -pubin -outform der` | PEM 公钥转为 DER（PKIX）格式 |
| 哈希编码 | `openssl dgst -sha256 -binary \| openssl enc -base64` | SHA-256 后 base64 编码 |

:::tip
推荐固定**中间证书**的 SPKI，而非叶子证书。中间证书有效期长（5-10 年），叶子证书续期（如 Let's Encrypt 90 天）时中间证书不变，固定值无需频繁更新。
:::

### SPKI 哈希固定（推荐）

`NewSPKIHashPinner` 接受一个或多个 base64 编码的 SHA-256 SPKI 哈希。提供多个哈希即支持密钥轮换，任一匹配即通过：

```go
package main

import (
	"crypto/tls"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	pinner, err := httpc.NewSPKIHashPinner(
		"YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // 当前中间证书
		"C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // 备用（密钥轮换）
	)
	if err != nil {
		log.Fatal(err)
	}

	cfg := httpc.DefaultConfig()
	cfg.Security.MinTLSVersion = tls.VersionTLS12
	cfg.Security.CertificatePinner = pinner
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()
	log.Println("证书固定客户端已就绪")
}
```

`NewSPKIHashPinner` 在哈希为空或非合法 base64 时返回错误，配置问题在启动期即暴露。校验逻辑：遍历服务端证书链每层证书，计算其 SPKI 的 SHA-256，与任一固定哈希匹配即通过。

:::tip
`CertificatePinner` 在标准 TLS 链验证**之上**叠加固定校验，无需设置 `InsecureSkipVerify`。校验对已验证链中任意一层证书生效，固定中间证书可在叶子证书续期后继续生效。
:::

### 三种 Pinner 构造器对比

HTTPC 提供三种 Pinner 构造器，适用场景不同：

| 构造器 | 输入 | 适用场景 | 推荐度 |
|--------|------|---------|--------|
| `NewSPKIHashPinner` | base64 SHA-256 SPKI 哈希 | 最常见（HPKP 格式） | 推荐 |
| `NewPublicKeyPinner` | DER 编码 PKIX 公钥 | 已持有原始公钥字节 | 便利 |
| `NewCertificatePinnerChain` | 多个 Pinner | 组合多策略/混合轮换密钥 | 高级 |

```go
// 1. SPKI 哈希（推荐，最常用）
spkiPinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=",
)

// 2. DER 公钥（已有原始公钥字节，内部计算 SHA-256）
pubPinner, err := httpc.NewPublicKeyPinner(pubKeyDER1, pubKeyDER2)

// 3. 组合多个 pinner，任一通过即接受（混合策略或不同构造器的轮换密钥）
chainPinner := httpc.NewCertificatePinnerChain(spkiPinner, pubPinner)
cfg.Security.CertificatePinner = chainPinner
```

:::warning
`NewCertificatePinnerChain` 无参数调用**不报错**，但返回的空链 Pinner 采用 fail-closed 策略：`VerifyPeerCertificate` 返回 `certificate pinning failed: no pinners configured`，即**拒绝所有连接**。

全部元素为 nil 时同样拒绝，错误为 `no pinner matched`。公开 API 文档将其描述为「accepts nothing」。构造时须传入至少一个 Pinner。
:::

### Pinner 校验细节与失败行为

固定校验语义以源码（`internal/security/certpin.go`）为准：

| 方面 | 行为 |
|------|------|
| 匹配范围 | 标准验证路径：仅遍历**已验证链**（`verifiedChains`）中的证书，任一层 SPKI 哈希命中任一固定值即通过——服务端自行附加的未验证证书不参与匹配（防 pin-stuffing：MITM 把受害者真实证书塞进自己的链也无法通过）。`InsecureSkipVerify` 路径：仅匹配**叶子证书**，固定中间证书在该模式下不生效 |
| 失败行为 | 全链无匹配 → 握手被拒，错误形如 `certificate pinning failed: no matching SPKI hash found` |
| 空证书链 | 服务端未提供证书 → `no peer certificates provided` |
| 解析容错 | 链中无法解析或密钥类型不支持的证书被跳过，不影响其余证书的匹配 |
| 构造校验 | 哈希先 `TrimSpace`；非 base64 报 `invalid base64 hash`；无有效哈希报 `at least one valid SPKI hash is required` |
| 性能 | 证书指纹 → SPKI 哈希缓存（1024 条，FIFO 淘汰：命中不续位，超限淘汰最旧 256 条），重复连接不重复解析证书 |
| 并发安全 | Pinner 内部有读写锁，可被多个 Client 共享；`Config` 深拷贝时 Pinner 按引用共享（不复制） |
| 调试描述 | `Pin()` 返回如 `spki-pins:2`、`public-key-pins:2`、`chain:[spki-pins:1,spki-pins:1]`，可写入日志 |

`NewPublicKeyPinner` 内部对每个 DER PKIX 公钥计算 SHA-256，再委托给 SPKI 哈希固定器，两者匹配语义一致；无有效公钥时报 `no valid public keys provided`。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/httpc"
)

func main() {
	// 非 base64 哈希在构造期即失败，不会等到线上握手才暴露
	_, err := httpc.NewSPKIHashPinner("!!not-base64!!")
	fmt.Println("非法哈希被拒绝：", err != nil)

	// 空白字符串 TrimSpace 后视为未提供，同样拒绝
	_, err = httpc.NewSPKIHashPinner("   ")
	fmt.Println("空哈希被拒绝：", err != nil)
	// 输出：
	// 非法哈希被拒绝：true
	// 空哈希被拒绝：true
}
```

### 与自定义 TLSConfig 的协作

设置 `Security.TLSConfig` 后，HTTPC 会 `Clone()` 自定义配置并**叠加注入** `VerifyPeerCertificate` 固定回调。RootCAs、mTLS 证书、密码套件等设置全部保留，固定校验照常生效（见 `internal/connection/pool.go` 的 `createTLSConfig`）。

:::warning
设置自定义 `TLSConfig` 后，`MinTLSVersion`/`MaxTLSVersion` 被忽略，但 `Security.InsecureSkipVerify = true` 仍然生效：HTTPC 会克隆自定义配置并把该开关单向注入（仅强制跳过；`TLSConfig` 自身设置的 `InsecureSkipVerify` 不受顶层开关影响）。
:::

### 自定义 CertificatePinner

高级场景需自定义固定策略（如固定完整证书而非公钥、动态从配置中心拉取固定值），可直接实现 `CertificatePinner` 接口：

```go
package main

import (
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"log"

	"github.com/cybergodev/httpc"
)

// fullCertPinner 固定完整证书的 SHA-256（而非公钥 SPKI）。
type fullCertPinner struct {
	pinnedHashes map[string]bool
}

func newFullCertPinner(hashes ...string) *fullCertPinner {
	m := make(map[string]bool, len(hashes))
	for _, h := range hashes {
		m[h] = true
	}
	return &fullCertPinner{pinnedHashes: m}
}

// Pin 实现 CertificatePinner 接口，返回固定值的描述（用于日志/调试）。
func (p *fullCertPinner) Pin() string {
	return "full-cert-pinner"
}

// VerifyPeerCertificate 实现 CertificatePinner 接口。
// 返回 nil 表示接受，非 nil 拒绝握手。
func (p *fullCertPinner) VerifyPeerCertificate(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
	if len(verifiedChains) == 0 || len(verifiedChains[0]) == 0 {
		return errors.New("certificate pinning failed: empty chain")
	}
	for _, cert := range verifiedChains[0] {
		sum := sha256.Sum256(cert.Raw)
		hash := base64.StdEncoding.EncodeToString(sum[:])
		if p.pinnedHashes[hash] {
			return nil // 匹配，接受
		}
	}
	return errors.New("certificate pinning failed: no matching certificate")
}

func main() {
	// 固定完整叶子证书的 SHA-256（证书续期后须更新此值）
	pinner := newFullCertPinner(
		"wert6uY/PCq3yAAbZA/wtqfzfQsTwmxnfv6I3vRz1XQ=", // 证书 Raw 的 SHA-256
	)

	cfg := httpc.DefaultConfig()
	cfg.Security.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	cfg.Security.CertificatePinner = pinner
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()
	log.Println("自定义证书固定客户端已就绪")
}
```

:::warning
实现自定义 `CertificatePinner` 时，须在标准证书链验证（`verifiedChains`）通过的基础上叠加固定校验。不可用它替代标准验证，始终保留 `InsecureSkipVerify = false`。
:::

## 多哈希与密钥轮换

`NewSPKIHashPinner` 与 `NewPublicKeyPinner` 均接受多个值，任一匹配即通过。密钥轮换依赖这一点：同时固定新旧公钥，轮换期间新旧证书均可通过，无需停机切换。

轮换流程：

1. 服务端生成新密钥对，签发新证书
2. 客户端更新固定值，**同时保留新旧哈希**：
   ```go
   pinner, _ := httpc.NewSPKIHashPinner(
       "OLD_HASH...", // 旧密钥（轮换期间保留）
       "NEW_HASH...", // 新密钥（即将启用）
   )
   ```
3. 部署客户端，确认新旧证书均可通过
4. 服务端切换到新证书
5. 观察一段时间无故障后，从固定值移除旧哈希

:::danger
证书固定失效（固定值不匹配）会使连接完全失败，且无法自动恢复。要求：
- **始终保留至少一个备份固定值**，防主密钥意外损坏
- 轮换采用「先加新、后删旧」的双窗口策略
- 建立监控，固定失败时快速回滚客户端配置
:::

## 证书固定与 Let's Encrypt

Let's Encrypt 证书有效期仅 90 天，续期频繁。直接固定叶子证书需每 90 天更新固定值，维护成本高。推荐策略：

| 固定对象 | 有效期 | 续期影响 | 推荐度 |
|---------|--------|---------|--------|
| 叶子证书 | 90 天 | 每次续期须更新固定值 | 低 |
| Let's Encrypt 中间证书 | 约 5 年 | 中间证书轮换（数年一次）才需更新 | 推荐 |
| 自有域名公钥（若自托管） | 由站点方控制 | 仅主动轮换密钥时更新 | 视情况 |

Let's Encrypt 的中间证书（如 R3、R10、R11）有效期数年，固定中间证书 SPKI 可兼顾安全与低维护成本。Let's Encrypt 轮换中间证书时提前公布，可从容更新固定值。

```go
// 固定 Let's Encrypt 中间证书（推荐）
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // 当前中间证书
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // 备用/下一轮中间证书
)
```

## 证书固定的安全考量

| 风险 | 后果 | 缓解措施 |
|------|------|---------|
| 固定值过期/不匹配 | 连接完全失败 | 多哈希 + 备份密钥 + 监控 |
| 备份密钥丢失 | 无法轮换，锁定 | 离线备份多个密钥对 |
| 固定值硬编码 | 更新需发版 | 配置中心动态加载（自定义 Pinner） |
| 仅固定一层 | 单点失效 | 固定多层（叶子 + 中间） |

:::warning
证书固定同时带来两类后果：提升对 MITM 与 CA 攻破的防御，固定失效则造成硬故障。采用前须确保：
1. 有可靠的固定值更新与分发机制
2. 监控固定失败率，设告警
3. 保留应急「关闭固定」开关（虽降低安全性）
:::

### 固定策略对比

| 策略 | 安全性 | 维护成本 | 推荐场景 |
|------|--------|----------|---------|
| 固定根证书 | 低 | 低 | 仅防篡改，CA 范围太广 |
| 固定中间证书 | 中 | 中 | **推荐**，兼顾安全与维护 |
| 固定叶子证书 | 高 | 高 | 高安全、证书可控场景 |
| 固定多个层级 | 高 | 中 | 多层冗余，推荐 |

## InsecureSkipVerify

`InsecureSkipVerify` 跳过全部 TLS 证书链验证，仅用于测试：

```go
// 仅用于测试
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true → 跳过 TLS 证书验证
```

HTTPC 在 `httpc.New()` 中检测到 `InsecureSkipVerify = true` 且非测试环境时，向 `stderr` 打印警告（每进程一次）。测试环境判定：可执行文件以 `.test` 结尾，或设置了 `GO_TEST` / `GOTEST=1`。

:::danger
`InsecureSkipVerify = true` 会跳过证书链与主机名校验，仅在测试环境使用。若同时配置了证书固定，SPKI 哈希校验**仍会执行**：Go 在跳过链校验时仍把对端证书传给固定回调，固定成为唯一验证关卡——且此时**仅匹配叶子证书**，固定中间证书的组合会始终握手失败。此时证书链有效性（过期、吊销、CA 签发）与主机名校验全部缺失。

生产环境不得设为 `true`。需要自定义验证逻辑（如固定完整证书）时，实现 `CertificatePinner` 接口，而非跳过验证。
:::

## HTTP/2

HTTP/2 默认启用，仅在使用 TLS（h2 via ALPN）时可用：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // 禁用 HTTP/2（仅 HTTP/1.1）
```

:::tip
启用证书固定或自定义 `TLSConfig` 时，HTTP/2 的 ALPN 协商仍正常工作。需要禁用 HTTP/2（如调试或兼容旧代理）时，设 `EnableHTTP2 = false`。
:::

## 最佳实践

1. 使用默认 TLS 配置（TLS 1.2+），无需手动设置
2. 证书固定时固定**中间证书** SPKI，并准备备用固定值
3. 多哈希支持密钥轮换，采用「先加新、后删旧」策略
4. 定期更新固定值，与服务端证书续期同步
5. 使用 `SecureConfig()` 作为安全基线
6. 生产环境不得设置 `InsecureSkipVerify`
7. 高安全场景固定多层证书（叶子 + 中间），增加冗余

## 下一步

- [SSRF 防护](./ssrf) - SSRF 安全配置
- [安全概述](./) - 安全特性总览
- [配置 API](../api-reference/client-config/config) - SecurityConfig 参考
