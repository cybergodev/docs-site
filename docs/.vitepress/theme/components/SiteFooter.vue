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
          <p class="brand-desc">{{ t.brandDesc }}</p>
          <div class="social-links">
            <a
              href="https://github.com/cybergodev"
              target="_blank"
              rel="noopener"
              class="social-link"
              aria-label="GitHub"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
            </a>
          </div>
        </div>

        <!-- Community Column -->
        <div class="footer-col">
          <h4 class="col-title">{{ t.community }}</h4>
          <ul class="col-links">
            <li>
              <a href="https://github.com/cybergodev" target="_blank" rel="noopener">
                GitHub
                <svg class="external-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                </svg>
                <span class="sr-only">{{ t.opensInNewWindow }}</span>
              </a>
            </li>
            <li>
              <a href="https://github.com/cybergodev/docs-site/issues/new?template=doc-issue.md" target="_blank" rel="noopener">
                {{ t.reportIssue }}
                <span class="sr-only">{{ t.opensInNewWindow }}</span>
              </a>
            </li>
            <li>
              <a href="https://github.com/cybergodev/docs-site" target="_blank" rel="noopener">
                {{ t.editDocs }}
                <span class="sr-only">{{ t.opensInNewWindow }}</span>
              </a>
            </li>
          </ul>
        </div>

        <!-- About Column -->
        <div class="footer-col">
          <h4 class="col-title">{{ t.about }}</h4>
          <ul class="col-links">
            <li><a :href="`/${lang}/about`">{{ t.aboutSite }}</a></li>
            <li>
              <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener">
                MIT {{ t.license }}
                <span class="sr-only">{{ t.opensInNewWindow }}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <span>{{ t.copyright }}</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useData, useRouter } from 'vitepress'

const { lang: vpLang, frontmatter } = useData()
const router = useRouter()
const show = ref(false)

function updateVisibility() {
  const layout = frontmatter.value.layout
  // Show footer only on home page and pages without sidebar
  show.value = layout === 'home' || layout === 'page'
}

onMounted(() => {
  updateVisibility()
  watch(() => router.route.path, () => {
    updateVisibility()
  })
})

const lang = computed(() => {
  const l = vpLang.value
  if (l.startsWith('zh')) return 'zh'
  if (l.startsWith('ko')) return 'ko'
  if (l.startsWith('ja')) return 'ja'
  if (l.startsWith('ru')) return 'ru'
  return 'en'
})

type Translations = {
  brandDesc: string
  community: string
  about: string
  aboutSite: string
  reportIssue: string
  editDocs: string
  license: string
  copyright: string
  opensInNewWindow: string
}

const i18n: Record<string, Translations> = {
  zh: {
    brandDesc: '专为 Go 语言打造的高性能开源库集合，涵盖 JSON、JWT、HTTP 客户端、HTML 提取、日志和环境变量管理。',
    community: '社区',
    about: '关于',
    aboutSite: '关于本站',
    reportIssue: '报告文档问题',
    editDocs: '编辑文档',
    license: '许可证',
    copyright: '版权所有 © 2026 CyberGo (cybergo.dev)',
    opensInNewWindow: '（在新窗口打开）'
  },
  en: {
    brandDesc: 'High-performance Go open-source library collection: JSON, JWT, HTTP client, HTML extraction, logging, and environment management.',
    community: 'Community',
    about: 'About',
    aboutSite: 'About This Site',
    reportIssue: 'Report a Doc Issue',
    editDocs: 'Edit Docs',
    license: 'License',
    copyright: 'Copyright © 2026 CyberGo (cybergo.dev)',
    opensInNewWindow: '(opens in new window)'
  },
  ko: {
    brandDesc: 'Go 언어를 위한 고성능 오픈소스 라이브러리 컬렉션: JSON, JWT, HTTP 클라이언트, HTML 추출, 로깅, 환경 변수 관리.',
    community: '커뮤니티',
    about: '소개',
    aboutSite: '이 사이트에 대하여',
    reportIssue: '문서 문제 보고',
    editDocs: '문서 편집',
    license: '라이선스',
    copyright: '저작권 © 2026 CyberGo (cybergo.dev)',
    opensInNewWindow: '(새 창에서 열림)'
  },
  ja: {
    brandDesc: 'Go 言語のための高性能オープンソースライブラリコレクション：JSON、JWT、HTTPクライアント、HTML抽出、ロギング、環境変数管理。',
    community: 'コミュニティ',
    about: '概要',
    aboutSite: 'このサイトについて',
    reportIssue: 'ドキュメントの問題を報告',
    editDocs: 'ドキュメントを編集',
    license: 'ライセンス',
    copyright: 'Copyright © 2026 CyberGo (cybergo.dev)',
    opensInNewWindow: '（新しいウィンドウで開く）'
  },
  ru: {
    brandDesc: 'Коллекция высокопроизводительных библиотек Go: JSON, JWT, HTTP-клиент, извлечение HTML, логирование и управление переменными окружения.',
    community: 'Сообщество',
    about: 'О проекте',
    aboutSite: 'О сайте',
    reportIssue: 'Сообщить о проблеме',
    editDocs: 'Редактировать документацию',
    license: 'Лицензия',
    copyright: '© 2026 CyberGo (cybergo.dev)',
    opensInNewWindow: '(откроется в новом окне)'
  }
}

const t = computed(() => i18n[lang.value] || i18n.en)
</script>
