/**
 * Перевірки, що тримають документацію і код разом.
 *
 * Причина існування: у вихідних проєктах довідники описують props, яких у
 * компонентах уже немає. Рукописна документація завжди роз'їжджається — не
 * від недбалості, а тому що ніщо не змушує оновити її разом із кодом.
 *
 * Запуск: bun run check:docs
 */

import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const CONTENT_DIR = join(ROOT, 'content/docs')
const UI_DIR = join(ROOT, 'app/components/ui')
const DEMOS_DIR = join(ROOT, 'app/demos')
const TOKENS_FILE = join(ROOT, 'app/assets/css/tokens.css')
const NAV_FILE = join(ROOT, 'app/config/docsNav.ts')
const DOCS_PAGE = join(ROOT, 'app/pages/docs/[...slug].vue')
const HOME_STATS = join(ROOT, 'app/components/home/HomeHeroDemo.vue')
const CSS_DIR = join(ROOT, 'app/assets/css')

const errors: string[] = []
const fail = (file: string, message: string) => errors.push(`${file}: ${message}`)

/** Заголовки, які зобов'язана мати сторінка компонента. */
const REQUIRED_HEADINGS = ['## API', '## Коли використовувати', '## Коли НЕ використовувати']

/**
 * Компоненти, які свідомо лишаються без публічної сторінки.
 *
 * UiLoadingDots — індикатор усередині UiButton, окремо його не вставляють;
 * власна сторінка лише розмила б каталог. Список явний саме тому, що
 * «немає сторінки» і «забули сторінку» інакше виглядають однаково.
 */
const UNDOCUMENTED = ['UiLoadingDots']

/**
 * Props, опис яких не додає нічого понад назву.
 *
 * Бібліотека вже свідомо лишає їх без JSDoc (див. UiInput, UiCheckbox), і
 * вимога описати `disabled` дала б сорок файлів шуму замість реальних
 * прогалин. Усе, що не в цьому списку, опис мати ЗОБОВ'ЯЗАНЕ: саме звідти
 * колонка «Опис» у таблиці API бере текст.
 */
/**
 * Префікси утиліт, значенням яких є КОЛІР, і слова, які після них кольором
 * не є. Без другого списку перевірка нижче лаялася б на border-r,
 * text-base й stroke-none — усе це легальні утиліти інших просторів.
 */
const COLOR_UTILITY =
  /(?:^|[\s"'`[({])(bg|text|border|ring|divide|from|via|to|fill|stroke)-([a-z][a-z0-9/-]*)/g

const NON_COLOR_UTILITY = new Set([
  // text-*: розмір, вирівнювання, перенос
  'xs', 'sm', 'base', 'lg', 'xl', 'left', 'center', 'right', 'justify', 'start', 'end',
  'wrap', 'nowrap', 'balance', 'pretty', 'ellipsis', 'clip',
  // border-*/divide-*: сторони, стиль, службове
  't', 'r', 'b', 'l', 'x', 'y', 's', 'e', 'solid', 'dashed', 'dotted', 'double',
  'hidden', 'none', 'collapse', 'separate', 'reverse',
  // ring-*: службове
  'inset', 'offset',
  // bg-*: позиція, повтор, розмір, градієнт
  'fixed', 'local', 'scroll', 'top', 'bottom', 'repeat', 'no-repeat', 'auto',
  'cover', 'contain', 'origin-border', 'origin-padding', 'origin-content',
  'clip-border', 'clip-padding', 'clip-content', 'clip-text', 'blend-normal',
  'blend-multiply', 'blend-screen', 'blend-overlay', 'gradient-to-t',
  'gradient-to-r', 'gradient-to-b', 'gradient-to-l', 'gradient-to-tr',
  'gradient-to-tl', 'gradient-to-br', 'gradient-to-bl', 'linear', 'radial', 'conic',
  // спільні ключові слова
  'transparent', 'current', 'inherit',
  // назви CSS-властивостей усередині transition-[border-color,…]: це
  // перелік того, ЩО анімувати, а не колір
  'color', 'decoration-color',
])

const SELF_EVIDENT = [
  'label', 'disabled', 'placeholder', 'id', 'name',
  'required', 'readonly', 'autofocus', 'class',
]

async function walk(dir: string, ext = '.md'): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full, ext)))
    else if (entry.name.endsWith(ext) && !entry.name.startsWith('_')) out.push(full)
  }
  return out
}

