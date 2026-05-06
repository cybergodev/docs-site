---
layout: home
title: CyberGo
titleTemplate: 고성능 Go 오픈소스 라이브러리 컬렉션
description: CyberGo는 Go 언어를 위한 고성능 오픈소스 라이브러리 컬렉션입니다. JSON 처리, JWT 인증, 보안 HTTP 클라이언트, HTML 콘텐츠 추출, 구조화된 로깅, 환경 변수 관리의 6가지 핵심 라이브러리를 제공합니다. 가벼운 설계, 즉시 사용 가능, 최소 의존성으로 고동시성 프로덕션 환경에 신뢰할 수 있는 기반 컴포넌트를 제공합니다.

hero:
  name: CyberGo
  text: 프로덕션 준비 완료 및 극한의 성능
  tagline: 가벼운 설계 / 즉시 사용 가능 / 최소 의존성 / 고성능 / 고동시성 시나리오를 위해
---

<!-- 프로젝트 목록 -->
<div class="home-projects" id="projects">
  <div class="project-grid">
    <div class="project-card" data-href="/ko/json/">
      <a href="/ko/json/" class="card-main">
        <div class="title">
          <span class="icon">📦</span>
          <span>json</span>
        </div>
        <div class="description">
          고성능 스레드 안전 JSON 처리 라이브러리. 파싱, 쿼리, 수정, 검증, 포맷팅 등 풍부한 JSON 조작 기능을 제공합니다.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/json" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ko/jwt/">
      <a href="/ko/jwt/" class="card-main">
        <div class="title">
          <span class="icon">🔑</span>
          <span>jwt</span>
        </div>
        <div class="description">
          프로덕션급 JWT 라이브러리. 단 3개의 함수로 모든 JWT 작업을 완료할 수 있습니다. 보안 보호 및 블랙리스트 관리 기능 내장.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/jwt" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ko/httpc/">
      <a href="/ko/httpc/" class="card-main">
        <div class="title">
          <span class="icon">🌐</span>
          <span>httpc</span>
        </div>
        <div class="description">
          모던 고성능 HTTP 클라이언트. TLS 1.2+, SSRF 방어, 서킷 브레이커, 스마트 재시도, 제로 할당 풀을 지원하며 GC를 90% 감소시킵니다.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/httpc" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ko/html/">
      <a href="/ko/html/" class="card-main">
        <div class="title">
          <span class="icon">📄</span>
          <span>html</span>
        </div>
        <div class="description">
          프로덕션급 HTML 콘텐츠 추출 도구. 스마트 문서 인식을 지원하며 메타데이터가 포함된 이미지, 비디오, 오디오 및 링크를 추출할 수 있습니다.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/html" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ko/dd/">
      <a href="/ko/dd/" class="card-main">
        <div class="title">
          <span class="icon">📝</span>
          <span>dd</span>
        </div>
        <div class="description">
          고성능 로깅 라이브러리. 초당 300만 회 이상의 작업을 처리합니다. 구조화된 로깅, 자동 파일 로테이션, 민감 데이터 필터링을 지원합니다.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/dd" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ko/env/">
      <a href="/ko/env/" class="card-main">
        <div class="title">
          <span class="icon">⚙️</span>
          <span>env</span>
        </div>
        <div class="description">
          프로덕션 준비 완료된 환경 변수 관리 라이브러리. 인메모리 잠금, 감사 로그 기록 및 고동시성을 지원하며 제로 의존성 설계.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/env" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
  </div>
</div>

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
