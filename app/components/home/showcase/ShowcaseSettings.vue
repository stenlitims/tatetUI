<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, shallowRef } from 'vue'
import UiActionBar from '~/components/ui/UiActionBar.vue'
import UiAlert from '~/components/ui/UiAlert.vue'
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiFormField from '~/components/ui/UiFormField.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiInputOtp from '~/components/ui/UiInputOtp.vue'
import UiPageHeader from '~/components/ui/UiPageHeader.vue'
import UiRadioGroup from '~/components/ui/UiRadioGroup.vue'
import UiSelect, { type SelectOption } from '~/components/ui/UiSelect.vue'
import UiSeparator from '~/components/ui/UiSeparator.vue'
import UiSwitch from '~/components/ui/UiSwitch.vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'
import UiToggleGroup from '~/components/ui/UiToggleGroup.vue'
import { useTheme, type ThemePreference } from '~/composables/useTheme'
import { useToast } from '~/composables/useToast'

defineSlots<Record<string, never>>()

const toast = useToast()

/* ------------------------------------------------------------------ */
/*  Форма з незбереженими змінами                                      */
/* ------------------------------------------------------------------ */

interface SettingsForm {
  name: string
  email: string
  bio: string
  language: string | number | null
  timezone: string | number | null
  density: string | number
  notifyEmail: boolean
  notifyPush: boolean
  notifySms: boolean
  plan: string | number | null
}

const saved = reactive<SettingsForm>({
  name: 'Олена Бондар',
  email: 'olena@glyna.ua',
  bio: 'Керую майстернею й відповідаю за оптових клієнтів.',
  language: 'uk',
  timezone: 'Europe/Kyiv',
  density: 'comfortable',
  notifyEmail: true,
  notifyPush: true,
  notifySms: false,
  plan: 'team',
})
const form = reactive<SettingsForm>({ ...saved })

const dirty = computed(() => (Object.keys(saved) as (keyof SettingsForm)[]).some((key) => saved[key] !== form[key]))

// Помилки показуються після першої спроби зберегти, а не на кожну літеру:
// червоне поле посеред набору — покарання за те, що людина ще не закінчила.
const submitted = shallowRef(false)
const errors = computed(() => ({
  name: form.name.trim() ? undefined : 'Вкажіть ім’я — його бачать клієнти в листах',
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? undefined : 'Email має вигляд name@domain.ua',
}))
const visibleErrors = computed(() => (submitted.value ? errors.value : { name: undefined, email: undefined }))

const saving = shallowRef(false)
let saveTimer: ReturnType<typeof setTimeout> | undefined

function save() {
  submitted.value = true
  if (errors.value.name || errors.value.email) {
    toast.error('Виправте позначені поля, щоб зберегти')
    return
  }
  saving.value = true
  saveTimer = setTimeout(() => {
    Object.assign(saved, form)
    saving.value = false
    submitted.value = false
    toast.success('Налаштування збережено')
  }, 900)
}

function discard() {
  Object.assign(form, saved)
  submitted.value = false
}

onBeforeUnmount(() => clearTimeout(saveTimer))

const languageOptions: SelectOption[] = [
  { value: 'uk', label: 'Українська' },
  { value: 'en', label: 'English' },
  { value: 'pl', label: 'Polski' },
]

const timezoneOptions: SelectOption[] = [
  { value: 'Europe/Kyiv', label: 'Київ (UTC+3)' },
  { value: 'Europe/Warsaw', label: 'Варшава (UTC+2)' },
  { value: 'Europe/London', label: 'Лондон (UTC+1)' },
]

const planOptions = [
  { value: 'solo', label: 'Solo', description: '1 майстер, до 50 товарів' },
  { value: 'team', label: 'Team', description: 'До 10 людей, CRM і склад' },
  { value: 'studio', label: 'Studio', description: 'Кілька точок і опт', disabled: true },
]

/* ------------------------------------------------------------------ */
/*  Налаштування, що діють одразу                                      */
/* ------------------------------------------------------------------ */

const { preference, setPreference } = useTheme()
const themeOptions = [
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
  { value: 'system', label: 'Як у системі' },
]

/* ------------------------------------------------------------------ */
/*  Двофакторна автентифікація                                         */
/* ------------------------------------------------------------------ */

const twoFactor = shallowRef(false)
const settingUp = shallowRef(false)
const code = shallowRef('')
const codeError = shallowRef<string | undefined>()

function toggleTwoFactor(value: boolean) {
  if (value) {
    settingUp.value = true
    code.value = ''
    codeError.value = undefined
  } else {
    twoFactor.value = false
    settingUp.value = false
    toast.warning('Двофакторну автентифікацію вимкнено')
  }
}

function verify(value: string) {
  // 000000 — «неправильний» код, щоб у демо було видно й стан помилки.
  if (value === '000000') {
    codeError.value = 'Код не підійшов. Перевірте час на телефоні й спробуйте ще раз'
    return
  }
  codeError.value = undefined
  twoFactor.value = true
  settingUp.value = false
  toast.success('Двофакторну автентифікацію увімкнено')
}
</script>

