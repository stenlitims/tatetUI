import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/**
 * Клік поза набором елементів.
 *
 * Пишемо самі, а не беремо `onClickOutside` з VueUse: заради одного хелпера
 * не варто вводити залежність, яку доведеться тягнути в кожен проєкт разом
 * із компонентом.
 *
 * `pointerdown` у фазі ЗАХОПЛЕННЯ, а не `click`:
 *   - pointerdown спрацьовує до того, як елемент під курсором встигне
 *     зникнути; на click ціль уже могла б бути видалена з DOM, і перевірка
 *     `contains` дала б хибне «клікнули повз»;
 *   - захоплення потрібне, щоб нас не випередив обробник, який кличе
 *     stopPropagation.
 *
 * `targets` — масив, бо телепортована панель формально лежить поза коренем
 * компонента, і перевіряти треба обидва вузли.
 */
export function useClickOutside(
  targets: Array<Ref<HTMLElement | null | undefined>>,
  handler: (event: PointerEvent) => void,
  options?: {
    /** Поки повертає false, слухач не спрацьовує. */
    enabled?: () => boolean
    /**
     * Селектори шарів, кліки в яких НЕ вважаються кліком повз:
     * випадайки, списки, вкладені діалоги.
     */
    ignore?: string
  },
) {
  const ignore = options?.ignore ?? '[role="listbox"], [role="option"], [role="dialog"], [role="menu"]'

  function onPointerDown(event: PointerEvent) {
    if (options?.enabled && !options.enabled()) return
    const target = event.target as HTMLElement | null
    if (!target) return
    for (const ref of targets) {
      if (ref.value?.contains(target)) return
    }
    if (ignore && target.closest(ignore)) return
    handler(event)
  }

  onMounted(() => document.addEventListener('pointerdown', onPointerDown, true))
  onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true))
}
