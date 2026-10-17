// Scene shell: renderer + bloom composer, night lighting base, orbit controls, eased camera
// flights and the frame loop.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { C } from './materials'

export interface View {
  target: THREE.Vector3Like
  position: THREE.Vector3Like
}

export type FrameCallback = (dt: number, elapsed: number) => void

const MAX_DT = 0.1
const FLIGHT_SECONDS = 1.3

const BLOOM = { strength: 0.85, radius: 0.55, threshold: 0.92 }

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export function createScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' })
  container.append(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(C.sky)
  scene.fog = new THREE.Fog(C.sky, 22, 60)

  // A faint studio environment only gives metal ornaments something to reflect.
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.12
  pmrem.dispose()

  scene.add(new THREE.HemisphereLight(0x2a3760, 0x0c0c12, 0.55))
  const moon = new THREE.DirectionalLight(0x8fa6d8, 0.35)
  moon.position.set(-8, 14, 10)
  scene.add(moon)

  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.rotateSpeed = 0.6
  controls.minDistance = 2.2
  controls.maxDistance = 24
  // The back of the building is not modelled: keep the camera in front of the facade.
  controls.minAzimuthAngle = -1.15
  controls.maxAzimuthAngle = 1.15
  controls.minPolarAngle = 0.55
  controls.maxPolarAngle = 1.72
  controls.screenSpacePanning = true

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const resize = () => {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    renderer.setSize(w, h, false)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(w, h)
    camera.aspect = w / h
    // Portrait phones: widen the view so the whole facade still fits.
    camera.fov = w / h < 0.8 ? 52 : 36
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(container)
  resize()

  // ── camera flights ────────────────────────────────────────────────────────────────────────
  let flight: { from: View; to: View; t: number } | null = null
  const v3 = (p: THREE.Vector3Like) => new THREE.Vector3(p.x, p.y, p.z)

  function setView(view: View) {
    controls.target.copy(view.target)
    camera.position.copy(view.position)
    controls.update()
  }

  function flyTo(view: View) {
    flight = {
      from: { target: controls.target.clone(), position: camera.position.clone() },
      to: { target: v3(view.target), position: v3(view.position) },
      t: 0,
    }
  }

  controls.addEventListener('start', () => { flight = null })

  function stepFlight(dt: number): boolean {
    if (!flight) return false
    flight.t = Math.min(1, flight.t + dt / FLIGHT_SECONDS)
    const k = easeInOutCubic(flight.t)
    controls.target.lerpVectors(v3(flight.from.target), v3(flight.to.target), k)
    camera.position.lerpVectors(v3(flight.from.position), v3(flight.to.position), k)
    camera.lookAt(controls.target)
    if (flight.t >= 1) {
      flight = null
      controls.update()
    }
    return true
  }

  // ── frame loop ────────────────────────────────────────────────────────────────────────────
  const callbacks = new Set<FrameCallback>()
  let last = performance.now()
  let elapsed = 0

  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const dt = Math.min(MAX_DT, (now - last) / 1000)
    last = now
    elapsed += dt
    for (const cb of callbacks) cb(dt, elapsed)
    if (!stepFlight(dt)) controls.update(dt)
    composer.render(dt)
  })

  return {
    renderer,
    scene,
    camera,
    controls,
    bloom,
    setView,
    flyTo,
    onFrame(cb: FrameCallback) {
      callbacks.add(cb)
      return () => callbacks.delete(cb)
    },
  }
}

export type SceneShell = ReturnType<typeof createScene>
