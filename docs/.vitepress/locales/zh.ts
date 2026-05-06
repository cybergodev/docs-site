import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'
import { zhSidebars } from './sidebars/zh'

export const zhConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  description: '高性能 Go 开源库文档',

  themeConfig: {
    nav: [
      {
        text: '项目',
        items: [
          { text: 'JSON', link: '/zh/json/' },
          { text: 'JWT', link: '/zh/jwt/' },
          { text: 'HTTPC', link: '/zh/httpc/' },
          { text: 'HTML', link: '/zh/html/' },
          { text: 'DD', link: '/zh/dd/' },
          { text: 'ENV', link: '/zh/env/' }
        ]
      },
      { text: '关于', link: '/zh/about' }
    ],

    sidebar: zhSidebars,

    editLink: {
      pattern: 'https://github.com/cybergodev/docs-site/edit/main/docs/zh/:path',
      text: '在 GitHub 编辑此页'
    },

    footer: {
      message: '基于 MIT 许可发布 · <a href="https://github.com/cybergodev/docs-site/issues/new?template=doc-issue.md" target="_blank">报告文档问题</a>',
      copyright: 'Copyright © 2026 CyberGoDev'
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    outline: {
      label: '页面导航'
    },

    langMenuLabel: '多语言',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式'
  }
}
