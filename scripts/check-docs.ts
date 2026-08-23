/**
 * Перевірки, що тримають документацію і код разом.
 *
 * Причина існування: у chat і tatet-cms довідники описують props, яких у
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

const errors: string[] = []
const fail = (file: string, message: string) => errors.push(`${file}: ${message}`)

/** Заголовки, які зобов'язана мати сторінка компонента. */
const REQUIRED_HEADINGS = ['## API', '## Коли використовувати', '## Коли НЕ використовувати']

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

  if (errors.length) {
    console.error(`\n✗ Знайдено проблем: ${errors.length}\n`)
    for (const error of errors) console.error(`  ${error}`)
    console.error('')
    process.exit(1)
  }

  console.log(
    `✓ Перевірки пройдено: ${pages.length} сторінок, ${demoFiles.length} демо, ${pairsChecked} пар токенів`,
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
