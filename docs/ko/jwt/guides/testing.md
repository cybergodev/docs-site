---
title: "테스트와 클럭 인젝션 - CyberGo JWT | 고정 클럭 반복 테스트"
description: "테스트와 클럭 인젝션 가이드: ClockProvider로 FixedClock 고정 클럭을 주입해 단위 테스트에서 시간 흐름을 정밀 제어, 만료·갱신·커스텀 Claims·취소 로직을 반복 가능하게 검증합니다."
---

# 테스트와 클럭 인젝션

`ClockProvider` 인터페이스를 통해 커스텀 클럭을 주입하여 테스트에서 시간을 정밀하게 제어할 수 있습니다.

## ClockProvider 인터페이스

```go
type ClockProvider interface {
    Now() time.Time
}
```

라이브러리는 두 가지 구현을 제공합니다:

| 타입 | 설명 |
|------|------|
| `SystemClock` | 기본값, 시스템 시간 사용 |
| `FixedClock` | 고정 시간, 테스트용 |

## FixedClock

`FixedClock`은 항상 생성 시 지정된 시간을 반환합니다:

```go
fixedTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.Clock = jwt.FixedClock{T: fixedTime}
```

## 토큰 만료 테스트

```go
func TestTokenExpiry(t *testing.T) {
    // 고정 시간 설정
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.Clock = jwt.FixedClock{T: now}

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    // now 시점에 토큰 발급
    claims := &jwt.Claims{UserID: "user123"}
    token, err := processor.Create(claims)
    require.NoError(t, err)

    // 현재 시점에서 검증 → 성공
    _, valid, err := processor.Validate(token)
    require.NoError(t, err)
    assert.True(t, valid)

    // 만료 후로 시간 경과 시뮬레이션 → 새로운 Processor 사용
    expiredCfg := cfg
    expiredCfg.Clock = jwt.FixedClock{T: now.Add(16 * time.Minute)}
    expiredProcessor, err := jwt.New(expiredCfg)
    require.NoError(t, err)
    defer expiredProcessor.Close()

    _, _, err = expiredProcessor.Validate(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenExpired))
}
```

## 갱신 흐름 테스트

```go
func TestRefreshFlow(t *testing.T) {
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Clock = jwt.FixedClock{T: now}

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123"}
    refreshToken, err := processor.CreateRefresh(claims)
    require.NoError(t, err)

    // 리프레시 토큰으로 새로운 액세스 토큰 획득
    newToken, err := processor.Refresh(refreshToken)
    require.NoError(t, err)
    assert.NotEmpty(t, newToken)
}
```

## 커스텀 Claims 테스트

```go
func TestCustomClaims(t *testing.T) {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &MyClaims{
        UserID: "user123",
        Email:  "test@example.com",
    }

    token, err := processor.Create(claims)
    require.NoError(t, err)

    result := &MyClaims{}
    parsed, valid, err := processor.ValidateInto(token, result)
    require.NoError(t, err)
    assert.True(t, valid)

    myResult := parsed.(*MyClaims)
    assert.Equal(t, "user123", myResult.UserID)
    assert.Equal(t, "test@example.com", myResult.Email)
}
```

## 오류 처리 테스트

```go
func TestRevokeToken(t *testing.T) {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123"}
    token, err := processor.Create(claims)
    require.NoError(t, err)

    // 토큰 취소
    err = processor.Revoke(token)
    require.NoError(t, err)

    // 검증이 실패해야 함
    _, _, err = processor.Validate(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenRevoked))
}
```

## 모범 사례

:::tip 테스트 권장 사항
- `FixedClock`을 사용하여 테스트의 재현성을 보장하세요
- 각 테스트 케이스마다 독립적인 Processor를 생성하세요
- `t.Cleanup()` 또는 `defer`를 사용하여 `Close()`가 호출되도록 보장하세요
- 오류 검증 시 문자열 매칭 대신 `errors.Is()`를 사용하세요
:::

## 다음 단계

- [API 레퍼런스 → ClockProvider](../api-reference/interfaces#clockprovider) — 클럭 인터페이스
- [API 레퍼런스 → FixedClock](../api-reference/types#fixedclock) — 고정 클럭
- [고급 예제](../examples/advanced) — 클럭 인젝션 예제
