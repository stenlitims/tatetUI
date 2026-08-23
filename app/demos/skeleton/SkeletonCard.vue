<script setup lang="ts">
import UiSkeleton from '~/components/ui/UiSkeleton.vue'
</script>

<template>
  <!-- Геометрія повторює реальну картку: аватар, два рядки тексту, кнопка.
       Смужки випадкової довжини читалися б як поламана верстка. -->
  <div class="w-full max-w-sm rounded-card border border-line bg-card p-4" aria-busy="true">
    <div class="flex items-center gap-3">
      <UiSkeleton class="h-10 w-10" rounded="full" />
      <div class="flex-1 space-y-2">
        <UiSkeleton class="h-3.5 w-32" />
        <UiSkeleton class="h-3 w-20" />
      </div>
    </div>
    <div class="mt-4 space-y-2">
      <UiSkeleton class="h-3 w-full" />
      <UiSkeleton class="h-3 w-4/5" />
    </div>
    <UiSkeleton class="mt-4 h-9 w-28" />
  </div>
</template>
