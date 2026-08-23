<script setup lang="ts">
import { ref } from 'vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'

const text = ref('Спробуйте додати кілька рядків — поле росте разом із текстом.')
</script>

<template>
  <div class="w-full max-w-md">
    <UiTextarea
      v-model="text"
      label="Опис"
      autoresize
      :max-rows="8"
      hint="Росте до восьми рядків, далі з'являється власна прокрутка."
    />
  </div>
</template>
