<template>
  <div class="min-h-dvh bg-main p-8">
    <!-- Тимчасова сцена перевірки токенів. Прибирається у фазі 1. -->
    <div class="mx-auto max-w-2xl space-y-4">
      <div class="rounded-card border border-line bg-card p-6 shadow-card">
        <h1 class="text-2xl font-semibold text-ink">Перевірка токенів</h1>
        <p class="mt-2 text-muted">bg-card + border-line + rounded-card + shadow-card</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <span class="rounded-control bg-accent-solid px-4 py-2 text-accent-contrast">accent-solid</span>
        <span class="rounded-control bg-primary-50 px-4 py-2 text-accent">primary-50 / accent</span>
        <span class="rounded-control bg-primary-900/30 px-4 py-2 text-ink">primary-900/30 (альфа)</span>
        <span class="rounded-control border border-success-line bg-success-bg px-4 py-2 text-success">success</span>
        <span class="rounded-control border border-danger-line bg-danger-bg px-4 py-2 text-danger">danger</span>
      </div>
      <div class="rounded-overlay bg-dropdown p-4 shadow-overlay">rounded-overlay + shadow-overlay</div>
      <button class="rounded-control bg-card px-4 py-2 text-ink ring-1 ring-line" @click="toggle">
        Перемкнути тему (зараз: {{ isDark ? 'dark' : 'light' }})
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const isDark = ref(false)
function toggle() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}
</script>
