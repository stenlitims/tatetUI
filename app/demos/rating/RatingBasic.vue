<script setup lang="ts">
import { shallowRef } from 'vue'
import UiRating from '~/components/ui/UiRating.vue'

const quality = shallowRef<number | null>(4)
const delivery = shallowRef<number | null>(null)
</script>

<template>
  <div class="flex w-full max-w-md flex-col gap-6">
    <UiRating
      v-model="quality"
      label="Якість товару"
      :labels="['Жахливо', 'Погано', 'Нормально', 'Добре', 'Чудово']"
      size="lg"
    />
    <UiRating
      v-model="delivery"
      label="Швидкість доставки"
      required
      :clearable="false"
      :error="delivery ? undefined : 'Оцініть доставку, щоб надіслати відгук'"
    />
    <p class="text-sm text-muted">
      Якість: {{ quality ?? '—' }}, доставка: {{ delivery ?? '—' }}.
      Повторний клік по обраній зірці знімає оцінку.
    </p>
  </div>
</template>
