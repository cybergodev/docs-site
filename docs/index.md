---
layout: page
title: Redirecting...
description: CyberGo - High-Performance Go Open Source Libraries
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
