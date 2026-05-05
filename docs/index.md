---
layout: page
title: Redirecting...
meta:
  - name: robots
    content: noindex
---

<script setup>
import { onMounted } from 'vue'
import { redirectFromRoot } from './.vitepress/theme/composables/useLanguageDetect'

onMounted(() => {
  redirectFromRoot()
})
</script>

<div class="redirect-container">
  <div class="redirect-message">
    <p>Detecting your language preference...</p>
    <p>正在检测您的语言偏好...</p>
    <p>언어 기본 설정을 감지하는 중...</p>
    <p>言語設定を検出中...</p>
    <p>Определение языковых предпочтений...</p>
  </div>
</div>

<style>
.redirect-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
  text-align: center;
}
.redirect-message {
  color: var(--vp-c-text-2);
}
.redirect-message p {
  margin: 0.5rem 0;
}
</style>
