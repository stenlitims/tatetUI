<script setup lang="ts">
import UiAvatarGroup, { type AvatarGroupItem } from '~/components/ui/UiAvatarGroup.vue'

const team: AvatarGroupItem[] = [
  { id: 1, name: 'Олена Ковальчук' },
  { id: 2, name: 'Андрій Мельник' },
  { id: 3, name: 'Ірина Бондар' },
  { id: 4, name: 'Тарас Шевчук' },
  { id: 5, name: 'Марія Лисенко' },
  { id: 6, name: 'Дмитро Гнатюк' },
  { id: 7, name: 'Софія Кравець' },
]
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="mb-2 text-xs uppercase tracking-wide text-muted">Уся команда вміщається</p>
      <UiAvatarGroup :items="team.slice(0, 4)" label="Учасники угоди" />
    </div>

    <div>
      <p class="mb-2 text-xs uppercase tracking-wide text-muted">Переповнення: решта — у підписі «+N»</p>
      <UiAvatarGroup :items="team" :max="4" label="Учасники проєкту" />
    </div>

    <div>
      <p class="mb-2 text-xs uppercase tracking-wide text-muted">Щільніше накладання, більший розмір</p>
      <UiAvatarGroup :items="team" :max="5" :size="44" overlap="tight" label="Відповідальні" />
    </div>
  </div>
</template>
