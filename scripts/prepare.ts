/**
 * prepare.ts — npm `prepare` lifecycle hook (runs on every `npm install`).
 *
 * Activates the repo-local git hooks: `git config core.hooksPath .githooks` so
 * `.githooks/pre-push` (the CJK typography gate — same engine as CI's lint job
 * once the pinned CLI is installed) fires on `git push`, and marks the hook
 * executable (mac/linux need the exec bit; chmod is a harmless no-op on
 * Windows, which also heals clones where the index lost the mode).
 *
 * Guards: silent no-op when `.githooks/` is absent (partial checkouts); a git
 * failure only warns — it must never fail the install itself.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOOKS = join(ROOT, '.githooks')

if (existsSync(HOOKS)) {
  // Local config write only — activates the hooks dir for this clone.
  const r = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: ROOT,
    windowsHide: true
  })
  if (r.status === 0) {
    await chmod(join(HOOKS, 'pre-push'), 0o755).catch(() => {}) // no-op on Windows
    console.log('prepare: git hooks -> .githooks (pre-push runs npm run lint:autocorrect)')
  } else {
    console.warn(
      `prepare: could not set core.hooksPath (${
        r.error?.message ?? r.stderr?.toString().trim() ?? 'git unavailable'
      }) — push hook not activated`
    )
  }
}
