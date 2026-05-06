import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'
import { koSidebars } from './sidebars/ko'

export const koConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  description: '고성능 Go 오픈소스 라이브러리 문서',

  themeConfig: {
    nav: [
      {
        text: '프로젝트',
        items: [
          { text: 'JSON', link: '/ko/json/' },
          { text: 'JWT', link: '/ko/jwt/' },
          { text: 'HTTPC', link: '/ko/httpc/' },
          { text: 'HTML', link: '/ko/html/' },
          { text: 'DD', link: '/ko/dd/' },
          { text: 'ENV', link: '/ko/env/' }
        ]
      },
      { text: '소개', link: '/ko/about' }
    ],

    sidebar: koSidebars,

    editLink: {
      pattern: 'https://github.com/cybergodev/docs-site/edit/main/docs/ko/:path',
      text: 'GitHub에서 이 페이지 편집'
    },

    footer: {
      message: 'MIT 라이선스로 배포 · <a href="https://github.com/cybergodev/docs-site/issues/new?template=doc-issue.md" target="_blank">문서 문제 보고</a>',
      copyright: 'Copyright © 2026 CyberGoDev'
    },

    docFooter: {
      prev: '이전',
      next: '다음'
    },

    outline: {
      label: '이 페이지에서'
    },

    langMenuLabel: '언어',
    returnToTopLabel: '맨 위로',
    sidebarMenuLabel: '메뉴',
    darkModeSwitchLabel: '테마',
    lightModeSwitchTitle: '라이트 테마로 전환',
    darkModeSwitchTitle: '다크 테마로 전환'
  }
}