<template>
  <div class="space-y-8 p-4 sm:p-6">
    <UiPageHeader
      title="Налаштування акаунта"
      description="Профіль, сповіщення й безпека. Зміни форми зберігаються разом; тема й 2FA діють одразу."
      as="h3"
    >
      <template #leading>
        <UiAvatar :name="form.name || 'Без імені'" :size="48" status="online" />
      </template>
    </UiPageHeader>

    <div class="grid gap-x-10 gap-y-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div>
        <h4 class="text-sm font-semibold text-ink">Профіль</h4>
        <p class="mt-1 text-sm text-muted">Бачать клієнти в листах і рахунках.</p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <UiInput v-model="form.name" label="Ім’я" required autocomplete="name" :error="visibleErrors.name" />
        <UiInput v-model="form.email" type="email" label="Email" required autocomplete="email" :error="visibleErrors.email" />
        <UiTextarea v-model="form.bio" class="sm:col-span-2" label="Про себе" :max-length="160" show-count :rows="2" autoresize />
        <UiSelect v-model="form.language" :options="languageOptions" label="Мова листів" />
        <UiSelect v-model="form.timezone" :options="timezoneOptions" label="Часовий пояс" />
      </div>
    </div>

    <UiSeparator />

    <div class="grid gap-x-10 gap-y-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div>
        <h4 class="text-sm font-semibold text-ink">Інтерфейс</h4>
        <p class="mt-1 text-sm text-muted">Як виглядає робочий простір.</p>
      </div>
      <div class="grid gap-5 sm:grid-cols-2">
        <UiFormField label="Щільність таблиць" description="Для всіх списків і таблиць." as="fieldset">
          <template #default="{ labelId, describedBy }">
            <UiToggleGroup
              v-model="form.density"
              block
              size="sm"
              :aria-labelledby="labelId"
              :aria-describedby="describedBy"
              :options="[
                { value: 'compact', label: 'Щільно' },
                { value: 'comfortable', label: 'Звичайно' },
                { value: 'relaxed', label: 'Просторо' },
              ]"
            />
          </template>
        </UiFormField>
        <UiFormField label="Тема" description="Діє одразу — без кнопки «Зберегти»." as="fieldset">
          <template #default="{ labelId, describedBy }">
            <UiToggleGroup
              :model-value="preference"
              block
              size="sm"
              :aria-labelledby="labelId"
              :aria-describedby="describedBy"
              :options="themeOptions"
              @update:model-value="setPreference($event as ThemePreference)"
            />
          </template>
        </UiFormField>
      </div>
    </div>

    <UiSeparator />

    <div class="grid gap-x-10 gap-y-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div>
        <h4 class="text-sm font-semibold text-ink">Сповіщення</h4>
        <p class="mt-1 text-sm text-muted">Куди надсилати нові замовлення.</p>
      </div>
      <ul class="divide-y divide-line rounded-card border border-line">
        <li v-for="channel in [
          { key: 'notifyEmail', title: 'Email', text: 'Підсумок замовлень раз на день' },
          { key: 'notifyPush', title: 'Push у браузері', text: 'Одразу, щойно замовлення оплачено' },
          { key: 'notifySms', title: 'SMS', text: 'Лише оптові замовлення від ₴10 000' },
        ] as const" :key="channel.key" class="flex items-center justify-between gap-4 px-4 py-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-ink">{{ channel.title }}</p>
            <p class="text-xs text-muted">{{ channel.text }}</p>
          </div>
          <UiSwitch v-model="form[channel.key]" :label="channel.title" />
        </li>
      </ul>
    </div>

    <UiSeparator />

    <div class="grid gap-x-10 gap-y-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div>
        <h4 class="text-sm font-semibold text-ink">Безпека</h4>
        <p class="mt-1 text-sm text-muted">Код з додатка-автентифікатора при вході.</p>
      </div>
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-4 rounded-card border border-line px-4 py-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-ink">Двофакторна автентифікація</p>
            <p class="text-xs text-muted">{{ twoFactor ? 'Увімкнено · Google Authenticator' : 'Вимкнено' }}</p>
          </div>
          <UiSwitch :model-value="twoFactor || settingUp" label="Двофакторна автентифікація" @update:model-value="toggleTwoFactor" />
        </div>

        <div v-if="settingUp" class="space-y-3 rounded-card border border-line bg-subtle p-4">
          <p class="text-sm text-ink">
            Відскануйте QR-код у додатку й введіть шість цифр, які він покаже.
            У демо підійде будь-який код, крім <span class="font-mono">000000</span>.
          </p>
          <UiInputOtp v-model="code" :length="6" label="Код підтвердження" :error="codeError" @complete="verify" />
          <UiButton variant="ghost" size="sm" @click="settingUp = false">Скасувати</UiButton>
        </div>

        <UiAlert v-else-if="twoFactor" tone="success" title="Акаунт захищено">
          Під час входу з нового пристрою ми попросимо код з додатка.
        </UiAlert>
      </div>
    </div>

    <UiSeparator />

    <div class="grid gap-x-10 gap-y-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div>
        <h4 class="text-sm font-semibold text-ink">Тариф</h4>
        <p class="mt-1 text-sm text-muted">Змінюється з наступного місяця.</p>
      </div>
      <UiRadioGroup v-model="form.plan" name="showcase-plan" :options="planOptions" orientation="horizontal" aria-label="Тариф" />
    </div>

    <UiActionBar :open="dirty" label="Незбережені зміни" aria-label="Незбережені зміни" @dismiss="discard">
      <UiButton variant="ghost" size="sm" :disabled="saving" @click="discard">Відкинути</UiButton>
      <UiButton size="sm" :loading="saving" @click="save">Зберегти</UiButton>
    </UiActionBar>
  </div>
</template>
