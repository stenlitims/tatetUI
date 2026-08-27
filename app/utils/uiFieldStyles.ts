/**
 * Спільний стильовий контракт усіх полів вводу.
 *
 * Це «cva без залежностей»: розміри, стани, панель випадайки, лейбл і текст
 * помилки живуть в одному місці, тож UiInput, UiTextarea, UiSelect і
 * UiMultiSelect лишаються візуально однаковими без копіювання довгих рядків
 * класів по компонентах.
 *
 * Чому не cva чи tailwind-variants: увесь потрібний функціонал — це пошук
 * у Record і склеювання рядків. Заради нього не варто вводити залежність,
 * яку доведеться тягнути в кожен проєкт разом із компонентом.
 *
 * Мобільні розміри вищі за десктопні (h-11 → md:h-9) — нижче 44px палець
 * промахується. Ієрархія розмірів на телефоні лишається в шрифті та
 * паддінгу, бо різна ВИСОТА полів пальцю нічого не дає.
 */

export type FieldSize = 'sm' | 'md' | 'lg'

/* ------------------------------------------------------------------ */
/*  Базове поле / тригер                                              */
/* ------------------------------------------------------------------ */

const fieldBase =
  'w-full rounded-control border border-line bg-input text-ink placeholder:text-muted transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-accent-solid'

const fieldSizes: Record<FieldSize, string> = {
  sm: 'h-11 px-2.5 text-sm md:h-8 md:px-2 md:text-xs',
  md: 'h-11 px-3 text-base md:h-9 md:px-2.5 md:text-sm',
  lg: 'h-12 px-3.5 text-base md:h-10 md:px-3',
}

const fieldDisabled = 'opacity-50 cursor-not-allowed'
const fieldError = 'border-danger focus-visible:ring-danger focus-visible:border-danger'

/* ------------------------------------------------------------------ */
/*  Лейбл / підказка / помилка                                        */
/* ------------------------------------------------------------------ */

export const labelClass = 'block text-sm font-medium text-ink mb-1'
export const errorTextClass = 'mt-1 text-sm text-danger'
export const helperTextClass = 'mt-1 text-sm text-muted'

/* ------------------------------------------------------------------ */
/*  Панель випадайки                                                  */
/*                                                                    */
/*  z-[1100] не випадкове: overlay-стек роздає шари з кроком 10 від    */
/*  1000, тож перші ~10 оверлеїв лишаються НИЖЧЕ за випадайку.        */
/*  Без цього селект усередині модалки був би перекритий її панеллю.  */
/* ------------------------------------------------------------------ */

export const dropdownPanelClass =
  'absolute z-[1100] mt-1 w-full min-w-max max-h-80 overflow-y-auto scrollbar-thin rounded-control ' +
  'border border-line bg-dropdown shadow-overlay'

export const dropdownEmptyClass = 'px-3 py-2 text-center text-sm text-muted'

export const dropdownSearchInputClass =
  'w-full rounded-control border border-line bg-input px-2 py-1.5 text-sm text-ink ' +
  'placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/* ------------------------------------------------------------------ */
/*  Пункти випадайки                                                  */
/* ------------------------------------------------------------------ */

const itemSizes: Record<FieldSize, string> = {
  sm: 'px-2 py-2 text-xs md:py-1.5',
  md: 'px-3 py-2.5 text-sm md:py-2',
  lg: 'px-3 py-3 text-base md:py-2.5',
}

export const itemBase = 'cursor-pointer transition-colors text-ink'
export const itemHover = 'hover:bg-hover'
export const itemHighlighted = 'bg-primary-50 text-accent'
export const itemSelected = 'font-medium'

/* ------------------------------------------------------------------ */
/*  Іконки (шеврон / очистити / галочка)                              */
/* ------------------------------------------------------------------ */

const iconSizes: Record<FieldSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

/* ------------------------------------------------------------------ */
/*  Анімація випадайки                                                */
/*                                                                    */
/*  Об'єкт розкладається прямо в <Transition v-bind="...">, тож усі    */
/*  випадайки анімуються однаково без жодного спільного CSS.          */
/* ------------------------------------------------------------------ */

export const dropdownTransitionProps = {
  enterActiveClass: 'transition duration-150 ease-out',
  enterFromClass: 'transform scale-95 opacity-0',
  enterToClass: 'transform scale-100 opacity-100',
  leaveActiveClass: 'transition duration-100 ease-in',
  leaveFromClass: 'transform scale-100 opacity-100',
  leaveToClass: 'transform scale-95 opacity-0',
}

/* ------------------------------------------------------------------ */
/*  Складені хелпери                                                  */
/* ------------------------------------------------------------------ */

/** Повний рядок класів базового поля або тригера. */
export function fieldClass(
  size: FieldSize,
  opts?: { error?: boolean; disabled?: boolean; extra?: string },
): string {
  const classes = [fieldBase, fieldSizes[size]]
  if (opts?.error) classes.push(fieldError)
  if (opts?.disabled) classes.push(fieldDisabled)
  if (opts?.extra) classes.push(opts.extra)
  return classes.join(' ')
}

/** Класи пункту списку у випадайці. */
export function itemClass(size: FieldSize): string {
  return `${itemBase} ${itemSizes[size]} ${itemHover}`
}

/** Клас розміру іконки. */
export function iconClass(size: FieldSize): string {
  return iconSizes[size]
}
