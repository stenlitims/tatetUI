<script setup lang="ts">
import UiConfirmDialog from '~/components/ui/UiConfirmDialog.vue'
import UiToaster from '~/components/ui/UiToaster.vue'
</script>

<template>
  <NuxtRouteAnnouncer />
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
