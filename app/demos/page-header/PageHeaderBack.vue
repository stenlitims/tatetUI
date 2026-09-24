<script setup lang="ts">
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiPageHeader from '~/components/ui/UiPageHeader.vue'
</script>

<template>
  <div class="w-full max-w-2xl rounded-card border border-line bg-card p-5">
    <UiPageHeader
      title="Олена Бондар"
      description="Менеджерка з продажу · Київ"
      as="h2"
      size="sm"
      back-to="/docs/components/page-header"
      back-label="До команди"
      divider
    >
      <template #leading>
        <UiAvatar name="Олена Бондар" :size="44" status="online" />
      </template>
      <template #actions>
        <UiButton variant="ghost" size="sm">Профіль</UiButton>
      </template>
    </UiPageHeader>
    <p class="mt-4 text-sm text-muted">Вміст сторінки починається під межею шапки.</p>
  </div>
</template>
