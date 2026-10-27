<script setup lang="ts">
  import { computed } from 'vue'
  import { useRoute } from 'vitepress'
  import { LANG_PATH_RE, LANGS, PRIMARY_LANG, STORAGE_KEYS, type Lang } from '../../shared'
  import { UI_LABELS } from '../../config/labels'
  import ProjectGrid from './ProjectGrid.vue'

  /**
   * The site's ONLY 404 implementation (docs/404.md is frontmatter-only: its
   * body never renders — see the comment there for the VitePress mechanics).
   *
   * Language: VitePress hands the not-found route the bare `notFoundPageData`,
   * which carries no lang, so `useData().lang` is always the root default (zh)
   * no matter which URL missed. The page therefore infers the language from the
   * route path instead: `/{lang}/…` → that language; no prefix → the stored
   * language preference (if any) → the primary language. The 404 page ships as
   * a client-rendered SPA shell (no SSR body in the output), so this
   * route-dependent render has no hydration mismatch. NB: VitePress still runs
   * the SSR render itself during build (only the rendered body is discarded),
   * so browser-only APIs in here must stay behind `import.meta.env.SSR` —
   * the same idiom as theme/index.ts.
   *
   * Labels come straight from UI_LABELS (same single source useUiLabels reads)
   * keyed by the route-derived lang, so the texts, the buttons and the project
   * grid below always agree on one language.
   */
  const route = useRoute()
  const lang = computed<Lang>(() => {
    // Anchored full-path match. The old LANG_PREFIX_RE (^\/(zh|en), no
    // boundary) also matched "/env/some-old-page" and rendered that 404 in
    // English; LANG_PATH_RE requires the WHOLE path to be /{lang} or
    // /{lang}/…, so only a real language prefix wins.
    const m = LANG_PATH_RE.exec(route.path)
    if (m) return m[1] as Lang
    // No language prefix on the failing URL: fall back to the visitor's
    // stored preference (written by the language menu / prompt in full-locale
    // form, e.g. "zh-CN" — normalized the same way redirects.ts
    // codeToLang / the bridge pages' prefLang do) before defaulting to the
    // primary language.
    if (!import.meta.env.SSR) {
      try {
        const pref = localStorage.getItem(STORAGE_KEYS.preference)
        const base = pref?.toLowerCase().split('-')[0]
        if (base && (LANGS as readonly string[]).includes(base)) return base as Lang
      } catch {
        // localStorage unavailable (blocked cookies / privacy mode) — fall through
      }
    }
    return PRIMARY_LANG
  })
  const t = computed(() => UI_LABELS[lang.value])

  /**
   * Anything to go back to? On a direct landing (new tab / external link)
   * history holds only the current entry and history.back() is a dead button —
   * hide it instead. Client-side expression (SSR-guarded: see the comment on
   * `lang` above).
   */
  const canGoBack = !import.meta.env.SSR && window.history.length > 1

  /**
   * Same-language home. The zh home collapses to the canonical root `/` (the
   * `/zh/` mirror canonicalizes there — see config/seo.ts), other languages go
   * to `/{lang}/`. Full navigation (not router.go) so the locale-correct nav
   * and SSR'd page state load fresh.
   */
  const homeHref = computed(() => (lang.value === PRIMARY_LANG ? '/' : `/${lang.value}/`))

  const goHome = () => {
    window.location.replace(homeHref.value)
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
        <button v-if="canGoBack" type="button" class="btn-secondary" @click="goBack">
          {{ t.notFoundGoBack }}
        </button>
      </div>
    </div>

    <!-- Data-driven project grid, same component + classes as the homepage
         (home.css styles .project-grid/.project-card globally). -->
    <div class="not-found-projects">
      <h2 class="not-found-projects-title">{{ t.notFoundBrowse }}</h2>
      <ProjectGrid :lang="lang" />
    </div>
  </div>
</template>

<style scoped>
  .not-found {
    padding: 4rem 1.5rem 5rem;
    text-align: center;
  }

  .not-found-content {
    max-width: 480px;
    margin: 0 auto;
  }

  /* 8rem = WCAG large text → 3:1 floor. The old start stop (#76b900) is
     2.41:1 on white; starting at the text-safe token gives light
     #4a7500 → #5a8b00 (min 4.10:1). Dark is pixel-identical (#8ed000 →
     #76b900). Not exempted as decorative: it is the page's h1. */
  .not-found-code {
    font-size: 8rem;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, var(--cg-brand-text) 0%, var(--vp-c-brand-2) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
  }

  /* Engines without background-clip: text would render the transparent-filled
     404 INVISIBLE — degrade to solid text-safe brand (audit D6). */
  @supports not (background-clip: text) {
    .not-found-code {
      background: none;
      color: var(--cg-brand-text);
      -webkit-text-fill-color: var(--cg-brand-text);
    }
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

  /* Solid brand fill + its paired text token: light #4a7500/#fff = 5.47:1,
     dark #8ed000/#1b1b1f = 9.13:1 (the old brand-1 + constant-white pairing
     was 2.41:1 / 1.88:1 — double fail). Hover deepens per mode via the
     paired hover token (light #3a5c00 = 7.75:1, dark #76b900 = 7.12:1). */
  .btn-primary {
    background: var(--cg-brand-solid-bg);
    color: var(--cg-brand-contrast);
  }

  .btn-primary:hover {
    background: var(--cg-brand-solid-bg-hover);
    transform: translateY(-2px);
  }

  .btn-secondary {
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-1);
    border: 1px solid var(--vp-c-divider);
  }

  .btn-secondary:hover {
    border-color: var(--vp-c-brand-1);
    color: var(--cg-brand-text);
  }

  /* Reduced motion: drop the hover lift, keep color transitions. */
  @media (prefers-reduced-motion: reduce) {
    .btn-primary:hover {
      transform: none;
    }
  }

  .not-found-projects-title {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 4rem 0 1.5rem;
    color: var(--vp-c-text-1);
  }

  /* The page centers its text, but the cards read better left-aligned like on
     the homepage (ProjectGrid is a child component → :deep()). */
  .not-found-projects :deep(.project-card) {
    text-align: left;
  }

  @media (max-width: 640px) {
    .not-found {
      padding: 2.5rem 1rem 3rem;
    }

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

    .not-found-projects-title {
      margin-top: 3rem;
    }
  }
</style>
