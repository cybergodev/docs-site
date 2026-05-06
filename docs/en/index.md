---
layout: home
title: CyberGo
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
</style>
