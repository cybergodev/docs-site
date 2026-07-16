<script setup lang="ts">
  import { ref, computed, onBeforeUnmount } from 'vue'
  import { useUiLabels } from '../composables/useUiLabels'

  const props = defineProps<{ code: string }>()
  const t = useUiLabels()

  /**
   * "Open in Go Playground" button for standard-library-only snippets.
   *
   * The Go Playground (go.dev/play) cannot fetch external modules, so snippets
   * that `import github.com/cybergodev/*` would fail there — for those the
   * button is hidden (VitePress's built-in copy button still covers them).
   *
   * Click tries the /share endpoint to land on a pre-filled runnable page; if
   * that is blocked (CORS / network), it falls back to copying the code and
   * opening an empty playground with a "paste it" hint.
   */
  const runnable = computed(() => !/cybergodev\//.test(props.code))

  const busy = ref(false)
  const note = ref('')

  // Outstanding share request, if any. Aborted on unmount so a slow response
  // never pops a window or mutates a ref after the component is gone, and a
  // hard 8s timeout so a hung connection cannot leave the button spinning.
  let controller: AbortController | null = null
  let unmounted = false
  let timeoutId: number | undefined

  onBeforeUnmount(() => {
    unmounted = true
    controller?.abort()
    if (timeoutId !== undefined) window.clearTimeout(timeoutId)
  })

  async function open() {
    busy.value = true
    note.value = ''
    // Cancel any request still in flight (rapid double-click).
    controller?.abort()
    controller = new AbortController()
    timeoutId = window.setTimeout(() => controller?.abort(), 8000)
    try {
      const res = await fetch('https://go.dev/play/share', {
        method: 'POST',
        body: props.code,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        signal: controller.signal
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const id = (await res.text()).trim()
      if (!id) throw new Error('empty id')
      if (!unmounted) window.open(`https://go.dev/play/p/${id}`, '_blank', 'noopener')
    } catch {
      // Aborted because the component unmounted: suppress every fallback side
      // effect (clipboard write, popup) — the user has navigated away.
      if (unmounted) return
      // Fallback: copy + open empty playground.
      try {
        await navigator.clipboard.writeText(props.code)
        note.value = t.value.codeCopied
      } catch {
        note.value = ''
      }
      window.open('https://go.dev/play/', '_blank', 'noopener')
    } finally {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
        timeoutId = undefined
      }
      controller = null
      busy.value = false
    }
  }
</script>

<template>
  <button v-if="runnable" type="button" class="go-play-btn" :disabled="busy" @click="open">
    <span>{{ busy ? '…' : t.openInPlayground }}</span>
    <span v-if="note" class="go-play-note">{{ note }}</span>
  </button>
</template>

<style scoped>
  .go-play-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0 16px;
    padding: 5px 14px;
    border-radius: var(--cg-radius-md, 8px);
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
    color: var(--cg-brand, var(--vp-c-brand-1));
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      border-color 0.2s,
      color 0.2s;
  }
  .go-play-btn:hover {
    border-color: var(--cg-brand, var(--vp-c-brand-1));
  }
  .go-play-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .go-play-note {
    color: var(--vp-c-text-2);
    font-weight: 400;
  }
</style>
