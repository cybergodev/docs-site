<script setup lang="ts">
import { computed } from 'vue'
import { PROJECTS } from '../../shared'
import { useCurrentLang, useUiLabels } from '../composables/useUiLabels'

const props = defineProps<{ cmd: string }>()
const lang = useCurrentLang()
const t = useUiLabels()

/**
 * Renders a single shell command with light token coloring (binary / flag /
 * argument) and, when the command references a known cybergodev module, a
 * localized "Docs" link to that project's getting-started page.
 */
const project = computed(() => {
  const m = props.cmd.match(/cybergodev\/([a-z0-9]+)/i)
  return m && (PROJECTS as readonly string[]).includes(m[1]) ? m[1] : null
})

const docsHref = computed(() =>
  project.value ? `/${lang.value}/${project.value}/getting-started/` : null
)

const tokens = computed(() => {
  const parts = props.cmd.trim().split(/\s+/)
  return parts.map((text, i) => {
    let kind = 'arg'
    if (i === 0) kind = 'bin'
    else if (text.startsWith('-')) kind = 'flag'
    return { text, kind }
  })
})
</script>

<template>
  <div class="cli-command">
    <code class="cli-line">
      <template v-for="(tok, i) in tokens" :key="i">
        <span :class="['cli-tok', `cli-tok-${tok.kind}`]">{{ tok.text }}</span>
        <span v-if="i < tokens.length - 1" class="cli-space">&nbsp;</span>
      </template>
    </code>
    <a v-if="docsHref" class="cli-docs-link" :href="docsHref">{{ t.cliDocs }} →</a>
  </div>
</template>

<style scoped>
.cli-command {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--cg-sp-3, 12px);
  margin: 16px 0;
  padding: var(--cg-sp-2, 8px) var(--cg-sp-3, 12px);
  border-radius: var(--cg-radius-md, 8px);
  background: var(--vp-code-block-bg);
  border: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 0.875rem;
  overflow-x: auto;
}
.cli-line {
  background: none;
  padding: 0;
  white-space: nowrap;
}
.cli-tok-bin {
  color: var(--cg-brand, var(--vp-c-brand-1));
  font-weight: 600;
}
.cli-tok-flag {
  color: var(--vp-c-text-2);
}
.cli-tok-arg {
  color: var(--vp-c-text-1);
}
.cli-docs-link {
  flex-shrink: 0;
  font-size: 0.8rem;
  color: var(--cg-brand, var(--vp-c-brand-1));
  text-decoration: none;
  white-space: nowrap;
}
.cli-docs-link:hover {
  text-decoration: underline;
}
</style>
