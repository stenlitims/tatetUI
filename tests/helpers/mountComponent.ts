import type { Component, Plugin, SlotsType } from 'vue'
import { createApp, h, nextTick, reactive } from 'vue'

/**
 * Мінімальний DOM-mount для copy-first компонентів. Навмисно без Test Utils:
 * тести перевіряють справжній DOM Vue, а runtime бібліотеки не росте.
 */
export async function mountComponent(
  component: Component,
  initialProps: Record<string, unknown> = {},
  slots: SlotsType<Record<string, (...args: unknown[]) => unknown>> | Record<string, unknown> = {},
  options: { plugins?: Plugin[] } = {},
) {
  const host = document.createElement('div')
  document.body.append(host)
  const props = reactive({ ...initialProps })
  const app = createApp({
    render: () => h(component, props, slots),
  })
  for (const plugin of options.plugins ?? []) app.use(plugin)

  const instance = app.mount(host)
  await nextTick()

  return {
    app,
    host,
    instance,
    props,
    async update(nextProps: Record<string, unknown>) {
      Object.assign(props, nextProps)
      await nextTick()
    },
    unmount() {
      app.unmount()
      host.remove()
    },
  }
}
