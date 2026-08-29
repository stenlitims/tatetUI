<script setup lang="ts">
import UiStatCard from '~/components/ui/UiStatCard.vue'
</script>

<template>
  <div class="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <UiStatCard label="Виторг за місяць" value="₴1 284 300" :delta="12.4" hint="проти липня">
      <template #icon>
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 18V9m6 9V5m6 13v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </template>
    </UiStatCard>

    <UiStatCard label="Нових угод" value="87" :delta="-4" delta-format="absolute" hint="проти липня" />

    <UiStatCard label="Середній чек" value="₴14 762" :delta="0" hint="без змін" />
  </div>
</template>
