---
sidebar_label: "签名算法"
title: "签名算法 - CyberGo JWT | 算法对比与选型"
description: "签名算法指南：对比 HMAC、RSA、RSA-PSS 与 ECDSA 四类共 12 种算法的密钥类型、生成方式、签名性能、签名长度与架构耦合度，给出选型决策、曲线匹配要求，以及环境变量、PEM 加载与密钥轮换的管理清单。"
sidebar_position: 10
---

# 签名算法

CyberGo JWT 支持 4 类共 12 种签名算法，覆盖从单体应用到微服务架构的各种场景。

## 算法一览

| 类型 | 算法 | 密钥类型 | 适用场景 |
|------|------|----------|----------|
| HMAC | HS256 / HS384 / HS512 | 对称密钥 | 单体应用、简单服务 |
| RSA | RS256 / RS384 / RS512 | 公钥/私钥 | 微服务、多服务验证 |
| RSA-PSS | PS256 / PS384 / PS512 | 公钥/私钥 | 微服务（推荐替代 RSA） |
| ECDSA | ES256 / ES384 / ES512 | 公钥/私钥 | 高性能微服务 |

## HMAC（对称密钥）

HMAC 使用同一密钥签名和验证，是最简单的方案。

### 密钥要求

HMAC 密钥需通过 `validateSigningKey` 的两项检查：

- **长度检查**：`len(SecretKey) < 32` 时返回 `ErrInvalidSecretKey`，错误信息包含实际字节长度，例如 `"minimum 32 bytes required, got 16"`
- **熵值检查**：通过 `internal.IsWeakKey` 检测低熵密钥，以下模式会被拒绝：
  - 全部相同字符（如 `"aaaaaaaa..."`）
  - 重复短模式（如 `"abcabcabc..."`）
  - 连续递增/递减序列（如 `"abcdefgh..."`）
  - 常见弱口令及其变体（如 `"password"`、`"qwerty"`）

:::warning 弱密钥会被拒绝
不要使用「重复字符」「连续序列」「字典单词」等易于猜测的密钥。即使长度达到 32 字节，低熵密钥仍会在 `jwt.New` 初始化阶段被拒绝并返回 `ErrInvalidSecretKey`。
:::

生产环境应使用密码学安全的随机源生成密钥：

```go
package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"

	"github.com/cybergodev/jwt"
)

func main() {
	// 使用 crypto/rand 生成 32 字节随机密钥
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		log.Fatal(err)
	}
	// 以 base64 编码存储、传递
	secret := base64.StdEncoding.EncodeToString(raw)

	cfg := jwt.DefaultConfig()
	cfg.SecretKey = secret
	processor, err := jwt.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer processor.Close()

	fmt.Println("HMAC 密钥已就绪，长度（字节）：", len(secret)) // 输出：HMAC 密钥已就绪，长度（字节）：44
}
```

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.SigningMethod = jwt.SigningMethodHS256 // 默认值，可省略
```

### 算法选择

| 常量 | 算法 | 说明 |
|------|------|------|
| `SigningMethodHS256` | HMAC-SHA256 | 推荐，性能与安全均衡 |
| `SigningMethodHS384` | HMAC-SHA384 | 更高安全性 |
| `SigningMethodHS512` | HMAC-SHA512 | 最高安全性 |

:::tip 推荐
大多数场景使用 `HS256` 即可。密钥建议使用密码学安全随机生成，长度至少 32 字节。
:::

## RSA（非对称密钥）

RSA 使用私钥签名、公钥验证。适用于验证端不需要持有私钥的场景。

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodRS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey（可选）
```

:::tip 验证密钥
`VerificationKey` 可选。不设置时，库使用 `SigningKey` 进行验证（内部从私钥提取公钥）。
:::

### 密钥生成

```go
// 生成 2048 位 RSA 密钥对（库强制要求最少 2048 位，否则返回 ErrInvalidSecretKey）
privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
if err != nil {
    log.Fatal(err)
}
publicKey := &privateKey.PublicKey
```

### 算法选择

| 常量 | 算法 | 说明 |
|------|------|------|
| `SigningMethodRS256` | RSA-SHA256 | 推荐 |
| `SigningMethodRS384` | RSA-SHA384 | 更高安全性 |
| `SigningMethodRS512` | RSA-SHA512 | 最高安全性 |

:::tip 与 RSA-PSS 共用密钥
RS256/RS384/RS512 和 PS256/PS384/PS512 使用相同的密钥类型（`*rsa.PrivateKey` / `*rsa.PublicKey`）和相同的验证逻辑，密钥可互换复用。从 RSA 迁移到 RSA-PSS 无需重新生成密钥。
:::

