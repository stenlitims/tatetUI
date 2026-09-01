<script setup lang="ts">
import UiConfirmDialog from '~/components/ui/UiConfirmDialog.vue'
import UiToaster from '~/components/ui/UiToaster.vue'
</script>

<template>
  <NuxtRouteAnnouncer />
  <!-- Смужка прогресу навігації під шапкою. На прередереному сайті
       переходи майже миттєві, але payload сторінки й чанки демо їдуть
       мережею — без індикатора клік у сайдбарі на повільному з'єднанні
       виглядає як «нічого не сталося». -->
  <NuxtLoadingIndicator color="var(--accent-solid)" :height="2" :throttle="120" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <!--
    Обидва — глобальні singleton-рендерери, монтуються рівно один раз.
    Стан лежить у модульній області useToast() / useConfirm(), тож викликати
    їх можна з будь-якого місця без прокидання пропсів через дерево.
  -->
  <UiToaster />
  <UiConfirmDialog />
</template>
