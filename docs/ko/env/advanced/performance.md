---
title: 성능 최적화 - CyberGo env | 고동시성 읽기/쓰기 튜닝
description: CyberGo env 라이브러리 성능 최적화 완전 가이드로, 동시 안전 읽기/쓰기 메커니즘과 sync.RWMutex 구현, 객체 풀 재사용 전략으로 메모리 할당 감소, 메모리 잠금 사용 패턴과 시스템 호출 오버헤드, 대용량 파일 스트리밍 처리 기법 및 벤치마크 성능 데이터 비교를 다루어 Go 개발자가 고동시성 고성능 시나리오에서 합리적으로 사용하고 튜닝할 수 있도록 돕습니다.
---

# 성능 최적화

env 라이브러리는 고성능 시나리오에 최적화되어 있습니다. 이 문서는 동시성 안전, 객체 풀, 메모리 관리 등 성능 관련 기능을 소개합니다.

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

라이브러리는 분할 저장소(Sharded Storage)를 사용하여 락 경합을 줄입니다:

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

- 키가 해시 값에 따라 다른 샤드에 할당됨
- 각 샤드에 독립적인 락 존재
- 락 경합 감소, 동시성 성능 향상

## 객체 풀

### 객체 풀을 사용하는 이유

빈번한 객체 생성 및 파괴는 GC 부하를 증가시킵니다:

```text
객체 풀 없음:
객체 생성 → 사용 → GC 회수 → 객체 생성 → 사용 → GC 회수 ...

객체 풀 있음:
객체 생성 → 사용 → 풀에 반환 → 가져오기 → 사용 → 풀에 반환 ...
```

### SecureValue 풀

`SecureValue` 객체는 풀 관리를 사용합니다:

```go
// SecureValue 가져오기 (풀에서 재사용할 수 있음)
secret := env.GetSecure("API_KEY")

// 사용
value := secret.String()

// 풀에 반환
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

**참조를 유지하지 마세요:**

```go
// 잘못됨: 해제된 객체의 참조 유지
var globalSecret *env.SecureValue

func init() {
    globalSecret = env.GetSecure("KEY")
    globalSecret.Close()  // 해제 후 객체가 재사용됨
}

func later() {
    // 위험: globalSecret이 다른 코드에서 이미 사용되었을 수 있음
    globalSecret.String()
}

// 올바름: 필요할 때마다 가져오기
func getSecret() string {
    secret := env.GetSecure("KEY")
    defer secret.Close()
    return secret.String()
}
```

**닫힘 상태 확인:**

```go
secret := env.GetSecure("KEY")

// 사용 전 확인
if secret.IsClosed() {
    // 객체가 닫혀 사용할 수 없음
}

// 사용 후 닫기
secret.Close()

// 닫은 후 확인
if secret.IsClosed() {
    // 닫힘
}
```

## 메모리 안전

### 메모리 잠금

메모리 잠금을 활성화하여 민감 데이터가 디스크로 스왑되는 것을 방지합니다:

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

::: tip 자세한 내용
[SecureValue API - 메모리 잠금 설정](/ko/env/api-reference/secure-value#메모리-잠금-설정)에서 완전한 설정 설명을 확인하세요.
:::

### 엄격 모드

엄격 모드에서는 메모리 잠금 실패 시 오류가 발생합니다:

```go
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive_data")
if err != nil {
    // 메모리 잠금 실패
}
```

### 안전한 초기화

`SecureValue`가 닫힐 때 메모리가 자동으로 초기화됩니다:

```go
secret := env.GetSecure("PASSWORD")
// 내부 저장소: ['p', 'a', 's', 's', ...]

secret.Close()
// 내부 저장소: [0, 0, 0, 0, ...]
```

수동으로 바이트 슬라이스 초기화:

```go
sensitiveBytes := []byte("secret")
env.ClearBytes(sensitiveBytes)
// sensitiveBytes는 이제 모두 0
```

## 성능 패턴

### 초기화 후 읽기 전용

가장 효율적인 패턴: 시작 시 설정을 로드하고, 실행 중에는 읽기 전용:

```go
var config *Config

func init() {
    env.Load(".env")

    config = &Config{}
    env.ParseInto(config)
}

// 모든 goroutine에서 안전하게 읽기
func getValue() string {
    return config.Key
}
```

### 동적 설정 새로고침

설정을 동적으로 업데이트해야 할 때의 패턴:

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

### 락 유지 시간 감소

```go
// 권장하지 않음: 락 내에서 시간이 많이 걸리는 작업 실행
func (l *Loader) ProcessValue(key string) {
    value := l.GetString(key)
    // 시간이 많이 걸리는 작업...
    processValue(value)
}

// 권장: 빠르게 읽고 락 밖에서 처리
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

### 빈번한 호출 피하기

```go
// 권장하지 않음: 매 요청마다 읽기
func Handler(w http.ResponseWriter, r *http.Request) {
    apiKey := env.GetString("API_KEY")  // 매 요청마다 락 획득
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

### 객체 풀 효과

| 작업 | 풀 없음 | 풀 있음 |
|------|------|------|
| 할당 횟수 | N | ~상수 |
| GC 부하 | 높음 | 낮음 |
| 지연 | 불안정 | 안정적 |

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

## 주의사항

### 락 내에서 차단 피하기

```go
// 위험: 교착 상태 발생 가능
func (l *Loader) BadMethod() {
    // 락 내에서 차단될 수 있는 작업 호출
    l.Set("KEY", computeValue())  // computeValue가 느릴 수 있음
}

// 안전: 먼저 계산한 후 설정
func GoodMethod() {
    value := computeValue()  // 락 밖에서 계산
    loader.Set("KEY", value)  // 빠르게 설정
}
```

### Close 후 동시 접근

```go
loader, _ := env.New(cfg)

// goroutine 시작
go func() {
    time.Sleep(1 * time.Second)
    loader.GetString("KEY")  // ErrClosed가 반환될 수 있음
}()

loader.Close()  // 메인 goroutine에서 닫기
```

### 전역 로더 초기화

```go
// 동시성 안전하지 않음: 런타임에 호출하지 마세요
env.ResetDefaultLoader()

// 안전: 테스트 또는 시작 시에만 호출
func init() {
    env.ResetDefaultLoader()
    env.Load(".env")
}
```

## 관련 문서

- [SecureValue API](/ko/env/api-reference/secure-value) - 보안 값 처리와 메모리 잠금
- [Loader API](/ko/env/api-reference/loader) - 로더 메서드
- [테스트 시나리오](/ko/env/guides/testing) - 벤치마크 예제
