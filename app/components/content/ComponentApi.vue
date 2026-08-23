<script setup lang="ts">
import { computed, inject } from 'vue'

/**
 * Таблиця API компонента.
 *
 * Дані беруться з nuxt-component-meta, тобто з самого SFC. Рукописних
 * таблиць тут немає навмисно: у двох вихідних проєктах довідники описують
 * props, яких у компонентах уже немає, — саме цей дрейф ми й прибираємо.
 */

const props = defineProps<{
  /**
   * Ім'я компонента. Зазвичай НЕ задається: береться з `component:` у
   * frontmatter сторінки, щоб назва не дублювалась у markdown.
   */
  name?: string
}>()

defineSlots<Record<string, never>>()

const pageComponent = inject<string | undefined>('docsPageComponent', undefined)
const pageEmitDescriptions = inject<Record<string, string>>('docsPageEmitDescriptions', {})

const target = computed(() => props.name ?? pageComponent)

interface MetaProp {
  name: string
  type: string
  default?: string
  required?: boolean
  description?: string
}
interface MetaNamed {
  name: string
  type?: string
  description?: string
}

const { data: meta } = await useAsyncData(
  () => `component-meta:${target.value}`,
  async () => {
    if (!target.value) return null
    return await $fetch<{
      meta?: { props?: MetaProp[]; events?: MetaNamed[]; slots?: MetaNamed[]; exposed?: MetaNamed[] }
    }>(`/api/component-meta/${target.value}`)
  },
  { watch: [target] },
)

const propRows = computed(() => meta.value?.meta?.props ?? [])
const eventRows = computed(() => meta.value?.meta?.events ?? [])
const slotRows = computed(() => meta.value?.meta?.slots ?? [])
const exposedRows = computed(() => meta.value?.meta?.exposed ?? [])

/**
 * Літеральний union розбиваємо на чипи.
 *
 * Саме заради цього і робилася автогенерація: перелік допустимих значень —
 * те, по що читач відкриває таблицю. Аліас (`Variant`) сюди не потрапляє,
 * бо в компонентах union оголошується інлайново в defineProps.
 */
function unionMembers(type: string): string[] | null {
  if (!type.includes('|')) return null
  const parts = type.split('|').map((s) => s.trim())
  return parts.every((p) => /^["'].*["']$/.test(p)) ? parts.map((p) => p.slice(1, -1)) : null
}

function emitDescription(name: string): string {
  return pageEmitDescriptions[name] ?? ''
}
</script>

<template>
  <div v-if="target" class="not-prose my-6 space-y-8">
    <section v-if="propRows.length">
      <h3 class="mb-3 text-base font-semibold text-ink">Props</h3>
      <div class="overflow-x-auto rounded-card border border-line">
        <table class="w-full min-w-[36rem] text-sm">
          <thead>
            <tr class="border-b border-line bg-subtle text-left">
              <th class="px-3 py-2 font-medium">Назва</th>
              <th class="px-3 py-2 font-medium">Тип</th>
              <th class="px-3 py-2 font-medium">Типово</th>
              <th class="px-3 py-2 font-medium">Опис</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in propRows" :key="row.name" class="border-b border-line last:border-0">
              <td class="px-3 py-2 align-top">
                <code class="font-mono text-xs text-accent">{{ row.name }}</code>
                <span v-if="row.required" class="ml-1 text-xs text-danger" title="Обов'язковий">*</span>
              </td>
              <td class="px-3 py-2 align-top">
                <template v-if="unionMembers(row.type)">
                  <span
                    v-for="member in unionMembers(row.type)"
                    :key="member"
                    class="mr-1 mb-1 inline-block rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-xs text-muted"
                  >{{ member }}</span>
                </template>
                <code v-else class="font-mono text-xs text-muted">{{ row.type }}</code>
              </td>
              <td class="px-3 py-2 align-top">
                <code v-if="row.default" class="font-mono text-xs text-muted">{{ row.default }}</code>
                <span v-else class="text-xs text-muted">—</span>
              </td>
              <td class="px-3 py-2 align-top whitespace-pre-line text-muted">{{ row.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="eventRows.length">
      <h3 class="mb-3 text-base font-semibold text-ink">Події</h3>
      <div class="overflow-x-auto rounded-card border border-line">
        <table class="w-full min-w-[30rem] text-sm">
          <thead>
            <tr class="border-b border-line bg-subtle text-left">
              <th class="px-3 py-2 font-medium">Назва</th>
              <th class="px-3 py-2 font-medium">Payload</th>
              <th class="px-3 py-2 font-medium">Опис</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in eventRows" :key="row.name" class="border-b border-line last:border-0">
              <td class="px-3 py-2 align-top">
                <code class="font-mono text-xs text-accent">{{ row.name }}</code>
              </td>
              <td class="px-3 py-2 align-top">
                <code class="font-mono text-xs text-muted">{{ row.type }}</code>
              </td>
              <td class="px-3 py-2 align-top text-muted">{{ emitDescription(row.name) || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="slotRows.length">
      <h3 class="mb-3 text-base font-semibold text-ink">Слоти</h3>
      <div class="overflow-x-auto rounded-card border border-line">
        <table class="w-full min-w-[24rem] text-sm">
          <thead>
            <tr class="border-b border-line bg-subtle text-left">
              <th class="px-3 py-2 font-medium">Назва</th>
              <th class="px-3 py-2 font-medium">Опис</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in slotRows" :key="row.name" class="border-b border-line last:border-0">
              <td class="px-3 py-2 align-top">
                <code class="font-mono text-xs text-accent">{{ row.name }}</code>
              </td>
              <td class="px-3 py-2 align-top text-muted">{{ row.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="exposedRows.length">
      <h3 class="mb-3 text-base font-semibold text-ink">Доступно через ref</h3>
      <div class="overflow-x-auto rounded-card border border-line">
        <table class="w-full min-w-[30rem] text-sm">
          <thead>
            <tr class="border-b border-line bg-subtle text-left">
              <th class="px-3 py-2 font-medium">Назва</th>
              <th class="px-3 py-2 font-medium">Тип</th>
              <th class="px-3 py-2 font-medium">Опис</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in exposedRows" :key="row.name" class="border-b border-line last:border-0">
              <td class="px-3 py-2 align-top">
                <code class="font-mono text-xs text-accent">{{ row.name }}</code>
              </td>
              <td class="px-3 py-2 align-top">
                <code class="font-mono text-xs text-muted">{{ row.type }}</code>
              </td>
              <td class="px-3 py-2 align-top text-muted">{{ row.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
