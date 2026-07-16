import { PROJECTS, LANGS } from '../shared'

// Dev-only redirect for bare project paths (e.g. /json → /{lang}/json).
//
// The build emits static "bridge" pages for these paths in production, but the
// dev server (vitepress dev) serves straight from source — there is no /json
// route, so it 404s. This middleware intercepts bare project paths during dev
// and 302-redirects to the visitor's preferred language, mirroring the bridge
// pages. Resolution: request cookie (explicit choice) → Accept-Language
// (browser) → /zh/ (site default). localStorage is not readable server-side, so
// it is intentionally not consulted here; the production bridge pages cover it.
function codeToLang(code: string | undefined): string | null {
  if (!code) return null
  const base = code.toLowerCase().split('-')[0]
  return (LANGS as readonly string[]).includes(base) ? base : null
}
function pickRequestLang(req: any): string {
  const cookie = (req.headers?.cookie as string) || ''
  const m = cookie.match(/(?:^|;)\s*vitepress-lang-preference=([^;]+)/)
  if (m) {
    const l = codeToLang(decodeURIComponent(m[1]))
    if (l) return l
  }
  const al = (req.headers?.['accept-language'] as string) || ''
  for (const part of al.split(',')) {
    const l = codeToLang(part.split(';')[0].trim())
    if (l) return l
  }
  return 'zh'
}
export const bareProjectDevRedirect = {
  name: 'cybergo:bare-project-redirect',
  enforce: 'pre' as const,
  apply: 'serve' as const,
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const raw: string = req.url || '/'
      const pathname = raw.split('?')[0].split('#')[0]
      // Only intercept HTML navigations; skip any file/asset request.
      if (pathname.includes('.')) return next()
      const segs = pathname.replace(/^\/+/, '').split('/').filter(Boolean)
      if (segs.length === 0) return next() // homepage — leave to VitePress
      // Bare project path = first segment is a project, no language prefix.
      if (!(PROJECTS as readonly string[]).includes(segs[0])) return next()
      const lang = pickRequestLang(req)
      const target = '/' + lang + '/' + segs.join('/') + '/'
      const query = raw.indexOf('?') !== -1 ? raw.slice(raw.indexOf('?')) : ''
      res.statusCode = 302
      res.setHeader('Location', target + query)
      res.setHeader('Cache-Control', 'no-store')
      res.end()
    })
  }
}
