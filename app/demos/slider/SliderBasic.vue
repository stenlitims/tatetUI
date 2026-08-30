<script setup lang="ts">
import { ref } from 'vue'
import UiSlider from '~/components/ui/UiSlider.vue'

const volume = ref(64)
const price = ref(2500)
</script>

<template>
  <div class="flex w-full max-w-sm flex-col gap-6">
    <UiSlider v-model="volume" label="Гучність" show-value unit="%" />
    <UiSlider v-model="price" :min="0" :max="10000" :step="100" show-bounds show-value label="Ціна" unit=" грн" />
  </div>
</template>