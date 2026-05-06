import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'
import { ruSidebars } from './sidebars/ru'

export const ruConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  description: 'Документация высокопроизводительных библиотек Go с открытым исходным кодом',

  themeConfig: {
    nav: [
      {
        text: 'Проекты',
        items: [
          { text: 'JSON', link: '/ru/json/' },
          { text: 'JWT', link: '/ru/jwt/' },
          { text: 'HTTPC', link: '/ru/httpc/' },
          { text: 'HTML', link: '/ru/html/' },
          { text: 'DD', link: '/ru/dd/' },
          { text: 'ENV', link: '/ru/env/' }
        ]
      },
      { text: 'О проекте', link: '/ru/about' }
    ],

    sidebar: ruSidebars,

    editLink: {
      pattern: 'https://github.com/cybergodev/docs-site/edit/main/docs/ru/:path',
      text: 'Редактировать эту страницу на GitHub'
    },

    footer: {
      message: 'Выпущено под лицензией MIT · <a href="https://github.com/cybergodev/docs-site/issues/new?template=doc-issue.md" target="_blank">Сообщить о проблеме в документации</a>',
      copyright: 'Copyright © 2026 CyberGoDev'
    },

    docFooter: {
      prev: 'Предыдущая',
      next: 'Следующая'
    },

    outline: {
      label: 'Содержание страницы'
    },

    langMenuLabel: 'Язык',
    returnToTopLabel: 'Вернуться наверх',
    sidebarMenuLabel: 'Меню',
    darkModeSwitchLabel: 'Тема',
    lightModeSwitchTitle: 'Переключить на светлую тему',
    darkModeSwitchTitle: 'Переключить на тёмную тему'
  }
}
