<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'

const saving = ref(false)

function save() {
  saving.value = true
  setTimeout(() => (saving.value = false), 1800)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <UiButton :loading="saving" @click="save">Зберегти</UiButton>
    <UiButton variant="outline" :loading="saving" @click="save">Ширина не стрибає</UiButton>
  </div>
</template>
