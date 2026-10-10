/**
 * Мобільний режим списків вибору: замість випадайки під полем — нижній
 * sheet (UiDrawer position="bottom"). Спільне для UiSelect, UiMultiSelect і
 * UiCombobox.
 *
 * Чому sheet, а не та сама випадайка. На телефоні панель під полем
 * накриває половину екрана, але лишається вузькою смужкою з власною
 * прокруткою: палець, що гортає список, на краю панелі починає гортати
 * сторінку, а пункти внизу ховаються під клавіатурою. Sheet займає всю
 * ширину, гортається як звичайний екран, закривається свайпом чи тапом
 * по фону — так поводяться нативні пікери iOS і Android.
 *
 * Чому не нативний `<select>`. Він не вміє ні пошуку, ні слота `option`
 * (прапори країн, аватари), ні серверних результатів UiCombobox. Sheet дає
 * ту саму звичку руки, не відбираючи жодної можливості компонента.
 */

import { fieldClass } from './uiFieldStyles'

/*
 * Поріг — той самий 768px, з якого поля повертають десктопну щільність
 * (`md:` у uiFieldStyles) і UiSidebar перестає бути drawer'ом. Тип вказівника
 * свідомо не перевіряємо: вузьке вікно з мишею теж краще отримує sheet, ніж
 * випадайку, яка не влазить, а планшет на 768+ — звичайну випадайку.
 */
export const SELECT_SHEET_QUERY = '(max-width: 767px)'

/**
 * Підписка на перемикання режиму. Колбек викликається одразу з поточним
 * станом і далі — на кожну зміну (поворот екрана, ресайз вікна).
 *
 * На сервері й без `matchMedia` (старі WebView, тестові оточення) —
 * завжди `false`: випадайка працює всюди, sheet — лише покращення.
 */
export function watchSelectSheet(callback: (sheet: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    callback(false)
    return () => {}
  }
  const query = window.matchMedia(SELECT_SHEET_QUERY)
  const update = () => callback(query.matches)
  update()
  query.addEventListener('change', update)
  return () => query.removeEventListener('change', update)
}

/**
 * Скільки пунктів має бути, щоб у sheet з'явився пошук. Десяток рядків по
 * 48px — це вже майже весь екран телефона: далі гортати довше, ніж набрати
 * три букви. Коротший список пошуком лише відсунутий униз.
 */
export const SHEET_SEARCH_MIN_OPTIONS = 10

/**
 * Заголовок sheet'а: видимий лейбл, `aria-label`, зовнішній `<label for>`
 * (`control.labels` — так поле підписують у фільтрах, не передаючи `label`),
 * і лише потім плейсхолдер. Без заголовка людина в sheet'і не бачить, ЩО
 * саме обирає, — поле з підписом лишилося під фоном.
 */
export function sheetTitleFor(
  control: HTMLInputElement | HTMLButtonElement | null,
  label: string | undefined,
  ariaLabel: unknown,
  placeholder: string | undefined,
): string {
  if (label) return label
  if (typeof ariaLabel === 'string' && ariaLabel.trim()) return ariaLabel.trim()
  const external = control?.labels?.[0]?.textContent?.trim()
  if (external) return external
  return placeholder ?? ''
}

/**
 * Прокручує sheet до пункту: `center` — при відкритті (обраний пункт
 * посередині, видно сусідів з обох боків), `nearest` — стрілками.
 *
 * Не `scrollIntoView`: на відкритті панель ще їде знизу (transform), і
 * браузер «доганяв» би її, прокручуючи всі предки аж до документа —
 * сторінка під фоном зсувалася, хоч прокрутку й заблоковано
 * (overflow: hidden програмну прокрутку не забороняє). Тут рухається лише
 * власний контейнер sheet'а, а різниця rect'ів від transform не залежить.
 *
 * Липкий пошук (`data-sheet-sticky`) накриває верх контейнера, тож пункт,
 * до якого дійшли стрілкою вгору, не ховається під ним.
 */
export function revealSheetItem(item: HTMLElement | null | undefined, block: 'center' | 'nearest'): void {
  if (!item || typeof window === 'undefined') return
  let scroller = item.parentElement
  while (scroller) {
    const { overflowY } = window.getComputedStyle(scroller)
    if (overflowY === 'auto' || overflowY === 'scroll') break
    scroller = scroller.parentElement
  }
  if (!scroller) return
  const sticky = scroller.querySelector<HTMLElement>('[data-sheet-sticky]')?.offsetHeight ?? 0
  const box = scroller.getBoundingClientRect()
  const rect = item.getBoundingClientRect()
  const top = rect.top - box.top - sticky
  const bottom = rect.bottom - box.bottom
  if (block === 'center') {
    scroller.scrollTop += top - (box.height - sticky - rect.height) / 2
  } else if (top < 0) {
    scroller.scrollTop += top
  } else if (bottom > 0) {
    scroller.scrollTop += bottom
  }
}

/* ------------------------------------------------------------------ */
/*  Класи                                                             */
/* ------------------------------------------------------------------ */

/*
 * Рядок sheet'а — 48px+ (py-3.5 + рядок 16px): пункти стоять впритул, тож
 * невидима зона ::after тут неможлива, ціль дотику тримає сама висота.
 * `active:` замість `hover:` — на дотику hover «липне» до останнього
 * торкнутого рядка. select-none: довгий тап не виділяє текст пункту.
 */
export const sheetItemClass =
  'flex w-full cursor-pointer select-none items-center gap-3 px-4 py-3.5 text-left text-[16px] leading-snug text-ink transition-colors active:bg-hover'

/** Підсвітка пункту з клавіатури (вузьке вікно з фізичною клавіатурою). */
export const sheetItemHighlighted = 'bg-hover'

/** Порожній стан і «Завантаження…» в sheet'і. */
export const sheetEmptyClass = 'px-4 py-6 text-center text-[16px] text-muted'

/*
 * Пошук — звичайне поле: 16px тексту (iOS не зумує), висота 45px. Ліворуч
 * місце під лупу.
 */
export const sheetSearchInputClass = fieldClass('md', { padLeft: 'pl-10' })

/*
 * Пошук липне до верху прокрутки sheet'а: прокрутивши список, людина не
 * мусить гортати назад, щоб уточнити запит.
 */
export const sheetSearchBarClass = 'sticky top-0 z-10 border-b border-line bg-card px-4 py-3'

/*
 * Нижній відступ — під домашній індикатор iPhone: у sheet'і без футера
 * останній пункт інакше лежав би під ним.
 */
export const sheetListClass = 'py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] outline-none'
