import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import UiFileUpload from '~/components/ui/UiFileUpload.vue'
import { mountComponent } from './helpers/mountComponent'
import { isFileAccepted, matchesAccept } from '../app/utils/fileUpload'

const png = new File(['x'], 'photo.png', { type: 'image/png' })
const webp = new File(['x'], 'photo.webp', { type: 'image/webp' })
const pdf = new File(['x'], 'report.pdf', { type: 'application/pdf' })
const pdfUpper = new File(['x'], 'doc.PDF', { type: '' })

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  vi.restoreAllMocks()
})

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: { 0: file, length: 1, item: (index: number) => index === 0 ? file : null },
  })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('matchesAccept', () => {
  it('image/* приймає image/png і відхиляє application/pdf', () => {
    expect(matchesAccept(png, 'image/*')).toBe(true)
    expect(matchesAccept(pdf, 'image/*')).toBe(false)
  })

  it('розширення .pdf приймає file.PDF без урахування регістра', () => {
    expect(matchesAccept(pdfUpper, '.pdf')).toBe(true)
    expect(matchesAccept(pdf, '.pdf')).toBe(true)
  })

  it('точний MIME image/png не приймає image/webp', () => {
    expect(matchesAccept(png, 'image/png')).toBe(true)
    expect(matchesAccept(webp, 'image/png')).toBe(false)
  })

  it('кілька правил через кому (з пробілами) працюють разом', () => {
    expect(matchesAccept(png, 'image/*, .pdf')).toBe(true)
    expect(matchesAccept(pdf, 'image/*, .pdf')).toBe(true)
    expect(matchesAccept(webp, 'image/png, .pdf')).toBe(false)
  })

  it('порожній accept приймає все — контракт на рівні виклику', () => {
    // Компонент викликає isFileAccepted: без accept фільтр не застосовується.
    expect(isFileAccepted(png, undefined)).toBe(true)
    expect(isFileAccepted(pdf, undefined)).toBe(true)
    expect(isFileAccepted(webp, '')).toBe(true)
    expect(isFileAccepted(pdf, '   ')).toBe(true)
    expect(isFileAccepted(pdf, 'image/*')).toBe(false)
  })
})

describe('UiFileUpload', () => {
  it('показує превʼю одиночного файла й емітить контекстний remove', async () => {
    const image = new File([new Uint8Array(1536)], 'avatar.png', { type: 'image/png' })
    const removed: File[] = []
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:avatar')
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    mounted = await mountComponent(UiFileUpload, { onRemove: (file: File) => removed.push(file) })
    const input = mounted.host.querySelector<HTMLInputElement>('input[type="file"]')!

    selectFile(input, image)
    await nextTick()
    expect(createUrl).toHaveBeenCalledWith(image)
    expect(mounted.host.textContent).toContain('avatar.png')
    expect(mounted.host.textContent).toContain('2 КБ')
    const remove = mounted.host.querySelector<HTMLButtonElement>('[aria-label="Видалити файл avatar.png"]')!
    expect(remove).not.toBeNull()

    remove.click()
    await nextTick()
    expect(removed).toEqual([image])
    expect(revokeUrl).toHaveBeenCalledWith('blob:avatar')
    expect(mounted.host.textContent).not.toContain('avatar.png')
    expect(input.value).toBe('')
  })

  it('відкликає object URL при заміні та unmount', async () => {
    const first = new File(['1'], 'first.png', { type: 'image/png' })
    const second = new File(['2'], 'second.png', { type: 'image/png' })
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second')
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    mounted = await mountComponent(UiFileUpload)
    const input = mounted.host.querySelector<HTMLInputElement>('input[type="file"]')!
    selectFile(input, first)
    await nextTick()
    selectFile(input, second)
    await nextTick()
    expect(revokeUrl).toHaveBeenCalledWith('blob:first')

    mounted.unmount()
    mounted = null
    expect(revokeUrl).toHaveBeenCalledWith('blob:second')
  })

  it('повʼязує зону рівно з активною помилкою або підказкою', async () => {
    mounted = await mountComponent(UiFileUpload, { hint: 'До 10 МБ' })
    const zone = mounted.host.querySelector<HTMLElement>('[role="button"]')!
    let described = zone.getAttribute('aria-describedby')!
    expect(mounted.host.querySelector(`#${described}`)?.textContent).toBe('До 10 МБ')

    await mounted.update({ error: 'Файл завеликий' })
    described = zone.getAttribute('aria-describedby')!
    expect(described.split(' ')).toHaveLength(1)
    expect(mounted.host.querySelector(`#${described}`)?.textContent).toBe('Файл завеликий')
    expect(mounted.host.querySelector(`#${described}`)?.getAttribute('role')).toBe('alert')
  })
})
