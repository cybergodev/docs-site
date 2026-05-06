import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'
import { jaSidebars } from './sidebars/ja'

export const jaConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  description: '高性能 Go オープンソースライブラリドキュメント',

  themeConfig: {
    nav: [
      {
        text: 'プロジェクト',
        items: [
          { text: 'JSON', link: '/ja/json/' },
          { text: 'JWT', link: '/ja/jwt/' },
          { text: 'HTTPC', link: '/ja/httpc/' },
          { text: 'HTML', link: '/ja/html/' },
          { text: 'DD', link: '/ja/dd/' },
          { text: 'ENV', link: '/ja/env/' }
        ]
      },
      { text: '概要', link: '/ja/about' }
    ],

    sidebar: jaSidebars,

    editLink: {
      pattern: 'https://github.com/cybergodev/docs-site/edit/main/docs/ja/:path',
      text: 'GitHub でこのページを編集'
    },

    footer: {
      message: 'MIT ライセンスで公開 · <a href="https://github.com/cybergodev/docs-site/issues/new?template=doc-issue.md" target="_blank">ドキュメントの問題を報告</a>',
      copyright: 'Copyright © 2026 CyberGoDev'
    },

    docFooter: {
      prev: '前へ',
      next: '次へ'
    },

    outline: {
      label: 'このページの内容'
    },

    langMenuLabel: '言語',
    returnToTopLabel: 'トップに戻る',
    sidebarMenuLabel: 'メニュー',
    darkModeSwitchLabel: 'テーマ',
    lightModeSwitchTitle: 'ライトモードに切り替え',
    darkModeSwitchTitle: 'ダークモードに切り替え'
  }
}
