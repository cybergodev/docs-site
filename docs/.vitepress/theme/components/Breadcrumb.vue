<script setup lang="ts">
  import { useBreadcrumb } from '../composables/useBreadcrumb'
  import { useUiLabels } from '../composables/useUiLabels'

  /**
   * Breadcrumb navigation for doc pages.
   *
   * Injected via the Layout `doc-before` slot (theme/index.ts), so it renders
   * above the page `<h1>` and only on doc-layout pages (never on the home
   * layout). The trail itself — and all hide-rules — come from
   * `useBreadcrumb()`; this component is pure presentation.
   *
   * Styling follows DESIGN.md: only `--cg-*` / `--vp-*` tokens, so the `.dark`
   * retune applies automatically. Links hover to `--vp-c-brand-1`; the current
   * page is `--vp-c-text-1` with `aria-current="page"`; separators are muted
   * `--vp-c-text-3`. The list wraps on narrow viewports.
   */
  const crumbs = useBreadcrumb()
  const t = useUiLabels()
</script>

<template>
  <nav v-if="crumbs.length" class="breadcrumb" :aria-label="t.breadcrumbAriaLabel">
    <ol class="breadcrumb-list">
      <li v-for="(c, i) in crumbs" :key="i" class="breadcrumb-item">
        <span v-if="i > 0" class="breadcrumb-sep" aria-hidden="true">›</span>
        <a v-if="c.link" :href="c.link" class="breadcrumb-link">{{ c.text }}</a>
        <span
          v-else
          class="breadcrumb-current"
          :aria-current="i === crumbs.length - 1 ? 'page' : undefined"
          >{{ c.text }}</span
        >
      </li>
    </ol>
  </nav>
</template>

<style scoped>
  .breadcrumb {
    margin: 0 0 var(--cg-sp-4);
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .breadcrumb-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .breadcrumb-item {
    display: inline-flex;
    align-items: center;
    color: var(--vp-c-text-2);
    max-width: 100%;
  }

  .breadcrumb-sep {
    margin: 0 var(--cg-sp-2);
    color: var(--vp-c-text-3);
    user-select: none;
  }

  .breadcrumb-link {
    color: var(--vp-c-text-2);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .breadcrumb-link:hover {
    color: var(--cg-brand-text);
  }

  .breadcrumb-current {
    color: var(--vp-c-text-1);
    font-weight: 500;
  }

  /* Narrow viewports: tighten the trail so a long path still fits comfortably. */
  @media (max-width: 768px) {
    .breadcrumb {
      font-size: 0.8rem;
    }

    .breadcrumb-sep {
      margin: 0 var(--cg-sp-1);
    }
  }
</style>
