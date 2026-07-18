<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useRouter } from 'vitepress'
  import { useUiLabels } from '../composables/useUiLabels'
  import { useProjectSearch } from '../composables/useProjectSearch'

  /**
   * Project-aware search trigger + modal.
   *
   * Replaces VitePress's built-in search box (disabled in config.mts by not
   * setting `themeConfig.search`). Built-in `local` / `algolia` are both
   * global-index + non-replaceable UI, which conflicts with the per-project
   * scope this site needs: results on a project page must only match that
   * project + the current language.
   *
   * Scope is derived from the route via useProjectContext() — a project page
   * searches only that project's index; any other page (home / about) searches
   * the language-wide `_site` index. The scope badge in the modal reflects the
   * active scope so the user knows what they are searching.
   *
   * Two visual variants mirror LanguageMenu.vue:
   *   - `bar`    desktop navbar icon button (≥768px) → opens a Teleport modal
   *   - `screen` mobile nav drawer inline panel (no modal)
   *
   * Keyboard: Cmd/Ctrl+K or `/` (when not already focused in a field) opens;
   * inside the modal: ↑/↓ move, Enter opens, Esc closes.
   *
   * SSR: only the static trigger button renders; the modal markup is gated on
   * `isOpen` (initially false) so the SSR output contains no modal DOM, and
   * all fetch / listener setup happens in onMounted.
   */
  const props = defineProps<{ variant?: 'bar' | 'screen' }>()
  const variant = computed(() => props.variant || 'bar')

  const router = useRouter()
  const t = useUiLabels()
  const { scope, scopeKey, isLoading, error, search } = useProjectSearch()

  const isOpen = ref(false)
  const query = ref('')
  const results = ref<Awaited<ReturnType<typeof search>>>([])
  const activeIndex = ref(0)
  const inputEl = ref<HTMLInputElement | null>(null)

  /** Scope badge text for the current scope ('仅在 JSON' / '全站'). */
  const scopeText = computed(() => {
    const l = t.value
    if (scope.value === 'project') {
      // scopeKey is the project name on a project route — upper-case it to
      // match the existing nav convention (buildNav renders p.toUpperCase()).
      return l.searchScopeProject.replace('{project}', scopeKey.value.toUpperCase())
    }
    return l.searchScopeSite
  })

  /** Debounce handle for the query watcher. */
  let debounce: ReturnType<typeof setTimeout> | null = null

  async function runSearch() {
    if (!query.value.trim()) {
      results.value = []
      activeIndex.value = 0
      return
    }
    try {
      results.value = await search(query.value)
      activeIndex.value = 0
    } catch {
      results.value = []
    }
  }

  watch(query, () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(runSearch, 120)
  })

  function open() {
    isOpen.value = true
    // Focus the input on next tick so the element exists.
    void nextTick(() => inputEl.value?.focus())
  }
  function close() {
    isOpen.value = false
    query.value = ''
    results.value = []
    activeIndex.value = 0
  }

  function go(url: string) {
    close()
    router.go(url)
  }

  function onKeydown(e: KeyboardEvent) {
    if (!isOpen.value) return
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeIndex.value = (activeIndex.value + 1) % Math.max(results.value.length, 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeIndex.value =
        (activeIndex.value - 1 + Math.max(results.value.length, 1)) %
        Math.max(results.value.length, 1)
    } else if (e.key === 'Enter') {
      const r = results.value[activeIndex.value]
      if (r) {
        e.preventDefault()
        go(r.url)
      }
    }
  }

  /** Global shortcut: Cmd/Ctrl+K, or `/` when no field is focused. */
  function onGlobalKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      isOpen.value ? close() : open()
      return
    }
    if (e.key === '/' && !isOpen.value) {
      const el = document.activeElement
      const tag = el?.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(el && (el as HTMLElement).isContentEditable)) {
        e.preventDefault()
        open()
      }
    }
  }

  // Route changes close an open modal so the user never sees stale results
  // for the previous scope.
  watch(
    () => router.route.path,
    () => {
      if (isOpen.value) close()
    }
  )

  onMounted(() => {
    window.addEventListener('keydown', onGlobalKeydown)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onGlobalKeydown)
    if (debounce) clearTimeout(debounce)
  })

  /** Truncate a string for the description line in the result list. */
  function truncate(s: string, n: number): string {
    const v = s.trim()
    return v.length > n ? v.slice(0, n - 1) + '…' : v
  }
