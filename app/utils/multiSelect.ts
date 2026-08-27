/**
 * Чисті функції вибору UiMultiSelect.
 *
 * Винесено з toggleOption і clearAll в UiMultiSelect.vue, щоб перевіряти
 * поведінку (стабільний порядок віддачі, фільтроване знімання) тестом,
 * а не рендером: компонент викликає функції зі своїм станом.
 */

/** Пункт списку мультиселекту. Джерело істини — UiMultiSelect.vue. */
export interface MultiSelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

/**
 * Порядок віддачі = порядок options, а не порядок кліків: споживач
 * отримує стабільний масив, навіть коли клікає з кінця списку.
 */
export function orderSelection(options: MultiSelectOption[], selectedSet: Set<string | number>): (string | number)[] {
  return options.filter((o) => selectedSet.has(o.value)).map((o) => o.value)
}

/**
 * Зняти все: з активним пошуком — лише відфільтровані пункти, без
 * пошуку — усе. Вибране поза фільтром має вижити.
 */
export function clearFiltered(
  internalValue: (string | number)[],
  filteredOptions: MultiSelectOption[],
): (string | number)[] {
  const filteredSet = new Set(filteredOptions.map((o) => o.value))
  return internalValue.filter((v) => !filteredSet.has(v))
}