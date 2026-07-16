---
layout: home
title: "CyberGo"
titleTemplate: "고성능 Go 오픈소스 라이브러리 컬렉션"
description: "CyberGo는 Go 언어를 위한 고성능 오픈소스 라이브러리 컬렉션입니다. JSON 처리, JWT 인증, 보안 HTTP 클라이언트, HTML 콘텐츠 추출, 구조화된 로깅, 환경 변수 관리의 6가지 핵심 라이브러리를 제공합니다. 가벼운 설계, 즉시 사용 가능, 최소 의존성으로 고동시성 프로덕션 환경에 신뢰할 수 있는 기반 컴포넌트를 제공합니다."

hero:
  name: CyberGo
  text: 프로덕션 준비 완료 및 극한의 성능
  tagline: 가벼운 설계 / 즉시 사용 가능 / 최소 의존성 / 고성능 / 고동시성 시나리오를 위해
---

<!-- 프로젝트 목록 (shared.ts의 PROJECT_META로 데이터 구동 — 한 곳에서 프로젝트 추가) -->
<ProjectGrid lang="ko" />

<style>
/* Hero 태그라인 반응형 */
@media (min-width: 640px) {
  [class*="tagline"] {
    max-width: 900px !important;
  }
}

@media (min-width: 960px) {
  [class*="container"] {
    padding: 0;
    max-width: 1280px;
  }
}
</style>
