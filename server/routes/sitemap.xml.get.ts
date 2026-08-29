import { queryCollection } from '@nuxt/content/server'

/**
 * Карта сайту.
 *
 * Будується з тієї самої колекції, що й сама документація, а не зі списку
 * руками: список роз'їхався б із контентом з тієї ж причини, з якої
 * роз'їжджається рукописна документація.
 *
 * Маршрут прередериться (див. nitro.prerender.routes), тож у проді це
 * статичний файл, а не запит до бази на кожного краулера.
 */
export default defineEventHandler(async (event) => {
  const base = (useRuntimeConfig(event).public.siteUrl as string).replace(/\/$/, '')
  const pages = await queryCollection(event, 'docs').select('path').all()

  // Головна плюс усі сторінки документації, без дублів і без кінцевих слешів.
  const paths = new Set<string>(['/'])
  for (const page of pages) {
    const path = (page.path ?? '').replace(/\/+$/, '')
    if (path) paths.add(path)
  }

  const urls = [...paths]
    .sort()
    .map((path) => `  <url><loc>${base}${path === '/' ? '/' : path}</loc></url>`)
    .join('\n')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
})
