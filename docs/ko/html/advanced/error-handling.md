---
title: "오류 처리 - HTML"
description: "CyberGo HTML 라이브러리 오류 처리 전체 가이드, 5가지 오류 분류(입력 오류, 설정 오류, 파일 오류, 처리 오류, 시스템 오류), errors.Is 센티넬 오류 판별 패턴, errors.As 구조화된 오류 정보 추출 상세 설명, context 컨텍스트 취소 처리와 배치 처리 부분 실패 처리 패턴을 포함합니다."
---

# 오류 처리

## 오류 분류

HTML 라이브러리의 오류는 다음과 같이 분류됩니다:

| 분류 | 센티넬 오류 | 설명 |
|------|----------|------|
| 입력 오류 | `ErrInputTooLarge`, `ErrInvalidHTML` | 입력 콘텐츠 문제 |
| 설정 오류 | `ErrInvalidConfig`, `ErrMultipleConfigs` | 설정 문제 |
| 파일 오류 | `ErrFileNotFound`, `ErrInvalidFilePath` | 파일 작업 문제 |
| 처리 오류 | `ErrProcessingTimeout`, `ErrMaxDepthExceeded` | 처리 과정 문제 |
| 시스템 오류 | `ErrProcessorClosed`, `ErrInternalPanic` | 내부 상태 문제 |

## errors.Is 패턴

`errors.Is`를 사용하여 오류 유형을 판별합니다:

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        slog.Warn("입력이 너무 큽니다. 문서 크기를 줄이세요")
    case errors.Is(err, html.ErrInvalidHTML):
        slog.Warn("유효하지 않은 HTML입니다. 입력을 확인하세요")
    case errors.Is(err, html.ErrProcessingTimeout):
        slog.Warn("처리 타임아웃. 문서가 너무 복잡할 수 있습니다")
    case errors.Is(err, html.ErrFileNotFound):
        slog.Warn("파일이 존재하지 않습니다")
    case errors.Is(err, html.ErrMaxDepthExceeded):
        slog.Warn("DOM 깊이가 너무 깊습니다. 악의적으로 구성되었을 수 있습니다")
    case errors.Is(err, html.ErrInternalPanic):
        slog.Error("내부 패닉이 복구되었습니다. 이 문제를 보고해 주세요")
    default:
        slog.Error("알 수 없는 오류", "err", err)
    }
}
```

## errors.As 패턴

구조화된 오류 정보를 추출합니다:

```go
var inputErr *html.InputError
var configErr *html.ConfigError
var fileErr *html.FileError

if errors.As(err, &inputErr) {
    fmt.Printf("크기 %d가 제한 %d를 초과함\n", inputErr.Size, inputErr.MaxSize)
}

if errors.As(err, &configErr) {
    fmt.Printf("필드 %s 값 %v이(가) 유효하지 않음: %s\n", configErr.Field, configErr.Value, configErr.Message)
}

if errors.As(err, &fileErr) {
    fmt.Printf("파일 작업: %s\n", fileErr.SafePath())
}
```

## 컨텍스트 취소

`WithContext` 버전을 사용하여 취소를 지원합니다:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
        // 타임아웃
    } else if ctx.Err() == context.Canceled {
        // 수동 취소
    }
}
```

## 배치 오류

배치 처리 결과에는 부분 성공과 부분 실패가 포함됩니다:

```go
batch := p.ExtractBatch(pages)

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("항목 %d 실패: %v\n", i, err)
    }
}

fmt.Printf("성공: %d, 실패: %d, 취소: %d\n",
    batch.Success, batch.Failed, batch.Cancelled)
```
