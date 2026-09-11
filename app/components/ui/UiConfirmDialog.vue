<script setup lang="ts">
import { computed } from 'vue'
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
 * Фокус віддаємо через `initialFocus` самої модалки, а не власним
 * `.focus()` після nextTick.
 *
 * UiModal ставить фокус усередині `focusTrap.activate()` — тобто ПІЗНІШЕ
 * за будь-який watch у цьому компоненті, — і мовчки перебивав наш виклик:
 * фокус завжди лишався на панелі. Найпомітніше це було в prompt, де
 * набрати відповідь можна було лише клікнувши в поле.
 *
 * На небезпечній дії фокус отримує «Скасувати», а не підтвердження:
 * діалог з'являється раптово, і Enter, натиснутий за інерцією, не має
 * незворотно нічого видаляти. Де скасування немає (alert) або дія
 * безпечна — фокус стоїть на підтвердженні, щоб не тиснути Tab.
 */
const initialFocus = computed(() => {
  if (options.value.input) return '[data-confirm-input] input'
  if (options.value.danger && !options.value.hideCancel) return '[data-confirm-cancel]'
  return '[data-confirm-accept]'
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
    :initial-focus="initialFocus"
  >
    <p v-if="options.message" class="text-muted">{{ options.message }}</p>

    <UiInput
      v-if="options.input"
      v-model="inputValue"
      data-confirm-input
      :label="options.input.label"
      :placeholder="options.input.placeholder"
      :required="options.input.required"
      class="mt-3"
      @keydown="onKeydown"
    />

    <template #footer>
      <UiButton v-if="!options.hideCancel" variant="outline" data-confirm-cancel @click="_cancel()">
        {{ options.cancelText }}
      </UiButton>
      <UiButton
        data-confirm-accept
        :variant="options.danger ? 'danger' : 'solid'"
        :disabled="!canAccept"
        @click="_accept()"
      >
        {{ options.confirmText }}
      </UiButton>
    </template>
  </UiModal>
</template>
