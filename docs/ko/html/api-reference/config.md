---
title: "설정 - HTML"
description: "CyberGo HTML 라이브러리 Config 설정 상세 설명, 리소스 관리(MaxInputSize, 캐시, 타임아웃), 보안(정제, 깊이 제한, 감사), 콘텐츠 추출(문서 인식, 미디어 보존), 출력 형식(이미지, 링크, 테이블), 링크 필터링(Include*, ResolveRelativeURLs) 및 Validate 검증 메서드를 포함합니다."
---

# 설정

## Config 구조체

`Config`는 HTML 라이브러리의 통합 설정 구조체로, 리소스 관리, 보안, 콘텐츠 추출, 출력 형식 및 링크 필터링을 포함합니다.

### 리소스 관리

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `MaxInputSize` | `int` | `52428800` (50MB) | 최대 입력 크기(바이트) |
| `MaxCacheEntries` | `int` | `2000` | 캐시 최대 항목 수 |
| `CacheTTL` | `time.Duration` | `1h` | 캐시 만료 시간 |
| `CacheCleanup` | `time.Duration` | `5m` | 캐시 정리 간격 |
| `WorkerPoolSize` | `int` | `4` | 워커 풀 크기 |
| `ProcessingTimeout` | `time.Duration` | `30s` | 처리 타임아웃 시간 |

### 보안

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `EnableSanitization` | `bool` | `true` | 콘텐츠 정제 활성화, 신뢰할 수 있는 입력에만 비활성화 가능 |
| `MaxDepth` | `int` | `500` | 최대 DOM 깊이 |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | 감사 설정 |

### 콘텐츠 추출

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `ExtractArticle` | `bool` | `true` | 스마트 문서 인식 활성화 |
| `PreserveImages` | `bool` | `true` | 이미지 정보 보존 |
| `PreserveLinks` | `bool` | `true` | 링크 정보 보존 |
| `PreserveVideos` | `bool` | `true` | 비디오 정보 보존 |
| `PreserveAudios` | `bool` | `true` | 오디오 정보 보존 |

### 출력 형식

| 필드 | 타입 | 기본값 | 선택값 | 설명 |
|------|------|--------|--------|------|
| `InlineImageFormat` | `string` | `none` | `none`, `markdown`, `html`, `placeholder` | 인라인 이미지 형식 |
| `InlineLinkFormat` | `string` | `none` | `none`, `markdown`, `html` | 인라인 링크 형식 |
| `TableFormat` | `string` | `markdown` | `markdown`, `html` | 테이블 형식 |
| `Encoding` | `string` | `""` | - | 인코딩 지정(비워두면 자동 감지) |

### 링크 추출

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `ResolveRelativeURLs` | `bool` | `true` | 상대 URL 해석, BaseURL 설정 필요 |
| `BaseURL` | `string` | `""` | 기본 URL(상대 경로 해석에 사용) |
| `IncludeImages` | `bool` | `true` | 이미지 링크 포함 |
| `IncludeVideos` | `bool` | `true` | 비디오 링크 포함 |
| `IncludeAudios` | `bool` | `true` | 오디오 링크 포함 |
| `IncludeCSS` | `bool` | `true` | CSS 링크 포함 |
| `IncludeJS` | `bool` | `true` | JS 링크 포함 |
| `IncludeContentLinks` | `bool` | `true` | 콘텐츠 링크 포함 |
| `IncludeExternalLinks` | `bool` | `true` | 외부 링크 포함 |
| `IncludeIcons` | `bool` | `true` | 아이콘 링크 포함 |

### 확장

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `Scorer` | `Scorer` | `nil` | 커스텀 콘텐츠 스코어러, 비어있으면 기본 스코어러 사용 |

## 프리셋 설정

### DefaultConfig

균형 잡힌 설정으로 범용 시나리오에 적합합니다.

```go
cfg := html.DefaultConfig()
```

### TextOnlyConfig

순수 텍스트만 추출하며, 모든 미디어와 링크 보존을 비활성화합니다(`PreserveImages`, `PreserveLinks`, `PreserveVideos`, `PreserveAudios` 모두 `false`로 설정).

```go
cfg := html.TextOnlyConfig()
```

### MarkdownConfig

Markdown 출력에 최적화되며, 인라인 이미지와 링크에 Markdown 형식을 사용합니다.

```go
cfg := html.MarkdownConfig()
```

### HighSecurityConfig

고보안 설정: 축소된 제한, 더 짧은 타임아웃, 전체 감사.

```go
cfg := html.HighSecurityConfig()
```

`DefaultConfig()`와 비교한 변경 값:

| 필드 | 기본값 | 고보안값 |
|------|--------|----------|
| `MaxInputSize` | `52428800` (50MB) | `10485760` (10MB) |
| `MaxCacheEntries` | `2000` | `500` |
| `CacheTTL` | `1h` | `30m` |
| `CacheCleanup` | `5m` | `1m` |
| `WorkerPoolSize` | `4` | `2` |
| `ProcessingTimeout` | `30s` | `10s` |
| `MaxDepth` | `500` | `100` |
| `Audit` | `DefaultAuditConfig()` | `HighSecurityAuditConfig()` |

## Validate

설정의 유효성을 검증합니다.

```go
func (c Config) Validate() error
```

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1
err := cfg.Validate() // ConfigError 반환
```
