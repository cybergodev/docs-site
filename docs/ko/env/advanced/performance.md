---
title: "성능 최적화 - CyberGo env | 고동시성 읽기/쓰기 튜닝"
description: "CyberGo env 성능 최적화 가이드로 RWMutex 동시성, 객체 풀 재사용, mlock 메모리 잠금, 대용량 파일 스트리밍과 벤치마크 기반 매개변수 튜닝을 제안합니다."
---

# 성능 최적화

env 라이브러리는 고성능 시나리오에 최적화되어 있습니다. 이 문서에서는 동시성 안전, 객체 풀, 메모리 관리 등 성능 관련 기능을 소개합니다.

## 동시성 안전

### 스레드 안전 보장

`Loader`의 모든 메서드는 스레드 안전합니다:

```go
loader, _ := env.New(env.DefaultConfig())
defer loader.Close()

var wg sync.WaitGroup

// 동시 읽기
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        loader.GetString("KEY")
    }()
}

// 동시 쓰기
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func(n int) {
        defer wg.Done()
        loader.Set(fmt.Sprintf("KEY_%d", n), "value")
    }(i)
}

wg.Wait()
```

### 패키지 수준 함수 스레드 안전

패키지 수준 함수는 전역 로더를 사용하며, 마찬가지로 스레드 안전합니다:

```go
var wg sync.WaitGroup

for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        env.GetString("KEY", "default")
    }()
}

wg.Wait()
```

### 내부 구현

라이브러리는 샤딩된 저장소(Sharded Storage)를 사용하여 잠금 경합을 줄입니다:

```text
┌─────────────────────────────────────────┐
│          Loader (8개 샤드)               │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐    ┌────────┐ │
│  │ Shard 0 │ │ Shard 1 │... │ Shard 7│ │
│  │  Lock   │ │  Lock   │    │  Lock  │ │
│  │  Data   │ │  Data   │    │  Data  │ │
│  └─────────┘ └─────────┘    └────────┘ │
└─────────────────────────────────────────┘
```

- 키는 해시값에 따라 다른 샤드에 할당됩니다
- 각 샤드는 독립적인 잠금을 가집니다
- 잠금 경합 감소, 동시성 성능 향상

## 객체 풀

### 객체 풀을 사용하는 이유

빈번한 객체 생성과 파괴는 GC 부하를 증가시킵니다:

```text
객체 풀 없음:
객체 생성 → 사용 → GC 회수 → 객체 생성 → 사용 → GC 회수 ...

객체 풀 있음:
객체 생성 → 사용 → 풀에 반납 → 가져오기 → 사용 → 풀에 반납 ...
```

### SecureValue 풀

`SecureValue` 객체는 풀링으로 관리됩니다:

```go
// SecureValue 가져오기 (풀에서 재사용될 수 있음)
secret := env.GetSecure("API_KEY")

// 사용 (Reveal은 평문 반환, String/Masked는 마스크 반환)
value := secret.Reveal()

// 풀에 반납
secret.Close()  // 또는 secret.Release()
```

### 객체 풀 올바른 사용법

**적시 해제:**

```go
func processData() {
    secret := env.GetSecure("SECRET")
    defer secret.Close()  // 해제 보장

    // secret 사용...
}
```

**참조를 보유하지 않기:**

```go
// 오류: 해제된 객체의 참조를 보유
var globalSecret *env.SecureValue

func init() {
    globalSecret = env.GetSecure("KEY")
    globalSecret.Close()  // 해제 후 객체가 재사용됨
}

func later() {
    // 위험: globalSecret이 다른 코드에서 이미 사용 중일 수 있음
    globalSecret.String()
}

// 올바름: 필요할 때마다 가져오기
func getSecret() string {
    secret := env.GetSecure("KEY")
    defer secret.Close()
    return secret.Reveal()
}
```

**닫힘 상태 확인:**

```go
secret := env.GetSecure("KEY")

// 사용 전 확인
if secret.IsClosed() {
    // 객체가 닫힘, 사용할 수 없음
}

// 사용 후 닫기
secret.Close()

// 닫은 후 확인
if secret.IsClosed() {
    // 닫힘
}
```

## 메모리 보안

### 메모리 잠금

메모리 잠금을 활성화하여 민감 데이터의 디스크 스왑을 방지합니다:

```go
// 플랫폼 지원 확인
if env.IsMemoryLockSupported() {
    env.SetMemoryLockEnabled(true)
}
```

**플랫폼 지원:**

| 플랫폼 | 지원 |
|------|------|
| Linux | ✅ |
| macOS | ✅ |
| Windows | ✅ |
| FreeBSD | ✅ |
| wasm | ❌ |

::: tip 자세히 보기
[SecureValue API - 메모리 잠금 구성](/ko/env/api-reference/secure-value)에서 전체 구성 설명을 확인하세요.
:::

### 엄격 모드

엄격 모드에서는 메모리 잠금 실패가 오류를 발생시킵니다:

```go
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive_data")
if err != nil {
    // 메모리 잠금 실패
}
```

### 보안 영값 초기화

`SecureValue`는 닫힐 때 메모리를 자동으로 영값 초기화합니다:

```go
secret := env.GetSecure("PASSWORD")
// 내부 저장소: ['p', 'a', 's', 's', ...]

secret.Close()
// 내부 저장소: [0, 0, 0, 0, ...]
```

