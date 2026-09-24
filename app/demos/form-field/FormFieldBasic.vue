<script setup lang="ts">
import { shallowRef } from 'vue'
import UiFormField from '~/components/ui/UiFormField.vue'
import UiToggleGroup from '~/components/ui/UiToggleGroup.vue'
import { fieldClass } from '~/utils/uiFieldStyles'

const density = shallowRef<string | number>('comfortable')
const color = shallowRef('#2563eb')
</script>

<template>
  <div class="flex w-full max-w-md flex-col gap-6">
    <!-- Сегментний перемикач не має власного лейбла — FormField дає і
         видимий заголовок групи, і його зв'язок для скрінрідера. -->
    <UiFormField
      label="Щільність таблиць"
      description="Застосовується до всіх таблиць робочого простору."
      as="fieldset"
    >
      <template #default="{ labelId, describedBy }">
        <UiToggleGroup
          v-model="density"
          block
          :aria-labelledby="labelId"
          :aria-describedby="describedBy"
          :options="[
            { value: 'compact', label: 'Щільно' },
            { value: 'comfortable', label: 'Звичайно' },
            { value: 'relaxed', label: 'Просторо' },
          ]"
        />
      </template>
    </UiFormField>

    <!-- Сторонній чи нативний контрол: id і describedBy — зі слота. -->
    <UiFormField label="Колір бренду" hint="Використовується для кнопок і посилань" :error="color === '#ffffff' ? 'Білий не читається на білому тлі' : undefined">
      <template #label-aside>
        <button type="button" class="rounded-control text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" @click="color = '#2563eb'">
          Скинути
        </button>
      </template>
      <template #default="{ id, describedBy, invalid }">
        <div class="flex items-center gap-2">
          <input
            :id="id"
            v-model="color"
            type="color"
            class="h-10 w-12 shrink-0 cursor-pointer rounded-control border border-line bg-input p-1 md:h-9"
            :aria-describedby="describedBy"
            :aria-invalid="invalid || undefined"
          />
          <input v-model="color" :class="fieldClass('md', { error: invalid })" aria-label="Колір бренду, HEX" />
        </div>
      </template>
    </UiFormField>
  </div>
</template>
