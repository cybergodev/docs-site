<div align="center">

<img src="docs/public/logo.svg" alt="CyberGo Logo" width="120" height="120" />

# CyberGo Docs

**Production-Ready, High-Performance Go Open Source Library Documentation**

[![VitePress](https://img.shields.io/badge/VitePress-1.6-646cff?logo=vitepress)](https://vitepress.dev/)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[🌐 Website](https://www.cybergo.dev) · [📚 文档](https://www.cybergo.dev/zh/) · [Documentation](https://www.cybergo.dev/en/) · [🐙 GitHub](https://github.com/cybergodev)

</div>

---

CyberGo is a collection of production-ready, high-performance Go open source libraries. This repository contains the source code for the documentation website, built with [VitePress](https://vitepress.dev/) and deployed at [www.cybergo.dev](https://www.cybergo.dev).

## Libraries

| Library | Description | Go Module |
|---------|-------------|-----------|
| [json](https://www.cybergo.dev/zh/json/) | High-performance JSON library with path queries and streaming | `github.com/cybergodev/json` |
| [jwt](https://www.cybergo.dev/zh/jwt/) | JWT token generation and verification with multi-algorithm support | `github.com/cybergodev/jwt` |
| [httpc](https://www.cybergo.dev/zh/httpc/) | Secure HTTP client with retry, circuit breaker, and SSRF protection | `github.com/cybergodev/httpc` |
| [html](https://www.cybergo.dev/zh/html/) | HTML content extraction, sanitization, and metadata parsing | `github.com/cybergodev/html` |
| [dd](https://www.cybergo.dev/zh/dd/) | Structured logging library (3M+ ops/sec) with file rotation | `github.com/cybergodev/dd` |
| [env](https://www.cybergo.dev/zh/env/) | Multi-format environment variable management with secure storage | `github.com/cybergodev/env` |

## Languages

The documentation is available in 2 languages:

| Language | Code | Path |
|----------|------|------|
| 简体中文 | `zh` | [/zh/](https://www.cybergo.dev/zh/) |
| English | `en` | [/en/](https://www.cybergo.dev/en/) |

## Features

- **Unified Language Switching** — A language menu on every page, a one-time browser-language hint, and language-aware routing for bare paths; the homepage stays static for SEO
- **Dynamic GitHub Links** — Project pages link directly to the corresponding source repository
- **Full-Text Search** — Local minisearch-based search across all libraries, with CJK-aware tokenization and per-language indexes
- **SEO Optimized** — Auto-generated canonical URLs, hreflang alternates, and Open Graph / Twitter meta tags
- **Responsive Design** — Fully responsive with dark mode support
- **Custom Components** — 404 page, footer, doc feedback widget, and project card grid

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm 9+

### Install

```bash
git clone https://github.com/cybergodev/docs-site.git
cd docs-site
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

### Pre-push Checks

Run these locally to catch errors before pushing to main (a push triggers the FTP auto-deploy):

```bash
npm run precheck      # format:check → typecheck → check:projects → build → audit
npm run precheck:go   # audit:api + check:code --all (run when you change Go code samples or API references)
npx autocorrect-node --fix   # CJK typography polish (run on demand)
```

- `precheck` includes a full production build, so it verifies your push will build successfully on the deploy runner.
- `precheck:go` requires the Go toolchain and the 6 source repos at `D:/MyProject/{project}-dev`.

## Project Structure

```
docs/
├── .vitepress/
│   ├── config.mts              # VitePress config (SEO, locales, redirect)
│   ├── shared.ts               # Shared constants
│   ├── locales/                # Locale configs (zh, en)
│   │   └── sidebars/           # Sidebar configs per language
│   └── theme/                  # Custom theme
│       ├── index.ts            # Dynamic GitHub links, title, layout
│       ├── custom.css          # Brand styles (#76B900 theme color)
│       ├── components/         # Vue components (Footer, 404, feedback, language menu)
│       └── composables/        # Composables (language detection, project path)
├── public/                     # Static assets (logo, favicon, robots.txt)
├── zh/                         # Chinese documentation
└── en/                         # English documentation
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).

---

<div align="center">

**[CyberGoDev](https://github.com/cybergodev)** · Made with ❤️ for the Go community!

</div>
