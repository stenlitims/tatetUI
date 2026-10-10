<script setup lang="ts">
import { shallowRef } from 'vue'

/*
 * `collapsed`: бічна панель відкривається й закривається, а основна не
 * перемонтовується — лічильник у ній живе далі. Ширина бічної зберігається
 * між відкриттями.
 */
const open = shallowRef(true)
const split = shallowRef(65)
const clicks = shallowRef(0)
</script>

<template>
  <div class="h-64 overflow-hidden rounded-overlay border border-line">
    <UiResizablePanels
      :min="40"
      :max="80"
      v-model="split"
      :collapsed="open ? undefined : 'end'"
      separator-style="line"
      start-label="Основна область"
      end-label="Бічна панель"
    >
      <template #start>
        <div class="flex h-full flex-col items-start gap-3 bg-card p-4">
          <p class="font-semibold text-ink">Основна область</p>
          <p class="text-sm text-muted">Стан тут не скидається, коли бічна панель ховається.</p>
          <div class="flex flex-wrap gap-2">
            <UiButton size="sm" variant="outline" @click="clicks++">Натиснуто: {{ clicks }}</UiButton>
            <UiButton size="sm" @click="open = !open">{{ open ? 'Сховати панель' : 'Показати панель' }}</UiButton>
          </div>
        </div>
      </template>
      <template #end>
        <div class="h-full bg-subtle p-4">
          <p class="font-semibold text-ink">Бічна панель</p>
          <p class="mt-2 text-sm text-muted">Розсуньте її — після повторного відкриття ширина та сама.</p>
        </div>
      </template>
    </UiResizablePanels>
  </div>
</template>
