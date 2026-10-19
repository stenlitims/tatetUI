import { onBeforeUnmount, shallowRef, watch } from 'vue'

/**
 * Стан країв вертикальної області прокрутки: чи вміст прокручено від верху
 * і чи лишилося що гортати донизу.
 *
 * Навіщо. Шапка й футер UiModal і UiDrawer пласкі — того ж тла, що й
 * вміст, без постійної лінії, як у GNOME (libadwaita). Межу видно лише
 * тоді, коли вона щось означає: вміст заїхав під шапку або продовжується
 * під кнопками. Постійна лінія ділила б навіть вікно з двома рядками
 * тексту на три коробки; без лінії взагалі довга форма не показувала б,
 * що під футером є ще поля.
 *
 * Сама подія `scroll` не помітила б, що вміст виріс без прокрутки (під
 * полем з'явилась помилка, догрузився список), тож розмір стежать
 * ResizeObserver на області й на кожній її прямій дитині, а
 * MutationObserver перепідписує дітей, коли слот підміняє вузли, — той
 * самий підхід, що в UiScrollArea.
 */
export function useScrollEdges(target: () => HTMLElement | null) {
  /** Вміст прокручено від верхнього краю: під шапкою щось сховано. */
  const scrolledFromTop = shallowRef(false)
  /** Під нижнім краєм області ще є вміст. */
  const moreBelow = shallowRef(false)

  let element: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let mutationObserver: MutationObserver | null = null

  /*
   * Допуск у пікселях. Нуль не годиться: при дробовому масштабуванні
   * scrollTop + clientHeight не дорівнює scrollHeight рівно, і лінія над
   * футером не зникала б навіть у самому низу.
   */
  const THRESHOLD = 1

  function update() {
    if (!element) {
      scrolledFromTop.value = false
      moreBelow.value = false
      return
    }
    const { scrollTop, clientHeight, scrollHeight } = element
    scrolledFromTop.value = scrollTop > THRESHOLD
    moreBelow.value = scrollTop + clientHeight < scrollHeight - THRESHOLD
  }

  function observeChildren() {
    if (!resizeObserver || !element) return
    resizeObserver.disconnect()
    resizeObserver.observe(element)
    for (const child of Array.from(element.children)) resizeObserver.observe(child)
    update()
  }

  function detach() {
    element?.removeEventListener('scroll', update)
    resizeObserver?.disconnect()
    mutationObserver?.disconnect()
    resizeObserver = null
    mutationObserver = null
    element = null
  }

  function attach(next: HTMLElement) {
    element = next
    element.addEventListener('scroll', update, { passive: true })
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => update())
      observeChildren()
    }
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(observeChildren)
      mutationObserver.observe(element, { childList: true })
    }
    update()
  }

  // flush: 'post' — елемент з'являється в DOM разом із відкриттям оверлея,
  // і читати його розміри до вставки нема чого.
  watch(
    target,
    (next) => {
      if (next === element) return
      detach()
      if (next) attach(next)
      else update()
    },
    { flush: 'post' },
  )

  onBeforeUnmount(detach)

  return { scrolledFromTop, moreBelow, update }
}
