<template>
  <div class="doc-feedback" v-if="show" aria-live="polite">
    <div class="feedback-prompt" v-if="!voted">
      <span class="feedback-text">{{ t.feedbackQuestion }}</span>
      <div class="feedback-buttons">
        <button
          type="button"
          class="feedback-btn"
          :class="{ active: selected === 'yes' }"
          @click="vote('yes')"
          :title="t.feedbackYes"
          :aria-label="t.feedbackYes"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"
            />
          </svg>
          <span>{{ t.feedbackYes }}</span>
        </button>
        <button
          type="button"
          class="feedback-btn"
          :class="{ active: selected === 'no' }"
          @click="vote('no')"
          :title="t.feedbackNo"
          :aria-label="t.feedbackNo"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zM17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"
            />
          </svg>
          <span>{{ t.feedbackNo }}</span>
        </button>
      </div>
    </div>
    <div class="feedback-thanks" v-else>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <span>{{ t.feedbackThanks }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useData } from 'vitepress'
  import { useUiLabels } from '../composables/useUiLabels'
  import { LANGS } from '../../shared'

  const { page } = useData()
  const t = useUiLabels()
  const voted = ref(false)
  const selected = ref<'yes' | 'no' | null>(null)
  const show = ref(false)

  // Matches `{lang}/index.md` and `{lang}/about.md` for every language in LANGS,
  // so adding a language cannot leave this hide-rule behind.
  const HOME_OR_ABOUT_RE = new RegExp(`^(${LANGS.join('|')})\\/(index|about)\\.md$`)

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
    if (relativePath === 'index.md' || HOME_OR_ABOUT_RE.test(relativePath)) {
      show.value = false
      return
    }

    show.value = true

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
