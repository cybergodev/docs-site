/**
 * setup-autocorrect.ts — explicit, one-shot installer for the pinned
 * autocorrect CLI (the exact release binary CI's lint job runs).
 *
 * NEVER triggered automatically — the lint gate installs nothing on its own.
 * Run it by hand: `npm run setup:autocorrect`.
 *
 * Steps: pick the release asset for this platform/arch -> download into a
 * fresh temp dir -> verify sha256 against the release's `.sha256` sidecar
 * (fail closed: missing sidecar or mismatch aborts) -> extract -> copy ONLY
 * the known binary name into the conventional dir (AUTOCORRECT_CLI_DIR
 * overrides the default) -> re-verify `--version`. Idempotent: exits 0
 * without touching the network when the target already reports the pinned
 * version.
 *
 * Version pin + upgrade checklist live in scripts/_lib/autocorrect.ts —
 * bump together with .github/workflows/ci.yml.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  PINNED_AUTOCORRECT_VERSION,
  conventionalCliDir,
  conventionalCliPath,
  probeCliVersion,
  releaseAssetUrl
} from './_lib/autocorrect'

const targetDir = conventionalCliDir()
const targetPath = conventionalCliPath()

/** Release asset layout per platform/arch (as shipped on the release page). */
function assetFor(
  platform: NodeJS.Platform,
  arch: string
): { archive: string; binary: string; zip: boolean } | null {
  if (platform === 'win32' && arch === 'x64')
    return { archive: 'autocorrect-windows-amd64.zip', binary: 'autocorrect.exe', zip: true }
  if (platform === 'darwin' && arch === 'x64')
    return { archive: 'autocorrect-darwin-amd64.tar.gz', binary: 'autocorrect', zip: false }
  if (platform === 'darwin' && arch === 'arm64')
    return { archive: 'autocorrect-darwin-arm64.tar.gz', binary: 'autocorrect', zip: false }
  if (platform === 'linux' && arch === 'x64')
    return { archive: 'autocorrect-linux-amd64.tar.gz', binary: 'autocorrect', zip: false }
  if (platform === 'linux' && arch === 'arm64')
    return { archive: 'autocorrect-linux-arm64.tar.gz', binary: 'autocorrect', zip: false }
  return null
}

/** Find `name` anywhere under `dir` (release archives are flat; walk is robustness). */
async function findFile(dir: string, name: string): Promise<string | null> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      const hit = await findFile(full, name)
      if (hit) return hit
    } else if (entry.name === name) {
      return full
    }
  }
  return null
}

/**
 * fetch with retry — connections to github.com:443 are intermittently slow;
 * undici's default 10s connect timeout then fails a run that would succeed on
 * a second try. Per-attempt cap 60s, backoff 2s/4s between attempts; the last
 * attempt is returned as-is (non-2xx included) so callers report real status.
 */
async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (res.ok || i === attempts) return res
      console.warn(`autocorrect: ${url} — HTTP ${res.status}, retrying (${i}/${attempts})`)
    } catch (e) {
      if (i === attempts) throw e
      console.warn(`autocorrect: ${url} — ${(e as Error).message}, retrying (${i}/${attempts})`)
    }
    await new Promise((r) => setTimeout(r, 2_000 * i))
  }
  throw new Error(`fetch failed after ${attempts} attempts: ${url}`)
}

// Idempotency first: if the pin is already in place, skip the network entirely
// (also covers platforms with no release asset when a binary was placed by hand).
if (existsSync(targetPath)) {
  const found = probeCliVersion(targetPath)
  if (found === PINNED_AUTOCORRECT_VERSION) {
    console.log(
      `autocorrect: ${targetPath} already at pinned ${PINNED_AUTOCORRECT_VERSION} — nothing to do`
    )
    process.exit(0)
  }
  console.log(
    `autocorrect: ${targetPath} reports ${found ?? 'an unreadable version'} — replacing with ${PINNED_AUTOCORRECT_VERSION}`
  )
}

const asset = assetFor(process.platform, process.arch)
if (!asset) {
  console.error(
    `autocorrect: no v${PINNED_AUTOCORRECT_VERSION} release asset for ${process.platform}/${process.arch}. ` +
      'Install a binary manually and point AUTOCORRECT_CLI at it.'
  )
  process.exit(1)
}

const tmp = await mkdtemp(join(tmpdir(), 'autocorrect-setup-'))
try {
  // Download the archive into the throwaway dir.
  const archiveUrl = releaseAssetUrl(asset.archive)
  console.log(`autocorrect: downloading ${archiveUrl}`)
  const dl = await fetchWithRetry(archiveUrl)
  if (!dl.ok) throw new Error(`archive download failed: HTTP ${dl.status}`)
  const archivePath = join(tmp, asset.archive)
  await writeFile(archivePath, Buffer.from(await dl.arrayBuffer()))

  // Fail-closed sha256 verification against the release's sidecar.
  const sidecarUrl = releaseAssetUrl(`${asset.archive}.sha256`)
  const sidecar = await fetchWithRetry(sidecarUrl)
  if (!sidecar.ok)
    throw new Error(`sha256 sidecar fetch failed: HTTP ${sidecar.status} (${sidecarUrl})`)
  const expected = (await sidecar.text()).trim().split(/\s+/)[0]?.toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(expected ?? ''))
    throw new Error(`unparseable sha256 sidecar: ${sidecarUrl}`)
  const actual = createHash('sha256')
    .update(await readFile(archivePath))
    .digest('hex')
  if (actual !== expected) throw new Error(`sha256 mismatch: expected ${expected}, got ${actual}`)

  // Extract next to the archive, then copy out only the known binary name.
  const extractDir = join(tmp, 'extracted')
  await mkdir(extractDir)
  // Windows: bsdtar ships with the OS and reads zip; elsewhere system tar
  // handles the tar.gz release archives.
  const tar = asset.zip && process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'tar'
  const ex = spawnSync(tar, [asset.zip ? '-xf' : '-xzf', archivePath, '-C', extractDir], {
    windowsHide: true
  })
  if (ex.error || ex.status !== 0)
    throw new Error(`extraction failed: ${ex.error?.message ?? `tar exited ${ex.status}`}`)
  const binaryPath = await findFile(extractDir, asset.binary)
  if (!binaryPath) throw new Error(`archive does not contain ${asset.binary}`)

  await mkdir(targetDir, { recursive: true })
  await copyFile(binaryPath, targetPath)
  await chmod(targetPath, 0o755) // no-op on Windows; mac/linux need the exec bit

  const installed = probeCliVersion(targetPath)
  if (installed !== PINNED_AUTOCORRECT_VERSION)
    throw new Error(
      `post-install check failed: --version reported ${installed ?? 'nothing'} (expected ${PINNED_AUTOCORRECT_VERSION})`
    )
  console.log(`autocorrect: installed ${PINNED_AUTOCORRECT_VERSION} -> ${targetPath}`)
} catch (e) {
  console.error(`autocorrect: setup failed — ${(e as Error).message}`)
  process.exitCode = 1
} finally {
  await rm(tmp, { recursive: true, force: true })
}
