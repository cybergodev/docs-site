import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

/**
 * autocorrect.ts — shared metadata for the pinned autocorrect CLI.
 *
 * The pin exists so the local gate and CI's lint job render identical
 * verdicts: CI (.github/workflows/ci.yml, lint job, "Install autocorrect"
 * step) downloads this exact release binary and runs `autocorrect ./ --lint`.
 *
 * When bumping the pin, ALL THREE must move together:
 *   1. PINNED_AUTOCORRECT_VERSION (below)
 *   2. the pinned version + sha256 in .github/workflows/ci.yml
 *   3. the local binary at the conventional path — refresh it with
 *      `npm run setup:autocorrect`
 */
export const PINNED_AUTOCORRECT_VERSION = '2.16.3'

/** GitHub release download base for huacnlee/autocorrect. */
export const AUTOCORRECT_RELEASE_BASE = 'https://github.com/huacnlee/autocorrect/releases/download'

export const AUTOCORRECT_RELEASE_TAG = `v${PINNED_AUTOCORRECT_VERSION}`

/**
 * Conventional install dir for the pinned CLI binary (outside this repo, so
 * it is shared across checkouts). Override with AUTOCORRECT_CLI_DIR:
 * `npm run setup:autocorrect` installs there, `npm run lint:autocorrect`
 * probes there (after AUTOCORRECT_CLI, before PATH).
 */
export const conventionalCliDir = (): string =>
  process.env.AUTOCORRECT_CLI_DIR ?? 'D:/MyProject/tools/autocorrect-cli'

/** Conventional binary path inside conventionalCliDir(). */
export const conventionalCliPath = (): string =>
  join(conventionalCliDir(), process.platform === 'win32' ? 'autocorrect.exe' : 'autocorrect')

/** Download URL for a release asset (archive or its `.sha256` sidecar). */
export const releaseAssetUrl = (asset: string): string =>
  `${AUTOCORRECT_RELEASE_BASE}/${AUTOCORRECT_RELEASE_TAG}/${asset}`

/**
 * Probe an autocorrect binary with `--version`.
 *   undefined — cannot execute (missing / blocked)
 *   null      — executed but printed no parseable version
 *   string    — the parsed x.y.z
 */
export const probeCliVersion = (cmd: string): string | null | undefined => {
  const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', windowsHide: true })
  if (r.error || r.status !== 0) return undefined
  return /\d+\.\d+\.\d+/.exec(`${r.stdout}${r.stderr}`)?.[0] ?? null
}