function parseFrontmatter(source: string): Record<string, unknown> {
  const match = source.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const out: Record<string, unknown> = {}
  let currentKey = ''
  for (const line of match[1]!.split('\n')) {
    const listItem = line.match(/^\s+-\s+(.*)$/)
    if (listItem && currentKey) {
      ;(out[currentKey] as string[]).push(listItem[1]!.trim())
      continue
    }
    const nested = line.match(/^\s{2,}([\w:]+):\s*(.*)$/)
    if (nested && currentKey && typeof out[currentKey] === 'object' && !Array.isArray(out[currentKey])) {
      ;(out[currentKey] as Record<string, string>)[nested[1]!] = nested[2]!.trim()
      continue
    }
    const pair = line.match(/^(\w+):\s*(.*)$/)
    if (!pair) continue
    currentKey = pair[1]!
    const value = pair[2]!.trim()
    if (value === '') {
      // Наступні рядки покажуть, список це чи мапа.
      out[currentKey] = /^\s+-\s/.test(match[1]!.split('\n')[match[1]!.split('\n').indexOf(line) + 1] ?? '')
        ? []
        : {}
    } else {
      out[currentKey] = value
    }
  }
  return out
}

/** kebab-basename: ButtonBasic.vue → button-basic */
function demoKey(file: string): string {
  return file
    .replace(/\.vue$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

async function main() {
  /* ---------------------------------------------------------------- */
  /*  1. Демо: існування та унікальність basename                     */
  /* ---------------------------------------------------------------- */

  const demoFiles = existsSync(DEMOS_DIR) ? await walk(DEMOS_DIR, '.vue') : []
  const demoKeys = new Map<string, string>()
  for (const file of demoFiles) {
    const key = demoKey(file.split('/').pop()!)
    const existing = demoKeys.get(key)
    if (existing) {
      // Реєстр демо ключується лише basename, тож дублікат тихо перекрив
      // би одне демо іншим — на сайті виглядало б як «показує не те».
      fail(relative(ROOT, file), `дублікат ключа демо "${key}" — вже є у ${relative(ROOT, existing)}`)
    }
    demoKeys.set(key, file)
  }

  /* ---------------------------------------------------------------- */
  /*  2-5. Сторінки контенту                                          */
  /* ---------------------------------------------------------------- */

  const pages = await walk(CONTENT_DIR)
  const pageRoutes = new Set<string>()
  const componentNames: string[] = []
  let componentPages = 0

  for (const page of pages) {
    const rel = relative(ROOT, page)
    const source = await readFile(page, 'utf8')
    const fm = parseFrontmatter(source)

    const slug = relative(CONTENT_DIR, page).replace(/\.md$/, '').replace(/(^|\/)index$/, '')
    pageRoutes.add(`/docs/${slug}`.replace(/\/$/, ''))

    // 2. component: має існувати
    const component = fm.component as string | undefined
    const componentPath = component ? join(UI_DIR, `${component}.vue`) : null
    const componentExists = !!componentPath && existsSync(componentPath)

    if (componentExists) {
      componentPages += 1
      componentNames.push(component!)
    }

    if (component && !componentExists) {
      fail(rel, `component: "${component}" — файл app/components/ui/${component}.vue не існує`)
    }

    // 3. ::component-preview{name="…"} має резолвитись
    for (const match of source.matchAll(/::component-preview\{name="([^"]+)"/g)) {
      const name = match[1]!
      if (!demoKeys.has(name)) {
        fail(rel, `демо "${name}" не знайдено в app/demos/**`)
      }
    }

    // 3a. stage у component-preview — клас з типового набору.
    //
    // stage передається РЯДКОМ з frontmatter, і JIT Tailwind не бачить
    // літералів "min-h-64" у .md файлах — утиліти генеруються лише для
    // наборів з @source inline(...) у main.css. Опечатка тут (min-h-64y,
    // h-64 замість min-h-64) мовчки дає сцену нульової висоти: демо
    // «зникає», а build і typecheck проходять. Ловимо тут.
    for (const match of source.matchAll(/::component-preview\{[^}]*stage="([^"]+)"/g)) {
      const stage = match[1]!
      if (!/^((min|max)-h-\d+)( min-h-\d+)?$/.test(stage)) {
        fail(
          rel,
          `stage "${stage}" — не впізнаний клас висоти; додай його в @source inline(...) у main.css або виправи опечатку`,
        )
      }
    }

    // 3b. Двокрапка зі пробілом усередині description ламає YAML-парсер
    // Nuxt Content: значення читається як об'єкт, і сторінка друкує
    // «[object Object]» замість опису. Виглядало саме так на Breadcrumb і
    // Tooltip, поки не замінили на тире.
    const descriptionRaw = source.match(/^description:[ \t]*(.+)$/m)?.[1] ?? ''
    if (/:\s/.test(descriptionRaw)) {
      fail(
        rel,
        'description містить ": " — YAML читає значення як об\'єкт і сторінка показує [object Object]; заміни двокрапку на тире',
      )
    }

    // 3c. emitDescriptions: {} — парсер читає "{}" як РЯДОК, і
    // Object.keys дає фантомні події "0"/"1" (бачено на п'яти сторінках).
    // Для компонента без подій треба голий ключ без значення.
    if (/^emitDescriptions:\s*\{\}\s*$/m.test(source)) {
      fail(rel, 'emitDescriptions: {} читається як рядок з фантомними подіями "0"/"1"; залиш голий ключ "emitDescriptions:"')
    }

    // 3d. dependsOn: [] — той самий капкан, що й emitDescriptions: {}.
    // Рукописний парсер читає "[]" РЯДКОМ і потім перебирає його символи,
    // тобто шукає файли з іменами "[" і "]". Для сторінки без залежностей
    // ключ треба просто не писати — схема сама підставить порожній масив.
    if (/^dependsOn:\s*\[\]\s*$/m.test(source)) {
      fail(rel, 'dependsOn: [] читається як рядок із фантомними шляхами "[" і "]"; приберіть ключ узагалі')
    }

    // 4. dependsOn: шляхи мають існувати
    for (const dep of (fm.dependsOn as string[] | undefined) ?? []) {
      if (!existsSync(join(ROOT, dep))) {
        fail(rel, `dependsOn: "${dep}" — файл не існує`)
      }
    }

    // 5. Обов'язкові заголовки на сторінках компонентів
    if (componentExists) {
      for (const heading of REQUIRED_HEADINGS) {
        if (!source.includes(`\n${heading}\n`)) {
          fail(rel, `бракує обов'язкового розділу "${heading}"`)
        }
      }
    }

    // 6. emitDescriptions мають збігатися з реальними подіями компонента.
    //
    // componentExists, а не просто component: fail() не зупиняє виконання,
    // тож без цієї умови readFile неіснуючого файлу кидав би ENOENT — і
    // скрипт падав би СТЕКОМ замість того, щоб надрукувати зрозумілу
    // причину, яку вже знайшов рядком вище.
    if (component && componentExists) {
      const sfc = await readFile(componentPath!, 'utf8')
      const emitBlock = sfc.match(/defineEmits<\{([\s\S]*?)\n\}>\(\)/)
      const declared = new Set<string>()
      if (emitBlock) {
        for (const line of emitBlock[1]!.split('\n')) {
          const name = line.match(/^\s*'?([\w:]+)'?\s*:/)
          if (name) declared.add(name[1]!)
        }
      }
      const documented = Object.keys((fm.emitDescriptions as Record<string, string>) ?? {})

      for (const name of documented) {
        if (!declared.has(name)) {
          fail(rel, `emitDescriptions містить "${name}", якого немає в defineEmits ${component}`)
        }
      }
      for (const name of declared) {
        if (!documented.includes(name)) {
          // nuxt-component-meta не витягує JSDoc подій, тож опис може
          // прийти лише звідси — без нього колонка в таблиці буде порожня.
          fail(rel, `подія "${name}" компонента ${component} не описана в emitDescriptions`)
        }
      }
    }
  }

  const uiFiles = (await readdir(UI_DIR)).filter((name) => /^Ui[A-Z].*\.vue$/.test(name))

  /*
   * Звіряємо ІМЕНА в обидва боки, а не кількості.
   *
   * Раніше тут стояли два числа — 50 файлів і 49 сторінок. Вони ловили
   * тільки той випадок, коли забули рівно одне; додавши компонент і
   * сторінку одночасно, можна було проґавити, що сторінка описує НЕ той
   * компонент. Гірше інше: кожен новий компонент вимагав правити два
   * літерали, і найпростіший спосіб «полагодити» червону перевірку —
   * підняти число, тобто вимкнути її.
   */
  const documentedComponents = new Set(componentNames)
  for (const file of uiFiles) {
    const name = file.replace(/\.vue$/, '')
    if (!documentedComponents.has(name) && !UNDOCUMENTED.includes(name)) {
      fail('content/docs/components', `${name} не має сторінки — додайте content/docs/components/*.md з component: ${name}`)
    }
  }
  for (const name of UNDOCUMENTED) {
    if (documentedComponents.has(name)) {
      fail('scripts/check-docs.ts', `${name} уже має сторінку — приберіть його з UNDOCUMENTED`)
    }
  }

  // Компоненти повинні працювати в обох темах лише через semantic tokens.
  // Локальні dark:-перевизначення та white/black знову розводять copy-first
  // версії Tailwind v3/v4 і обходять контрастні пари з tokens.css.
  // Токени, зареєстровані в утилітах Tailwind. Усе, що поза цим списком,
  // генерує НІЧОГО — див. перевірку нижче.
  const themeSource = await readFile(join(CSS_DIR, 'theme.css'), 'utf8')
  const knownColors = new Set(
    [...themeSource.matchAll(/--color-([\w-]+):/g)].map((match) => match[1]!),
  )

  for (const name of uiFiles) {
    const raw = await readFile(join(UI_DIR, name), 'utf8')
    const source = raw.replace(/<!--[^]*?-->/g, '').replace(/\/\*[^]*?\*\//g, '')
    const where = `app/components/ui/${name}`

    if (/\bdark:/.test(source)) fail(where, 'заборонено dark: — використайте semantic token')
    const rawColor = source.match(/\b(?:bg|text)-(?:white|black)\b/)
    if (rawColor) fail(where, `заборонено сирий колір "${rawColor[0]}" — використайте semantic token`)

    /*
     * Колірна утиліта з НЕіснуючого токена.
     *
     * Tailwind не лається на bg-surface — він просто не генерує такого
     * класу, і елемент лишається прозорим. Так у UiSidebar мобільна панель
     * і її затемнення були прозорі (bg-surface, bg-overlay-backdrop), у
     * UiScrollArea не малювалися градієнти країв (from-surface), а в
     * UiResizablePanels роздільник був невидимий. Жодна перевірка цього не
     * бачила: збірка зелена, типи зелені, у браузері просто «щось не те».
     *
     * Вбудована палітра Tailwind (bg-slate-500) теж не проходить — це та
     * сама заборона сирих кольорів, лише іншими словами.
     */
    for (const match of source.matchAll(COLOR_UTILITY)) {
      // Атрибут (stroke-width="2") чи властивість CSS (border-radius:) —
      // не утиліта. Обидва впізнаються за наступним символом.
      const after = source[match.index! + match[0].length]
      if (after === '=' || after === ':') continue

      let token = match[2]!
      // ring-offset-* — окремий простір: ширина або колір.
      if (match[1] === 'ring' && token.startsWith('offset-')) token = token.slice('offset-'.length)
      // Число — ширина (border-2), відсоток (from-40%) або сторона з
      // шириною (border-b-2). Кольором ніщо з цього не є.
      if (NON_COLOR_UTILITY.has(token) || /^\d/.test(token) || /^[trblxyse]-\d/.test(token)) continue

      const base = token.replace(/\/.*$/, '')
      if (knownColors.has(base)) continue
      fail(where, `утиліта "${match[0].trim()}" посилається на незареєстрований токен "${base}" — Tailwind згенерує порожнечу, елемент лишиться прозорим`)
    }

    /*
     * defineSlots обов'язковий. Для генеричних компонентів слоти з шаблону
     * не читаються взагалі, і секція «Слоти» в таблиці API просто зникає.
     * Компонент без слотів пише defineSlots<Record<string, never>>().
     */
    if (!/defineSlots</.test(source)) {
      fail(where, 'немає defineSlots<> — таблиця API лишиться без секції «Слоти»')
    }

    /*
     * JSDoc на кожному публічному props. Це ЄДИНЕ джерело колонки «Опис»
     * у таблиці API: nuxt-component-meta бере описи саме звідти. CLAUDE.md
     * називав це правило перевіреним, хоча перевірки не існувало — і
     * десять компонентів приїхали з порожніми описами.
     */
    const propsBlock = raw.match(/defineProps<\{([\s\S]*?)\n\s*\}>\(\)/)
    if (propsBlock) {
      const lines = propsBlock[1]!.split('\n')
      for (const [index, line] of lines.entries()) {
        const declaration = line.match(/^\s{4}([A-Za-z_$][\w$]*)\??:/)
        if (!declaration) continue
        const prop = declaration[1]!
        if (SELF_EVIDENT.includes(prop)) continue
        /*
         * Дивимось на БЕЗПОСЕРЕДНЬО попередній непорожній рядок, а не на
         * кілька рядків угору. Інакше props успадковує JSDoc сусіда: у
         * UiEmptyState `tone` вважався описаним, бо рядком вище стояв опис
         * для `description`.
         */
        const previous = lines.slice(0, index).map((line) => line.trim()).filter(Boolean).at(-1) ?? ''
        if (!previous.endsWith('*/') && !previous.startsWith('//')) {
          fail(where, `props "${prop}" без JSDoc — колонка «Опис» у таблиці API буде порожня`)
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  7. Сайдбар і контент мають збігатися В ОБИДВА боки              */
  /* ---------------------------------------------------------------- */

  const navSource = await readFile(NAV_FILE, 'utf8')
  const navRoutes = new Set(
    [...navSource.matchAll(/to:\s*'([^']+)'/g)].map((match) => match[1]!),
  )

  for (const route of navRoutes) {
    if (!pageRoutes.has(route)) {
      fail('app/config/docsNav.ts', `посилання "${route}" веде в нікуди — сторінки немає`)
    }
  }
  for (const route of pageRoutes) {
    if (!navRoutes.has(route)) {
      // Сторінка без посилання в сайдбарі недосяжна: краулер прередеру її
      // теж не знайде, і в проді її просто не буде.
      fail('app/config/docsNav.ts', `сторінка "${route}" є в content/, але її немає в сайдбарі`)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  8. Токени: hex і rgb-триплет мають описувати той самий колір     */
  /* ---------------------------------------------------------------- */

  const tokensSource = await readFile(TOKENS_FILE, 'utf8')

  const hexColor = (block: string, token: string) =>
    block.match(new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    return channels.reduce(
      (sum, channel, index) =>
        sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index]!,
      0,
    )
  }
  const contrast = (first: string, second: string) => {
    const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a)
    return (lighter! + 0.05) / (darker! + 0.05)
  }

  for (const [theme, block] of [
    ['light', tokensSource.match(/:root\s*\{([^]*?)\n\}/)?.[1] ?? ''],
    ['dark', tokensSource.match(/\.dark\s*\{([^]*?)\n\}/)?.[1] ?? ''],
  ] as const) {
    for (const prefix of ['accent', 'danger'] as const) {
      const solid = hexColor(block, `${prefix}-solid`)
      const foreground = hexColor(block, `${prefix}-contrast`)
      if (!solid || !foreground) {
        fail('app/assets/css/tokens.css', `${theme}: бракує пари ${prefix}-solid/${prefix}-contrast`)
        continue
      }
      const ratio = contrast(solid, foreground)
      if (ratio < 4.5) {
        fail(
          'app/assets/css/tokens.css',
          `${theme}: контраст ${prefix}-solid/${prefix}-contrast = ${ratio.toFixed(2)}:1, потрібно ≥4.5:1`,
        )
      }
    }
  }

  /*
   * Порівнюємо ПОРЯДКОВО, а не через дві мапи по всьому файлу.
   *
   * Кожен токен оголошено двічі — у :root і в .dark. Мапа «ім'я → значення»
   * лишала б тільки останнє входження, тобто перевірявся б лише темний
   * блок, а розсинхрон у світлому проходив би непоміченим. Саме на цьому
   * перша версія перевірки й попалася.
   *
   * У tokens.css hex і триплет стоять в одному рядку — на цьому й тримаємось.
   */
  const hexToTriplet = (hex: string) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(', ')

  let pairsChecked = 0
  const lines = tokensSource.split('\n')

  for (const [index, line] of lines.entries()) {
    const hexDecl = line.match(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/)
    const rgbDecl = line.match(/--([\w-]+)-rgb:\s*([\d\s,]+);/)
    const where = `app/assets/css/tokens.css:${index + 1}`

    if (hexDecl && !rgbDecl) {
      // Без триплета токен непереносний у проєкт на Tailwind v3.
      fail(where, `--${hexDecl[1]} оголошено без парного --${hexDecl[1]}-rgb`)
      continue
    }
    if (rgbDecl && !hexDecl) {
      fail(where, `--${rgbDecl[1]}-rgb оголошено без парного --${rgbDecl[1]}`)
      continue
    }
    if (!hexDecl || !rgbDecl) continue

    if (hexDecl[1] !== rgbDecl[1]) {
      fail(where, `в одному рядку різні токени: --${hexDecl[1]} і --${rgbDecl[1]}-rgb`)
      continue
    }

    const expected = hexToTriplet(hexDecl[2]!.toLowerCase())
    if (expected !== rgbDecl[2]!.trim()) {
      fail(
        where,
        `--${hexDecl[1]}: ${hexDecl[2]} не збігається з --${rgbDecl[1]}-rgb: ${rgbDecl[2]!.trim()} ` +
          `(мало б бути ${expected})`,
      )
    }
    pairsChecked += 1
  }

  /* ---------------------------------------------------------------- */
  /*  8a. Числа в статистиці на головній — справжні                    */
  /* ---------------------------------------------------------------- */

  /*
   * «50 UI-файлів» і «49 публічних сторінок» — рукописні числа в hero.
   * Рукописне число застаріває мовчки: додав компонент — і головна вже
   * бреше, а помітить це хіба той, хто вирішить перерахувати. Це та сама
   * причина, з якої існує решта перевірок у цьому файлі.
   */
  const homeSource = await readFile(HOME_STATS, 'utf8')
  const homeStats: Array<[string, number]> = [
    ['UI-файлів', uiFiles.length],
    ['публічних сторінок', componentPages],
  ]

  for (const [label, expected] of homeStats) {
    const declared = homeSource.match(
      new RegExp(`\\{\\s*value:\\s*'(\\d+)',\\s*label:\\s*'${label}'\\s*\\}`),
    )?.[1]
    if (declared === undefined) {
      fail('app/components/home/HomeHeroDemo.vue', `у статистиці немає рядка з label: '${label}'`)
    } else if (Number(declared) !== expected) {
      fail(
        'app/components/home/HomeHeroDemo.vue',
        `статистика каже ${declared} ${label}, насправді ${expected}`,
      )
    }
  }

  /* ---------------------------------------------------------------- */
  /*  9. Клас .docs-prose стоїть просто на ContentRenderer             */
  /* ---------------------------------------------------------------- */

  /*
   * ContentRenderer рендерить власний кореневий <div>. Поки .docs-prose
   * висів на обгортці НАВКОЛО нього, між класом і блоками документа стояв
   * зайвий рівень, і `.docs-prose > * + *` не збігалося ні з чим: усі <p>
   * і <pre> лишалися з margin-top: 0. Сторінка при цьому виглядала майже
   * нормально — вертикальний ритм тримали заголовки, у яких власні
   * марджини, — тож помітно стало аж на сторінці з трьома блоками коду
   * підряд.
   */
  const docsPageSource = (await readFile(DOCS_PAGE, 'utf8')).replace(/<!--[\s\S]*?-->/g, '')
  const proseMentions = docsPageSource.match(/docs-prose/g)?.length ?? 0

  if (proseMentions !== 1) {
    fail(
      'app/pages/docs/[...slug].vue',
      `docs-prose згадано ${proseMentions} раз(ів), очікується рівно один — на <ContentRenderer>`,
    )
  } else if (!/<ContentRenderer[^>]*\bclass="[^"]*\bdocs-prose\b/.test(docsPageSource)) {
    fail(
      'app/pages/docs/[...slug].vue',
      'клас docs-prose має стояти на самому <ContentRenderer>, а не на обгортці: ' +
        'зайвий рівень вкладеності мовчки вимикає `.docs-prose > * + *`',
    )
  }

  /* ---------------------------------------------------------------- */
  /*  10. CSS справді парситься                                        */
  /* ---------------------------------------------------------------- */

  /*
   * Тут ловиться конкретна поламка: коментар, що втратив свій `/*`.
   * Парсер CSS з'їдає осиротілий текст як селектор аж до наступної `{` і
   * мовчки викидає ціле правило разом із ним. Так загинуло
   * `.docs-prose { line-height: 1.7 }` — виявилося тільки вимірюванням
   * computed-стилю.
   *
   * Дві ознаки, обидві дешеві: непарні межі коментарів і кирилиця в
   * селекторі. Кирилиця в селекторі в цьому проєкті означає рівно одне —
   * що в нього затік текст коментаря.
   */
  let selectorsChecked = 0

  for (const name of await readdir(CSS_DIR)) {
    if (!name.endsWith('.css')) continue

    const where = `app/assets/css/${name}`
    const raw = await readFile(join(CSS_DIR, name), 'utf8')

    const opens = raw.match(/\/\*/g)?.length ?? 0
    const closes = raw.match(/\*\//g)?.length ?? 0
    if (opens !== closes) {
      fail(where, `межі коментарів непарні: ${opens} разів /* і ${closes} разів */`)
      continue
    }

    // Пробіли замість вмісту, щоб номери рядків лишалися чесними.
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))

    let buffer = ''
    let line = 1
    let selectorLine = 1

    for (const char of css) {
      if (char === '\n') line += 1

      if (char === '{') {
        const selector = buffer.trim()
        selectorsChecked += 1
        if (/[\u0400-\u04FF]/.test(selector) || selector.includes('*/')) {
          fail(
            `${where}:${selectorLine}`,
            `у селекторі текст коментаря: "${selector.replace(/\s+/g, ' ').slice(0, 60)}…"`,
          )
        }
        buffer = ''
        selectorLine = line
      } else if (char === '}' || char === ';') {
        buffer = ''
        selectorLine = line
      } else if (!buffer && /\s/.test(char)) {
        selectorLine = line
      } else {
        buffer += char
      }
    }
  }

  /* ---------------------------------------------------------------- */

  if (errors.length) {
    console.error(`\n✗ Знайдено проблем: ${errors.length}\n`)
    for (const error of errors) console.error(`  ${error}`)
    console.error('')
    process.exit(1)
  }

  console.log(
    `✓ Перевірки пройдено: ${pages.length} сторінок, ${demoFiles.length} демо, ` +
      `${pairsChecked} пар токенів, ${selectorsChecked} селекторів`,
  )
}

try {
  await main()
} catch (error) {
  // Несподіваний виняток — теж провал перевірки, але з читабельною
  // причиною замість голого стека.
  console.error('\n✗ Перевірка обірвалася з помилкою:\n')
  console.error(error instanceof Error ? error.message : String(error))
  console.error('')
  process.exit(1)
}
