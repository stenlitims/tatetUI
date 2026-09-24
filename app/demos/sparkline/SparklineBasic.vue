<script setup lang="ts">
import UiSparkline from '~/components/ui/UiSparkline.vue'

const revenue = [42, 48, 45, 53, 51, 60, 58, 66, 71, 69, 78, 84]
const churn = [2.1, 2.4, 2.2, 2.9, 3.1, 2.8, 3.4, 3.6]
const orders = [12, 18, 9, 22, 17, 25, 31]
const uptime = [99.9, 99.8, Number.NaN, Number.NaN, 99.95, 99.9, 99.97, 99.99]
</script>

<template>
  <div class="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
    <div class="rounded-card border border-line bg-card p-4">
      <p class="text-sm text-muted">Виторг, лінія + заливка</p>
      <UiSparkline class="mt-3" :data="revenue" variant="area" :height="48" show-last-point />
    </div>
    <div class="rounded-card border border-line bg-card p-4">
      <p class="text-sm text-muted">Відтік — зростання погане</p>
      <UiSparkline class="mt-3" :data="churn" tone="danger" :height="48" show-last-point />
    </div>
    <div class="rounded-card border border-line bg-card p-4">
      <p class="text-sm text-muted">Замовлення за тиждень</p>
      <UiSparkline class="mt-3" :data="orders" variant="bar" tone="accent" :height="48" label="Замовлення за 7 днів: від 12 до 31" />
    </div>
    <div class="rounded-card border border-line bg-card p-4">
      <p class="text-sm text-muted">Пропуск у даних — розрив, не нуль</p>
      <UiSparkline class="mt-3" :data="uptime" tone="success" curve="linear" :height="48" />
    </div>
  </div>
</template>
