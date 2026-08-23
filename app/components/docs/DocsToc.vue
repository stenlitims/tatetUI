<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface TocLink {
  id: string
  text: string
  depth: number
  children?: TocLink[]
}

const props = defineProps<{
  links: TocLink[]
}>()

const activeId = ref<string>('')

// Плоский список: у розмітці зміст двоярусний, але підсвічувати треба
// будь-який заголовок, тож спостерігач має бачити їх усі однаково.
const flatLinks = computed<TocLink[]>(() =>
  props.links.flatMap((link) => [link, ...(link.children ?? [])]),
)

let observer: IntersectionObserver | null = null

onMounted(() => {
  const headings = flatLinks.value
    .map((link) => document.getElementById(link.id))
    .filter((el): el is HTMLElement => !!el)

  if (!headings.length) return

  /*
   * rootMargin зверху від'ємний на висоту шапки, знизу — великий мінус.
   * Так «активним» вважається заголовок у ВЕРХНІЙ смузі екрана, а не
   * будь-який видимий: інакше при прокрутці підсвічувалися б одразу три
   * пункти, а на довгій секції — жоден.
   */
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) activeId.value = visible[0].target.id
    },
    { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
  )

  headings.forEach((heading) => observer?.observe(heading))
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <nav v-if="flatLinks.length" aria-label="Зміст сторінки" class="text-sm">
    <p class="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">На цій сторінці</p>
    <ul class="space-y-1 border-l border-line">
      <li v-for="link in flatLinks" :key="link.id">
        <a
          :href="`#${link.id}`"
          class="-ml-px block border-l-2 py-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="[
            link.depth > 2 ? 'pl-6' : 'pl-3',
            activeId === link.id
              ? 'border-accent font-medium text-accent'
              : 'border-transparent text-muted hover:text-ink',
          ]"
          :aria-current="activeId === link.id ? 'location' : undefined"
        >
          {{ link.text }}
        </a>
      </li>
    </ul>
  </nav>
</template>
