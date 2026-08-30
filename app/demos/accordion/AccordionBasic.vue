<script setup lang="ts">
import UiAccordion from '~/components/ui/UiAccordion.vue'

const accordionItems = [
  { id: 'general', label: 'Загальні налаштування' },
  { id: 'seo', label: 'SEO' },
  { id: 'advanced', label: 'Розширені', disabled: true },
]
</script>

<template>
  <UiAccordion :items="accordionItems" :default-open="['general']">
    <template #content-general>
      Назва сайту, мови версій, головна сторінка. Типові поля, які потрібні
      рідко, але мають бути під рукою.
    </template>
    <template #content-advanced>
      Ця секція деактивована — приклад disabled-стану.
    </template>
  </UiAccordion>
</template>