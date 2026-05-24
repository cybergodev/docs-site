---
title: "토큰 블랙리스트 - JWT"
description: "CyberGo JWT 토큰 블랙리스트 가이드: 내장 메모리 저장소 설정, BlacklistStore 커스텀 백엔드(Redis), 취소 메커니즘, 자동 정리 및 프로덕션 환경 모범 사례."
---

# 토큰 블랙리스트

블랙리스트는 토큰이 만료되기 전에 능동적으로 무효화하는 데 사용됩니다. 사용자 로그아웃, 비밀번호 변경, 권한 변경 등의 시나리오에 적합합니다.

## 작동 방식

```text
Revoke(token) → jti + exp 추출 → BlacklistStore에 기록
Validate(token) → 서명 검증 → 블랙리스트 확인 → 결과 반환
```

## 내장 메모리 저장소

기본적으로 메모리 저장소를 사용하며, 설정 없이 바로 사용할 수 있습니다:

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// 블랙리스트가 자동으로 활성화되며, DefaultBlacklistConfig() 사용
```

### 설정 항목

```go
cfg.Blacklist.CleanupInterval = 5 * time.Minute  // 정리 간격
cfg.Blacklist.MaxSize = 100000                     // 최대 항목 수
cfg.Blacklist.EnableAutoCleanup = true             // 자동 정리
```

| 필드 | 기본값 | 설명 |
|------|--------|------|
| `CleanupInterval` | `5m` | 만료 항목 정리 간격 |
| `MaxSize` | `100000` | 최대 항목 수 |
| `EnableAutoCleanup` | `true` | 자동 정리 (항상 true로 강제) |

:::tip 자동 정리
내장 저장소의 `EnableAutoCleanup`은 항상 `true`로 강제되어 메모리 무한 증가를 방지합니다.
:::

## 토큰 취소

```go
// 취소
err := processor.Revoke(accessToken)
if err != nil {
    panic(err)
}

// 확인
revoked, err := processor.IsRevoked(accessToken)
fmt.Println("Revoked:", revoked) // true

// 취소된 토큰은 검증에 실패함
_, _, err = processor.Validate(accessToken)
// err → jwt.ErrTokenRevoked
```

## 커스텀 저장소 백엔드

[`BlacklistStore`](../api-reference/interfaces#blackliststore) 인터페이스를 구현하여 외부 저장소(Redis, 데이터베이스 등)에 연결:

```go
type BlacklistStore interface {
    Add(tokenID string, expiresAt time.Time) error
    Contains(tokenID string) (bool, error)
    Close() error
}
```

### Redis 예제

```go
type RedisStore struct {
    client *redis.Client
}

func (s *RedisStore) Add(tokenID string, expiresAt time.Time) error {
    ttl := time.Until(expiresAt)
    if ttl <= 0 {
        return nil // 이미 만료된 토큰은 저장할 필요 없음
    }
    return s.client.Set(ctx, "blacklist:"+tokenID, "1", ttl).Err()
}

func (s *RedisStore) Contains(tokenID string) (bool, error) {
    n, err := s.client.Exists(ctx, "blacklist:"+tokenID).Result()
    return n > 0, err
}

func (s *RedisStore) Close() error {
    return s.client.Close()
}
```

커스텀 저장소 사용:

```go
cfg.Blacklist.Store = &RedisStore{client: rdb}
```

:::tip TTL 최적화
`time.Until(expiresAt)`를 Redis TTL로 사용하면 토큰이 만료된 후 블랙리스트에서 자동으로 제거되어 추가 정리가 필요 없습니다.
:::

## 프로덕션 환경 권장 사항

:::warning 주의사항
- 내장 메모리 저장소는 프로세스 간에 공유되지 않으므로, 다중 인스턴스 배포 시 외부 저장소를 사용해야 합니다
- `MaxSize`에 도달하면 새로 취소된 토큰이 가장 오래된 항목을 밀어냅니다
- 커스텀 저장소 구현은 네트워크 타임아웃과 재시도를 처리해야 합니다
:::

## 다음 단계

- [API 레퍼런스 → BlacklistStore](../api-reference/interfaces#blackliststore) — 인터페이스 정의
- [API 레퍼런스 → BlacklistConfig](../api-reference/config#blacklistconfig) — 설정 필드
- [API 레퍼런스 → Revoke](../api-reference/processor#revoke) — 취소 메서드
- [고급 예제](../examples/advanced) — Redis 블랙리스트 예제
