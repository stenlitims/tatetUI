/**
 * Чиста логіка UiLightbox — поза компонентом, щоб покривати тестами без
 * рендеру (правило дому: поведінка → utils → тести). Жести свайпу беруться
 * з utils/carousel: поріг і флік мають відчуватися однаково в каруселі й у
 * галереї.
 *
 * Уся геометрія збільшення рахується в координатах сцени відносно її
 * центру: зображення стоїть у центрі, а `x`/`y` — зсув його центру. Так
 * формули не залежать від того, де на сторінці сцена і чи є в неї відступи.
 */

/* ------------------------------------------------------------------ */
/*  Індекс і напрямок                                                  */
/* ------------------------------------------------------------------ */

/**
 * Індекс у межах галереї.
 *
 * Без `loop` — обрізається до країв; з `loop` — загортається по колу, у
 * тому числі від'ємний (−1 → останній). Дріб і NaN не можуть потрапити в
 * `images[i]`: undefined там — це порожня сцена замість фото.
 */
export function lightboxIndex(value: number, count: number, loop = false): number {
  if (count <= 0) return 0
  const whole = Number.isFinite(value) ? Math.trunc(value) : 0
  if (loop) return ((whole % count) + count) % count
  return Math.min(Math.max(whole, 0), count - 1)
}

/**
 * У який бік їде трек, коли галерея переходить з `from` на `to`.
 *
 * З `loop` сусід через край — теж сусід: з останнього на перший трек їде
 * вперед на один слайд, а не пролітає назад через усю галерею. Дальній
 * перехід (клік по мініатюрі) — за знаком різниці: трек однаково зсувається
 * лише на один слайд, а ціль підставляється поруч.
 */
export function slideStep(from: number, to: number, count: number, loop = false): 1 | -1 {
  if (loop && count > 2) {
    if ((from + 1) % count === to) return 1
    if ((from - 1 + count) % count === to) return -1
  }
  return to >= from ? 1 : -1
}

/**
 * Наступний кадр слайдшоу. `null` — зупинитися: без `loop` слайдшоу
 * закінчується на останньому кадрі, а не перескакує мовчки на перший.
 */
export function nextSlideshowIndex(current: number, count: number, loop = false): number | null {
  if (count < 2) return null
  if (current < count - 1) return current + 1
  return loop ? 0 : null
}

/* ------------------------------------------------------------------ */
/*  Тип вмісту й вбудовані плеєри                                      */
/* ------------------------------------------------------------------ */

/** Як рендерити слайд. Відео з YouTube і Vimeo — окремі види: у них свій плеєр. */
export type LightboxKind = 'image' | 'video' | 'youtube' | 'vimeo' | 'iframe' | 'custom'

