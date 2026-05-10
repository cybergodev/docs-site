---
title: SSRF 방어 - HTTPC
description: HTTPC SSRF 방어 상세 설명, 사설 IP 차단 메커니즘, 면제 CIDR 구성, DNS 리바인딩 방어, 리다이렉트 허용 목록과 클라우드 메타데이터 엔드포인트 보호 포함.
---

# SSRF 방어

SSRF(Server-Side Request Forgery, 서버 측 요청 위조)는 공격자가 서버를 이용하여 내부 네트워크 요청을 보내는 공격 방식입니다. HTTPC는 기본적으로 SSRF 방어가 활성화되어 있습니다.

## 기본 동작

```go
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → 기본적으로 모든 사설 IP 차단
```

기본적으로 차단되는 IP 범위:

| 범위 | CIDR | 설명 |
|------|------|------|
| IPv4 루프백 | `127.0.0.0/8` | localhost |
| A 클래스 사설 | `10.0.0.0/8` | 내부망 |
| B 클래스 사설 | `172.16.0.0/12` | 내부망 |
| C 클래스 사설 | `192.168.0.0/16` | 내부망 |
| 링크 로컬 | `169.254.0.0/16` | 자동 구성 |
| IPv6 루프백 | `::1/128` | localhost |
| IPv6 로컬 | `fc00::/7` | 고유 로컬 주소 |
| IPv6 링크 | `fe80::/10` | 링크 로컬 |

## CIDR 면제

마이크로서비스 환경에서는 내부 서비스에 접근해야 할 수 있습니다:

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 내부
    "100.64.0.0/10",    // Tailscale VPN
    "172.20.0.0/16",    // Kubernetes Service CIDR
}
```

:::warning 주의
면제 CIDR는 가능한 정확하게 지정하십시오. 너무 큰 범위(예: `0.0.0.0/0`)를 사용하면 SSRF 방어가 비활성화되는 것과 같습니다.
:::

## DNS 리바인딩 방어

HTTPC는 "해석-검증-직접 연결" 모드로 DNS 리바인딩 공격을 방지합니다:

1. 도메인을 IP 주소로 해석
2. 해석된 모든 IP가 사설 주소인지 검증
3. 검증된 IP에 직접 연결 (도메인을 다시 해석하지 않음)

```go
// 공격 시나리오:
// 1. 공격자가 evil.com의 DNS를 제어
// 2. 첫 번째 해석에서 공인 IP 반환 (검증 통과)
// 3. 실제 연결 시 DNS가 127.0.0.1 반환 (검증 우회)
//
// HTTPC 방어: 검증 후 검증된 IP를 직접 사용하여 다시 해석하지 않음
```

## 리다이렉트 SSRF 검사

리다이렉트 대상도 SSRF 검증을 거칩니다:

```go
// public-api.com에 요청, 서버가 302 리다이렉트로 http://169.254.169.254/ 반환
// HTTPC는 리다이렉트 대상의 IP를 검증하여 메타데이터 서비스 접근을 차단
```

### 리다이렉트 도메인 허용 목록

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
    "*.cdn.example.com",  // 와일드카드 지원
}

// 허용 목록에 없는 도메인의 리다이렉트는 차단됩니다
```

## 클라우드 환경 메타데이터 보호

각 클라우드 플랫폼의 메타데이터 서비스 주소:

| 플랫폼 | 주소 | 설명 |
|------|------|------|
| AWS | `169.254.169.254` | 인스턴스 메타데이터 |
| GCP | `metadata.google.internal` | 메타데이터 서비스 |
| Azure | `169.254.169.254` | 인스턴스 메타데이터 |
| 알리바바 클라우드 | `100.100.100.200` | 메타데이터 서비스 |

HTTPC는 기본적으로 AWS/Azure 메타데이터 접근을 차단합니다 (`169.254.169.254`가 `169.254.0.0/16` 차단 목록에 포함). GCP 메타데이터(`metadata.google.internal`)는 DNS 해석 검증에 의해 차단됩니다.

:::warning 주의
알리바바 클라우드 메타데이터(`100.100.100.200`)는 CGNAT 범위(`100.64.0.0/10`)에 위치하며, Tailscale/WireGuard 등 VPN을 지원하기 위해 이 범위는 기본 차단 목록에 포함되어 있지 않습니다. 알리바바 클라우드 메타데이터 접근을 방지하려면 다른 보안 정책(예: 방화벽 규칙)을 통해 제한하십시오.
:::

## SSRF 방어 완전 비활성화

테스트 환경에서만 사용하십시오:

```go
// TestingConfig는 SSRF 방어 비활성화
client, _ := httpc.New(httpc.TestingConfig())

// 또는 수동 구성
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true
```

:::danger 위험
프로덕션 환경에서 절대 `AllowPrivateIPs = true`로 설정하지 마십시오.
:::

## 모범 사례

1. `SecureConfig()`를 보안 기준으로 사용
2. 필요한 CIDR 범위만 면제
3. `RedirectWhitelist`로 리다이렉트 대상 제한
4. `SSRFExemptCIDRs` 구성을 정기적으로 감사
5. 감사 미들웨어로 모든 요청 기록

## 다음 단계

- [TLS와 인증서 고정](./tls-certpin) - TLS 보안 구성
- [보안 개요](./) - 보안 기능 총览
- [프로덕션 체크리스트](./production-checklist) - 배포 전 필수 확인 사항
