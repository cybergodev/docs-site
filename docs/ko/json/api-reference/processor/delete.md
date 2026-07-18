---
sidebar_label: "삭제 작업"
title: "Processor 삭제 메서드 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON Processor 삭제 메서드: Delete는 값을 삭제하고 DeleteClean은 null 값과 빈 배열을 자동 정리하며 체이닝을 지원합니다."
sidebar_position: 4
---

# 삭제 메서드

Processor는 지정된 경로의 값을 삭제하고 수정된 JSON 문자열을 반환하는 메서드를 제공합니다.

## Delete

시그니처: `func (p *Processor) Delete(jsonStr, path string, cfg ...Config) (string, error)`

지정된 경로의 값을 삭제하고, 수정된 JSON 문자열을 반환합니다.

```go
result, err := p.Delete(data, "user.temporary")
```

## DeleteClean

시그니처: `func (p *Processor) DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

지정된 경로를 삭제하고 빈 값과 빈 배열을 자동으로 정리합니다.

```go
result, err := p.DeleteClean(data, "user.temporary")
// 삭제 후 생성된 null과 빈 배열을 정리
```

**Delete와 DeleteClean의 차이**:

```go
// 원본 데이터: {"user": {"temp": "value", "name": "test"}}

// Delete 후: {"user": {"name": "test"}}
result, _ := p.Delete(data, "user.temp")

// 삭제 후 부모 객체가 비어있으면 DeleteClean은 계속 정리
// {"user": {}} -> {}
result, _ = p.DeleteClean(data, "user.temp")
```

## 관련 문서

- [수정](./modify) - Set/SetCreate 체인 수정
- [삭제 함수](../functions/delete) - 패키지 레벨 Delete 함수
