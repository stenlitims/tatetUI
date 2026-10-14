import { onMounted, shallowRef, watch, type ShallowRef } from 'vue'

/**
 * Готовність `<Teleport to="body">` плаваючої панелі чи оверлея: вмикається,
 * коли панель відкривають уперше, а не в `onMounted`.
 *
 * На сервері Teleport вимкнений — SSR і гідратація збігаються. Раніше його
 * вмикали в `onMounted`, і кожен екземпляр одразу після монтування
 * рендерився вдруге — разом зі слотом-тригером. З меню, підказкою чи
 * селектом у кожному рядку довгого списку це подвоювало вартість появи
 * списку. Поки панель закрита, телепортувати нічого.
 *
 * Спостерігач — `flush: 'pre'`: прапорець стає `true` ДО рендеру, що вперше
 * показує панель, тож вона одразу з'являється в `<body>`, а не на мить у
 * своєму місці в дереві (де `position: fixed` під предком із `transform`
 * поїхав би не туди).
 *
 * ```ts
 * const teleportReady = useLazyTeleport(() => props.modelValue)
 * // <Teleport to="body" :disabled="!teleportReady">
 * ```
 */
export function useLazyTeleport(open: () => boolean): ShallowRef<boolean> {
  const ready = shallowRef(false)
  watch(open, (value) => {
    if (value) ready.value = true
  }, { flush: 'pre' })
  // Панель, відкрита вже під час серверного рендеру, — одразу в <body>.
  onMounted(() => {
    if (open()) ready.value = true
  })
  return ready
}