## RSA-PSS（非对称密钥，推荐替代 RSA）

RSA-PSS 是 RSA 的改进签名方案，使用概率签名方案（PSS）填充，安全性优于 PKCS#1 v1.5。密钥与 RSA 相同。

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodPS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey（与 RSA 共用密钥）
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey（可选）
```

:::tip 推荐替代
RSA-PSS 比 RSA PKCS#1 v1.5 更安全，建议新项目优先使用 RSA-PSS 算法。密钥与 RSA 完全相同，无需额外生成。
:::

### 算法选择

| 常量 | 算法 | 说明 |
|------|------|------|
| `SigningMethodPS256` | RSA-PSS-SHA256 | 推荐 |
| `SigningMethodPS384` | RSA-PSS-SHA384 | 更高安全性 |
| `SigningMethodPS512` | RSA-PSS-SHA512 | 最高安全性 |

## ECDSA（椭圆曲线）

ECDSA 同样是非对称算法，但密钥更短、性能更好。

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodES256
cfg.SigningKey = ecdsaPrivateKey      // *ecdsa.PrivateKey
cfg.VerificationKey = ecdsaPublicKey  // *ecdsa.PublicKey（可选）
```

### 密钥生成

```go
// 生成 P-256 曲线密钥对
privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
if err != nil {
    log.Fatal(err)
}
publicKey := &privateKey.PublicKey
```

### 算法选择

| 常量 | 算法 | 曲线 | 说明 |
|------|------|------|------|
| `SigningMethodES256` | ECDSA-SHA256 | P-256 | 推荐 |
| `SigningMethodES384` | ECDSA-SHA384 | P-384 | 更高安全性 |
| `SigningMethodES512` | ECDSA-SHA512 | P-521 | 最高安全性 |

### 曲线匹配

算法与曲线必须严格对应，初始化时会强制校验（源码见 `validateECDSACurve`）：

| 算法 | 必须使用的曲线 | 生成方式 |
|------|----------------|----------|
| ES256 | P-256 | `elliptic.P256()` |
| ES384 | P-384 | `elliptic.P384()` |
| ES512 | P-521 | `elliptic.P521()` |

:::warning ES512 使用 P-521 而非 P-512
`ES512` 对应的曲线是 **P-521**（注意是 521 不是 512）。这是常见错误——数字 512 容易让人误以为曲线也是 P-512，但 Go 标准库中不存在 `P512`，最高位曲线就是 `elliptic.P521()`。曲线不匹配时返回 `ErrInvalidSecretKey`。
:::

## 密钥分离模式

在微服务架构中，通常需要将**签名能力**（签发令牌）与**验证能力**（校验令牌）分离，遵循最小权限原则：

| 服务角色 | 持有密钥 | 职责 |
|----------|----------|------|
| **认证服务** | 私钥（`SigningKey`） | 登录成功后签发访问令牌 |
| **API 服务** | 公钥（`VerificationKey`） | 验证令牌签名，不参与签发 |

认证服务持有私钥负责签发，API 服务持有公钥负责验证。当前 API 要求 `SigningKey` 字段非空，因此 API 服务仍需填入一个 `*rsa.PrivateKey`。**占位私钥即可**：只要设置了 `VerificationKey`，验证时就只使用该公钥，占位私钥的内容与真实签发密钥无关。

:::tip VerificationKey 优先
设置了 `VerificationKey` 后，验证流程使用该公钥，而非从 `SigningKey` 提取的公钥。因此只验不签的服务可以放置一个无关的 2048 位占位私钥，签名能力仍然完全隔离在认证服务一侧。
:::

认证服务（签发令牌）：

```go
authCfg := jwt.DefaultConfig()
authCfg.SigningMethod = jwt.SigningMethodRS256
authCfg.SigningKey = rsaPrivateKey           // *rsa.PrivateKey，用于签名
authCfg.VerificationKey = &rsaPrivateKey.PublicKey
```

API 服务（仅验证）：

```go
apiCfg := jwt.DefaultConfig()
apiCfg.SigningMethod = jwt.SigningMethodRS256
apiCfg.SigningKey = placeholderPrivateKey    // 任意 2048 位私钥占位，不参与验证
apiCfg.VerificationKey = rsaPublicKey        // *rsa.PublicKey，验证时实际使用
```

