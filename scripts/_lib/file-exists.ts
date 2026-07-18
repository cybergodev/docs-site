import { access } from 'fs/promises'

/**
 * Resolve to `true` if `p` exists (any type), `false` otherwise — without
 * throwing. Used by the redirect-page generators to skip paths the build still
 * produces (`access` rejects with ENOENT for missing paths; we collapse that to
 * a boolean).
 */
export const fileExists = (p: string): Promise<boolean> =>
  access(p)
    .then(() => true)
    .catch(() => false)
