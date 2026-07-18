<script setup lang="ts">
  import { useProjectContext } from '../composables/useProjectContext'

  /**
   * The sole visible navbar title text. Renders `cybergodev/{project}` on a
   * project page, `CyberGo` elsewhere.
   *
   * Injected into the `nav-bar-title-after` slot; VitePress's native siteTitle
   * `<span>` is hidden via theme/style/overrides.css so the two never render at
   * once. Driven by `useProjectContext()` (reactive on the route), it renders
   * the correct title during SSR instead of only after hydration.
   */
  const { project } = useProjectContext()
</script>

<template>
  <span class="project-nav-title">
    <template v-if="project"> <span class="org">cybergodev/</span>{{ project }} </template>
    <template v-else>CyberGo</template>
  </span>
</template>

<style scoped>
  /* The org prefix is dimmed, mirroring the old .nav-title-org treatment. */
  .project-nav-title .org {
    opacity: 0.5;
  }
</style>
