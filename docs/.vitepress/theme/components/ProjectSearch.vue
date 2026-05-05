<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue'
import { useData, useRouter } from 'vitepress'
import MiniSearch from 'minisearch'
import { useProjectPath } from '../composables/useProjectPath'

interface Result {
  id: string
  title: string
  titles: string[]
  text?: string
}

const { localeIndex, theme } = useData()
const router = useRouter()
const { project, projectLabel, searchPrefix } = useProjectPath()

const show = ref(false)
const query = ref('')
const searchInput = ref<HTMLInputElement>()
const scopeAll = ref(false)
const isLoading = ref(false)

const index = shallowRef<MiniSearch<Result> | null>(null)

// Debounce
let debounceTimer: ReturnType<typeof setTimeout>
const debouncedQuery = ref('')

watch(query, (val) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = val
  }, 200)
})

// Load search index
async function loadIndex() {
  if (index.value) return
  isLoading.value = true
  try {
    const localeKey = localeIndex.value || 'root'
    const localSearchIndex = (await import('@localSearchIndex')).default as Record<
      string,
      () => Promise<{ default: string }>
    >
    const loadFn = localSearchIndex[localeKey]
    if (!loadFn) return
    const data = await loadFn()
    let jsonStr: string = data.default
    if (jsonStr.startsWith('"')) {
      jsonStr = JSON.parse(jsonStr)
    }
    index.value = MiniSearch.loadJSON<Result>(jsonStr, {
      fields: ['title', 'titles', 'text'],
      storeFields: ['title', 'titles']
    })
  } catch (e) {
    console.error('Failed to load search index:', e)
  } finally {
    isLoading.value = false
  }
}

// Search results
const results = computed(() => {
  if (!index.value || !debouncedQuery.value.trim()) return []

  const searchResults = index.value
    .search(debouncedQuery.value, {
      fuzzy: 0.2,
      prefix: true,
      boost: { title: 4, text: 2, titles: 1 }
    })
    .slice(0, 16) as (Result & { score: number })[]

  if (!scopeAll.value && searchPrefix.value) {
    const prefix = searchPrefix.value
    return searchResults.filter((r) => r.id.startsWith(prefix))
  }

  return searchResults
})

// Group results by page
const groupedResults = computed(() => {
  const groups: Map<
    string,
    { pageId: string; pageName: string; sections: Result[] }
  > = new Map()

  for (const r of results.value) {
    const pageId = r.id.split('#')[0]
    if (!groups.has(pageId)) {
      const name = r.titles.length > 0 ? r.titles[0] : r.title
      groups.set(pageId, { pageId, pageName: name, sections: [] })
    }
    groups.get(pageId)!.sections.push(r)
  }

  return Array.from(groups.values())
})

// Actions
function open() {
  show.value = true
  scopeAll.value = false
  nextTick(() => {
    searchInput.value?.focus()
  })
  loadIndex()
}

function close() {
  show.value = false
  query.value = ''
  debouncedQuery.value = ''
}

function navigate(id: string) {
  close()
  router.go(id)
}

// Keyboard shortcuts
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    show.value ? close() : open()
  }
  if (e.key === 'Escape' && show.value) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  clearTimeout(debounceTimer)
})

// i18n text based on locale
type SearchTranslations = {
  buttonText: string
  loading: string
  all: string
  placeholder: string
  placeholderProject: (p: string) => string
  noResults: string
  noResultsFallback: string
}

const searchI18n: Record<string, SearchTranslations> = {
  zh: {
    buttonText: '搜索',
    loading: '加载索引...',
    all: '全部',
    placeholder: '搜索文档...',
    placeholderProject: (p: string) => `在 ${p} 中搜索...`,
    noResults: '无法找到相关结果',
    noResultsFallback: '无法找到相关结果'
  },
  en: {
    buttonText: 'Search',
    loading: 'Loading index...',
    all: 'All',
    placeholder: 'Search docs...',
    placeholderProject: (p: string) => `Search in ${p}...`,
    noResults: 'No results found',
    noResultsFallback: 'No results found'
  },
  ko: {
    buttonText: '검색',
    loading: '인덱스 로딩 중...',
    all: '전체',
    placeholder: '문서 검색...',
    placeholderProject: (p: string) => `${p}에서 검색...`,
    noResults: '검색 결과가 없습니다',
    noResultsFallback: '검색 결과가 없습니다'
  },
  ja: {
    buttonText: '検索',
    loading: 'インデックスを読み込み中...',
    all: 'すべて',
    placeholder: 'ドキュメントを検索...',
    placeholderProject: (p: string) => `${p}内で検索...`,
    noResults: '結果が見つかりませんでした',
    noResultsFallback: '結果が見つかりませんでした'
  },
  ru: {
    buttonText: 'Поиск',
    loading: 'Загрузка индекса...',
    all: 'Все',
    placeholder: 'Поиск в документации...',
    placeholderProject: (p: string) => `Искать в ${p}...`,
    noResults: 'Результатов не найдено',
    noResultsFallback: 'Результатов не найдено'
  }
}

function getLocale(): string {
  const l = localeIndex.value || 'en'
  if (l === 'zh') return 'zh'
  if (l === 'ko') return 'ko'
  if (l === 'ja') return 'ja'
  if (l === 'ru') return 'ru'
  return 'en'
}

