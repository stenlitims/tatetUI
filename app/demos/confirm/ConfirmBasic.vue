<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import { useConfirm } from '~/composables/useConfirm'
import { useToast } from '~/composables/useToast'

const { confirm, prompt } = useConfirm()
const toast = useToast()
const lastResult = ref<string>('—')

async function remove() {
  const ok = await confirm({
    title: 'Видалити проєкт?',
    message: 'Дію не можна скасувати. Разом із проєктом зникнуть усі його сторінки.',
    confirmText: 'Видалити',
    danger: true,
  })
  lastResult.value = ok ? 'підтверджено' : 'скасовано'
  if (ok) toast.success('Проєкт видалено')
}

async function rename() {
  const name = await prompt({
    title: 'Нова назва',
    input: { label: 'Назва проєкту', placeholder: 'Мій проєкт', required: true },
    confirmText: 'Перейменувати',
  })
  lastResult.value = name === null ? 'скасовано' : `введено: ${name}`
}
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <UiButton variant="danger" @click="remove">Видалити проєкт</UiButton>
      <UiButton variant="outline" @click="rename">Перейменувати</UiButton>
    </div>
    <p class="text-sm text-muted">Результат: {{ lastResult }}</p>
  </div>
</template>
