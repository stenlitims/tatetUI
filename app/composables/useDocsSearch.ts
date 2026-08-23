import { ref, shallowRef } from 'vue'
import type MiniSearch from 'minisearch'
import { processTerm, tokenize } from '~/utils/searchTokenizer'

export interface SearchSection {
  id: string
  title: string
  titles: string[]
  level: number
  content: string
}

export interface SearchHit {
  route: string
  title: string
  breadcrumb: string
  snippet: string
}

const isOpen = ref(false)
const isReady = ref(false)

// shallowRef: індекс — великий непрозорий об'єкт, робити його глибоко
// реактивним означало б обійти кожен вузол дерева на кожній зміні.
const engine = shallowRef<MiniSearch<SearchSection & { _id: number }> | null>(null)
const sections = shallowRef<SearchSection[]>([])

let loading: Promise<void> | null = null

/**
 * Пошук по документації.
 *
 * Індекс і сам MiniSearch підвантажуються ЛИШЕ при першому відкритті —
 * бібліотека і 60 КБ JSON не мають їхати на сторінку, де пошук так і не
 * відкрили. Повторні виклики чекають на ту саму обіцянку, тож паралельні
 * відкриття не тягнуть індекс двічі.
 */
export function useDocsSearch() {
  async function ensureIndex() {
    if (isReady.value) return
    if (loading) return loading

    loading = (async () => {
      const [{ default: MiniSearchCtor }, data] = await Promise.all([
        import('minisearch'),
        $fetch<SearchSection[]>('/api/search.json'),
      ])

      sections.value = data

      /*
       * Маршрут лежить у полі `route`, а НЕ `id`.
       *
       * MiniSearch кладе ідентифікатор документа в result.id, а потім
       * розкладає туди ж storeFields. Якщо серед них є власне поле `id`,
       * воно перезаписує ідентифікатор — і подальший доступ за індексом
       * ламається з «Cannot read properties of undefined». Саме на цьому
       * перша версія й попалася.
       */
      const ms = new MiniSearchCtor<SearchSection & { _id: number }>({
        idField: '_id',
        fields: ['title', 'titlesText', 'content'],
        storeFields: ['route', 'title', 'titles', 'content'],
        tokenize,
        processTerm,
        searchOptions: {
          prefix: true,
          fuzzy: 0.2,
          // Заголовок важить найбільше: коли шукають «Токени», потрібна
          // сторінка з такою назвою, а не десять згадок слова в тексті.
          boost: { title: 4, titlesText: 2 },
        },
      })

      ms.addAll(
        data.map((section, index) => ({
          ...section,
          _id: index,
          route: section.id,
          titlesText: section.titles.join(' '),
        })) as never,
      )

      engine.value = ms
      isReady.value = true
    })()

    return loading
  }

  function search(query: string, limit = 8): SearchHit[] {
    const ms = engine.value
    if (!ms || query.trim().length < 2) return []

    return ms
      .search(query)
      .slice(0, limit)
      .map((result) => ({
        route: result.route as string,
        title: result.title as string,
        breadcrumb: (result.titles as string[]).join(' › '),
        snippet: (result.content as string).slice(0, 120),
      }))
  }

  async function open() {
    isOpen.value = true
    await ensureIndex()
  }

  return { isOpen, isReady, open, close: () => (isOpen.value = false), search }
}
