/**
 * Generate language-neutral "bridge" pages for bare paths.
 *
 * Problem: every real page lives under a language prefix
 * (e.g. /zh/json/getting-started/). A bare path like /json/getting-started/
 * does not exist as a static file, so on the FTP-hosted static site it falls
 * through to 404.html and only recovers via a client-side JS redirect — a poor
 * SEO signal (404 status + JS).
 *
 * Fix: for each page that exists under /zh/ (the default language), emit a
 * minimal static page at the bare path that:
 *   - canonicalizes to the /zh/ version (so the bare URL is not seen as
 *     duplicate content),
 *   - declares hreflang alternates for every language that has the page,
 *   - injects a synchronous <head> script that routes JS-enabled visitors to
 *     their preferred language — explicit choice (cookie) → explicit choice
 *     (localStorage) → browser language — only considering languages that
 *     actually publish the page,
 *   - falls back to <meta http-equiv="refresh"> → /zh/ (followed by all major
 *     crawlers and by JS-disabled browsers), and
 *   - carries robots "noindex, follow" so the thin bridge is not indexed but
 *     still passes link equity to the canonical target.
 *
 * Runs after `fix-clean-urls.js` so the /zh/ tree is already in
 * directory-per-page form.
 */
import { mkdir, writeFile } from 'fs/promises'
import { join, relative, dirname, basename } from 'path'
import { DIST_DIR, HOST, LANGS, PRIMARY_LANG } from '../docs/.vitepress/shared'
import { collectMd } from './_lib/walk'
import { fileExists } from './_lib/file-exists'
import { escapeHtml } from './_lib/escape-html'

const ZH_DIR = join(DIST_DIR, PRIMARY_LANG)

// Recursively collect every built page under `root` as a forward-slashed path
// relative to `root`. A page is a directory containing `index.html` (clean URLs,
// applied by fix-clean-urls before this runs). Implemented via the shared
// collectMd helper (ext: '.html'): gather every index.html, then map each back
// to its directory. The root home (index.html directly under `root`) maps to
// rel "" and is excluded — it already exists at the bare path, so it needs no
// bridge (main()'s fileExists guard would skip it anyway, but excluding it
// here keeps collectPages self-describing).
async function collectPages(root: string): Promise<string[]> {
  const htmlFiles = await collectMd(root, { ext: '.html' })
  const pages: string[] = []
  for (const f of htmlFiles) {
    if (basename(f) !== 'index.html') continue
    const dir = relative(root, dirname(f)).replace(/\\/g, '/')
    if (dir === '') continue // home page — no bare-path bridge
    pages.push(dir)
  }
  return pages
}

// Inline, synchronous client-side language detection embedded in each bridge
// page. It runs in <head> *before* the <meta refresh>, so a JS-enabled browser
// hops straight to the visitor's preferred language instead of always landing
// on /zh/. Resolution order: explicit choice via cookie → explicit choice via
// localStorage → navigator language. Only languages in `availableLangs` (i.e.
// those that actually publish this page) are accepted, so we never redirect to
// a language version that does not exist. If nothing resolves (or JS is off)
// the <meta refresh> below still sends the visitor to /zh/. `rel` is the page
// path relative to the language prefix (e.g. "json" or "json/getting-started").
function buildDetectScript(rel: string, availableLangs: string[]): string {
  const relLiteral = JSON.stringify(rel)
  const availLiteral = JSON.stringify(availableLangs)
  return `<script>(function(){
var AVAIL=${availLiteral};
function prefLang(v){if(!v)return null;var b=decodeURIComponent(v).toLowerCase().split('-')[0];return (AVAIL.indexOf(b)!==-1)?b:null;}
var lang=null;
var parts=document.cookie.split(';');
for(var i=0;i<parts.length;i++){var kv=parts[i].trim();if(kv.indexOf('vitepress-lang-preference=')===0){lang=prefLang(kv.substring(26));break;}}
if(!lang){try{lang=prefLang(localStorage.getItem('vitepress-lang-preference'));}catch(e){}}
if(!lang){var nav=(navigator.languages&&navigator.languages.length)?navigator.languages:[navigator.language];for(var j=0;j<nav.length;j++){var b=((nav[j]||'').toLowerCase().split('-'))[0];if(AVAIL.indexOf(b)!==-1){lang=b;break;}}}
lang=lang||'zh';
if(lang!=='zh'){location.replace('/'+lang+'/'+${relLiteral}+'/');}
})();</script>`
}

function buildBridgeHtml(rel: string, availableLangs: string[]): string {
  // `rel` is the page path under the language prefix (e.g. "json" or
  // "json/getting-started"). The home page (rel === "") is an edge case
  // collectPages never yields, but handle it here directly instead of relying
  // on that upstream guard — otherwise empty rel produces `/zh//` canonicals.
  const langPath = (l: string) => (rel ? `/${l}/${rel}/` : `/${l}/`)
  const canonical = rel ? `${HOST}/${PRIMARY_LANG}/${rel}/` : `${HOST}/`
  const refreshUrl = rel ? `/${PRIMARY_LANG}/${rel}/` : `/`
  const hreflangLinks = availableLangs
    .map((l) => `  <link rel="alternate" hreflang="${l}" href="${HOST}${langPath(l)}">`)
    .join('\n')
  const langLinks = availableLangs.map((l) => `<a href="${langPath(l)}">${l}</a>`).join(' ')
  const detectScript = buildDetectScript(rel, availableLangs)
  const titleRel = escapeHtml(rel || PRIMARY_LANG)

  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CyberGo - ${titleRel}</title>
${detectScript}
<link rel="canonical" href="${canonical}">
${hreflangLinks}
  <link rel="alternate" hreflang="x-default" href="${canonical}">
<meta http-equiv="refresh" content="0; url=${refreshUrl}">
<meta name="robots" content="noindex, follow">
</head>
<body>
<noscript>
  <p>Redirecting to <a href="${refreshUrl}">${titleRel}</a>.</p>
  <p>Also available in: ${langLinks}</p>
</noscript>
</body>
</html>
`
}

async function main(): Promise<void> {
  const zhPages = await collectPages(ZH_DIR)
  let created = 0
  for (const rel of zhPages) {
    const bridgeDir = join(DIST_DIR, rel)
    const bridgeFile = join(bridgeDir, 'index.html')

    // Never overwrite a file the build already produced at the root.
    if (await fileExists(bridgeFile)) continue

    // Only declare hreflang for languages that actually have this page.
    const availableLangs: string[] = []
    for (const l of LANGS) {
      if (l === PRIMARY_LANG || (await fileExists(join(DIST_DIR, l, rel, 'index.html')))) {
        availableLangs.push(l)
      }
    }

    await mkdir(bridgeDir, { recursive: true })
    await writeFile(bridgeFile, buildBridgeHtml(rel, availableLangs), 'utf8')
    console.log(`  bridge: /${rel}/ -> /${PRIMARY_LANG}/${rel}/`)
    created++
  }
  console.log(`Generated ${created} language-neutral redirect page(s).`)
}

await main()
