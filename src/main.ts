// Entry: builds the scene, the storefront and the decor, then wires the overlay UI.
// Deep link: ?v=B2 opens a variant directly, &view=close picks a camera preset.
import * as THREE from 'three'
import { createScene, type View } from './core/scene'
import { createDecorManager } from './decor/manager'
import { VARIANTS, type VariantId } from './decor/variants'
import { createUi } from './ui/ui'
import { FACADE } from './world/facade'
import { createStorefront } from './world/storefront'

const VIEWS = [
  { id: 'front', label: 'Chính diện', target: [0, 3.9, 0.6], position: [0, 2.9, 15.5] },
  { id: 'close', label: 'Cận cảnh', target: [-1.6, 4.45, 1.3], position: [-0.5, 4.25, 4.4] },
  { id: 'angle', label: 'Góc nghiêng', target: [0, 4.1, 0.6], position: [-9.0, 2.4, 9.8] },
  { id: 'street', label: 'Từ vỉa hè', target: [0.4, 4.8, 0.9], position: [2.2, 1.6, 5.6] },
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
    onVariant: selectVariant,
    onView: (id) => shell.flyTo(resolveView(id as ViewId, shell.camera)),
    onLights: decor.setLightsOn,
    onTwinkle: decor.setTwinkle,
    onAutoRotate: (on) => {
      shell.controls.autoRotate = on
      shell.controls.autoRotateSpeed = 0.6
    },
  })

  function selectVariant(id: VariantId) {
    const layer = decor.show(id)
    ui.setVariant(id, layer.bom)
    const url = new URL(location.href)
    url.searchParams.set('v', id)
    history.replaceState(null, '', url)
  }

  shell.controls.addEventListener('start', ui.clearViewSelection)
  shell.setView(resolveView(initialView, shell.camera))
  selectVariant(initialVariant)
  decor.warmUp()

  requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('loader')?.classList.add('done')))
}

main()
