<template>
  <footer class="site-footer" v-if="show">
    <div class="footer-inner">
      <div class="footer-grid">
        <!-- Brand Column -->
        <div class="footer-col footer-brand">
          <div class="brand-logo">
            <img src="/logo.svg" alt="CyberGo" class="brand-icon" />
            <span class="brand-name">CyberGo</span>
          </div>
          <p class="brand-desc">{{ t.footerBrandDesc }}</p>
          <div class="social-links">
            <a
              href="https://github.com/cybergodev"
              target="_blank"
              rel="noopener"
              class="social-link"
              aria-label="GitHub"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"
                />
              </svg>
            </a>
          </div>
        </div>

        <!-- Community Column -->
        <div class="footer-col">
          <h4 class="col-title">{{ t.footerCommunity }}</h4>
          <ul class="col-links">
            <li>
              <a href="https://github.com/cybergodev" target="_blank" rel="noopener">
                GitHub
                <svg
                  class="external-icon"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                  />
                </svg>
                <span class="sr-only">{{ t.footerOpensInNewWindow }}</span>
              </a>
            </li>
            <li>
              <a
                href="https://github.com/cybergodev/docs-site/issues/new?template=doc-issue.md"
                target="_blank"
                rel="noopener"
              >
                {{ t.footerReportIssue }}
                <span class="sr-only">{{ t.footerOpensInNewWindow }}</span>
              </a>
            </li>
            <li>
              <a href="https://github.com/cybergodev/docs-site" target="_blank" rel="noopener">
                {{ t.footerEditDocs }}
                <span class="sr-only">{{ t.footerOpensInNewWindow }}</span>
              </a>
            </li>
          </ul>
        </div>

        <!-- About Column -->
        <div class="footer-col">
          <h4 class="col-title">{{ t.navAbout }}</h4>
          <ul class="col-links">
            <li>
              <a :href="`/${lang}/about`">{{ t.footerAboutSite }}</a>
            </li>
            <li>
              <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener">
                MIT {{ t.footerLicenseWord }}
                <span class="sr-only">{{ t.footerOpensInNewWindow }}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <span>{{ t.footerCopyright }}</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useData } from 'vitepress'
  import { useUiLabels, useCurrentLang } from '../composables/useUiLabels'

  const { frontmatter } = useData()
  const t = useUiLabels()
  const lang = useCurrentLang()

  // Show the footer only on the home page and on custom (sidebar-less) pages.
  // Derived straight from the reactive frontmatter so it tracks navigation
  // automatically — no imperative onMounted toggle and no route `watch` to set
  // up/clean up. It is also hydration-safe: `frontmatter` is identical on server
  // and client, so the computed resolves the same way in both passes.
  const show = computed(() => {
    const layout = frontmatter.value.layout
    return layout === 'home' || layout === 'page'
  })
</script>
