/**
 * Дії з датами без бібліотеки дат.
 *
 * Бібліотека не має зовнішніх залежностей, тож date-fns чи dayjs сюди не
 * заходять. Натомість діє одне жорстке правило: **нова дата будується
 * конструктором `new Date(рік, місяць, день)`, а не додаванням мілісекунд**.
 *
 * `date.getTime() + 86_400_000` дає не «наступний день», а «рівно 24
 * години». У ніч переходу на зимовий час доба триває 25 годин, і такий
 * «наступний день» лишається у вчорашньому; навесні — перестрибує. Сітка
 * місяця тоді втрачає або дублює день двічі на рік, і відтворити це
 * можливо лише в ті самі вихідні.
 */

export interface DateRangePreset {
  /** Підпис у списку пресетів. */
  label: string
  /**
   * Обчислює діапазон від переданого «сьогодні».
   *
   * Саме функція, а не готовий кортеж: «Останні 7 днів», пораховані під час
   * імпорту модуля, назавжди застигли б на даті збірки. На прередереному
   * сайті це стало б помітно наступного ж дня.
   */
  range: (today: Date) => [Date, Date]
}

/** Опівніч того самого дня за локальним часом. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** -1, 0 або 1 — порівняння лише за календарним днем, без часу. */
export function compareDay(first: Date, second: Date): -1 | 0 | 1 {
  const a = startOfDay(first).getTime()
  const b = startOfDay(second).getTime()
  return a === b ? 0 : a < b ? -1 : 1
}

export function isSameDay(first: Date, second: Date): boolean {
  return compareDay(first, second) === 0
}

/**
 * Календарний день як `YYYY-MM-DD` за ЛОКАЛЬНИМ часом.
 *
 * Не `toISOString()`: той переводить опівніч у UTC, і в Києві 24 вересня
 * серіалізувалося як `2026-09-23T21:00:00.000Z` — сервер, що бере перші
 * десять символів, отримував учорашній день.
 */
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Той самий день іншого місяця. Кількість днів у місяці враховується. */
export function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

/**
 * Місяці з ЗАТИСКАННЯМ дня.
 *
 * `setMonth` для 31 січня + 1 місяць дає 3 березня: 31 лютого не існує, і
 * Date мовчки переливається в наступний місяць. У навігації календаря це
 * означало б, що з січня PageDown веде в березень, минаючи лютий.
 */
export function addMonths(date: Date, amount: number): Date {
  const year = date.getFullYear()
  const month = date.getMonth() + amount
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(date.getDate(), lastDay))
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** День 0 наступного місяця — це останній день поточного. */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function startOfQuarter(date: Date): Date {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1)
}

/**
 * Сітка місяця — ЗАВЖДИ 42 комірки (шість тижнів).
 *
 * Змінна кількість рядків міняла б висоту панелі при гортанні місяців, а
 * всередині закріпленої панелі це щоразу перезапускає логіку перевороту:
 * панель видимо стрибає над тригером і під нього. Шість рядків вміщають
 * будь-який місяць, включно з 31-денним, що починається в неділю.
 */
export function buildMonthGrid(month: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const first = startOfMonth(month)
  // Скільки днів відмотати назад, щоб рядок починався з потрібного дня.
  const shift = (first.getDay() - weekStartsOn + 7) % 7
  const start = addDays(first, -shift)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

/**
 * Номер тижня за ISO 8601: тиждень починається з понеділка, а перший
 * тиждень року — той, що містить четвер.
 */
export function isoWeekNumber(date: Date): number {
  const target = startOfDay(date)
  // Зсув до четверга поточного тижня — саме він визначає рік тижня.
  const day = (target.getDay() + 6) % 7
  const thursday = addDays(target, 3 - day)
  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  const firstDay = (firstThursday.getDay() + 6) % 7
  const firstWeekMonday = addDays(firstThursday, -firstDay)
  // Різниця в днях між понеділками; ділення на 7 тут безпечне, бо обидві
  // дати — опівніч понеділка, і DST дає щонайбільше годину похибки.
  const diff = Math.round((thursday.getTime() - firstWeekMonday.getTime()) / 86_400_000)
  return Math.floor(diff / 7) + 1
}

/** Затискає дату в межі, якщо вони задані. */
export function clampDate(date: Date, min?: Date, max?: Date): Date {
  if (min && compareDay(date, min) < 0) return startOfDay(min)
  if (max && compareDay(date, max) > 0) return startOfDay(max)
  return startOfDay(date)
}

/** Чи входить дата у відрізок включно з обома кінцями. */
export function isWithin(date: Date, from: Date, to: Date): boolean {
  const [start, end] = compareDay(from, to) <= 0 ? [from, to] : [to, from]
  return compareDay(date, start) >= 0 && compareDay(date, end) <= 0
}

/** Пресети діапазонів за замовчуванням для UiDateRangePicker. */
export const defaultDateRangePresets: DateRangePreset[] = [
  { label: 'Сьогодні', range: (today) => [startOfDay(today), startOfDay(today)] },
  { label: 'Останні 7 днів', range: (today) => [addDays(today, -6), startOfDay(today)] },
  { label: 'Останні 30 днів', range: (today) => [addDays(today, -29), startOfDay(today)] },
  { label: 'Цей місяць', range: (today) => [startOfMonth(today), endOfMonth(today)] },
  {
    label: 'Минулий місяць',
    range: (today) => {
      const previous = addMonths(startOfMonth(today), -1)
      return [startOfMonth(previous), endOfMonth(previous)]
    },
  },
  {
    label: 'Цей квартал',
    range: (today) => {
      const start = startOfQuarter(today)
      return [start, endOfMonth(addMonths(start, 2))]
    },
  },
]