</script>

<template>
  <!-- bar variant: desktop navbar icon button, hidden <768px (screen variant takes over). -->
  <button
    v-if="variant === 'bar'"
    type="button"
    class="ProjectSearchTrigger"
    :aria-label="t.searchAriaLabel"
    @click="open"
  >
    <span class="vpi-search icon" />
    <span class="trigger-text">{{ t.searchPlaceholder }}</span>
    <span class="shortcut">⌘K</span>
  </button>

  <!-- screen variant: mobile drawer inline panel. -->
  <div v-else class="ProjectSearchScreen">
    <div class="screen-row">
      <span class="vpi-search icon" />
      <input
        v-model="query"
        type="search"
        class="screen-input"
        :placeholder="t.searchPlaceholder"
        :aria-label="t.searchAriaLabel"
        @keydown="onKeydown"
      />
    </div>
    <div class="screen-meta">
      <span class="scope">{{ scopeText }}</span>
      <span v-if="isLoading" class="loading">{{ t.searchLoading }}</span>
    </div>
    <ul v-if="results.length" class="screen-results">
      <li
        v-for="(r, i) in results"
        :key="r.url"
        class="result"
        :class="{ active: i === activeIndex }"
      >
        <a :href="r.url" class="result-link" @click.prevent="go(r.url)">
          <span class="result-title">{{ r.title }}</span>
          <span v-if="r.headings" class="result-crumb">{{ r.headings }}</span>
          <span v-if="r.description" class="result-desc">{{ truncate(r.description, 90) }}</span>
        </a>
      </li>
    </ul>
    <p v-else-if="query.trim() && !isLoading" class="empty">{{ t.searchNoResults }}</p>
  </div>

  <!-- bar modal (Teleport, only rendered client-side when open). -->
  <Teleport v-if="variant === 'bar' && isOpen" to="body">
    <div class="ProjectSearchOverlay" @click.self="close">
      <div
        class="ProjectSearchModal"
        role="dialog"
        :aria-label="t.searchAriaLabel"
        @keydown="onKeydown"
      >
        <div class="modal-bar">
          <span class="vpi-search icon leading" />
          <input
            ref="inputEl"
            v-model="query"
            type="search"
            class="modal-input"
            :placeholder="t.searchPlaceholder"
            :aria-label="t.searchAriaLabel"
          />
          <span class="scope-badge">
            <span class="scope-label">{{ t.searchScopeLabel }}:</span>
            <span class="scope-value">{{ scopeText }}</span>
          </span>
          <button type="button" class="close-btn" :aria-label="t.searchClose" @click="close">
            <svg class="close-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p v-if="isLoading" class="loading">{{ t.searchLoading }}</p>
          <p v-else-if="error" class="error">{{ t.searchNoResults }}</p>
          <p v-else-if="!query.trim()" class="hint"><!-- empty state; keep DOM stable --></p>
          <p v-else-if="!results.length" class="empty">{{ t.searchNoResults }}</p>
          <ul v-else class="modal-results">
            <li
              v-for="(r, i) in results"
              :key="r.url"
              class="result"
              :class="{ active: i === activeIndex }"
              @mousemove="activeIndex = i"
            >
              <a :href="r.url" class="result-link" @click.prevent="go(r.url)">
                <span class="result-title">{{ r.title }}</span>
                <span v-if="r.headings" class="result-crumb">{{ r.headings }}</span>
                <span v-if="r.description" class="result-desc">{{
                  truncate(r.description, 90)
                }}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Teleport>
</template>
