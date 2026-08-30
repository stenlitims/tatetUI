<script setup lang="ts">
import { shallowRef } from 'vue'

const mobileOpen = shallowRef(false)
const collapsed = shallowRef(false)
const active = shallowRef('overview')
const side = shallowRef<'left' | 'right'>('left')
const links = [
  { id: 'overview', label: 'Огляд' },
  { id: 'projects', label: 'Проєкти' },
  { id: 'team', label: 'Команда' },
]
</script>

<template>
  <div class="relative flex min-h-72 overflow-hidden rounded-overlay border border-line">
    <UiSidebar
      v-model="mobileOpen"
      v-model:collapsed="collapsed"
      storage-key="tatetui-demo-sidebar"
      :side="side"
      width="14rem"
      collapsed-width="4rem"
    >
      <template #header="{ collapsed: isCollapsed }">
        <span class="font-semibold">{{ isCollapsed ? 'T' : 'tatetUI' }}</span>
      </template>
      <template #default="{ collapsed: isCollapsed, close }">
        <nav aria-label="Навігація демо" class="grid gap-1">
          <button
            v-for="link in links"
            :key="link.id"
            type="button"
            class="flex min-h-10 items-center gap-2.5 rounded-control px-3 text-left text-base md:text-sm"
            :class="active === link.id ? 'bg-primary-50 font-medium text-accent' : 'text-ink hover:bg-hover'"
            :aria-current="active === link.id ? 'page' : undefined"
            @click="active = link.id; close()"
          >
            <svg class="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <span class="truncate">{{ isCollapsed ? link.id.charAt(0) : link.label }}</span>
          </button>
        </nav>
      </template>
      <template #footer="{ collapsed: isCollapsed }">
        <span class="text-xs text-muted">{{ isCollapsed ? 'IK' : 'Ігор К.' }}</span>
      </template>
    </UiSidebar>
    <main class="min-w-0 flex-1 p-6">
      <UiButton class="md:hidden" size="sm" @click="mobileOpen = true">Відкрити меню</UiButton>
      <div class="mt-3">
        <UiButton size="sm" variant="outline" @click="side = side === 'left' ? 'right' : 'left'">
          Панель: {{ side === 'left' ? 'ліворуч' : 'праворуч' }}
        </UiButton>
      </div>
    </main>
  </div>
</template>