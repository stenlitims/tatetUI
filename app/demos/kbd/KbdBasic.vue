<script setup lang="ts">
import UiKbd from '~/components/ui/UiKbd.vue'
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UiKbd combo="K" />
    <UiKbd :combo="['Ctrl', 'K']" />
    <UiKbd combo="Escape" />
    <UiKbd :combo="['Meta', 'Shift', 'P']" />
    <UiKbd combo="q" :uppercase="false" />
    <UiKbd>⏎</UiKbd>
  </div>
</template>