<script setup lang="ts">
import { computed } from 'vue'
import { RTE_ICONS, type RteIconName } from './icons'

const props = withDefaults(
  defineProps<{
    name: RteIconName
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

/*
 * Літерали, а не інтерполяція `h-${size}`.
 *
 * JIT Tailwind сканує вихідний код рядками — зібраного `h-4` він у
 * шаблонному рядку не побачить, і клас просто не згенерується. Помилки при
 * цьому не буде: іконка мовчки втратить розмір.
 */
const SIZES = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4' } as const

defineSlots<Record<string, never>>()

const icon = computed(() => RTE_ICONS[props.name])
</script>

<template>
  <svg
    :class="SIZES[size]"
    viewBox="0 0 24 24"
    :fill="icon.fill ? 'currentColor' : 'none'"
    :stroke="icon.fill ? 'none' : 'currentColor'"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="icon.d" />
  </svg>
</template>
