/**
 * Чиста геометрія UiSparkline — поза компонентом, щоб покривати тестами без
 * рендеру (правило дому: поведінка → utils → тести).
 *
 * Координати — у пікселях висоти й умовних одиницях ширини: SVG тягнеться
 * на всю ширину батька через preserveAspectRatio="none", а товщину лінії
 * тримає vector-effect="non-scaling-stroke". Тому вертикаль рахується в
 * справжніх пікселях (відступ під товщину лінії має бути точним), а
 * горизонталь — у довільних одиницях, які однаково розтягнуться.
 */

export interface SparkPoint {
  x: number
  y: number
  /** Індекс у вихідному масиві — потрібен, щоб знайти останню точку. */
  index: number
}

/** Ширина viewBox. Будь-яке число: SVG однаково розтягується на батька. */
export const SPARK_WIDTH = 100

/**
 * Межі шкали по вертикалі.
 *
 * Пропуски (NaN, ±Infinity) у межі не входять. Вироджений випадок — усі
 * значення однакові — розширюється на ±1, інакше ділення на нуль дало б
 * NaN у кожній координаті, і лінія не намалювалася б зовсім замість
 * рівної прямої посередині.
 */
export function sparkDomain(
  data: readonly number[],
  options: { min?: number; max?: number; includeZero?: boolean } = {},
): [number, number] {
  const finite = data.filter((value) => Number.isFinite(value))
  let low = options.min ?? (finite.length ? Math.min(...finite) : 0)
  let high = options.max ?? (finite.length ? Math.max(...finite) : 1)
  if (options.includeZero) {
    low = Math.min(low, 0)
    high = Math.max(high, 0)
  }
  if (low === high) return [low - 1, high + 1]
  return low < high ? [low, high] : [high, low]
}

/**
 * Точки, розбиті на суцільні відрізки.
 *
 * Пропуск у даних — це РОЗРИВ лінії, а не нуль: нуль намалював би падіння,
 * якого не було (день без даних — не день без продажів).
 */
export function sparkSegments(
  data: readonly number[],
  options: { height: number; padding: number; domain: [number, number] },
): SparkPoint[][] {
  const { height, padding, domain } = options
  const [low, high] = domain
  const span = high - low || 1
  const inner = Math.max(0, height - padding * 2)
  const step = data.length > 1 ? SPARK_WIDTH / (data.length - 1) : 0

  const segments: SparkPoint[][] = []
  let current: SparkPoint[] = []

  data.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      if (current.length) segments.push(current)
      current = []
      return
    }
    const clamped = Math.min(Math.max(value, low), high)
    current.push({
      // Одна точка стоїть посередині, а не притиснута до лівого краю.
      x: data.length > 1 ? index * step : SPARK_WIDTH / 2,
      y: padding + inner - ((clamped - low) / span) * inner,
      index,
    })
  })
  if (current.length) segments.push(current)
  return segments
}

