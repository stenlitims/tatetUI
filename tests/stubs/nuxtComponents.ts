import { defineComponent, h } from 'vue'

/** Достатній для DOM-тестів UiButton контракт NuxtLink. */
export const NuxtLink = defineComponent({
  name: 'NuxtLinkStub',
  inheritAttrs: false,
  props: {
    to: { type: [String, Object], required: true },
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        'a',
        {
          ...attrs,
          href: typeof props.to === 'string' ? props.to : '#',
        },
        slots.default?.(),
      )
  },
})
