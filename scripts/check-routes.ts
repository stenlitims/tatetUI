/**
 * Smoke-перевірка зібраного сайту: кожна сторінка docs віддає 200.
 *
 * Причина існування: тричі за одну ітерацію довелось руками ганяти цикл
 * «build → serve → curl кожної сторінки». Падіння прередера на
 * компоненті-preview (404 на вигаданий маршрут у демо) build ловить, але
 * поламані dev-компіляції SFC і деякі помилки гідратації — ні.
 *
 * Використання: спершу `bun run build`, потім `bun run check:routes`.
 * Скрипт сам піднімає .output на вільному порту, перевіряє всі сторінки
 * з content/ + головну, і гасить сервер.
 *
 * Запуск: bun run scripts/check-routes.ts
 */

import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const CONTENT_DIR = join(ROOT, 'content/docs')
const PORT = 3471
const BASE = `http://127.0.0.1:${PORT}`

async function collectRoutes(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await collectRoutes(full)))
    else if (entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
      const slug = relative(CONTENT_DIR, full).replace(/\.md$/, '').replace(/(^|\/)index$/, '')
      out.push(`/docs/${slug}`.replace(/\/$/, ''))
    }
  }
  return out
}

async function waitForServer(pid: number, timeoutMs = 20000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    // Процес міг помер (порт зайнятий, битий build) — чекати марно.
    try {
      process.kill(pid, 0)
    } catch {
      throw new Error('сервер .output впав одразу — чи виконаний `bun run build`?')
    }
    try {
      const res = await fetch(`${BASE}/`)
      if (res.ok) return
    } catch {
      // ще не піднявся
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`сервер не піднявся за ${timeoutMs}ms`)
}

async function main() {
  if (!existsSync(join(ROOT, '.output/server/index.mjs'))) {
    console.error('✗ Немає .output — спершу `bun run build`')
    process.exit(1)
  }

  const routes = ['/', ...(await collectRoutes(CONTENT_DIR))].sort()
  console.log(`Перевіряю ${routes.length} маршрутів на ${BASE}`)

  const server = spawn('node', ['.output/server/index.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  })

  try {
    await waitForServer(server.pid!)

    const failures: string[] = []
    for (const route of routes) {
      try {
        const res = await fetch(`${BASE}${route}`)
        if (res.status !== 200) failures.push(`${route} → ${res.status}`)
      } catch (error) {
        failures.push(`${route} → ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (failures.length) {
      console.error(`\n✗ Проблемні маршрути: ${failures.length}`)
      for (const line of failures) console.error(`  ${line}`)
      process.exitCode = 1
    } else {
      console.log(`✓ Усі ${routes.length} маршрутів → 200`)
    }
  } finally {
    server.kill('SIGTERM')
  }
}

try {
  await main()
} catch (error) {
  console.error(`\n✗ Перевірка обірвалася: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}