:::warning 仅验证实例不要签发
仅验证的 `Processor` 不应调用 `Create` / `CreateRefresh`：那会用占位私钥签名，产出无法验证的令牌。完整跨服务示例见[高级示例](../examples/advanced#密钥分离模式)。
:::

## 如何选择

```text
单体应用 ──────────→ HMAC
微服务（同信任域） ──→ HMAC
微服务（跨服务验证）→ RSA、RSA-PSS 或 ECDSA
安全性优先 ────────→ RSA-PSS（替代 RSA）
高性能要求 ────────→ ECDSA
密钥长度敏感 ──────→ ECDSA
```

| 考量因素 | HMAC | RSA | RSA-PSS | ECDSA |
|----------|------|-----|---------|-------|
| 签名速度 | 快 | 较慢 | 较慢 | 快 |
| 验证速度 | 快 | 快 | 快 | 快 |
| 密钥长度 | 32+ 字节 | 2048+ 位 | 2048+ 位 | 256+ 位 |
| 签名长度 | 固定 | 长（~256 字节） | 长（~256 字节） | 短（~64 字节） |
| 架构耦合 | 紧耦合 | 松耦合 | 松耦合 | 松耦合 |
| 安全性 | 高 | 高 | 更高 | 高 |

## 密钥管理最佳实践

### 环境变量注入

通过环境变量传递密钥，避免硬编码到源码：

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/jwt"
)

func main() {
	secret := os.Getenv("JWT_SECRET_KEY")
	cfg := jwt.DefaultConfig()
	cfg.SecretKey = secret
	processor, err := jwt.New(cfg)
	if err != nil {
		fmt.Println("密钥无效：", err)
		return
	}
	defer processor.Close()
	fmt.Println("Processor 就绪") // 输出：Processor 就绪
}
```

### 从 PEM 文件加载 RSA 密钥

生产环境通常将非对称密钥以 PEM 文件存储，启动时使用 `crypto/x509` 解析加载：

```go
package main

import (
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"

	"github.com/cybergodev/jwt"
)

func main() {
	// 读取私钥 PEM 文件
	keyData, err := os.ReadFile("private_key.pem")
	if err != nil {
		fmt.Println("读取私钥失败：", err)
		return
	}

	block, _ := pem.Decode(keyData)
	if block == nil {
		fmt.Println("PEM 解码失败")
		return
	}

	privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		fmt.Println("解析私钥失败：", err)
		return
	}

	cfg := jwt.DefaultConfig()
	cfg.SigningMethod = jwt.SigningMethodRS256
	cfg.SigningKey = privateKey
	processor, err := jwt.New(cfg)
	if err != nil {
		fmt.Println("初始化失败：", err)
		return
	}
	defer processor.Close()
	fmt.Println("RSA 密钥已从 PEM 加载") // 输出：RSA 密钥已从 PEM 加载
}
```

:::tip 从 PEM 加载公钥
公钥 PEM 文件使用 `x509.ParsePKIXPublicKey` 解析，返回值为 `any`，需类型断言为 `*rsa.PublicKey` 或 `*ecdsa.PublicKey`。完整示例见[高级示例](../examples/advanced#从-pem-文件加载密钥)。
:::

### 密钥轮换

:::tip 轮换建议
- 定期轮换签名密钥（建议每 3–6 个月）
- 新旧密钥并行期间，验证端同时接受两把公钥
- 本库的 JWT 头部固定为 `{"typ":"JWT","alg":"<算法>"}`，**不支持 `kid`（Key ID）**，无法在令牌里标记密钥版本。并行期需为每把密钥各建一个 `Processor`，先按 `kid` 之类的字段或外部路由判断版本，再交给对应的实例验证；不支持在单个实例内自动选钥
- 轮换完成后撤销旧密钥，检查黑名单是否需同步更新
:::

## 安全注意事项

密钥管理的检查清单：

| 项 | 要求 |
|----|------|
| 密钥来源 | 环境变量或密钥管理服务，不写入源码、不提交版本控制 |
| HMAC 密钥 | 密码学安全随机生成，≥ 32 字节；禁止纯数字、重复字符、字典词 |
| 非对称密钥 | RSA ≥ 2048 位；ECDSA 曲线与算法严格匹配（ES256→P-256、ES384→P-384、ES512→P-521） |
| 算法 | 不使用 `none`（本库自动拒绝）；跨服务验证优先 RSA-PSS 或 ECDSA |
| 轮换 | 定期轮换；并行期验证端同时接受新旧公钥。本库头部固定，不支持 `kid`，见[密钥轮换](#密钥轮换) |
| 收尾 | 轮换完成后撤销旧密钥，检查黑名单是否需同步更新 |

## 下一步

- [自定义 Claims](./custom-claims) — 定义业务字段
- [API 参考 → 包函数](../api-reference/functions) — 完整 API 签名
- [基础示例](../examples/basic) — HMAC 完整示例
