---
layout: home
title: "CyberGo"
titleTemplate: Коллекция высокопроизводительных библиотек Go с открытым исходным кодом
description: "CyberGo — коллекция высокопроизводительных библиотек Go с открытым исходным кодом, включающая шесть основных библиотек — обработка JSON, аутентификация JWT, безопасный HTTP-клиент, извлечение содержимого HTML, структурированное логирование и управление переменными окружения. Лёгкий дизайн, готовность к использованию из коробки, минимальные зависимости, надёжные базовые компоненты для высоконагруженных продакшен-сред."

hero:
  name: CyberGo
  text: Готовность к продакшену и максимальная производительность
  tagline: Лёгкий дизайн / Готовность из коробки / Минимальные зависимости / Высокая производительность / Для высоконагруженных сценариев
---

<!-- Список проектов -->
<div class="home-projects" id="projects">
  <div class="project-grid">
    <div class="project-card" data-href="/ru/json/">
      <a href="/ru/json/" class="card-main">
        <div class="title">
          <span class="icon">📦</span>
          <span>json</span>
        </div>
        <div class="description">
          Высокопроизводительная, потокобезопасная библиотека обработки JSON. Предоставляет богатый набор функций для работы с JSON, включая парсинг, запросы, модификацию, валидацию и форматирование.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/json" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ru/jwt/">
      <a href="/ru/jwt/" class="card-main">
        <div class="title">
          <span class="icon">🔑</span>
          <span>jwt</span>
        </div>
        <div class="description">
          Библиотека JWT продакшен-уровня, для всех операций JWT достаточно 3 функций. Встроенная защита безопасности и управление чёрными списками.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/jwt" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ru/httpc/">
      <a href="/ru/httpc/" class="card-main">
        <div class="title">
          <span class="icon">🌐</span>
          <span>httpc</span>
        </div>
        <div class="description">
          Современный высокопроизводительный HTTP-клиент. Поддержка TLS 1.2+, защита от SSRF, автоматические выключатели, интеллектуальные повторы, пулы без аллокаций, снижение GC на 90%.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/httpc" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ru/html/">
      <a href="/ru/html/" class="card-main">
        <div class="title">
          <span class="icon">📄</span>
          <span>html</span>
        </div>
        <div class="description">
          Инструмент извлечения содержимого HTML продакшен-уровня. Поддержка интеллектуального распознавания статей, извлечение изображений, видео, аудио и ссылок с метаданными.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/html" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ru/dd/">
      <a href="/ru/dd/" class="card-main">
        <div class="title">
          <span class="icon">📝</span>
          <span>dd</span>
        </div>
        <div class="description">
          Высокопроизводительная библиотека логирования, обрабатывающая более 3 миллионов операций в секунду. Поддержка структурированного логирования, автоматической ротации файлов, фильтрации конфиденциальных данных.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/dd" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ru/env/">
      <a href="/ru/env/" class="card-main">
        <div class="title">
          <span class="icon">⚙️</span>
          <span>env</span>
        </div>
        <div class="description">
          Библиотека управления переменными окружения продакшен-уровня. Поддержка блокировки в памяти, журналирования аудита и высокой параллельности, дизайн без зависимостей.
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/env" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
  </div>
</div>

<style>
/* Адаптивность слогана Hero */
@media (min-width: 640px) {
  [class*="tagline"] {
    max-width: 900px !important;
  }
}

@media (min-width: 960px) {
  [class*="container"] {
    padding: 0;
    max-width: 1280px;
  }
}
</style>
