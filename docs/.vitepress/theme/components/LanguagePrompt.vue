<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue'
  import { supportedLanguages, STORAGE_KEYS } from '../../shared'
  import { findMatchingLanguage } from '../composables/useLanguageDetect'
  import { useUiLabels, useCurrentLang } from '../composables/useUiLabels'

  /**
   * Browser-language switch prompt.
   *
   * Pure client-side enhancement — does NOT affect SSR/SEO: `visible` starts
   * `false`, so the prompt is absent from the static HTML crawlers receive. It
   * only appears (once) when the user lands on a page whose language differs
   * from their browser language and they have not already made a choice.
   */
  const t = useUiLabels()
  const currentLang = useCurrentLang()
  const visible = ref(false)
  const suggestedPath = ref('')
  const suggestedLabel = ref('')

  // Prompt text with the suggested language name interpolated in.
  const promptText = computed(() =>
    t.value.langPromptTextTemplate.replace('{label}', suggestedLabel.value)
  )

  onMounted(() => {
    if (typeof window === 'undefined') return

    // Respect an explicit prior choice — never prompt again.
    if (localStorage.getItem(STORAGE_KEYS.preference)) return
    // Already dismissed once — don't bother the user again.
    if (localStorage.getItem(STORAGE_KEYS.langPromptDismissed) === 'true') return

    const matched = findMatchingLanguage((navigator.language || '').toLowerCase())
    if (!matched) return

    const suggestedCode = matched.lang.split('-')[0].toLowerCase()
    if (currentLang.value === suggestedCode) return // already on the matching language

    suggestedPath.value = matched.path
    suggestedLabel.value = matched.label
    visible.value = true
  })

  // If the user switches language themselves, the prompt is no longer relevant.
  watch(currentLang, () => {
    visible.value = false
  })

  // Swap only the language prefix, keeping the rest of the path (so an inner
  // page maps to its counterpart in the target language, not the homepage).
  function buildTarget(langPath: string): string {
    let rest = window.location.pathname
    for (const l of supportedLanguages) {
      if (rest.startsWith(l.path)) {
        rest = rest.slice(l.path.length - 1) // keep the leading '/'
        break
      }
    }
    return langPath.slice(0, -1) + rest
  }

  function switchLanguage() {
    const matched = supportedLanguages.find((l) => l.path === suggestedPath.value)
    if (matched) {
      localStorage.setItem(STORAGE_KEYS.preference, matched.lang)
      document.cookie = `${STORAGE_KEYS.preference}=${matched.lang};path=/;max-age=31536000;samesite=lax;secure`
    }
    window.location.assign(buildTarget(suggestedPath.value))
  }

  function dismiss() {
    localStorage.setItem(STORAGE_KEYS.langPromptDismissed, 'true')
    visible.value = false
  }
</script>

<template>
  <Transition name="lang-prompt">
    <div v-if="visible" class="lang-prompt" role="dialog" aria-live="polite">
      <p class="lang-prompt-text">{{ promptText }}</p>
      <div class="lang-prompt-actions">
        <button type="button" class="btn-switch" @click="switchLanguage">
          {{ t.langPromptSwitch }}
        </button>
        <button type="button" class="btn-dismiss" @click="dismiss">
          {{ t.langPromptDismiss }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
  .lang-prompt {
    position: fixed;
    right: 1.5rem;
    bottom: 1.5rem;
    z-index: 100;
    max-width: 320px;
    padding: 1rem 1.15rem;
    border-radius: 12px;
    background: var(--vp-c-bg);
    border: 1px solid var(--vp-c-divider);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14);
  }

  .lang-prompt-text {
    margin: 0 0 0.85rem;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--vp-c-text-1);
  }

  .lang-prompt-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .btn-switch,
  .btn-dismiss {
    padding: 0.45rem 0.95rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
  }

  /* Solid brand fill + paired text token (same pairing as NotFound .btn-primary):
     light #4a7500/#fff = 5.47:1, dark #8ed000/#1b1b1f = 9.13:1. */
  .btn-switch {
    background: var(--cg-brand-solid-bg);
    color: var(--cg-brand-contrast);
  }

  .btn-switch:hover {
    background: var(--cg-brand-solid-bg-hover);
  }

  .btn-dismiss {
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-2);
    border: 1px solid var(--vp-c-divider);
  }

  .btn-dismiss:hover {
    color: var(--vp-c-text-1);
    border-color: var(--vp-c-brand-1);
  }

  .lang-prompt-enter-active,
  .lang-prompt-leave-active {
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;
  }

  .lang-prompt-enter-from,
  .lang-prompt-leave-to {
    opacity: 0;
    transform: translateY(12px);
  }

  /* Reduced motion: keep the (non-moving) opacity fade, drop the slide. */
  @media (prefers-reduced-motion: reduce) {
    .lang-prompt-enter-active,
    .lang-prompt-leave-active {
      transition: opacity 0.2s ease;
    }

    .lang-prompt-enter-from,
    .lang-prompt-leave-to {
      transform: none;
    }
  }

  @media (max-width: 480px) {
    .lang-prompt {
      right: 1rem;
      left: 1rem;
      bottom: 1rem;
      max-width: none;
    }
  }
</style>