const VIDEO_FILE = /\.(mp4|webm|ogv|ogg|mov|m4v)(?:$|[?#])/i

function parseUrl(src: string): URL | null {
  try {
    // База потрібна для відносних адрес ("/demo/clip.mp4"): вони валідні,
    // просто не можуть бути ні YouTube, ні Vimeo.
    return new URL(src, 'https://lightbox.invalid')
  } catch {
    return null
  }
}

function hostIs(url: URL, domain: string): boolean {
  return url.hostname === domain || url.hostname.endsWith(`.${domain}`)
}

/** «1m30s», «90s», «90» → 90. Формат параметра `t` у посиланнях YouTube. */
function parseStart(value: string | null): number {
  if (!value) return 0
  if (/^\d+$/.test(value)) return Number(value)
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!match || !match[0]) return 0
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
}

/** Ідентифікатор і стартова секунда відео YouTube з будь-якої форми посилання. */
export function youtubeVideo(src: string): { id: string; start: number } | null {
  const url = parseUrl(src)
  if (!url) return null
  let id: string | undefined
  if (hostIs(url, 'youtu.be')) {
    id = url.pathname.split('/')[1]
  } else if (hostIs(url, 'youtube.com') || hostIs(url, 'youtube-nocookie.com')) {
    const [, section, value] = url.pathname.split('/')
    if (section === 'watch') id = url.searchParams.get('v') ?? undefined
    else if (section === 'embed' || section === 'shorts' || section === 'live' || section === 'v') id = value
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null
  return { id, start: parseStart(url.searchParams.get('t') ?? url.searchParams.get('start')) }
}

/** Ідентифікатор відео Vimeo і хеш приватного посилання, якщо він є. */
export function vimeoVideo(src: string): { id: string; hash?: string; time?: string } | null {
  const url = parseUrl(src)
  if (!url || !hostIs(url, 'vimeo.com')) return null
  const segments = url.pathname.split('/').filter(Boolean)
  const at = segments.findIndex((segment) => /^\d{5,}$/.test(segment))
  if (at === -1) return null
  const next = segments[at + 1]
  const hash = url.searchParams.get('h') ?? (next && /^[\da-f]{6,}$/i.test(next) ? next : undefined)
  const time = url.hash.startsWith('#t=') ? url.hash.slice(1) : undefined
  return { id: segments[at]!, hash, time }
}

/**
 * Вид слайда. Явний `type` виграє; без нього — за адресою: YouTube і Vimeo
 * мають власні плеєри, відеофайл — `<video>`, решта — зображення.
 */
export function lightboxKind(item: { type?: string; src: string }): LightboxKind {
  if (item.type === 'custom' || item.type === 'iframe') return item.type
  if (item.type === 'image') return 'image'
  if (youtubeVideo(item.src)) return 'youtube'
  if (vimeoVideo(item.src)) return 'vimeo'
  if (item.type === 'video' || VIDEO_FILE.test(item.src)) return 'video'
  return 'image'
}

/**
 * Адреса вбудованого плеєра.
 *
 * YouTube — через youtube-nocookie.com: плеєр не ставить cookies, доки
 * людина не натисне «відтворити», а галерея не має права вирішувати за
 * неї про трекінг. `autoplay` — бо слайд уже обрали явно; браузер однаково
 * дозволить звук лише після жесту користувача, а він щойно був.
 */
export function embedSrc(kind: LightboxKind, src: string): string {
  if (kind === 'youtube') {
    const video = youtubeVideo(src)
    if (!video) return src
    const start = video.start ? `&start=${video.start}` : ''
    return `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1${start}`
  }
  if (kind === 'vimeo') {
    const video = vimeoVideo(src)
    if (!video) return src
    const hash = video.hash ? `&h=${video.hash}` : ''
    return `https://player.vimeo.com/video/${video.id}?autoplay=1&dnt=1${hash}${video.time ? `#${video.time}` : ''}`
  }
  return src
}

/**
 * Мініатюра для відео YouTube, коли власної немає. Для Vimeo такої
 * адреси без запиту до API не існує — там потрібен `thumbnail` чи `poster`.
 */
export function youtubeThumbnail(src: string): string | null {
  const video = youtubeVideo(src)
  return video ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : null
}

/* ------------------------------------------------------------------ */
/*  Геометрія збільшення                                               */
/* ------------------------------------------------------------------ */

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Чверть оберту (90°, 270°, −90°…): ширина й висота міняються місцями. */
export function isQuarterTurn(rotation: number): boolean {
  return Math.abs(Math.round(rotation / 90)) % 2 === 1
}

/**
 * Масштаб «вписано» відносно розміру, який зображенню дав CSS.
 *
 * Без повороту CSS уже вписав зображення (`max-w-full max-h-full`) — це 1.
 * На чверть оберту ширина й висота міняються місцями, і повернуте фото
 * треба вписати заново: так само не більше за натуральний розмір, як це
 * робить CSS, інакше дрібне фото після повороту раптом розпливалося б.
 */
export function fitScale(input: { layout: Size; box: Size; natural?: Size; rotation: number }): number {
  const { layout, box } = input
  if (!isQuarterTurn(input.rotation)) return 1
  if (!layout.width || !layout.height || !box.width || !box.height) return 1
  const natural = input.natural?.width && input.natural.height ? input.natural : layout
  const scaleOfNatural = Math.min(box.width / natural.height, box.height / natural.width, 1)
  return (scaleOfNatural * natural.width) / layout.width
}

/**
 * Межі масштабу поточного зображення відносно розміру з CSS.
 *
 * Нижня — «вписано». Верхня — `maxZoom` від вписаного, але щонайменше
 * натуральний розмір: великий знімок має бути видно піксель у піксель,
 * навіть якщо для цього треба збільшити у вісім разів.
 */
export function zoomLimits(input: { base: number; naturalRatio: number; maxZoom: number }): { min: number; max: number } {
  const min = input.base
  const max = Math.max(input.base * Math.max(input.maxZoom, 1), input.naturalRatio, min)
  return { min, max }
}

/**
 * Куди збільшувати кліком чи подвійним дотиком: до натурального розміру,
 * якщо фото велике, але щонайменше вдвічі — на дрібному фото збільшення в
 * 1.1 раза виглядало б як клік, що не спрацював.
 */
export function toggleZoomTarget(input: { base: number; naturalRatio: number; max: number }): number {
  return clamp(Math.max(input.base * 2, input.naturalRatio), input.base, input.max)
}

/** Крок кнопок і клавіш `+`/`−`. */
export const ZOOM_STEP = 1.5

/**
 * Наступний масштаб на крок. Майже вписане «доклацується» до вписаного:
 * інакше після кількох кроків туди й назад лишався б масштаб 1.02, за
 * якого зображення вже рухається, а стрілки ще не гортають.
 */
export function stepZoom(scale: number, direction: 1 | -1, limits: { min: number; max: number }): number {
  const next = clamp(direction > 0 ? scale * ZOOM_STEP : scale / ZOOM_STEP, limits.min, limits.max)
  return next < limits.min * 1.05 ? limits.min : next
}

/**
 * Найбільший зсув центру зображення, за якого край не відходить від краю
 * сцени. Менше за сцену — зсуву немає зовсім: зображення стоїть у центрі.
 */
export function panBounds(input: { layout: Size; stage: Size; scale: number; rotation: number }): Point {
  const quarter = isQuarterTurn(input.rotation)
  const width = (quarter ? input.layout.height : input.layout.width) * input.scale
  const height = (quarter ? input.layout.width : input.layout.height) * input.scale
  return {
    x: Math.max(0, (width - input.stage.width) / 2),
    y: Math.max(0, (height - input.stage.height) / 2),
  }
}

/** Частка руху, що проходить за межу: край «пружинить», а не впирається. */
export const RUBBER_BAND = 0.3

/** Гумовий край для зсуву: за межею `±limit` рух гаситься. */
export function rubberband(value: number, limit: number, factor = RUBBER_BAND): number {
  if (value > limit) return limit + (value - limit) * factor
  if (value < -limit) return -limit + (value + limit) * factor
  return value
}

/** Гумові межі масштабу: щипок трохи за межу можливий, але з опором. */
export function rubberbandScale(scale: number, min: number, max: number, factor = RUBBER_BAND): number {
  if (scale < min) return min - (min - scale) * factor
  if (scale > max) return max + (scale - max) * factor
  return scale
}

/**
 * Зсув після зміни масштабу, за якого точка під вказівником лишається на
 * місці. Точка й зсув — відносно центру сцени.
 *
 * Деталь під вказівником у координатах зображення — `(point − offset) /
 * scale`; щоб після збільшення вона лишилася під ним же, новий зсув має
 * бути `point − (point − offset) × nextScale / scale`.
 */
export function zoomAround(input: { point: Point; offset: Point; scale: number; nextScale: number }): Point {
  const ratio = input.scale > 0 ? input.nextScale / input.scale : 1
  return {
    x: input.point.x - (input.point.x - input.offset.x) * ratio,
    y: input.point.y - (input.point.y - input.offset.y) * ratio,
  }
}

/**
 * Множник масштабу від одного руху колеса.
 *
 * Два різні пристрої під однією подією. Щипок на тачпаді приходить як
 * Ctrl + колесо з дрібними кроками по кілька пікселів — йому потрібен
 * чутливий коефіцієнт. Колесо миші дає ~100px на клацання — з тим самим
 * коефіцієнтом один клац збільшував би втричі.
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0, pinch = false, pageHeight = 800): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * pageHeight : deltaY
  return clamp(Math.exp(-pixels * (pinch ? 0.01 : 0.002)), 0.5, 2)
}

/* ------------------------------------------------------------------ */
/*  Інерція й дотики                                                   */
/* ------------------------------------------------------------------ */

export interface PointerSample {
  x: number
  y: number
  t: number
}

/**
 * Швидкість жесту в момент відпускання, px/мс, — за останні ~100 мс руху.
 * Уся історія жесту не годиться: повільний початок гасив би різкий змах
 * наприкінці, і зображення зупинялося б як укопане.
 */
export function releaseVelocity(samples: PointerSample[], windowMs = 100): Point {
  const last = samples[samples.length - 1]
  if (!last || samples.length < 2) return { x: 0, y: 0 }
  let first = last
  for (let index = samples.length - 2; index >= 0; index -= 1) {
    const sample = samples[index]!
    if (last.t - sample.t > windowMs) break
    first = sample
  }
  const elapsed = last.t - first.t
  if (elapsed <= 0) return { x: 0, y: 0 }
  return { x: (last.x - first.x) / elapsed, y: (last.y - first.y) / elapsed }
}

/** Тертя інерції за мілісекунду: змах 1 px/мс докочується ще на ~200px. */
export const PAN_FRICTION = 0.995

/** Швидкість після `elapsedMs` тертя. */
export function decay(velocity: number, elapsedMs: number, friction = PAN_FRICTION): number {
  return velocity * friction ** elapsedMs
}

/** Скільки може зрушити палець, щоб дотик лишався дотиком, а не жестом. */
export const TAP_SLOP_PX = 10
/** Найдовший дотик; довше — це вже натискання з утриманням. */
export const TAP_MAX_MS = 400
/** Найбільша пауза між дотиками подвійного дотику. */
export const DOUBLE_TAP_MS = 300
/** Наскільки далеко один від одного можуть бути дотики подвійного дотику. */
export const DOUBLE_TAP_SLOP_PX = 40

export function isTap(input: { dx: number; dy: number; elapsedMs: number }): boolean {
  return Math.hypot(input.dx, input.dy) <= TAP_SLOP_PX && input.elapsedMs <= TAP_MAX_MS
}

export function isDoubleTap(previous: PointerSample | null, next: PointerSample): boolean {
  if (!previous) return false
  return (
    next.t - previous.t <= DOUBLE_TAP_MS
    && Math.hypot(next.x - previous.x, next.y - previous.y) <= DOUBLE_TAP_SLOP_PX
  )
}

/* ------------------------------------------------------------------ */
/*  Закриття змахом                                                    */
/* ------------------------------------------------------------------ */

/**
 * Скільки треба протягнути, щоб відпущений слайд закрив галерею: 15%
 * висоти сцени, але не менше 80px — на низькому екрані в ландшафті 15%
 * давали б закриття від випадкового руху.
 */
export function closeThreshold(height: number): number {
  if (!Number.isFinite(height) || height <= 0) return 80
  return Math.max(80, Math.round(height * 0.15))
}

/**
 * Наскільки «закрита» галерея під пальцем: 0 — на місці, 1 — фон уже
 * зник. Фон гасне повільніше, ніж досягається поріг: людина має бачити,
 * що жест працює, ще до того, як його відпустила.
 */
export function closeProgress(dy: number, height: number): number {
  return clamp(Math.abs(dy) / (closeThreshold(height) * 2.5), 0, 1)
}

/**
 * Чи закривати після відпускання: далеко протягнуто або різко змахнуто —
 * той самий флік, що гортає карусель (коротко, але швидко).
 */
export function shouldCloseOnDrag(input: { dy: number; elapsedMs: number; height: number; velocity?: number }): boolean {
  const distance = Math.abs(input.dy)
  if (distance >= closeThreshold(input.height)) return true
  if (distance < 24) return false
  return input.elapsedMs <= 200 || Math.abs(input.velocity ?? 0) >= 0.6
}

/* ------------------------------------------------------------------ */
/*  Анімація з мініатюри                                               */
/* ------------------------------------------------------------------ */

/**
 * Перетворення, що ставить вписане зображення точно на місце мініатюри.
 *
 * `cover` — мініатюра обрізає фото (`object-cover`): масштаб береться за
 * більшою стороною, а те, що в мініатюру не влазить, ховає clip-path.
 * Відступи clip-path — у власних координатах зображення (до transform),
 * тому діляться на масштаб; радіус кутів — так само.
 */
export function originTransform(input: { image: Rect; thumbnail: Rect; fit: 'cover' | 'contain'; radius?: number }): {
  x: number
  y: number
  scale: number
  clipX: number
  clipY: number
  radius: number
} {
  const { image, thumbnail } = input
  if (!image.width || !image.height) return { x: 0, y: 0, scale: 1, clipX: 0, clipY: 0, radius: 0 }
  const scaleX = thumbnail.width / image.width
  const scaleY = thumbnail.height / image.height
  const cover = input.fit === 'cover'
  const scale = cover ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY)
  return {
    x: thumbnail.left + thumbnail.width / 2 - (image.left + image.width / 2),
    y: thumbnail.top + thumbnail.height / 2 - (image.top + image.height / 2),
    scale,
    clipX: cover ? Math.max(0, (image.width - thumbnail.width / scale) / 2) : 0,
    clipY: cover ? Math.max(0, (image.height - thumbnail.height / scale) / 2) : 0,
    radius: scale > 0 ? (input.radius ?? 0) / scale : 0,
  }
}

/**
 * Яка частка прямокутника лишається видимою після обрізання вікном і
 * предками з `overflow`. Мініатюра, прокручена за край каруселі, формально
 * у вікні, але її не видно — летіти туди зображенню не можна.
 */
export function visibleFraction(rect: Rect, clips: Rect[]): number {
  const area = rect.width * rect.height
  if (area <= 0) return 0
  let left = rect.left
  let top = rect.top
  let right = rect.left + rect.width
  let bottom = rect.top + rect.height
  for (const clip of clips) {
    left = Math.max(left, clip.left)
    top = Math.max(top, clip.top)
    right = Math.min(right, clip.left + clip.width)
    bottom = Math.min(bottom, clip.top + clip.height)
  }
  return (Math.max(0, right - left) * Math.max(0, bottom - top)) / area
}

/* ------------------------------------------------------------------ */
/*  Підписи                                                            */
/* ------------------------------------------------------------------ */

/** Вид слайда для підписів: скрінрідеру важливо, фото це чи відео. */
export type LightboxSlideKind = 'image' | 'video' | 'other'

export function slideKindOf(kind: LightboxKind): LightboxSlideKind {
  if (kind === 'image') return 'image'
  if (kind === 'video' || kind === 'youtube' || kind === 'vimeo') return 'video'
  return 'other'
}

/**
 * Усі підписи галереї. Бібліотека i18n не має, але зашивати рядки в
 * компонент не можна — перекрити їх стало б неможливо (той самий підхід,
 * що в UiRichTextEditor).
 */
export interface LightboxLabels {
  close: string
  previous: string
  next: string
  zoomIn: string
  zoomOut: string
  rotateLeft: string
  rotateRight: string
  flipHorizontal: string
  flipVertical: string
  slideshowPlay: string
  slideshowPause: string
  fullscreenEnter: string
  fullscreenExit: string
  thumbnailsShow: string
  thumbnailsHide: string
  download: string
  /** Назва групи мініатюр. */
  thumbnails: string
  loading: string
  error: string
  retry: string
  empty: string
  /** Оголошення поточного слайда: «Зображення 2 з 5: Хол». */
  slide: (position: number, total: number, title: string, kind: LightboxSlideKind) => string
  /** Назва мініатюри: «Зображення 2: Хол». */
  thumbnail: (position: number, title: string, kind: LightboxSlideKind) => string
}

const KIND_NOUN: Record<LightboxSlideKind, string> = { image: 'Зображення', video: 'Відео', other: 'Слайд' }

export const LIGHTBOX_LABELS_UK: LightboxLabels = {
  close: 'Закрити',
  previous: 'Попередній слайд',
  next: 'Наступний слайд',
  zoomIn: 'Збільшити',
  zoomOut: 'Зменшити',
  rotateLeft: 'Повернути ліворуч',
  rotateRight: 'Повернути праворуч',
  flipHorizontal: 'Віддзеркалити по горизонталі',
  flipVertical: 'Віддзеркалити по вертикалі',
  slideshowPlay: 'Запустити слайдшоу',
  slideshowPause: 'Зупинити слайдшоу',
  fullscreenEnter: 'На весь екран',
  fullscreenExit: 'Вийти з повного екрана',
  thumbnailsShow: 'Показати мініатюри',
  thumbnailsHide: 'Сховати мініатюри',
  download: 'Завантажити',
  thumbnails: 'Мініатюри',
  loading: 'Завантаження',
  error: 'Не вдалося завантажити',
  retry: 'Спробувати ще раз',
  empty: 'Немає зображень',
  slide: (position, total, title, kind) => `${KIND_NOUN[kind]} ${position} з ${total}: ${title}`,
  thumbnail: (position, title, kind) => `${KIND_NOUN[kind]} ${position}: ${title}`,
}
