<script setup lang="ts">
import { ref } from 'vue'
import UiAlert from '~/components/ui/UiAlert.vue'

const visible = ref(true)
</script>

<template>
  <div class="flex flex-col gap-3">
    <UiAlert tone="info" title="Заплановане обслуговування">
      29 серпня з 02:00 до 03:00 сервіс буде недоступний.
    </UiAlert>
    <UiAlert tone="success" title="Збережено">Зміни опубліковано на всіх мовах.</UiAlert>
    <UiAlert tone="warning">Квоту зберігання вичерпано на 90% — очистіть старі файли.</UiAlert>
    <UiAlert tone="danger" title="Помилка збереження" dismissible @dismiss="visible = false">
      Сервер не відповів. Спробуйте ще раз або скопіюйте текст у буфер.
    </UiAlert>
    <UiAlert v-if="visible" tone="neutral" title="Чернетка" dismissible @dismiss="visible = false">
      Ця сторінка ще не опублікована.
    </UiAlert>
  </div>
</template>