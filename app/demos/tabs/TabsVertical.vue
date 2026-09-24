<script setup lang="ts">
import { ref } from 'vue'
import UiTabs from '~/components/ui/UiTabs.vue'

const section = ref('profile')
</script>

<template>
  <div class="w-full max-w-xl">
    <UiTabs
      v-model="section"
      orientation="vertical"
      aria-label="Розділи налаштувань"
      :tabs="[
        { id: 'profile', label: 'Профіль' },
        { id: 'security', label: 'Безпека' },
        { id: 'billing', label: 'Оплата' },
        { id: 'api', label: 'API-ключі', disabled: true },
      ]"
    >
      <template #panel-profile><p class="text-sm text-muted">Ім'я, фото й контактна пошта.</p></template>
      <template #panel-security><p class="text-sm text-muted">Пароль і двофакторна автентифікація.</p></template>
      <template #panel-billing><p class="text-sm text-muted">Тариф, рахунки й спосіб оплати.</p></template>
    </UiTabs>
  </div>
</template>
