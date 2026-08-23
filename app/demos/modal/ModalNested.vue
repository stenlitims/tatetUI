<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiModal from '~/components/ui/UiModal.vue'

const first = ref(false)
const second = ref(false)
</script>

<template>
  <UiButton variant="outline" @click="first = true">Вкладені оверлеї</UiButton>

  <UiModal v-model="first" title="Перший рівень" size="md">
    <p class="text-muted">
      Відкрийте другий рівень і натисніть Escape — закриється лише верхній.
      Це працює завдяки спільному стеку шарів: кожен оверлей знає, чи він
      наразі верхній.
    </p>
    <template #footer>
      <UiButton variant="outline" @click="second = true">Відкрити другий</UiButton>
    </template>
  </UiModal>

  <UiModal v-model="second" title="Другий рівень" size="sm">
    <p class="text-muted">
      z-index цього вікна на 10 більший за попереднє. Прокрутка фону лишається
      заблокованою, поки відкрито хоч один оверлей.
    </p>
  </UiModal>
</template>
