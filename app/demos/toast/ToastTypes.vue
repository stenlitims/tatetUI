<script setup lang="ts">
import UiButton from '~/components/ui/UiButton.vue'
import { useToast } from '~/composables/useToast'

const toast = useToast()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <UiButton size="sm" @click="toast.success('Зміни збережено')">success</UiButton>
    <UiButton size="sm" variant="outline" @click="toast.info('Синхронізація запущена')">
      info
    </UiButton>
    <UiButton
      size="sm"
      variant="outline"
      @click="toast.warning('Місце на диску майже вичерпано')"
    >
      warning
    </UiButton>
    <UiButton
      size="sm"
      variant="danger"
      @click="toast.error('Не вдалося зберегти: сервер недоступний')"
    >
      error
    </UiButton>
  </div>
</template>
