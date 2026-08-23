import { computed, inject, provide, toValue, type ComputedRef, type InjectionKey, type MaybeRefOrGetter } from 'vue'

/**
 * Усі підписи редактора.
 *
 * У вихідному проєкті це були 152 виклики `t()` у 12 файлах. Бібліотека
 * i18n не має і мати не повинна — але й зашивати рядки в дюжину
 * під-компонентів не можна, бо перекрити їх стало б неможливо.
 */
export interface RteLabels {
  bold: string
  italic: string
  underline: string
  strike: string
  code: string
  superscript: string
  subscript: string
  clearFormatting: string

  paragraph: string
  heading: string
  headingLevel: string
  style: string
  styleDefault: string
  lead: string
  small: string
  caption: string
  muted: string

  bulletList: string
  numberedList: string
  blockquote: string
  codeBlock: string
  horizontalRule: string

  alignLeft: string
  alignCenter: string
  alignRight: string
  alignJustify: string

  textColor: string
  highlight: string
  clearColor: string

  link: string
  unlink: string
  linkUrl: string
  linkNewTab: string

  image: string
  imageUrl: string
  imageUpload: string
  imageWidth: string
  imageAlign: string
  imageUploadError: string

  table: string
  insertTable: string
  deleteTable: string
  addRowBefore: string
  addRowAfter: string
  deleteRow: string
  addColumnBefore: string
  addColumnAfter: string
  deleteColumn: string
  toggleHeaderRow: string
  mergeOrSplit: string

  quoteVariant: string
  quoteQuote: string
  quoteInfo: string
  quoteSuccess: string
  quoteWarning: string
  quoteDanger: string
  quoteShowIcon: string

  editHtml: string
  htmlSource: string
  htmlPreview: string
  invalidHtml: string

  fullscreen: string
  exitFullscreen: string
  more: string
  undo: string
  redo: string

  save: string
  cancel: string
  insert: string
  remove: string
}

/** Типово українською. Перекривати треба лише те, що змінюється. */
export const RTE_LABELS_UK: RteLabels = {
  bold: 'Жирний',
  italic: 'Курсив',
  underline: 'Підкреслений',
  strike: 'Закреслений',
  code: 'Код',
  superscript: 'Верхній індекс',
  subscript: 'Нижній індекс',
  clearFormatting: 'Прибрати форматування',

  paragraph: 'Абзац',
  heading: 'Заголовок',
  headingLevel: 'Рівень заголовка',
  style: 'Стиль',
  styleDefault: 'Звичайний',
  lead: 'Вступний',
  small: 'Дрібний',
  caption: 'Підпис',
  muted: 'Приглушений',

  bulletList: 'Маркований список',
  numberedList: 'Нумерований список',
  blockquote: 'Цитата',
  codeBlock: 'Блок коду',
  horizontalRule: 'Роздільник',

  alignLeft: 'По лівому краю',
  alignCenter: 'По центру',
  alignRight: 'По правому краю',
  alignJustify: 'По ширині',

  textColor: 'Колір тексту',
  highlight: 'Маркер',
  clearColor: 'Скинути колір',

  link: 'Посилання',
  unlink: 'Прибрати посилання',
  linkUrl: 'Адреса',
  linkNewTab: 'Відкривати в новій вкладці',

  image: 'Зображення',
  imageUrl: 'Адреса зображення',
  imageUpload: 'Завантажити файл',
  imageWidth: 'Ширина',
  imageAlign: 'Вирівнювання',
  imageUploadError: 'Не вдалося завантажити зображення',

  table: 'Таблиця',
  insertTable: 'Вставити таблицю',
  deleteTable: 'Видалити таблицю',
  addRowBefore: 'Рядок вище',
  addRowAfter: 'Рядок нижче',
  deleteRow: 'Видалити рядок',
  addColumnBefore: 'Колонка ліворуч',
  addColumnAfter: 'Колонка праворуч',
  deleteColumn: 'Видалити колонку',
  toggleHeaderRow: 'Рядок заголовків',
  mergeOrSplit: "Об'єднати або розділити",

  quoteVariant: 'Тип цитати',
  quoteQuote: 'Звичайна',
  quoteInfo: 'Інформація',
  quoteSuccess: 'Успіх',
  quoteWarning: 'Попередження',
  quoteDanger: 'Небезпека',
  quoteShowIcon: 'Показувати іконку',

  editHtml: 'Редагувати HTML',
  htmlSource: 'Код',
  htmlPreview: 'Перегляд',
  invalidHtml: 'HTML не розібрався — перевірте теги',

  fullscreen: 'На весь екран',
  exitFullscreen: 'Вийти з повного екрана',
  more: 'Ще',
  undo: 'Скасувати',
  redo: 'Повторити',

  save: 'Зберегти',
  cancel: 'Скасувати',
  insert: 'Вставити',
  remove: 'Прибрати',
}

const RTE_LABELS: InjectionKey<ComputedRef<RteLabels>> = Symbol('rte-labels')

/**
 * Викликається РІВНО в UiRichTextEditor.
 *
 * provide/inject, а не props: RteDropdown — чиста слот-обгортка, і через
 * неї довелося б прокидати проп, якого вона не читає. І не модульний
 * singleton, як useToast: два редактори на сторінці з різними підписами
 * перезаписали б одне одного.
 *
 * computed, а не разовий spread: у проєкті з i18n зміна мови міняє об'єкт
 * у props, і підписи мають оновитись без перемонтування редактора —
 * інакше перемикання мови гасило б документ.
 */
export function provideRteLabels(
  source: MaybeRefOrGetter<Partial<RteLabels> | undefined>,
): ComputedRef<RteLabels> {
  const merged = computed<RteLabels>(() => ({ ...RTE_LABELS_UK, ...(toValue(source) ?? {}) }))
  provide(RTE_LABELS, merged)
  return merged
}

/**
 * Дефолт в inject — не страховка, а вимога переносності: під-компонент
 * має рендеритись і поза деревом редактора (тест, ізольований приклад),
 * інакше копіювати файли поштучно неможливо.
 */
export function useRteLabels(): ComputedRef<RteLabels> {
  return inject(
    RTE_LABELS,
    computed(() => RTE_LABELS_UK),
  )
}
