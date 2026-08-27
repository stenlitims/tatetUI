<script setup lang="ts">
import { ref } from 'vue'
import UiAccordion from '~/components/ui/UiAccordion.vue'
import UiStepper from '~/components/ui/UiStepper.vue'
import UiSlider from '~/components/ui/UiSlider.vue'
import UiDatePicker from '~/components/ui/UiDatePicker.vue'
import UiInlineEdit from '~/components/ui/UiInlineEdit.vue'

const step = ref(1)
const volume = ref(64)
const price = ref(2500)
const date = ref('2026-08-27')
const author = ref('Ігор Шевченко')
const views = ref<number | null>(1284)

const accordionItems = [
  { id: 'general', label: 'Загальні налаштування' },
  { id: 'seo', label: 'SEO' },
  { id: 'advanced', label: 'Розширені', disabled: true },
]
</script>

<template>
  <div class="flex max-w-xl flex-col gap-8">
    <UiAccordion :items="accordionItems" :default-open="['general']">
      <template #content-general>
        Назва сайту, мови версій, головна сторінка. Типові поля, які потрібні
        рідко, але мають бути під рукою.
      </template>
      <template #content-advanced>
        Ця секція деактивована — приклад disabled-стану.
      </template>
    </UiAccordion>

    <div>
      <UiStepper
        v-model="step"
        :steps="[
          { id: 'site', label: 'Сайт', description: 'Базові поля' },
          { id: 'content', label: 'Контент' },
          { id: 'publish', label: 'Публікація' },
        ]"
      />
      <p class="mt-2 text-xs text-muted">Крок {{ step + 1 }} з 3 — клікайте по кроках або ведіть станом.</p>
    </div>

    <div class="flex flex-col gap-6">
      <UiSlider v-model="volume" label="Гучність" show-value unit="%" />
      <UiSlider v-model="price" :min="0" :max="10000" :step="100" show-bounds show-value label="Ціна" unit=" грн" />
    </div>

    <div class="flex flex-col gap-4">
      <UiDatePicker v-model="date" label="Дата публікації" />
      <div class="grid items-center gap-1 text-sm sm:grid-cols-[8rem_1fr] sm:gap-3">
        <span class="text-xs text-muted">Автор</span>
        <UiInlineEdit v-model="author" type="text" aria-label="Автор" />
        <span class="text-xs text-muted">Перегляди</span>
        <UiInlineEdit v-model="views" type="number" aria-label="Перегляди" />
      </div>
    </div>
  </div>
</template>