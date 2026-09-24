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

    <!-- Підпис біля краю — заголовок групи, а не пауза посередині. -->
    <UiSeparator label="Цього тижня" label-position="start" />
    <p class="text-sm text-muted">3 нові угоди</p>

    <div class="flex h-10 items-center gap-1 pt-4">
      <span class="text-sm text-ink">Редагувати</span>
      <UiSeparator orientation="vertical" spacing="sm" />
      <span class="text-sm text-ink">Дублювати</span>
      <UiSeparator orientation="vertical" spacing="sm" />
      <span class="text-sm text-danger">Видалити</span>
    </div>

    <!-- Вертикальний підписаний: «або» між двома способами входу поруч. -->
    <div class="flex items-stretch pt-4">
      <p class="flex-1 rounded-control bg-subtle p-3 text-center text-sm text-ink">Увійти через Google</p>
      <UiSeparator label="або" orientation="vertical" spacing="sm" />
      <p class="flex-1 rounded-control bg-subtle p-3 text-center text-sm text-ink">Email і пароль</p>
    </div>
  </div>
</template>
