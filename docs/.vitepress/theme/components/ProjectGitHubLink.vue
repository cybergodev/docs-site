<script setup lang="ts">
  import GitHubIcon from './GitHubIcon.vue'
  import { useProjectContext } from '../composables/useProjectContext'

  /**
   * Project-aware GitHub link for the navbar. Points at `{org}/{project}` on a
   * project page, else the org root.
   *
   * Injected into `nav-bar-content-after`; VitePress's native social-links
   * cluster (which only ever held this one GitHub link) is hidden via
   * theme/style/overrides.css so the two never duplicate. Driven by
   * `useProjectContext()` (reactive on the route).
   *
   * Mirrors the native social-links visibility: hidden below 768px (mobile uses
   * the nav drawer; VitePress surfaces no GitHub link there either).
   */
  const { githubUrl } = useProjectContext()
</script>

<template>
  <a class="ProjectGitHubLink" :href="githubUrl" target="_blank" rel="noopener" aria-label="GitHub">
    <GitHubIcon :size="20" />
  </a>
</template>

<style scoped>
  .ProjectGitHubLink {
    display: none; /* hidden <768px, matches native .social-links */
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    color: var(--vp-c-text-2);
    transition: color 0.25s;
  }

  @media (min-width: 768px) {
    .ProjectGitHubLink {
      display: flex;
    }
  }

  .ProjectGitHubLink:hover {
    color: var(--vp-c-text-1);
  }
</style>
