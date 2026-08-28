<script setup lang="ts">
import { shallowRef } from 'vue'

const newsletter = shallowRef(true)
const partial = shallowRef(true)
</script>

<template>
  <div class="grid max-w-md gap-4">
    <UiCheckbox v-model="newsletter" name="newsletter" label="Щотижневий дайджест" description="Один лист щопʼятниці без реклами." />
    <UiCheckbox v-model="partial" indeterminate label="Обрати всі проєкти" hint="Частину проєктів уже обрано." />
    <p class="text-sm text-muted">Дайджест: {{ newsletter ? 'увімкнено' : 'вимкнено' }}</p>
  </div>
</template>
