<script setup lang="ts">
import UiAvatar from '~/components/ui/UiAvatar.vue'
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <UiAvatar name="Ігор Шевченко" :size="24" />
    <UiAvatar name="Марія Ковалишин" :size="32" />
    <UiAvatar name="Олег Марченко" :size="48" />
    <!-- Битий URL навмисно: демонструє падіння на ініціали -->
    <UiAvatar src="https://example.invalid/no-photo.png" name="Немає фото" :size="32" />
    <UiAvatar tone="neutral" name="Сервісний акаунт" :size="32" />
    <UiAvatar name="Оксана Литвин" :size="40" status="online" />
    <UiAvatar name="Денис Кравець" :size="40" status="busy" tone="neutral" />
    <!-- Компанія — квадрат; ініціали беруться з букв, а не з лапок: «ТС». -->
    <UiAvatar name="ТОВ «Сігма Трейд»" :size="40" shape="square" />
  </div>
</template>