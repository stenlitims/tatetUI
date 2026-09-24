<script setup lang="ts">
import UiButton from '~/components/ui/UiButton.vue'
import UiKbd from '~/components/ui/UiKbd.vue'
import UiSwitch from '~/components/ui/UiSwitch.vue'
import { useTheme } from '~/composables/useTheme'

defineSlots<Record<string, never>>()

const { isDark, toggle } = useTheme()

const files = [
  { path: 'components/ui/UiRating.vue', note: 'компонент', tone: 'text-accent' },
  { path: 'utils/uiFieldStyles.ts', note: 'dependsOn', tone: 'text-muted' },
  { path: 'assets/css/tokens.css', note: 'раз на проєкт', tone: 'text-muted' },
]

/*
 * Зразки — самі токени, а не картинки: перемикач теми поруч фарбує їх
 * наживо, і видно, що та сама розмітка тримає обидві теми.
 */
const swatches = [
  { name: 'card', class: 'bg-card' },
  { name: 'subtle', class: 'bg-subtle' },
  { name: 'accent-solid', class: 'bg-accent-solid' },
  { name: 'success', class: 'bg-success' },
  { name: 'warning', class: 'bg-warning' },
  { name: 'danger', class: 'bg-danger' },
  { name: 'rating', class: 'bg-rating' },
  { name: 'line-strong', class: 'bg-line-strong' },
]

const checks = [
  'кожен Ui*.vue має сторінку, і навпаки',
  'кожен props має опис у JSDoc',
  'події звірені з defineEmits в обидва боки',
  'лише зареєстровані токени, жодного dark:',
  'accent і danger тримають AA в обох темах',
]
</script>

<template>
  <section class="border-t border-line bg-subtle py-20 sm:py-24" aria-labelledby="principles-title">
    <div class="mx-auto max-w-6xl px-4">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold text-accent">Чому саме так</p>
        <h2 id="principles-title" class="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Кожне правило закриває баг, який уже траплявся
        </h2>
        <p class="mt-3 text-lg text-muted">
          Бібліотека виросла з продуктів, де ті самі компоненти писали незалежно
          по кілька разів. Правила нижче — не стиль, а наслідки.
        </p>
      </div>

      <div class="mt-10 grid gap-4 md:grid-cols-6">
        <!-- Копіювання -->
        <article class="rounded-overlay border border-line bg-card p-6 shadow-card md:col-span-4">
          <h3 class="text-lg font-semibold text-ink">Копіюй, не встановлюй</h3>
          <p class="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Компонент стає частиною проєкту: правка під екран — це правка файлу,
            а не форк пакета. Сторінка кожного компонента перелічує, що скопіювати
            разом із ним.
          </p>
          <div class="mt-5 overflow-x-auto rounded-card border border-line bg-subtle p-4 font-mono text-[13px] leading-7">
            <p class="text-muted">app/</p>
            <p v-for="file in files" :key="file.path" class="flex items-center gap-3 whitespace-nowrap pl-4">
              <span class="text-ink">{{ file.path }}</span>
              <span class="text-xs" :class="file.tone">← {{ file.note }}</span>
            </p>
          </div>
        </article>

        <!-- Нуль залежностей -->
        <article class="flex flex-col justify-between rounded-overlay border border-line bg-card p-6 shadow-card md:col-span-2">
          <div>
            <p class="text-6xl font-semibold tabular-nums tracking-tight text-ink">0</p>
            <h3 class="mt-2 text-lg font-semibold text-ink">залежностей у runtime</h3>
          </div>
          <p class="mt-4 text-sm leading-relaxed text-muted">
            Позиціонування, пастка фокуса, блокування прокрутки, дати — власні.
            Єдиний свідомий виняток — редактор на TipTap.
          </p>
        </article>

        <!-- Токени -->
        <article class="rounded-overlay border border-line bg-card p-6 shadow-card md:col-span-3">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold text-ink">Токени замість кольорів</h3>
              <p class="mt-2 text-sm leading-relaxed text-muted">
                <code class="rounded bg-hover px-1 py-0.5 text-xs text-ink">bg-card</code>, а не
                <code class="rounded bg-hover px-1 py-0.5 text-xs text-ink">bg-white dark:bg-…</code>.
                Та сама розмітка тримає обидві теми.
              </p>
            </div>
            <UiSwitch :model-value="isDark" label="Темна тема" @update:model-value="toggle()" />
          </div>
          <ul class="mt-5 grid grid-cols-4 gap-2">
            <li v-for="swatch in swatches" :key="swatch.name">
              <span class="block h-10 rounded-control border border-line" :class="swatch.class" />
              <span class="mt-1 block truncate font-mono text-[11px] text-muted">{{ swatch.name }}</span>
            </li>
          </ul>
        </article>

        <!-- Доступність -->
        <article class="rounded-overlay border border-line bg-card p-6 shadow-card md:col-span-3">
          <h3 class="text-lg font-semibold text-ink">Доступність — контракт</h3>
          <p class="mt-2 text-sm leading-relaxed text-muted">
            Ролі, клавіатура й видимий фокус перевіряються тестами разом із
            поведінкою. На телефоні — поля з 16px тексту й цілі дотику 44px.
          </p>
          <div class="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <UiKbd combo="Tab" /> фокус
            <UiKbd :combo="['ArrowUp']" /><UiKbd :combo="['ArrowDown']" /> вибір
            <UiKbd combo="Enter" /> дія
            <UiKbd combo="Escape" /> лише верхній шар
          </div>
        </article>

        <!-- Оверлеї -->
        <article class="rounded-overlay border border-line bg-card p-6 shadow-card md:col-span-2">
          <h3 class="text-lg font-semibold text-ink">Один стек оверлеїв</h3>
          <p class="mt-2 text-sm leading-relaxed text-muted">
            Modal, Drawer, Lightbox і Confirm ділять шари, лок прокрутки й пастку
            фокуса — вкладені вікна закриваються по одному.
          </p>
          <div class="relative mt-6 h-24" aria-hidden="true">
            <div class="absolute inset-x-6 top-0 h-14 rounded-card border border-line bg-subtle" />
            <div class="absolute inset-x-3 top-4 h-14 rounded-card border border-line bg-card shadow-card" />
            <div class="absolute inset-x-0 top-8 flex h-14 items-center justify-between rounded-card border border-line bg-card px-3 shadow-raised">
              <span class="text-xs font-medium text-ink">Видалити?</span>
              <span class="rounded-control bg-danger-solid px-2 py-1 text-[11px] font-medium text-danger-contrast">Так</span>
            </div>
          </div>
          <UiButton to="/docs/patterns/overlays" variant="link" size="sm" class="mt-2">Як це працює</UiButton>
        </article>

        <!-- Документація -->
        <article class="rounded-overlay border border-line bg-card p-6 shadow-card md:col-span-4">
          <h3 class="text-lg font-semibold text-ink">Документація не розходиться з кодом</h3>
          <p class="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Таблиці API генеруються з самих компонентів, а десять перевірок
            валять збірку, щойно сторінка й код розійшлися.
          </p>
          <div class="mt-5 overflow-x-auto rounded-card border border-line bg-subtle p-4 font-mono text-[13px] leading-6">
            <p class="text-muted"><span class="select-none text-accent">$ </span>bun run check:docs</p>
            <p v-for="check in checks" :key="check" class="whitespace-nowrap text-ink">
              <span class="text-success">✓</span> {{ check }}
            </p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
