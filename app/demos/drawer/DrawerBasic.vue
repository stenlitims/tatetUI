<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'

const open = ref(false)
</script>

<template>
  <UiButton @click="open = true">Редагувати профіль</UiButton>

  <UiDrawer v-model="open" title="Редагування профілю" size="sm">
    <div class="space-y-4">
      <p class="text-muted">
        Клік по затемненому фону тут навмисно НЕ закриває панель: усередині
        форма, і випадковий клік повз неї не має знищити введене.
      </p>
      <p class="text-muted">Закрити можна хрестиком або клавішею Escape.</p>
    </div>

    <template #footer>
      <UiButton variant="outline" @click="open = false">Скасувати</UiButton>
      <UiButton @click="open = false">Зберегти</UiButton>
    </template>
  </UiDrawer>
</template>
