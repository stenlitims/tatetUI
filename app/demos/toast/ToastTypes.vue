<script setup lang="ts">
import UiButton from '~/components/ui/UiButton.vue'
import { useToast, type ToastType } from '~/composables/useToast'

const toast = useToast()

function showAction() {
  const id = toast.info('Посилання залишиться доступним, доки ви не закриєте це повідомлення.', {
    title: 'Звіт готовий до перегляду',
    duration: 0,
    actions: [
      {
        label: 'Переглянути звіт',
        onClick: () => {
          toast.dismiss(id)
          toast.success('Демонстраційний звіт відкрито')
        },
      },
      { label: 'Закрити', onClick: () => toast.dismiss(id) },
    ],
  })
}

function showQueue() {
  const types: ToastType[] = ['success', 'info', 'warning', 'error']
  const messages = [
    ['Зміни збережено', 'Усі поля профілю успішно оновлено.'],
    ['Експорт розпочато', 'Готуємо файл із вашими даними.'],
    ['Сховище майже заповнене', 'Звільніть місце, щоб продовжити завантаження.'],
    ['Не вдалося синхронізувати', 'Перевірте з’єднання та спробуйте ще раз.'],
    ['Запрошення надіслано', 'Колега отримає посилання для приєднання до команди.'],
    ['Доступне оновлення', 'Нова версія містить покращення швидкодії.'],
    ['Термін посилання спливає', 'Поділіться новим посиланням протягом доби.'],
    ['Завантаження перервано', 'Файл перевищує ліміт. Спробуйте завантажити меншу версію.'],
  ]
  messages.forEach(([title, message], index) => {
    toast.show({ title, message: message!, type: types[index % types.length], duration: 0 })
  })
}
</script>

<template>
  <div class="w-full max-w-lg space-y-5">
    <div>
      <p class="mb-3 text-sm font-medium text-ink">Повідомлення для кожної ситуації</p>
      <div class="flex flex-wrap gap-2">
        <UiButton
          size="sm"
          @click="toast.success('Усі зміни вже у вашому профілі.', { title: 'Успішно збережено' })"
          >Успіх</UiButton
        >
        <UiButton
          size="sm"
          variant="outline"
          @click="
            toast.info('Ми повідомимо, щойно файл буде готовий.', { title: 'Експорт розпочато' })
          "
          >Інформація</UiButton
        >
        <UiButton
          size="sm"
          variant="outline"
          @click="toast.warning('Залишилося менше 10% вільного простору.', { title: 'Мало місця' })"
          >Попередження</UiButton
        >
        <UiButton
          size="sm"
          variant="danger"
          @click="
            toast.error('Перевірте підключення та спробуйте ще раз.', {
              title: 'Не вдалося зберегти',
            })
          "
          >Помилка</UiButton
        >
      </div>
    </div>
    <div class="border-t border-line pt-4">
      <p class="mb-3 text-sm font-medium text-ink">Спробуйте взаємодію</p>
      <div class="flex flex-wrap gap-2">
        <UiButton size="sm" variant="outline" @click="showAction">Із діями · без таймера</UiButton>
        <UiButton
          size="sm"
          variant="outline"
          @click="
            toast.info(
              'Експорт містить усі обрані записи, вкладення та історію змін. Підготовка великого файлу може тривати кілька хвилин.\nВи можете продовжувати роботу — ми повідомимо, коли все буде готово.',
              { title: 'Готуємо детальний звіт для вашої команди', duration: 0 },
            )
          "
          >Довгий текст</UiButton
        >
        <UiButton size="sm" variant="outline" @click="showQueue">Показати 8 сповіщень</UiButton>
      </div>
      <p class="mt-3 text-xs leading-relaxed text-muted">
        Змахніть картку вбік, щоб закрити. Від трьох повідомлень з’явиться «Очистити всі».
        Наведення, фокус і дотик призупиняють автозакриття.
      </p>
    </div>
  </div>
</template>
