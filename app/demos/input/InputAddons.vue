<script setup lang="ts">
import { ref } from 'vue'
import UiInput from '~/components/ui/UiInput.vue'

const site = ref('tatet.ua')
const price = ref('1250')
const bio = ref('Дизайн-системи і доступність')
</script>

<template>
  <div class="w-full max-w-sm space-y-4">
    <!-- inputmode — не props: він доходить до самого <input>, як і будь-який
         інший нативний атрибут. -->
    <UiInput v-model="site" label="Сайт" prefix="https://" inputmode="url" spellcheck="false" />
    <UiInput v-model="price" label="Ціна" suffix="грн" inputmode="decimal" />
    <UiInput
      v-model="bio"
      label="Коротко про себе"
      hint="Видно в профілі"
      :max-length="60"
      show-count
    />
  </div>
</template>
