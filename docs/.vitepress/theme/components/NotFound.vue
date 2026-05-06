<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useData } from 'vitepress'
import { PROJECTS } from '../../shared'
import { STORAGE_KEYS } from '../../locales/languages'
import { findMatchingLanguage, getPreferencePath } from '../composables/useLanguageDetect'

const { lang } = useData()

type NotFoundTranslations = {
  title: string
  desc: string
  goHome: string
  goBack: string
}

const notFoundI18n: Record<string, NotFoundTranslations> = {
  zh: { title: '页面未找到', desc: '抱歉，您访问的页面不存在或已被移除。', goHome: '返回首页', goBack: '返回上页' },
  en: { title: 'Page Not Found', desc: 'Sorry, the page you are looking for does not exist or has been removed.', goHome: 'Go Home', goBack: 'Go Back' },
  ko: { title: '페이지를 찾을 수 없습니다', desc: '죄송합니다. 요청하신 페이지가 존재하지 않거나 삭제되었습니다.', goHome: '홈으로', goBack: '뒤로 가기' },
  ja: { title: 'ページが見つかりません', desc: '申し訳ありません。お探しのページは存在しないか、削除されました。', goHome: 'ホームへ', goBack: '戻る' },
  ru: { title: 'Страница не найдена', desc: 'Извините, запрашиваемая страница не существует или была удалена.', goHome: 'На главную', goBack: 'Назад' }
}

function getLangKey(): string {
  const l = lang.value || ''
  if (l.startsWith('zh')) return 'zh'
  if (l.startsWith('ko')) return 'ko'
  if (l.startsWith('ja')) return 'ja'
  if (l.startsWith('ru')) return 'ru'
  return 'en'
}

const t = computed(() => notFoundI18n[getLangKey()] || notFoundI18n.en)

function detectLangPrefix(): string {
  if (typeof window === 'undefined') return '/en'
  const saved = localStorage.getItem(STORAGE_KEYS.preference)
  if (saved) {
    const prefPath = getPreferencePath(saved)
    if (prefPath) return prefPath.slice(0, -1)
  }
  const browserLang = (navigator.language || '').toLowerCase()
  const matched = findMatchingLanguage(browserLang)
  return matched ? matched.path.slice(0, -1) : '/en'
}

onMounted(() => {
  // Auto-redirect bare project paths (production fallback for static hosting)
  const pathname = window.location.pathname
  const isBare = PROJECTS.some(p =>
    pathname === `/${p}` || pathname === `/${p}/`
  )
  if (isBare) {
    window.location.replace(detectLangPrefix() + pathname)
  }
})

const goHome = () => {
  const prefix = detectLangPrefix()
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
        {{ t.title }}
      </p>
      <p class="not-found-desc">
        {{ t.desc }}
      </p>
      <div class="not-found-actions">
        <button type="button" class="btn-primary" @click="goHome">
          {{ t.goHome }}
        </button>
        <button type="button" class="btn-secondary" @click="goBack">
          {{ t.goBack }}
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
