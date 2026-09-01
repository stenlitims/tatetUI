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

/*
 * Фокус — межа акцентного кольору плюс м'яке кільце 3px на 30% альфи, а не
 * суцільне кільце 2px. Суцільне кільце на полі з межею читається як подвійна
 * рамка; м'яке — як «підсвітка», і при цьому лишається видимим (межа стає
 * акцентною — саме вона несе контраст). Наведення підсилює межу — поле має
 * відповідати на курсор ще до кліку.
 */
const fieldBase =
  'w-full rounded-control border border-line bg-input text-ink placeholder:text-muted transition-[border-color,box-shadow,background-color] ' +
  'not-disabled:hover:border-line-strong ' +
  'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:border-accent-solid focus-visible:hover:border-accent-solid'

/*
 * Мобільні розміри ДОВЖЕ, а не вище: 45px (h-12 за кореня 15px) — це
 * фактичний мінімум цільової зони дотику, тож поля на телефоні рівно на
 * 44–45px і не «ховаються» під пальцем. Десктопні висоти повертає `md:`.
 *
 * `sm` на мобільному теж тримає 16px тексту: iOS Safari при фокусі на
 * поле з font-size < 16px АВТОМАТИЧНО зумує сторінку на ~113%. Це не
 * поправна дія — це властивість браузера, і `sm` з `text-sm` (13px)
 * зумував би кожну форму з діалогом вибору. `md:` повертає 13px.
 */
const fieldSizes: Record<FieldSize, string> = {
  sm: 'h-12 text-base md:h-8 md:text-xs',
  md: 'h-12 text-base md:h-9 md:text-sm',
  lg: 'h-13 text-base md:h-10',
}

/*
 * Горизонтальний паддінг живе окремо від решти розміру — і по одному класу
 * на бік.
 *
 * Причина суто в порядку правил у згенерованому CSS: `md:px-2.5` лежить у
 * медіазапиті, тобто НИЖЧЕ за будь-який базовий `pr-9`, дописаний через
 * extra. Специфічність однакова, тож на ≥768px розмір мовчки з'їдав місце,
 * зарезервоване під іконку: `pr-9` (36px) перетворювався на 9.375px, і текст
 * — а в UiMultiSelect лічильник обраних — наїжджав на шеврон. На мобільному
 * все виглядало правильно, тому баг і жив непоміченим.
 *
 * Лікується не «перебиванням», а відсутністю: бік, який зайняла іконка,
 * взагалі не отримує паддінг від розміру (див. padLeft/padRight у
 * fieldClass), тож конкурувати в медіазапиті нема з чим.
 */
const fieldPadLeft: Record<FieldSize, string> = {
  sm: 'pl-2.5 md:pl-2',
  md: 'pl-3 md:pl-2.5',
  lg: 'pl-3.5 md:pl-3',
}

const fieldPadRight: Record<FieldSize, string> = {
  sm: 'pr-2.5 md:pr-2',
  md: 'pr-3 md:pr-2.5',
  lg: 'pr-3.5 md:pr-3',
}

const fieldDisabled = 'opacity-50 cursor-not-allowed'
const fieldError =
  'border-danger not-disabled:hover:border-danger focus-visible:ring-danger/30 focus-visible:border-danger focus-visible:hover:border-danger'

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
  'absolute z-[1100] mt-1 w-full min-w-max max-h-80 overflow-y-auto scrollbar-thin rounded-control origin-top ' +
  'border border-line bg-dropdown shadow-overlay'

export const dropdownEmptyClass = 'px-3 py-2 text-center text-sm text-muted'

export const dropdownSearchInputClass =
  'w-full rounded-control border border-line bg-input px-2 py-1.5 text-sm text-ink transition-[border-color,box-shadow] ' +
  'placeholder:text-muted focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:border-accent-solid'

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
  enterFromClass: 'scale-[0.97] -translate-y-1 opacity-0',
  enterToClass: 'scale-100 translate-y-0 opacity-100',
  leaveActiveClass: 'transition duration-100 ease-in',
  leaveFromClass: 'scale-100 translate-y-0 opacity-100',
  leaveToClass: 'scale-[0.97] -translate-y-1 opacity-0',
}

/* ------------------------------------------------------------------ */
/*  Складені хелпери                                                  */
/* ------------------------------------------------------------------ */

/** Повний рядок класів базового поля або тригера. */
export function fieldClass(
  size: FieldSize,
  opts?: {
    error?: boolean
    disabled?: boolean
    /**
     * Паддінг зліва/справа замість типового для розміру — місце під іконку,
     * кнопку очищення чи степери.
     *
     * Передається готовим класом (`'pr-9'`), а не числом: Tailwind сканує
     * вихідний код, і класу, склеєного в рантаймі з `pr-${n}`, у бандлі
     * просто не буде.
     */
    padLeft?: string
    padRight?: string
    extra?: string
  },
): string {
  const classes = [
    fieldBase,
    fieldSizes[size],
    opts?.padLeft || fieldPadLeft[size],
    opts?.padRight || fieldPadRight[size],
  ]
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
