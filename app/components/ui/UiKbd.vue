<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /**
     * Клавіша або послідовність: 'K' або ['Ctrl', 'K']. Модифікатори
     * розпізнаються за назвою: meta/cmd/command → ⌘, alt/option → ⌥,
     * shift → ⇧, enter → ↵, escape → Esc, стрілки → ↑↓←→.
     */
    combo?: string | string[]
    /** Піднімати регістр звичайних клавіш: `k` → `K`. */
    uppercase?: boolean
  }>(),
  { uppercase: true },
)

defineSlots<{
  /** Сире наповнення замість props.combo. */
  default?: () => unknown
}>()

const SYMBOLS: Record<string, string> = {
  meta: '⌘',
  cmd: '⌘',
  command: '⌘',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: '⌥',
  shift: '⇧',
  enter: '↵',
  escape: 'Esc',
  esc: 'Esc',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  space: 'Space',
  tab: 'Tab',
  backspace: '⌫',
  delete: 'Del',
}

const keys = computed(() => {
  const list = props.combo == null ? [] : Array.isArray(props.combo) ? props.combo : [props.combo]
  return list.map((key) => {
    const lower = key.toLowerCase().trim()
    return SYMBOLS[lower] ?? (props.uppercase ? key.toUpperCase() : key)
  })
})
</script>

<template>
  <kbd
    class="inline-flex h-5.5 min-w-5.5 items-center justify-center gap-0.5 rounded-[0.25rem] border border-line bg-subtle px-1 font-sans text-[11px] font-medium leading-none text-muted shadow-[inset_0_-1px_0_0_var(--line)]"
  >
    <slot>
      <template v-for="(key, index) in keys" :key="index">
        <span v-if="index > 0" class="px-0.5 text-muted" aria-hidden="true">+</span>
        <span>{{ key }}</span>
      </template>
    </slot>
  </kbd>
</template>