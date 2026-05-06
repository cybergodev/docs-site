import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'
import { enSidebars } from './sidebars/en'

export const enConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  description: 'High-Performance Go Open Source Library Documentation',

  themeConfig: {
    nav: [
      {
        text: 'Projects',
        items: [
          { text: 'JSON', link: '/en/json/' },
          { text: 'JWT', link: '/en/jwt/' },
          { text: 'HTTPC', link: '/en/httpc/' },
          { text: 'HTML', link: '/en/html/' },
          { text: 'DD', link: '/en/dd/' },
          { text: 'ENV', link: '/en/env/' }
        ]
      },
      { text: 'About', link: '/en/about' }
    ],

    sidebar: enSidebars,

    editLink: {
      pattern: 'https://github.com/cybergodev/docs-site/edit/main/docs/en/:path',
      text: 'Edit this page on GitHub'
    },

    footer: {
      message: 'Released under the MIT License · <a href="https://github.com/cybergodev/docs-site/issues/new?template=doc-issue.md" target="_blank">Report a doc issue</a>',
      copyright: 'Copyright © 2026 CyberGoDev'
    },

    docFooter: {
      prev: 'Previous',
      next: 'Next'
    },

    outline: {
      label: 'On this page'
    },

    langMenuLabel: 'Language',
    returnToTopLabel: 'Return to top',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Theme',
    lightModeSwitchTitle: 'Switch to light theme',
    darkModeSwitchTitle: 'Switch to dark theme'
  }
}
