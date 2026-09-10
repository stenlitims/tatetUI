<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiExpand from '~/components/ui/UiExpand.vue'
import UiInput from '~/components/ui/UiInput.vue'

const open = ref(true)
const note = ref('Перевірити правила добірки')
</script>

<template>
  <div class="space-y-3">
    <UiButton size="sm" variant="outline" @click="open = !open">
      {{ open ? 'Згорнути деталі' : 'Розгорнути деталі' }}
    </UiButton>
    <UiExpand v-model="open" title="Додаткові налаштування">
      <UiInput v-model="note" label="Нотатка" />
      <p class="mt-2 text-xs text-muted">Введений текст зберігається після згортання.</p>
    </UiExpand>
    <UiExpand title="Архівні налаштування" disabled>
      Цей блок наразі недоступний.
    </UiExpand>
  </div>
</template>
