<script setup lang="ts">
import { shallowRef } from 'vue'

const mobileOpen = shallowRef(false)
const collapsed = shallowRef(false)
const active = shallowRef('Огляд')
const links = ['Огляд', 'Проєкти', 'Команда']
</script>

<template>
  <div class="flex min-h-72 overflow-hidden rounded-overlay border border-line">
    <UiSidebar v-model="mobileOpen" v-model:collapsed="collapsed" width="14rem" collapsed-width="4rem">
      <template #header="{ collapsed: isCollapsed }">
        <span class="font-semibold">{{ isCollapsed ? 'T' : 'tatetUI' }}</span>
      </template>
      <template #default="{ collapsed: isCollapsed, close }">
        <nav aria-label="Навігація демо" class="grid gap-1">
          <button
            v-for="link in links"
            :key="link"
            type="button"
            class="min-h-10 rounded-control px-3 text-left text-sm transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="active === link ? 'bg-primary-50 text-accent' : 'text-ink'"
            @click="active = link; close()"
          >
            {{ isCollapsed ? link.charAt(0) : link }}
          </button>
        </nav>
      </template>
      <template #footer="{ collapsed: isCollapsed }">
        <span class="text-xs text-muted">{{ isCollapsed ? 'IK' : 'Ігор К.' }}</span>
      </template>
    </UiSidebar>
    <main class="min-w-0 flex-1 p-6">
      <UiButton class="md:hidden" size="sm" @click="mobileOpen = true">Відкрити меню</UiButton>
      <p class="font-semibold text-ink">{{ active }}</p>
      <p class="mt-2 text-sm text-muted">На desktop панель можна згортати, на mobile вона утримує фокус.</p>
    </main>
  </div>
</template>
