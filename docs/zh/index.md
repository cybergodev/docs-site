---
layout: home
title: "CyberGo"
titleTemplate: "高性能 Go 开源库集合"
description: "CyberGo 是专为 Go 语言打造的高性能开源库集合，涵盖 JSON 处理、JWT 认证、安全 HTTP 客户端、HTML 内容提取、结构化日志和环境变量管理六大核心库，轻量设计、开箱即用、最小依赖，为高并发生产环境提供可靠的基础组件。"

hero:
  name: CyberGo
  text: 生产就绪与极致性能
  tagline: 轻量设计 / 开箱即用 / 最小依赖 / 高性能 / 为高并发场景打造
---

<!-- 项目列表（由 shared.ts 的 PROJECT_META 数据驱动，加项目只需改一处） -->
<ProjectGrid lang="zh" />

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
