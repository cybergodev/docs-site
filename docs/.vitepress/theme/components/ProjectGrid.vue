<script setup lang="ts">
  import { computed } from 'vue'
  import { PROJECTS, PROJECT_META, type Lang } from '../../shared'
  import GitHubIcon from './GitHubIcon.vue'

  const props = defineProps<{ lang: Lang }>()

  /**
   * Homepage project grid, data-driven from `PROJECT_META` (shared.ts).
   * Reuses the `.home-projects` / `.project-card` / … classes already defined
   * in theme/style/home.css, and renders `.tags` chips from the per-language
   * feature entries in PROJECT_META.
   */
  const cards = computed(() =>
    PROJECTS.map((project) => {
      const meta = PROJECT_META[project]
      return {
        project,
        icon: meta.icon,
        github: meta.github,
        desc: meta.desc[props.lang],
        features: meta.features[props.lang]
      }
    })
  )
</script>

<template>
  <div class="home-projects" id="projects">
    <div class="project-grid">
      <div
        v-for="card in cards"
        :key="card.project"
        class="project-card"
        :data-href="`/${lang}/${card.project}/`"
      >
        <a :href="`/${lang}/${card.project}/`" class="card-main">
          <div class="title">
            <span class="icon">{{ card.icon }}</span>
            <span>{{ card.project }}</span>
          </div>
          <div class="description">{{ card.desc }}</div>
          <div v-if="card.features.length" class="tags">
            <span v-for="f in card.features" :key="f" class="tag">{{ f }}</span>
          </div>
        </a>
        <div class="actions">
          <a class="github-link" :href="card.github" target="_blank" rel="noopener">
            <GitHubIcon :size="16" />
            GitHub
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
