import { useHead, useRoute, useRuntimeConfig, useSeoMeta } from '#imports'

export interface SeoOptions {
  /** Назва сторінки без назви сайту — суфікс додається сам. */
  title: string
  /** Опис для пошуку і для картки в месенджері. */
  description: string
  /**
   * Шлях сторінки. Типово — поточний маршрут. Передається явно там, де
   * канонічний шлях відрізняється від фактичного.
   */
  path?: string
}

/**
 * Один виклик на сторінку замість пари useHead + useSeoMeta.
 *
 * Так було раніше, і саме тому og:title не існувало: заголовок ішов через
 * useHead, опис — через useSeoMeta, і жоден із них не знав про другого.
 * Посилання на документацію в месенджері розгорталося в голий URL.
 *
 * Абсолютні адреси обов'язкові: відносний og:image не підхоплює ні Slack,
 * ні Telegram, ні Twitter.
 */
export function useSeo(options: SeoOptions) {
  const route = useRoute()
  const siteUrl = useRuntimeConfig().public.siteUrl as string

  const base = siteUrl.replace(/\/$/, '')
  /*
   * Канонічний шлях завжди БЕЗ кінцевого слеша.
   *
   * І /docs/table, і /docs/table/ віддають ту саму сторінку — це навмисно,
   * посилання в сайдбарі й пейджері приймають обидві форми. Але для
   * пошуковика це два різні URL з однаковим вмістом, тобто дубль. Канонічна
   * форма мусить бути рівно одна.
   */
  const path = (options.path ?? route.path).replace(/\/+$/, '') || '/'
  // Корінь лишається зі слешем, щоб canonical збігався з тим, що віддає
  // sitemap.xml: розбіжність між ними — зайвий привід для пошуковика
  // вважати це різними адресами.
  const url = `${base}${path}`
  const title = `${options.title} — tatetUI`

  useSeoMeta({
    title,
    description: options.description,
    ogTitle: title,
    ogDescription: options.description,
    ogType: 'website',
    ogUrl: url,
    ogImage: `${base}/og-image.png`,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'tatetUI — бібліотека UI-компонентів для Vue 3 і Nuxt',
    ogSiteName: 'tatetUI',
    ogLocale: 'uk_UA',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: options.description,
    twitterImage: `${base}/og-image.png`,
  })

  useHead({
    link: [{ rel: 'canonical', href: url }],
  })
}
