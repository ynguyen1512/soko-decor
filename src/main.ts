// Entry: builds the scene, the storefront and the decor, then wires the overlay UI.
// Deep links: ?v=B2 opens a variant, &view=close picks a camera preset, &detail=bow a close-up.
import * as THREE from 'three'
import { createScene, type View } from './core/scene'
import { createDecorManager } from './decor/manager'
import { DETAILS, type DetailId } from './decor/details'
import { VARIANTS, type VariantId } from './decor/variants'
import { createUi } from './ui/ui'
import { FACADE } from './world/facade'
import { createStorefront } from './world/storefront'

const VIEWS = [
  // matches the reference photo: across the street, eye height, looking slightly up
  { id: 'front', label: 'Chính diện', target: [0.3, 3.55, 0.3], position: [0.3, 1.7, 14.2] },
  { id: 'close', label: 'Cận cảnh', target: [-1.9, 4.75, 0.4], position: [-1.0, 4.4, 4.2] },
  { id: 'angle', label: 'Góc nghiêng', target: [0, 3.6, 0.2], position: [-8.8, 2.0, 10.0] },
  { id: 'street', label: 'Từ vỉa hè', target: [-0.3, 4.6, 0.4], position: [1.4, 1.6, 4.6] },
] as const

type ViewId = (typeof VIEWS)[number]['id']

/** Narrow (portrait) screens see less width: pull the camera back so the facade still fits. */
function resolveView(id: ViewId, camera: THREE.PerspectiveCamera): View {
  const v = VIEWS.find((x) => x.id === id) ?? VIEWS[0]
  const target = new THREE.Vector3(...v.target)
  const position = new THREE.Vector3(...v.position)
  const halfWidth = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect
  const needed = (FACADE.halfWidth + 1.0) / halfWidth
  const pull = Math.max(1, needed / position.distanceTo(target))
  if (pull > 1) position.sub(target).multiplyScalar(id === 'front' ? pull : Math.sqrt(pull)).add(target)
  return { target, position }
}

async function main() {
  // the sign is painted on a canvas: wait for its typefaces first (falls back after 1.5 s)
  await Promise.race([
    Promise.all([document.fonts.load(`700 100px 'Fraunces'`), document.fonts.load(`600 40px 'JetBrains Mono'`)]),
    new Promise((r) => setTimeout(r, 1500)),
  ])

  const shell = createScene(document.getElementById('viewport')!)
  shell.scene.add(createStorefront())
  const decor = createDecorManager(shell.scene)
  shell.onFrame(decor.update)

  const params = new URLSearchParams(location.search)
  const initialVariant = (VARIANTS.find((v) => v.id === params.get('v')?.toUpperCase())?.id ?? 'A1') as VariantId
  const initialView = (VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'front') as ViewId

  const ui = createUi(document.getElementById('ui')!, {
    variants: VARIANTS,
    views: VIEWS,
    details: DETAILS,
    onVariant: (id) => {
      ui.hideCaption()
      selectVariant(id)
    },
    onDetail: (id) => showDetail(id),
    onView: (id) => shell.flyTo(resolveView(id as ViewId, shell.camera)),
    onLights: decor.setLightsOn,
    onTwinkle: decor.setTwinkle,
    onBrightness: decor.setBrightness,
    onAutoRotate: (on) => {
      shell.controls.autoRotate = on
      shell.controls.autoRotateSpeed = 0.6
    },
  })

  let current: VariantId = initialVariant

  /** Flies to a close-up of one accessory, switching to a variant that has it if needed. */
  function showDetail(id: DetailId, instant = false) {
    const detail = DETAILS.find((d) => d.id === id)!
    const variant = VARIANTS.find((v) => v.id === current)!
    const target = detail.has(variant) ? current : detail.fallback
    const layer = selectVariant(target)
    const point = layer.focus[id]
    if (!point) return
    // a little to the right and below, so the tails and drape read in depth
    const offset = new THREE.Vector3(0.35, -0.08, id === 'bow' ? 1.9 : id === 'garland' ? 1.7 : 1.2)
    if (shell.camera.aspect < 1) offset.multiplyScalar(1.5)
    const view = { target: point, position: point.clone().add(offset) }
    if (instant) shell.setView(view)
    else shell.flyTo(view)
    ui.showDetail(detail, target)
  }

  function selectVariant(id: VariantId) {
    current = id
    const layer = decor.show(id)
    ui.setVariant(id, layer.bom)
    const url = new URL(location.href)
    url.searchParams.set('v', id)
    history.replaceState(null, '', url)
    return layer
  }

  shell.controls.addEventListener('start', ui.clearViewSelection)
  shell.setView(resolveView(initialView, shell.camera))
  selectVariant(initialVariant)
  const initialDetail = DETAILS.find((d) => d.id === params.get('detail'))
  if (initialDetail) showDetail(initialDetail.id, true)
  decor.warmUp()

  requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('loader')?.classList.add('done')))
}

main()
