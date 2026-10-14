import { afterEach, expect, it } from 'vitest'
import { ref, nextTick } from 'vue'
import UiModal from '~/components/ui/UiModal.vue'
import { uiText, setUiTextTranslator } from '~/composables/useUiText'
import { mountComponent } from './helpers/mountComponent'

afterEach(() => setUiTextTranslator())

it('keeps Ukrainian defaults and plain-text substitutions without a translator', () => {
  expect(uiText('Видалити {0}', { 0: '<b>$&</b>' })).toBe('Видалити <b>$&</b>')
})

it('updates an already open dialog’s built-in close label with a reactive translator', async () => {
  const english = ref(false)
  setUiTextTranslator(message => english.value && message === 'Закрити' ? 'Close' : message)
  const mounted = await mountComponent(UiModal, { modelValue: true, title: 'Example' })
  try {
    await nextTick()
    expect(document.querySelector('button[aria-label="Закрити"]')).not.toBeNull()
    english.value = true
    await nextTick()
    expect(document.querySelector('button[aria-label="Close"]')).not.toBeNull()
  } finally { mounted.unmount() }
})
