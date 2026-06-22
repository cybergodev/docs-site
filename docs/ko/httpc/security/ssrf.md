---
title: "SSRF 방어 - CyberGo HTTPC | 사설 IP와 메타데이터"
description: "HTTPC SSRF 방어 상세: 기본 IPv4/IPv6 사설 IP 차단, SSRFExemptCIDRs 정밀 면제, DNS 리바인딩 방어, 리다이렉트 허용 목록과 AWS/GCP/Azure 클라우드 메타데이터 보호를 다룹니다."
---

# SSRF 방어

SSRF(Server-Side Request Forgery, 서버 측 요청 위조)는 공격자가 서버를 이용해 내부 네트워크에 요청을 보내는 공격 방식입니다. HTTPC은 기본적으로 SSRF 방어가 활성화되어 있습니다.

## 기본 동작

```go
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → 기본적으로 모든 사설 IP 차단
```

기본 차단 IP 범위:

| 범위 | CIDR | 설명 |
|------|------|------|
| IPv4 루프백 | `127.0.0.0/8` | localhost |
| A 클래스 사설 | `10.0.0.0/8` | 내부망 |
| B 클래스 사설 | `172.16.0.0/12` | 내부망 |
| C 클래스 사설 | `192.168.0.0/16` | 내부망 |
| 링크 로컬 | `169.254.0.0/16` | 자동 설정 |
| IPv6 루프백 | `::1/128` | localhost |
| IPv6 로컬 | `fc00::/7` | 고유 로컬 주소 |
| IPv6 링크 | `fe80::/10` | 링크 로컬 |

## CIDR 면제

마이크로서비스 환경에서 내부 서비스에 접근해야 할 수 있습니다:

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 내부
    "100.64.0.0/10",    // Tailscale VPN
    "172.20.0.0/16",    // Kubernetes Service CIDR
}
```

:::warning
면제 CIDR은 최대한 정밀하게 지정하세요. 너무 큰 범위(예: `0.0.0.0/0`)를 사용하면 SSRF 방어가 사실상 비활성화됩니다.
:::

### 요청별 사설 IP 면제

개별 요청에만 사설 IP를 허용하면 되는 경우(예: `localhost` 헬스 체크 엔드포인트 호출)에는 전역으로 `AllowPrivateIPs`를 켤 필요 없이 `WithAllowPrivateIPs` 요청 옵션으로 해당 요청에만 허용할 수 있습니다:

```go
// 기본 클라이언트는 사설 IP를 차단; 이 호출은 요청별로 허용
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

:::warning
이 옵션은 **신뢰할 수 있고 사용자 입력이 아닌** URL에만 활성화하세요. SSRF 방어의 목적은 공격자가 귀하의 프로세스를 유도해 내부망 엔드포인트에 접근하는 것을 막는 것이며, 요청별로 비활성화하면 해당 호출에 이 위험이 다시 발생합니다. 클라이언트 전체가 내부 서비스에 접근해야 한다면 Config에서 `Security.AllowPrivateIPs = true`를 설정하세요.
:::

## DNS 리바인딩 방어

HTTPC은 "해석-검증-직접 연결" 모드로 DNS 리바인딩 공격을 방지합니다:

1. 도메인을 IP 주소로 해석
2. 해석된 모든 IP가 사설 주소인지 검증
3. 검증된 IP에 직접 연결 (도메인을 다시 해석하지 않음)

```go
// 공격 시나리오:
// 1. 공격자가 evil.com의 DNS를 제어
// 2. 첫 번째 해석에서 공인 IP 반환 (검증 통과)
// 3. 실제 연결 시 DNS가 127.0.0.1 반환 (검증 우회)
//
// HTTPC 방어: 검증 후 검증된 IP로 직접 연결, 재해석하지 않음
```

## 리다이렉트 SSRF 검사

리다이렉트 대상도 SSRF 검증을 거칩니다:

```go
// public-api.com에 요청했는데 서버가 http://169.254.169.254/로 302 리다이렉트 반환
// HTTPC이 리다이렉트 대상의 IP를 검증하여 메타데이터 서비스 접근을 차단
```

### 리다이렉트 도메인 허용 목록

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
    "*.cdn.example.com",  // 와일드카드 지원
}

// 허용 목록에 없는 도메인의 리다이렉트는 차단됨
```

## 클라우드 환경 메타데이터 보호

각 클라우드 플랫폼의 메타데이터 서비스 주소:

| 플랫폼 | 주소 | 설명 |
|--------|------|------|
| AWS | `169.254.169.254` | 인스턴스 메타데이터 |
| GCP | `metadata.google.internal` | 메타데이터 서비스 |
| Azure | `169.254.169.254` | 인스턴스 메타데이터 |
| 알리바바 클라우드 | `100.100.100.200` | 메타데이터 서비스 |

HTTPC은 기본적으로 AWS/Azure 메타데이터 접근을 차단합니다(`169.254.169.254`가 `169.254.0.0/16` 차단 목록에 포함). GCP 메타데이터(`metadata.google.internal`)는 DNS 해석 검증으로 차단됩니다.

:::warning
알리바바 클라우드 메타데이터(`100.100.100.200`)는 CGNAT 범위(`100.64.0.0/10`)에 위치하며, Tailscale/WireGuard 등 VPN 지원을 위해 이 범위는 기본 차단 목록에 **포함되지 않습니다**. 알리바바 클라우드 메타데이터 접근을 방지하려면 다른 보안 정책(예: 방화벽 규칙)으로 제한하세요.
:::

## SSRF 방어 완전 비활성화

테스트 환경에서만 사용하세요:

```go
// TestingConfig은 SSRF 방어 비활성화
client, _ := httpc.New(httpc.TestingConfig())

// 또는 수동 설정
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true
```

:::danger
프로덕션 환경에서는 절대 `AllowPrivateIPs = true`로 설정하지 마세요.
:::

## 모범 사례

1. `SecureConfig()`를 보안 기준선으로 사용
2. 필요한 CIDR 범위만 면제
3. `RedirectWhitelist`로 리다이렉트 대상 제한
4. `SSRFExemptCIDRs` 설정을 정기적으로 감사
5. 감사 미들웨어로 모든 요청 기록

## 다음 단계

- [TLS와 인증서 고정](./tls-certpin) - TLS 보안 설정
- [보안 개요](./) - 보안 기능 개요
- [프로덕션 체크리스트](./production-checklist) - 릴리스 전 필수 확인 항목
