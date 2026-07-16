<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useData, useRouter } from 'vitepress'
  // Reuse VitePress's own flyout building blocks so this switcher is visually and
  // behaviorally identical to the native one (VPFlyout brings the hover/click,
  // click-outside/ESC, and dropdown positioning; VPMenuLink brings the menu-row
  // styling). Importing the shipped SFCs is stable across vitepress 1.x; the
  // default theme itself imports them the same way.
  import VPFlyout from 'vitepress/dist/client/theme-default/components/VPFlyout.vue'
  import VPMenuLink from 'vitepress/dist/client/theme-default/components/VPMenuLink.vue'
  import { supportedLanguages, PRIMARY_LANG, LANG_PATH_RE } from '../../shared'

  /**
   * Unified language switcher rendered on EVERY page (root `/` included).
   *
   * VitePress's native VPNavBarTranslations only renders on routes that belong to
   * a locale — its useLangs() returns empty localeLinks everywhere else, and the
   * root `/` is deliberately outside every locale (it is the static Chinese
   * homepage for SEO). That left `/` with a different, bespoke switcher while
   * every /{lang}/ page used the native one — an inconsistent header.
   *
   * This component closes the gap by composing the SAME native building blocks
   * (VPFlyout + VPMenuLink) but with a path-aware data source, so every page
   * renders an identical switcher. The native VPNavBarTranslations, the
   * translations group inside VPNavBarExtra, and VPNavScreenTranslations are
   * hidden via CSS (theme/style/overrides.css) to avoid duplicates.
   *
   * Two variants: `bar` (desktop nav flyout, ≥768px) and `screen` (mobile nav
   * drawer list). SSR-friendly via router.route.path.
   */
  const props = defineProps<{ variant?: 'bar' | 'screen' }>()
  const variant = computed(() => props.variant || 'bar')

  const router = useRouter()
  const { theme } = useData()

  // { code, label } per language, derived from the shared single source.
  const LANGS = supportedLanguages.map((l) => ({ code: l.code, label: l.label }))

  // Path-aware language resolution — mirrors useLangs({ correspondingLink: true })
  // but also works on the root `/` (treated as zh, the site default). On a
  // project/inner page the links point to the same sub-path in each other
  // language; on a landing page they point to each language's home.
  const state = computed(() => {
    const path = router.route.path || '/'
    const m = LANG_PATH_RE.exec(path)
    const rest = m ? m[2] || '' : ''
    const currentCode = m ? m[1] : PRIMARY_LANG
    const currentLang = LANGS.find((l) => l.code === currentCode) || LANGS[0]
    const localeLinks = LANGS.filter((l) => l.code !== currentCode).map((l) => ({
      text: l.label,
      link:
        l.code === PRIMARY_LANG
          ? rest
            ? `/${PRIMARY_LANG}${rest}`
            : '/'
          : rest
            ? `/${l.code}${rest}`
            : `/${l.code}/`
    }))
    return { currentLang, localeLinks }
  })

  const ariaLabel = computed(
    () => (theme.value.langMenuLabel as string | undefined) || 'Change language'
  )

  // Mobile drawer expand state
  const screenOpen = ref(false)
  function toggleScreen() {
    screenOpen.value = !screenOpen.value
  }
</script>

<template>
  <!-- Desktop nav flyout -->
  <VPFlyout v-if="variant === 'bar'" class="LanguageMenu" icon="vpi-languages" :label="ariaLabel">
    <div class="items">
      <p class="title">{{ state.currentLang.label }}</p>
      <VPMenuLink v-for="item in state.localeLinks" :key="item.link" :item="item" />
    </div>
  </VPFlyout>

  <!-- Mobile nav drawer list -->
  <div v-else class="LanguageMenuScreen" :class="{ open: screenOpen }">
    <button class="title" type="button" @click="toggleScreen">
      <span class="vpi-languages icon lang" />
      {{ state.currentLang.label }}
      <span class="vpi-chevron-down icon chevron" />
    </button>
    <ul class="list">
      <li v-for="item in state.localeLinks" :key="item.link" class="item">
        <a class="link" :href="item.link">{{ item.text }}</a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
  /* ---- Desktop flyout (bar variant) ----
 * Visible ≥768px: covers the tablet range (768–1280px) where VitePress
 * otherwise buries the switcher inside the "..." menu — which is empty on the
 * root `/` — plus full desktop. Hidden on mobile, where the screen variant in
 * the nav drawer takes over.
 */
  .LanguageMenu {
    display: none;
    align-items: center;
  }

  @media (min-width: 768px) {
    .LanguageMenu {
      display: flex;
    }
  }

  /* Current-language label inside the dropdown (mirrors native VPNavBarTranslations). */
  .LanguageMenu .title {
    padding: 0 24px 0 12px;
    line-height: 32px;
    font-size: 14px;
    font-weight: 700;
    color: var(--vp-c-text-1);
  }

  /* ---- Mobile drawer (screen variant) ---- mirrors native VPNavScreenTranslations. */
  .LanguageMenuScreen {
    height: 24px;
    overflow: hidden;
  }

  .LanguageMenuScreen.open {
    height: auto;
  }

  .LanguageMenuScreen .title {
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 500;
    color: var(--vp-c-text-1);
  }

  .LanguageMenuScreen .icon {
    font-size: 16px;
  }

  .LanguageMenuScreen .icon.lang {
    margin-right: 8px;
  }

  .LanguageMenuScreen .icon.chevron {
    margin-left: 4px;
  }

  .LanguageMenuScreen .list {
    padding: 4px 0 0 24px;
  }

  .LanguageMenuScreen .link {
    display: block;
    line-height: 32px;
    font-size: 13px;
    color: var(--vp-c-text-1);
    text-decoration: none;
  }

  .LanguageMenuScreen .link:hover {
    color: var(--vp-c-brand-1);
  }
</style>