바이트 슬라이스 수동 영값 초기화:

```go
sensitiveBytes := []byte("secret")
env.ClearBytes(sensitiveBytes)
// sensitiveBytes는 이제 모두 0
```

## 성능 패턴

### 초기화 후 읽기 전용

가장 효율적인 패턴: 시작 시 구성을 로딩하고, 런타임에는 읽기 전용:

```go
var config *Config

func init() {
    env.Load(".env")

    config = &Config{}
    env.ParseInto(config)
}

// 임의의 goroutine에서 안전하게 읽기
func getValue() string {
    return config.Key
}
```

### 동적 구성 새로고침

구성을 동적으로 업데이트해야 하는 패턴:

```go
type ConfigManager struct {
    loader *env.Loader
    mu     sync.RWMutex
}

func (m *ConfigManager) Refresh() error {
    m.mu.Lock()
    defer m.mu.Unlock()

    return m.loader.LoadFiles(".env")
}

func (m *ConfigManager) Get(key string) string {
    m.mu.RLock()
    defer m.mu.RUnlock()

    return m.loader.GetString(key)
}
```

### 잠금 보유 시간 단축

```go
// 비권장: 잠금 내에서 시간이 오래 걸리는 작업 실행
func (l *Loader) ProcessValue(key string) {
    value := l.GetString(key)
    // 시간이 오래 걸리는 작업...
    processValue(value)
}

// 권장: 빠르게 읽고, 잠금 밖에서 처리
func ProcessValue(key string) {
    value := loader.GetString(key)  // 빠르게 가져오기
    go processValue(value)          // 비동기 처리
}
```

### 일괄 작업

```go
// 필요한 모든 값을 한 번에 가져오기
func LoadAllConfig(loader *env.Loader) *Config {
    return &Config{
        Host:    loader.GetString("HOST"),
        Port:    loader.GetInt("PORT"),
        Debug:   loader.GetBool("DEBUG"),
        Timeout: loader.GetDuration("TIMEOUT"),
    }
}
```

### 빈번한 호출 방지

```go
// 비권장: 매 요청마다 읽기
func Handler(w http.ResponseWriter, r *http.Request) {
    apiKey := env.GetString("API_KEY")  // 매 요청마다 잠금 획득
    // ...
}

// 권장: 시작 시 캐시
var apiKey string

func init() {
    env.Load(".env")
    apiKey = env.GetString("API_KEY")
}

func Handler(w http.ResponseWriter, r *http.Request) {
    // 캐시된 값을 직접 사용
    // ...
}
```

## 성능 영향

### 객체 풀 이점

| 작업 | 풀 없음 | 풀 있음 |
|------|------|------|
| 할당 횟수 | N | ~상수 |
| GC 부하 | 높음 | 낮음 |
| 지연 | 불안정 | 안정 |

### 메모리 잠금 오버헤드

| 작업 | 잠금 없음 | 잠금 있음 |
|------|--------|--------|
| 생성 | ~100ns | ~1μs |
| 읽기 | ~10ns | ~10ns |

## 벤치마크 테스트

### 읽기 성능

```go
func BenchmarkConcurrentRead(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())
    loader.Set("KEY", "value")

    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            loader.GetString("KEY")
        }
    })
}
```

### 쓰기 성능

```go
func BenchmarkConcurrentWrite(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())

    var i int64
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            n := atomic.AddInt64(&i, 1)
            loader.Set(fmt.Sprintf("KEY_%d", n), "value")
        }
    })
}
```

### 혼합 읽기/쓰기

```go
func BenchmarkMixedReadWrite(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())
    loader.Set("KEY", "value")

    b.RunParallel(func(pb *testing.PB) {
        i := 0
        for pb.Next() {
            if i%10 == 0 {
                loader.Set("KEY", "new_value")
            } else {
                loader.GetString("KEY")
            }
            i++
        }
    })
}
```

## 주의 사항

### 잠금 내 차단 방지

```go
// 위험: 교착 상태 발생 가능
func (l *Loader) BadMethod() {
    // 잠금 내에서 차단될 수 있는 작업 호출
    l.Set("KEY", computeValue())  // computeValue가 느릴 수 있음
}

// 안전: 먼저 계산, 그 다음 설정
func GoodMethod() {
    value := computeValue()  // 잠금 밖에서 계산
    loader.Set("KEY", value)  // 빠른 설정
}
```

### Close 후 동시성 접근

```go
loader, _ := env.New(cfg)

// goroutine 시작
go func() {
    time.Sleep(1 * time.Second)
    loader.GetString("KEY")  // 빈 문자열 반환 (GetString은 error를 반환하지 않음)
}()

loader.Close()  // 주 goroutine에서 닫기
```

### 전역 로더 재설정

```go
// 동시성 불안전: 런타임에 호출하지 마세요
env.ResetDefaultLoader()

// 안전: 테스트 또는 시작 시에만 호출
func init() {
    env.ResetDefaultLoader()
    env.Load(".env")
}
```

## 관련 문서

- [SecureValue API](/ko/env/api-reference/secure-value) - 보안 값 처리 및 메모리 잠금
- [Loader API](/ko/env/api-reference/loader) - 로더 메서드
- [테스트 시나리오](/ko/env/guides/testing) - 벤치마크 테스트 예시