/** Координата у рядку шляху: дві цифри після коми, без хвоста нулів. */
function f(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/** Ламана через усі точки відрізка. */
export function linearPath(points: readonly SparkPoint[]): string {
  return points.map((point, i) => `${i ? 'L' : 'M'}${f(point.x)},${f(point.y)}`).join('')
}

/*
 * Монотонна кубічна інтерполяція (Fritsch–Carlson, як curveMonotoneX у d3).
 *
 * Звичайний згладжений сплайн «перелітає» екстремуми: між 10 і 10 з піком
 * 50 посередині він малює провал нижче 10, якого в даних немає. Для
 * графіка, що показує тренд, це вигадане значення. Монотонна крива
 * проходить через кожну точку й ніколи не виходить за сусідні значення.
 */
const sign = (value: number) => (value < 0 ? -1 : 1)

function tangentBetween(p0: SparkPoint, p1: SparkPoint, p2: SparkPoint): number {
  const h0 = p1.x - p0.x
  const h1 = p2.x - p1.x
  const s0 = (p1.y - p0.y) / h0
  const s1 = (p2.y - p1.y) / h1
  const p = (s0 * h1 + s1 * h0) / (h0 + h1)
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
}

function tangentAtEnd(from: SparkPoint, to: SparkPoint, neighbour: number): number {
  const h = to.x - from.x
  return h ? ((3 * (to.y - from.y)) / h - neighbour) / 2 : neighbour
}

export function monotonePath(points: readonly SparkPoint[]): string {
  if (points.length < 3) return linearPath(points)

  const last = points.length - 1
  const tangents: number[] = new Array(points.length).fill(0)
  for (let i = 1; i < last; i++) tangents[i] = tangentBetween(points[i - 1]!, points[i]!, points[i + 1]!)
  tangents[0] = tangentAtEnd(points[0]!, points[1]!, tangents[1]!)
  tangents[last] = tangentAtEnd(points[last - 1]!, points[last]!, tangents[last - 1]!)

  let path = `M${f(points[0]!.x)},${f(points[0]!.y)}`
  for (let i = 0; i < last; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const dx = (b.x - a.x) / 3
    path +=
      `C${f(a.x + dx)},${f(a.y + dx * tangents[i]!)} ` +
      `${f(b.x - dx)},${f(b.y - dx * tangents[i + 1]!)} ` +
      `${f(b.x)},${f(b.y)}`
  }
  return path
}

/** Лінія відрізка з обраною кривою. */
export function segmentPath(points: readonly SparkPoint[], curve: 'linear' | 'smooth'): string {
  return curve === 'smooth' ? monotonePath(points) : linearPath(points)
}

/** Заливка під лінією: та сама крива, замкнена на нижній лінії `baseline`. */
export function areaPath(points: readonly SparkPoint[], curve: 'linear' | 'smooth', baseline: number): string {
  if (!points.length) return ''
  const first = points[0]!
  const last = points[points.length - 1]!
  return `${segmentPath(points, curve)}L${f(last.x)},${f(baseline)}L${f(first.x)},${f(baseline)}Z`
}

export interface SparkBar {
  x: number
  y: number
  width: number
  height: number
  index: number
  negative: boolean
}

/**
 * Стовпчики від нульової лінії.
 *
 * Шкала стовпчиків завжди містить нуль: стовпчик, що починається не з
 * нуля, бреше про пропорції — 98 і 100 виглядали б як «удвічі більше».
 */
export function sparkBars(
  data: readonly number[],
  options: { height: number; padding: number; domain: [number, number]; gap?: number },
): SparkBar[] {
  const { height, padding, domain } = options
  const [low, high] = domain
  const span = high - low || 1
  const inner = Math.max(0, height - padding * 2)
  const slot = data.length ? SPARK_WIDTH / data.length : 0
  const gap = Math.min(options.gap ?? 0.25, 0.9) * slot
  const toY = (value: number) => padding + inner - ((Math.min(Math.max(value, low), high) - low) / span) * inner
  const zero = toY(0)

  const bars: SparkBar[] = []
  data.forEach((value, index) => {
    if (!Number.isFinite(value)) return
    const y = toY(value)
    bars.push({
      x: index * slot + gap / 2,
      width: slot - gap,
      y: Math.min(y, zero),
      // Нуль — це стовпчик завтовшки з волосину, а не пропуск: «нуль
      // продажів» і «немає даних» на графіку мають розрізнятися.
      height: Math.max(Math.abs(zero - y), 1),
      index,
      negative: value < 0,
    })
  })
  return bars
}

/**
 * Словесний підсумок ряду для скрінрідера: «від 120 до 180, мінімум 96,
 * максимум 210». Графік без тексту для скрінрідера — порожнє місце.
 */
export function sparkSummary(data: readonly number[], format: (value: number) => string): string {
  const finite = data.filter((value) => Number.isFinite(value))
  if (!finite.length) return 'Немає даних'
  const first = finite[0]!
  const last = finite[finite.length - 1]!
  if (finite.length === 1) return `Одне значення: ${format(first)}`
  const trend = last > first ? 'зростання' : last < first ? 'спад' : 'без змін'
  return (
    `${trend}: від ${format(first)} до ${format(last)}, ` +
    `мінімум ${format(Math.min(...finite))}, максимум ${format(Math.max(...finite))}`
  )
}
