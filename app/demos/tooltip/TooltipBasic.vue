<script setup lang="ts">
import UiButton from '~/components/ui/UiButton.vue'
import UiTooltip from '~/components/ui/UiTooltip.vue'
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <UiTooltip content="Видалити без можливості відновлення">
      <template #default="{ describedBy }">
        <UiButton variant="danger" size="icon" aria-label="Видалити" :aria-describedby="describedBy">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </UiButton>
      </template>
    </UiTooltip>

    <UiTooltip placement="bottom" content="Підказка знизу тригера">
      <template #default="{ describedBy }">
        <UiButton variant="outline" :aria-describedby="describedBy">Знизу</UiButton>
      </template>
    </UiTooltip>

    <UiTooltip placement="right" content="Підказка праворуч тригера">
      <template #default="{ describedBy }">
        <UiButton variant="ghost" :aria-describedby="describedBy">Праворуч</UiButton>
      </template>
    </UiTooltip>
  </div>
</template>