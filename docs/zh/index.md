---
layout: home
title: "CyberGo"
titleTemplate: 高性能 Go 开源库集合
description: "CyberGo 是专为 Go 语言打造的高性能开源库集合，涵盖 JSON 处理、JWT 认证、安全 HTTP 客户端、HTML 内容提取、结构化日志和环境变量管理六大核心库，轻量设计、开箱即用、最小依赖，为高并发生产环境提供可靠的基础组件。"

hero:
  name: CyberGo
  text: 生产就绪与极致性能
  tagline: 轻量设计 / 开箱即用 / 最小依赖 / 高性能 / 为高并发场景打造
---

<!-- 项目列表 -->
<div class="home-projects" id="projects">
  <div class="project-grid">
    <div class="project-card" data-href="/zh/json/">
      <a href="/zh/json/" class="card-main">
        <div class="title">
          <span class="icon">📦</span>
          <span>json</span>
        </div>
        <div class="description">
          高性能、线程安全的 JSON 处理库。提供丰富的 JSON 操作功能，包括解析、查询、修改、验证和格式化。
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/json" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/zh/jwt/">
      <a href="/zh/jwt/" class="card-main">
        <div class="title">
          <span class="icon">🔑</span>
          <span>jwt</span>
        </div>
        <div class="description">
          生产级 JWT 库，仅需 3 个函数即可完成所有 JWT 操作。内置安全保护和黑名单管理功能。
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/jwt" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/zh/httpc/">
      <a href="/zh/httpc/" class="card-main">
        <div class="title">
          <span class="icon">🌐</span>
          <span>httpc</span>
        </div>
        <div class="description">
          现代高性能 HTTP 客户端。支持 TLS 1.2+、SSRF 防护、断路器、智能重试、零分配池，将 GC 减少 90%。
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/httpc" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/zh/html/">
      <a href="/zh/html/" class="card-main">
        <div class="title">
          <span class="icon">📄</span>
          <span>html</span>
        </div>
        <div class="description">
          生产级 HTML 内容提取工具。支持智能文章识别，可提取带元数据的图片、视频、音频及链接。
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/html" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/zh/dd/">
      <a href="/zh/dd/" class="card-main">
        <div class="title">
          <span class="icon">📝</span>
          <span>dd</span>
        </div>
        <div class="description">
          高性能日志库，每秒处理超过 300 万次操作。支持结构化日志、自动文件轮换、敏感数据过滤。
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/dd" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/zh/env/">
      <a href="/zh/env/" class="card-main">
        <div class="title">
          <span class="icon">⚙️</span>
          <span>env</span>
        </div>
        <div class="description">
          生产就绪的环境变量管理库。支持内存锁定、审计日志记录和高并发，零依赖设计。
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
/* Hero tagline 响应式 */
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
