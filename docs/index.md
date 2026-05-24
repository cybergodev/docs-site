---
layout: home
title: "CyberGo"
titleTemplate: High-Performance Go Open Source Libraries
description: "Production-ready Go library collection: JSON processing, JWT authentication, HTTP client, HTML extraction, structured logging, and environment management."

hero:
  name: CyberGo
  text: Production-Ready with Ultimate Performance
  tagline: Lightweight Design / Ready to Use / Minimal Dependencies / High Performance / Built for High Concurrency
---

<!-- Project List -->
<div class="home-projects" id="projects">
  <div class="project-grid">
    <div class="project-card" data-href="/en/json/">
      <a href="/en/json/" class="card-main">
        <div class="title">
          <span class="icon">📦</span>
          <span>json</span>
        </div>
        <div class="description">
          High-performance, thread-safe JSON processing library. Provides rich JSON operations including parsing, querying, modifying, validating, and formatting.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/json" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/en/jwt/">
      <a href="/en/jwt/" class="card-main">
        <div class="title">
          <span class="icon">🔑</span>
          <span>jwt</span>
        </div>
        <div class="description">
          Production-grade JWT library that handles all JWT operations with just 3 functions. Built-in security protection and blacklist management.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/jwt" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/en/httpc/">
      <a href="/en/httpc/" class="card-main">
        <div class="title">
          <span class="icon">🌐</span>
          <span>httpc</span>
        </div>
        <div class="description">
          Modern high-performance HTTP client. Supports TLS 1.2+, SSRF protection, circuit breaker, smart retry, zero-allocation pooling, reducing GC by 90%.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/httpc" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/en/html/">
      <a href="/en/html/" class="card-main">
        <div class="title">
          <span class="icon">📄</span>
          <span>html</span>
        </div>
        <div class="description">
          Production-grade HTML content extraction tool. Supports intelligent article recognition, extracting images, videos, audio, and links with metadata.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/html" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/en/dd/">
      <a href="/en/dd/" class="card-main">
        <div class="title">
          <span class="icon">📝</span>
          <span>dd</span>
        </div>
        <div class="description">
          High-performance logging library processing over 3 million operations per second. Supports structured logging, automatic file rotation, and sensitive data filtering.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/dd" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/en/env/">
      <a href="/en/env/" class="card-main">
        <div class="title">
          <span class="icon">⚙️</span>
          <span>env</span>
        </div>
        <div class="description">
          Production-ready environment variable management library. Supports memory locking, audit logging, and high concurrency with zero-dependency design.
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

<!-- Language links for SEO and manual switching -->
<div class="lang-hint">
  <span>Also available in:</span>
  <a href="/zh/">简体中文</a>
  <a href="/ko/">한국어</a>
  <a href="/ja/">日本語</a>
  <a href="/ru/">Русский</a>
</div>

<style>
/* Hero tagline responsive */
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

/* Language hint bar */
.lang-hint {
  max-width: 1200px;
  margin: 2rem auto 0;
  padding: 1rem 0;
  text-align: center;
  color: var(--vp-c-text-3);
  font-size: 0.85rem;
}

.lang-hint span {
  margin-right: 0.5rem;
}

.lang-hint a {
  color: var(--vp-c-text-2);
  text-decoration: none;
  margin: 0 0.4rem;
  transition: color 0.2s ease;
}

.lang-hint a:hover {
  color: var(--vp-c-brand-1);
}
</style>
