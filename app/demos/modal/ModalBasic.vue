<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiModal from '~/components/ui/UiModal.vue'

const open = ref(false)
</script>

<template>
  <UiButton @click="open = true">Відкрити вікно</UiButton>

  <UiModal v-model="open" title="Видалити проєкт?" size="sm">
    <p class="text-muted">
      Дію не можна скасувати. Разом із проєктом буде видалено всі його сторінки
      та завантажені файли.
    </p>

    <template #footer>
      <UiButton variant="outline" @click="open = false">Скасувати</UiButton>
      <UiButton variant="danger" @click="open = false">Видалити</UiButton>
    </template>
  </UiModal>
</template>
