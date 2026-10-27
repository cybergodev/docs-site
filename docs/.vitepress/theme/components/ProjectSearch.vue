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
   * inside the modal: ↑/↓ move (the active option scrolls into view), Enter
   * opens, Esc closes and returns focus to the trigger, Tab cycles within
   * the modal (focus trap). The screen variant shares arrow/Enter handling
   * but is an inline drawer, not an overlay dialog — no trap.
   *
   * SSR: only the static trigger button renders; the modal markup is gated on
   * `isOpen` (initially false) so the SSR output contains no modal DOM, and
   * all fetch / listener setup happens in onMounted.
   */
  const props = defineProps<{ variant?: 'bar' | 'screen' }>()
  const variant = computed(() => props.variant || 'bar')

  const router = useRouter()
  const t = useUiLabels()
  const { scope, scopeKey, isLoading, error, search, preload } = useProjectSearch()

  const isOpen = ref(false)
  const query = ref('')
  const results = ref<Awaited<ReturnType<typeof search>>>([])
  const activeIndex = ref(0)
  const inputEl = ref<HTMLInputElement | null>(null)
  /** Modal container (focus-trap scope) and trigger button (focus return). */
  const modalEl = ref<HTMLDivElement | null>(null)
  const triggerEl = ref<HTMLButtonElement | null>(null)

  /**
   * Stable DOM ids for the combobox wiring (aria-controls /
   * aria-activedescendant / scroll-following). Prefixed `cg-search-` so they
   * can never collide with page-content ids; variant-suffixed so the modal
   * and the mobile screen panel can never collide with each other.
   */
  const listboxId = computed(() => `cg-search-listbox-${variant.value}`)
  const optionId = (i: number) => `cg-search-opt-${variant.value}-${i}`

  /** Id of the keyboard-active option; undefined (attribute omitted) when the
   * listbox is not rendered, so aria-activedescendant never dangles. */
  const activeDescendantId = computed(() =>
    results.value.length ? optionId(activeIndex.value) : undefined
  )

  /**
   * Platform-adaptive shortcut hint (⌘ K on Apple platforms, Ctrl K
   * elsewhere). Starts as the non-Mac value on BOTH server and client —
   * `navigator` does not exist during SSR — and is flipped only in
   * onMounted, i.e. after hydration, so the server HTML and the first
   * client render stay identical (no hydration mismatch warning).
   * Not a UI_LABELS string: it is a platform symbol, not translatable copy.
   */
  const isMac = ref(false)
  const shortcutHint = computed(() => (isMac.value ? '⌘ K' : 'Ctrl K'))

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
    // Opening the box is an explicit intent signal — warm the index so the
    // first query doesn't pay the fetch + parse cost. Fire-and-forget;
    // preload swallows warm-up failures (a real search() reports them).
    void preload()
    // Focus the input on next tick so the element exists.
    void nextTick(() => inputEl.value?.focus())
  }
  function close() {
    isOpen.value = false
    query.value = ''
    results.value = []
    activeIndex.value = 0
    // Return focus to the trigger so keyboard users are not stranded on
    // <body>. nextTick waits for the teleported modal to unmount (its removal
    // would otherwise reset focus to body). If the trigger is already gone
    // (route changed), the optional chain degrades to a no-op, never throws.
    void nextTick(() => triggerEl.value?.focus())
  }

  function go(url: string) {
    close()
    router.go(url)
  }

  /**
   * Keep the keyboard-active option in view: the modal body is a 70vh scroll
   * container, so without this, arrowing past roughly the 6th result moves
   * the selection to a row the user cannot see. Called ONLY from keydown
   * handlers — never during render — so document access stays client-side
   * (SSR-safe). The option elements already exist by the time arrows fire;
   * the optional chain covers a mid-debounce results swap.
   */
  function scrollToActive(): void {
    document.getElementById(optionId(activeIndex.value))?.scrollIntoView({
      block: 'nearest'
    })
  }

  /** Focusable candidates for the modal Tab loop. Scoped to the modal's own
   * teleported markup (this component's DOM, not VitePress internals), and
   * read-only — queried, never mutated. */
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

  /** Cycle Tab / Shift+Tab inside the modal (first ↔ last wrap-around) so
   * focus cannot escape into the inert background — out there, keydown no
   * longer reaches the dialog and Esc would stop working. */
  function trapTab(e: KeyboardEvent): void {
    const root = modalEl.value
    if (!root) return
    const els = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    if (!els.length) return
    e.preventDefault()
    const current = els.indexOf(document.activeElement as HTMLElement)
    if (current === -1) {
      // Focus somehow outside the modal: re-enter from the matching end.
      els[e.shiftKey ? els.length - 1 : 0].focus()
      return
    }
    const delta = e.shiftKey ? -1 : 1
    els[(current + delta + els.length) % els.length].focus()
  }

  function onKeydown(e: KeyboardEvent) {
    // IME composition guard (Chinese/Japanese/Korean input): while composing,
    // Enter commits the candidate, Escape cancels the composition, and arrows
    // move the IME candidate window — none of which may be hijacked for
    // modal control, or a pinyin user commits a candidate and instantly
    // navigates away / loses the whole query. keyCode 229 covers browsers
    // that fire keydown before clearing isComposing (Safari legacy).
    if (e.isComposing || e.keyCode === 229) return
    // bar: live only while the modal is open. screen: always live — the panel
    // has no open/close state of its own; the drawer's visibility IS the
    // state. (The old `!isOpen.value` guard silently disabled arrow/Enter
    // handling for the screen variant entirely.)
    if (variant.value === 'bar' && !isOpen.value) return
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeIndex.value = (activeIndex.value + 1) % Math.max(results.value.length, 1)
      scrollToActive()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeIndex.value =
        (activeIndex.value - 1 + Math.max(results.value.length, 1)) %
        Math.max(results.value.length, 1)
      scrollToActive()
    } else if (e.key === 'Enter') {
      // Activate the active option only when Enter originates from the input
      // (the combobox). Elsewhere in the modal — the close button, a result
      // link — Enter keeps its native activation semantics.
      if (e.target instanceof HTMLInputElement) {
        const r = results.value[activeIndex.value]
        if (r) {
          e.preventDefault()
          go(r.url)
        }
      }
    } else if (e.key === 'Tab') {
      // Modal only: an overlay dialog traps focus. The screen variant is an
      // inline drawer — Tab flows naturally through the page.
      if (variant.value === 'bar') trapTab(e)
    }
  }

  /**
   * Global shortcut: Cmd/Ctrl+K, or `/` when no field is focused.
   *
   * No IME-composition guard here (unlike onKeydown): this handler has no
   * Enter/Escape branches to protect. Cmd/Ctrl+K is a modifier chord the IME
   * never consumes as text, so opening search mid-composition stays available
   * on purpose; `/` is already gated on "no field focused", and during
   * composition focus is necessarily inside an input. If an Enter/Escape
   * branch is ever added here, add the `e.isComposing || e.keyCode === 229`
   * guard to it first.
   */
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
  // for the previous scope. When the modal is NOT open (bar variant closed;
  // screen variant, whose drawer visibility is external state), the query and
  // results are still cleared unconditionally — reopening the screen drawer
  // or the modal on a new route must never resurrect the previous scope's
  // typed query or result list.
  watch(
    () => router.route.path,
    () => {
      if (isOpen.value) {
        close()
        return
      }
      query.value = ''
      results.value = []
      activeIndex.value = 0
    }
  )

  /**
   * The screen (mobile drawer) variant has no open() flow of its own — the
   * panel is always mounted once the drawer is visible. Focusing its input is
   * the equivalent intent signal, so warm the index there too.
   */
  function onScreenInputFocus() {
    void preload()
  }

  onMounted(() => {
    window.addEventListener('keydown', onGlobalKeydown)
    // Platform detection must happen here, not in setup: `navigator` is
    // unavailable during SSR. The label flips only after hydration.
    // navigator.platform is deprecated: prefer the UA-CH platform when the
    // browser exposes it (Chromium), then fall back to navigator.platform
    // ("MacIntel" — desktop Safari) and the UA string (catches iPhone/iPad,
    // "… like Mac OS X").
    type NavigatorWithUAData = Navigator & { userAgentData?: { platform?: string } }
    const platform =
      (navigator as NavigatorWithUAData).userAgentData?.platform || navigator.platform || ''
    isMac.value = /mac/i.test(platform) || /Mac/i.test(navigator.userAgent)
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
    ref="triggerEl"
    type="button"
    class="ProjectSearchTrigger"
    :aria-label="t.searchAriaLabel"
    @click="open"
  >
    <span class="vpi-search icon" />
    <span class="trigger-text">{{ t.searchPlaceholder }}</span>
    <span class="shortcut">{{ shortcutHint }}</span>
  </button>

  <!-- screen variant: mobile drawer inline panel. -->
  <div v-else class="ProjectSearchScreen">
    <div class="screen-row">
      <span class="vpi-search icon" />
      <input
        v-model="query"
        type="search"
        class="screen-input"
        role="combobox"
        aria-haspopup="listbox"
        aria-autocomplete="list"
        :aria-expanded="results.length > 0"
        :aria-controls="results.length ? listboxId : undefined"
        :aria-activedescendant="activeDescendantId"
        :placeholder="t.searchPlaceholder"
        :aria-label="t.searchAriaLabel"
        @keydown="onKeydown"
        @focus="onScreenInputFocus"
      />
    </div>
    <div class="screen-meta">
      <span class="scope">{{ scopeText }}</span>
      <span v-if="isLoading" class="loading">{{ t.searchLoading }}</span>
    </div>
    <ul v-if="results.length" class="screen-results" :id="listboxId" role="listbox">
      <li
        v-for="(r, i) in results"
        :key="r.url"
        :id="optionId(i)"
        class="result"
        :class="{ active: i === activeIndex }"
        role="option"
        :aria-selected="i === activeIndex"
      >
        <a :href="r.url" class="result-link" @click.prevent="go(r.url)">
          <span class="result-title">{{ r.title }}</span>
          <span v-if="r.headings" class="result-crumb">{{ r.headings }}</span>
          <span v-if="r.description" class="result-desc">{{ truncate(r.description, 90) }}</span>
        </a>
      </li>
    </ul>
    <!-- Same error/empty distinction as the bar modal (load failure ≠ no
         results); shown before the empty state so a failed index load is
         never misreported as "no results". -->
    <p v-else-if="error && !isLoading" class="error">{{ t.searchError }}</p>
    <p v-else-if="query.trim() && !isLoading" class="empty">{{ t.searchNoResults }}</p>
  </div>

  <!-- bar modal (Teleport, only rendered client-side when open). -->
  <Teleport v-if="variant === 'bar' && isOpen" to="body">
    <div class="ProjectSearchOverlay" @click.self="close">
      <div
        ref="modalEl"
        class="ProjectSearchModal"
        role="dialog"
        aria-modal="true"
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
            role="combobox"
            aria-haspopup="listbox"
            aria-autocomplete="list"
            :aria-expanded="results.length > 0"
            :aria-controls="results.length ? listboxId : undefined"
            :aria-activedescendant="activeDescendantId"
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
          <!-- Index-load failure is NOT "no results" — its own label so the
               user knows a retry may help instead of concluding the docs lack
               a match. -->
          <p v-else-if="error" class="error">{{ t.searchError }}</p>
          <p v-else-if="!query.trim()" class="hint"><!-- empty state; keep DOM stable --></p>
          <p v-else-if="!results.length" class="empty">{{ t.searchNoResults }}</p>
          <ul v-else class="modal-results" :id="listboxId" role="listbox">
            <li
              v-for="(r, i) in results"
              :key="r.url"
              :id="optionId(i)"
              class="result"
              :class="{ active: i === activeIndex }"
              role="option"
              :aria-selected="i === activeIndex"
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
