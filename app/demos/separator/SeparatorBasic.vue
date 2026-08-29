<script setup lang="ts">
import UiSeparator from '~/components/ui/UiSeparator.vue'
</script>

<template>
  <div class="w-full max-w-md space-y-1">
    <p class="text-sm text-ink">Основні дані клієнта</p>
    <!-- Декоративний: межу вже видно з розкладки, тож для скрінрідера
         роздільника не існує. -->
    <UiSeparator />
    <p class="text-sm text-ink">Контакти</p>

    <!-- Смисловий: підпис сам робить роздільник смисловим. -->
    <UiSeparator label="Архів" />
    <p class="text-sm text-muted">Угоди, закриті понад рік тому</p>

    <div class="flex h-10 items-center gap-1 pt-4">
      <span class="text-sm text-ink">Редагувати</span>
      <UiSeparator orientation="vertical" spacing="sm" />
      <span class="text-sm text-ink">Дублювати</span>
      <UiSeparator orientation="vertical" spacing="sm" />
      <span class="text-sm text-danger">Видалити</span>
    </div>
  </div>
</template>
