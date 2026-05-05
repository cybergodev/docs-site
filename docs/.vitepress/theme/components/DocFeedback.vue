<template>
  <div class="doc-feedback" v-if="show">
    <div class="feedback-prompt" v-if="!voted">
      <span class="feedback-text">{{ t.question }}</span>
      <div class="feedback-buttons">
        <button
          class="feedback-btn"
          :class="{ active: selected === 'yes' }"
          @click="vote('yes')"
          :title="t.yes"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
          </svg>
          <span>{{ t.yes }}</span>
        </button>
        <button
          class="feedback-btn"
          :class="{ active: selected === 'no' }"
          @click="vote('no')"
          :title="t.no"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zM17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
          </svg>
          <span>{{ t.no }}</span>
        </button>
      </div>
    </div>
    <div class="feedback-thanks" v-else>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>{{ t.thanks }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useData } from 'vitepress'

const { lang: vpLang, page } = useData()
const voted = ref(false)
const selected = ref<'yes' | 'no' | null>(null)
const show = ref(true)

const lang = computed(() => {
  const l = vpLang.value
  if (l.startsWith('zh')) return 'zh'
  if (l.startsWith('ko')) return 'ko'
  if (l.startsWith('ja')) return 'ja'
  if (l.startsWith('ru')) return 'ru'
  return 'en'
})

type FeedbackTexts = {
  question: string
  yes: string
  no: string
  thanks: string
}

const i18n: Record<string, FeedbackTexts> = {
  zh: {
    question: '本文有帮助吗？',
    yes: '有帮助',
    no: '没帮助',
    thanks: '感谢您的反馈！'
  },
  en: {
    question: 'Was this page helpful?',
    yes: 'Yes',
    no: 'No',
    thanks: 'Thanks for your feedback!'
  },
  ko: {
    question: '이 페이지가 도움이 되었나요?',
    yes: '도움 됨',
    no: '도움 안 됨',
    thanks: '피드백 감사합니다!'
  },
  ja: {
    question: 'このページは役に立ちましたか？',
    yes: '役に立った',
    no: '役に立たなかった',
    thanks: 'フィードバックありがとうございます！'
  },
  ru: {
    question: 'Была ли эта страница полезной?',
    yes: 'Да',
    no: 'Нет',
    thanks: 'Спасибо за отзыв!'
  }
}

const t = computed(() => i18n[lang.value] || i18n.en)

function vote(choice: 'yes' | 'no') {
  selected.value = choice
  voted.value = true
  if (typeof window !== 'undefined') {
    try {
      const key = `doc-feedback-${page.value.relativePath}`
      localStorage.setItem(key, choice)
    } catch {}
  }
}

onMounted(() => {
  if (typeof window === 'undefined') return

  // Hide on home page, about page, and root redirect page
  const relativePath = page.value.relativePath
  if (relativePath === 'index.md' || relativePath.match(/^(zh|en|ko|ja|ru)\/index\.md$/) || relativePath.match(/^(zh|en|ko|ja|ru)\/about\.md$/)) {
    show.value = false
    return
  }

  // Check if already voted
  try {
    const key = `doc-feedback-${page.value.relativePath}`
    const existing = localStorage.getItem(key)
    if (existing) {
      selected.value = existing as 'yes' | 'no'
      voted.value = true
    }
  } catch {}
})
</script>
