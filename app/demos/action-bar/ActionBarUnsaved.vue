<script setup lang="ts">
import { computed, reactive } from 'vue'
import UiActionBar from '~/components/ui/UiActionBar.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiSwitch from '~/components/ui/UiSwitch.vue'
import { useToast } from '~/composables/useToast'

const toast = useToast()

const saved = reactive({ name: 'Керамічна майстерня', publicProfile: true })
const draft = reactive({ ...saved })

const dirty = computed(() => draft.name !== saved.name || draft.publicProfile !== saved.publicProfile)

function discard() {
  Object.assign(draft, saved)
}

function save() {
  Object.assign(saved, draft)
  toast.success('Налаштування збережено')
}
</script>

<template>
  <div class="w-full max-w-lg">
    <div class="space-y-4 rounded-card border border-line bg-card p-5">
      <UiInput v-model="draft.name" label="Назва магазину" />
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-ink">Публічний профіль</p>
          <p class="text-xs text-muted">Покупці бачать сторінку магазину в каталозі</p>
        </div>
        <UiSwitch v-model="draft.publicProfile" label="Публічний профіль" />
      </div>
    </div>

    <UiActionBar :open="dirty" label="Незбережені зміни" aria-label="Незбережені зміни" @dismiss="discard">
      <UiButton variant="ghost" size="sm" @click="discard">Відкинути</UiButton>
      <UiButton size="sm" @click="save">Зберегти</UiButton>
    </UiActionBar>
  </div>
</template>
