<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useConfirm } from '~/composables/useConfirm'
import UiButton from './UiButton.vue'
import UiInput from './UiInput.vue'
import UiModal from './UiModal.vue'

/**
 * Рендерер імперативних діалогів. Монтується РІВНО ОДИН раз на застосунок
 * — зазвичай у app.vue, поруч із UiToaster. Пропсів не має: усе рішення
 * приймає useConfirm().
 *
 * Побудований на UiModal, а не на власній розмітці, щоб пастка фокуса,
 * блокування прокрутки і стек шарів були ті самі. Діалог підтвердження
 * майже завжди відкривається ПОВЕРХ іншого оверлея — саме там власна
 * реалізація z-index і ламалася б.
 */

defineSlots<Record<string, never>>()

const { _state, _accept, _cancel } = useConfirm()
const { isOpen, options, inputValue } = _state

const inputRef = ref<InstanceType<typeof UiInput> | null>(null)
const confirmRef = ref<InstanceType<typeof UiButton> | null>(null)

const open = computed({
  get: () => isOpen.value,
  // UiModal може закритися сам (Escape, хрестик) — це рівносильно скасуванню.
  set: (value: boolean) => {
    if (!value && isOpen.value) _cancel()
  },
})

const canAccept = computed(() => {
  const input = options.value.input
  if (!input?.required) return true
  return inputValue.value.trim().length > 0
})

/*
 * Фокус ставимо вручну після відкриття: у полі введення, якщо це prompt,
 * інакше на кнопці підтвердження. UiModal типово фокусує саму панель — це
 * правильний дефолт для форм на мобільних, але для діалогу з однією дією
 * зайвий Tab перед підтвердженням дратує.
 */
watch(isOpen, async (value) => {
  if (!value) return
  await nextTick()
  if (options.value.input) inputRef.value?.focus()
  else confirmRef.value?.focus()
})

function onKeydown(event: KeyboardEvent) {
  // Enter у полі введення підтверджує — інакше єдиний спосіб завершити
  // prompt це тягнутися мишкою до кнопки.
  if (event.key === 'Enter' && canAccept.value) _accept()
}
</script>

<template>
  <UiModal
    v-model="open"
    :title="options.title"
    size="sm"
    :close-on-backdrop="!options.input"
    :closable="!options.input?.required"
  >
    <p v-if="options.message" class="text-muted">{{ options.message }}</p>

    <UiInput
      v-if="options.input"
      ref="inputRef"
      v-model="inputValue"
      :label="options.input.label"
      :placeholder="options.input.placeholder"
      :required="options.input.required"
      class="mt-3"
      @keydown="onKeydown"
    />

    <template #footer>
      <UiButton v-if="!options.hideCancel" variant="outline" @click="_cancel()">
        {{ options.cancelText }}
      </UiButton>
      <UiButton
        ref="confirmRef"
        :variant="options.danger ? 'danger' : 'solid'"
        :disabled="!canAccept"
        @click="_accept()"
      >
        {{ options.confirmText }}
      </UiButton>
    </template>
  </UiModal>
</template>
