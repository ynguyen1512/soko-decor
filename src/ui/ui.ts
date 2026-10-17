// DOM overlay: brand, camera views, light toggles, the A1–B3 variant rail and the materials sheet.
import type { Detail, DetailId } from '../decor/details'
import type { BomLine, Variant, VariantId } from '../decor/variants'
import './styles.css'

export interface ViewPreset {
  id: string
  label: string
}

export interface UiOptions {
  variants: readonly Variant[]
  views: readonly ViewPreset[]
  details: readonly Detail[]
  onVariant(id: VariantId): void
  onDetail(id: DetailId): void
  onView(id: string): void
  onLights(on: boolean): void
  onTwinkle(on: boolean): void
  onBrightness(level: number): void
  onAutoRotate(on: boolean): void
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (text) el.textContent = text
  return el
}

function toggle(label: string, initial: boolean, onChange: (on: boolean) => void) {
  const b = h('button', 'chip toggle', label)
  b.type = 'button'
  b.setAttribute('aria-pressed', String(initial))
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true'
    b.setAttribute('aria-pressed', String(on))
    onChange(on)
  })
  return b
}

export function createUi(root: HTMLElement, opts: UiOptions) {
  // ── brand ──
  const brand = h('header', 'brand panel')
  brand.append(h('div', 'brand-mark', 'soko.'), h('div', 'brand-sub', 'Decor Giáng sinh · mặt tiền 3D'))

  // ── toolbar ──
  const tools = h('div', 'tools')
  const views = h('div', 'segmented panel')
  views.setAttribute('role', 'group')
  views.setAttribute('aria-label', 'Góc nhìn')
  const viewButtons = opts.views.map((v) => {
    const b = h('button', 'seg', v.label)
    b.type = 'button'
    b.addEventListener('click', () => {
      viewButtons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      hideCaption()
      opts.onView(v.id)
    })
    return b
  })
  viewButtons[0]?.setAttribute('aria-pressed', 'true')
  views.append(...viewButtons)

  const toggles = h('div', 'toggles panel')
  const bomButton = h('button', 'chip bom-toggle', 'Vật tư')
  bomButton.type = 'button'
  // brightness of the decor lights
  const dimmer = h('label', 'dimmer')
  const dimmerText = h('span', 'dimmer-text', 'Độ sáng')
  const dimmerValue = h('output', 'dimmer-value', '100%')
  const slider = h('input')
  slider.type = 'range'
  slider.min = '10'
  slider.max = '100'
  slider.step = '5'
  slider.value = '100'
  slider.setAttribute('aria-label', 'Độ sáng đèn trang trí')
  slider.addEventListener('input', () => {
    dimmerValue.textContent = `${slider.value}%`
    slider.style.setProperty('--fill', `${((Number(slider.value) - 10) / 90) * 100}%`)
    opts.onBrightness(Number(slider.value) / 100)
  })
  dimmer.append(dimmerText, slider, dimmerValue)

  toggles.append(
    toggle('Đèn', true, opts.onLights),
    dimmer,
    toggle('Nhấp nháy', true, opts.onTwinkle),
    toggle('Tự xoay', false, opts.onAutoRotate),
    bomButton,
  )
  tools.append(views, toggles)

  // ── materials sheet ──
  const bom = h('aside', 'bom panel')
  bom.setAttribute('aria-live', 'polite')
  const bomHead = h('div', 'bom-head')
  const bomTitle = h('h2', 'bom-title')
  const bomClose = h('button', 'bom-close', '×')
  bomClose.type = 'button'
  bomClose.setAttribute('aria-label', 'Đóng')
  bomHead.append(bomTitle, bomClose)
  const bomList = h('ul', 'bom-list')
  const bomFoot = h('p', 'bom-foot', 'Ước tính theo mặt tiền ~8,4m, 5 cây thông giữ nguyên. Số liệu tham khảo, cần đo thực tế trước khi báo giá.')
  bom.append(bomHead, bomList, bomFoot)
  bomButton.addEventListener('click', () => bom.classList.toggle('open'))
  bomClose.addEventListener('click', () => bom.classList.remove('open'))

  // ── variant rail ──
  const rail = h('nav', 'rail')
  rail.setAttribute('aria-label', 'Phương án decor')
  const cards = new Map<VariantId, HTMLButtonElement>()
  opts.variants.forEach((v, i) => {
    const card = h('button', 'card')
    card.type = 'button'
    const code = h('span', 'card-code', v.id)
    const body = h('span', 'card-body')
    body.append(h('span', 'card-title', v.title), h('span', 'card-desc', v.description))
    const key = h('kbd', 'card-key', String(i + 1))
    card.append(code, body, key)
    card.addEventListener('click', () => opts.onVariant(v.id))
    cards.set(v.id, card)
    rail.append(card)
  })

  // ── close-up details (the "Chi tiết …" row of the proposal sheet) ──
  const details = h('div', 'details panel')
  details.setAttribute('role', 'group')
  details.setAttribute('aria-label', 'Xem cận cảnh chi tiết')
  details.append(h('span', 'details-label', 'Chi tiết'))
  const detailButtons = new Map<DetailId, HTMLButtonElement>()
  for (const d of opts.details) {
    const b = h('button', 'chip detail', d.label)
    b.type = 'button'
    b.addEventListener('click', () => opts.onDetail(d.id))
    detailButtons.set(d.id, b)
    details.append(b)
  }
  details.append(h('span', 'hint', 'Kéo để xoay · Cuộn/chụm để zoom · Phím 1–6'))

  const caption = h('aside', 'caption panel')
  caption.setAttribute('aria-live', 'polite')
  const captionTitle = h('h2', 'caption-title')
  const captionText = h('p', 'caption-text')
  const captionMeta = h('p', 'caption-meta')
  const captionClose = h('button', 'bom-close caption-close', '×')
  captionClose.type = 'button'
  captionClose.setAttribute('aria-label', 'Đóng')
  caption.append(captionClose, captionTitle, captionText, captionMeta)

  const hideCaption = () => {
    caption.classList.remove('open')
    for (const b of detailButtons.values()) b.setAttribute('aria-pressed', 'false')
  }
  captionClose.addEventListener('click', hideCaption)

  root.append(brand, tools, caption, bom, details, rail)

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
    const v = opts.variants[Number(e.key) - 1]
    if (v) opts.onVariant(v.id)
  })

  return {
    setVariant(id: VariantId, lines: BomLine[]) {
      for (const [vid, card] of cards) card.setAttribute('aria-current', String(vid === id))
      cards.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      bomTitle.textContent = `Ước tính vật tư · ${id}`
      bomList.replaceChildren(
        ...lines.map((l) => {
          const li = h('li')
          const label = h('span', 'bom-label', l.label)
          if (l.note) label.append(h('small', undefined, l.note))
          li.append(label, h('span', 'bom-qty', `${l.qty.toLocaleString('vi-VN')} ${l.unit}`))
          return li
        }),
      )
    },
    clearViewSelection() {
      viewButtons.forEach((x) => x.setAttribute('aria-pressed', 'false'))
    },
    showDetail(d: Detail, variant: VariantId) {
      viewButtons.forEach((x) => x.setAttribute('aria-pressed', 'false'))
      for (const [id, b] of detailButtons) b.setAttribute('aria-pressed', String(id === d.id))
      captionTitle.textContent = d.title
      captionText.textContent = d.description
      captionMeta.textContent = `Đang xem trong phương án ${variant}`
      caption.classList.add('open')
    },
    hideCaption,
  }
}
