<script setup lang="ts">
import { useUiLabels } from '../composables/useUiLabels'
import { STORAGE_KEYS } from '../../shared'
import { getPreferencePath } from '../composables/useLanguageDetect'

const t = useUiLabels()

const goHome = () => {
  // Honor a previously-saved language preference; otherwise go to the site
  // default homepage (the root `/`, which is the static Chinese homepage).
  let prefix = ''
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEYS.preference)
    if (saved) {
      const prefPath = getPreferencePath(saved)
      if (prefPath) prefix = prefPath.slice(0, -1)
    }
  }
  window.location.replace(`${prefix}/`)
}

const goBack = () => {
  window.history.back()
}
</script>

<template>
  <div class="not-found">
    <div class="not-found-content">
      <h1 class="not-found-code">404</h1>
      <p class="not-found-title">
        {{ t.notFoundTitle }}
      </p>
      <p class="not-found-desc">
        {{ t.notFoundDesc }}
      </p>
      <div class="not-found-actions">
        <button type="button" class="btn-primary" @click="goHome">
          {{ t.notFoundGoHome }}
        </button>
        <button type="button" class="btn-secondary" @click="goBack">
          {{ t.notFoundGoBack }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 64px);
  padding: 2rem;
  text-align: center;
}

.not-found-content {
  max-width: 480px;
}

.not-found-code {
  font-size: 8rem;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, var(--vp-c-brand-1) 0%, var(--vp-c-brand-2) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}

.not-found-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1rem 0;
  color: var(--vp-c-text-1);
}

.not-found-desc {
  font-size: 1rem;
  color: var(--vp-c-text-2);
  margin-bottom: 2rem;
  line-height: 1.6;
}

.not-found-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: var(--vp-c-brand-1);
  color: #fff;
}

.btn-primary:hover {
  background: var(--vp-c-brand-2);
  transform: translateY(-2px);
}

.btn-secondary {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.btn-secondary:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

@media (max-width: 640px) {
  .not-found-code {
    font-size: 5rem;
  }

  .not-found-title {
    font-size: 1.25rem;
  }

  .not-found-actions {
    flex-direction: column;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
