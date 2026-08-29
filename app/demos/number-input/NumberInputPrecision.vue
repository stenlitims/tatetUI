<script setup lang="ts">
import { ref } from 'vue'
import UiNumberInput from '~/components/ui/UiNumberInput.vue'

const price = ref<number | null>(14762.5)
const weight = ref<number | null>(null)
</script>

<template>
  <div class="grid w-full max-w-md gap-4">
    <!-- Поза фокусом — згруповане «14 762,50», у фокусі — сире «14762.5». -->
    <UiNumberInput
      v-model="price"
      label="Ціна"
      unit="грн"
      :precision="2"
      :step="0.5"
      :min="0"
      hint="Клацніть у поле — групування зникне на час редагування"
    />
    <UiNumberInput
      v-model="weight"
      label="Вага"
      unit="кг"
      :precision="3"
      :step="0.1"
      :min="0"
      placeholder="0,000"
      error="Вкажіть вагу — без неї не порахувати доставку"
    />
  </div>
</template>
