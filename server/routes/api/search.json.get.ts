import { queryCollectionSearchSections } from '@nuxt/content/server'

/**
 * Пошуковий індекс, зібраний на етапі прередеру.
 *
 * Маршрут потрапляє в nitro.prerender.routes, тож у .output/public лежить
 * готовий статичний JSON. У браузері база Content не відкривається взагалі
 * — саме це тримає WASM-SQLite поза клієнтським бандлом.
 *
 * Імпорт явний, а не через автоімпорт Nitro: `nuxt typecheck` для
 * серверних файлів підхоплював КЛІЄНТСЬКИЙ оверлоад цієї функції
 * (collection, opts) замість серверного (event, collection, opts) і лаявся
 * на зайвий третій аргумент, хоча на рантаймі все працювало.
 */
export default defineEventHandler(async (event) => {
  const sections = await queryCollectionSearchSections(event, 'docs', {
    // Код у сніпетах індексувати марно: пошук за «const» знайшов би все.
    ignoredTags: ['code', 'pre'],
  })

  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    titles: section.titles,
    level: section.level,
    // Обрізаємо: індекс їде в браузер цілком, а для ранжування вистачає
    // перших абзаців розділу.
    content: section.content.slice(0, 400),
  }))
})