const i18n = computed(() => {
  const t = searchI18n[getLocale()] || searchI18n.en
  return {
    buttonText: t.buttonText,
    loading: t.loading,
    all: t.all,
    placeholder: projectLabel.value && !scopeAll.value
      ? t.placeholderProject(projectLabel.value)
      : t.placeholder,
    noResults: theme.value.search?.options?.translations?.modal?.noResultsText
      || t.noResultsFallback
  }
})

const isMac = computed(() => {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/.test(navigator.userAgent)
})
</script>

<template>
  <!-- Search Button -->
  <div class="ProjectSearch">
    <button type="button" class="ProjectSearchButton" @click="open">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <span class="button-text">{{ i18n.buttonText }}</span>
      <span v-if="projectLabel" class="scope-badge">{{ projectLabel }}</span>
      <span class="shortcut">
        <kbd>{{ isMac ? '⌘' : 'Ctrl' }}</kbd>
        <kbd>K</kbd>
      </span>
    </button>
  </div>

  <!-- Search Modal -->
  <Teleport to="body">
    <Transition name="search-backdrop">
      <div v-if="show" class="ProjectSearchBackdrop" @click.self="close">
        <div class="ProjectSearchModal">
          <!-- Header -->
          <div class="search-header">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="search-icon"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref="searchInput"
              v-model="query"
              class="search-input"
              :placeholder="i18n.placeholder"
            />
            <div v-if="projectLabel" class="scope-toggle">
              <button
                type="button"
                :class="['scope-btn', { active: !scopeAll }]"
                @click="scopeAll = false"
              >
                {{ projectLabel }}
              </button>
              <button
                type="button"
                :class="['scope-btn', { active: scopeAll }]"
                @click="scopeAll = true"
              >
                {{ i18n.all }}
              </button>
            </div>
            <button type="button" class="esc-btn" @click="close">ESC</button>
          </div>

          <!-- Body -->
          <div class="search-body">
            <div v-if="isLoading" class="search-status">{{ i18n.loading }}</div>
            <template v-else-if="results.length > 0">
              <div
                v-for="group in groupedResults"
                :key="group.pageId"
                class="result-group"
              >
                <div class="group-header">{{ group.pageName }}</div>
                <a
                  v-for="section in group.sections"
                  :key="section.id"
                  :href="section.id"
                  class="result-item"
                  @click.prevent="navigate(section.id)"
                >
                  <div class="result-breadcrumb" v-if="section.titles.length">
                    {{ section.titles.join(' › ') }}
                  </div>
                  <div class="result-title">{{ section.title }}</div>
                </a>
              </div>
            </template>
            <div v-else-if="debouncedQuery.trim()" class="search-status">
              {{ i18n.noResults }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ProjectSearch {
  display: flex;
  align-items: center;
}

.ProjectSearchButton {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.25s ease;
  white-space: nowrap;
}

.ProjectSearchButton:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}

.ProjectSearchButton svg {
  flex-shrink: 0;
  opacity: 0.6;
}

.button-text {
  font-weight: 500;
}

.scope-badge {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

.shortcut {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
}

.shortcut kbd {
  padding: 1px 5px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
  font-family: inherit;
  font-size: 11px;
  line-height: 1.6;
}

/* Backdrop */
.ProjectSearchBackdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  justify-content: center;
  padding-top: 80px;
  background: rgba(0, 0, 0, 0.5);
}

.search-backdrop-enter-active,
.search-backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.search-backdrop-enter-from,
.search-backdrop-leave-to {
  opacity: 0;
}

/* Modal */
.ProjectSearchModal {
  width: 560px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: var(--vp-c-bg-elv);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

/* Header */
.search-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.search-icon {
  flex-shrink: 0;
  color: var(--vp-c-text-3);
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 15px;
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--vp-c-text-3);
}

/* Scope Toggle */
.scope-toggle {
  display: flex;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.scope-btn {
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
}

.scope-btn.active {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.esc-btn {
  padding: 2px 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 0;
}

/* Body */
.search-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.search-status {
  padding: 24px 16px;
  text-align: center;
  color: var(--vp-c-text-3);
  font-size: 14px;
}

/* Result Groups */
.result-group {
  margin-bottom: 4px;
}

.group-header {
  padding: 6px 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--vp-c-text-3);
}

.result-item {
  display: block;
  padding: 8px 16px 8px 28px;
  text-decoration: none;
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: background 0.15s ease;
}

.result-item:hover {
  background: var(--vp-c-bg-soft);
}

.result-breadcrumb {
  font-size: 12px;
  color: var(--vp-c-text-3);
  margin-bottom: 2px;
  line-height: 1.4;
}

.result-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
}

/* Mobile */
@media (max-width: 768px) {
  .ProjectSearchButton .button-text,
  .ProjectSearchButton .shortcut {
    display: none;
  }

  .ProjectSearchButton {
    padding: 6px;
    border-radius: 6px;
  }

  .ProjectSearchBackdrop {
    padding-top: 0;
  }

  .ProjectSearchModal {
    width: 100%;
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .scope-badge {
    font-size: 10px;
  }
}

@media (max-width: 480px) {
  .scope-badge {
    display: none;
  }
}
</style>
