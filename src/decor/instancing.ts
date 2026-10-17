// Instance collectors: decor generators push transforms here, then each collector becomes one
// InstancedMesh (one draw call for thousands of needles / bulbs / berries).
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const UP = new THREE.Vector3(0, 1, 0)
const _q = new THREE.Quaternion()
const _spin = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _dir = new THREE.Vector3()

export class InstanceCollector {
  private matrices: THREE.Matrix4[] = []
  private colors: THREE.Color[] = []
  private phases: number[] = []

  constructor(
    private geometry: THREE.BufferGeometry,
    private material: THREE.Material,
  ) {}

  get count() {
    return this.matrices.length
  }

  /** Places one instance at `pos`, its +Y axis pointing along `dir`, spun by `spin` radians. */
  add(pos: THREE.Vector3, opts: { dir?: THREE.Vector3; spin?: number; scale?: number | THREE.Vector3; color?: THREE.Color; phase?: number } = {}) {
    if (opts.dir) _q.setFromUnitVectors(UP, _dir.copy(opts.dir).normalize())
    else _q.identity()
    if (opts.spin) _q.multiply(_spin.setFromAxisAngle(UP, opts.spin))
    if (typeof opts.scale === 'number') _s.setScalar(opts.scale)
    else if (opts.scale) _s.copy(opts.scale)
    else _s.setScalar(1)
    this.matrices.push(new THREE.Matrix4().compose(pos, _q, _s))
    this.colors.push(opts.color ?? new THREE.Color(1, 1, 1))
    this.phases.push(opts.phase ?? 0)
  }

  build(name: string): THREE.InstancedMesh {
    // per-mesh geometry copy: it carries this mesh's own aPhase attribute
    const geometry = this.geometry.clone()
    const phase = new Float32Array(Math.max(1, this.count))
    phase.set(this.phases)
    geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
    const mesh = new THREE.InstancedMesh(geometry, this.material, Math.max(1, this.count))
    mesh.name = name
    mesh.count = this.count
    this.matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, this.colors[i])
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.frustumCulled = false
    return mesh
  }
}

// ── shared LED / neon shader ─────────────────────────────────────────────────────────────────

/** Shared uniforms: one update per frame drives every bulb and neon star in the scene. */
export const lightUniforms = {
  uTime: { value: 0 },
  /** 0 = lights off, 1 = on (animated between for a soft switch) */
  uOn: { value: 1 },
  /** 0 = steady, 1 = full twinkle */
  uTwinkle: { value: 1 },
}

const vertexShader = /* glsl */ `
  attribute float aPhase;
  uniform float uTime;
  uniform float uTwinkle;
  uniform float uTwinkleAmount;
  varying float vGlow;
  varying vec3 vTint;
  void main() {
    float speed = 1.2 + fract(aPhase * 7.31) * 2.6;
    float wave = 0.5 + 0.5 * sin(uTime * speed + aPhase * 6.2831);
    float sparkle = smoothstep(0.93, 1.0, sin(uTime * 0.7 + aPhase * 40.0));
    vGlow = mix(1.0, 0.55 + 0.45 * wave + 0.6 * sparkle, uTwinkle * uTwinkleAmount);
    #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
    #else
      vTint = vec3(1.0);
    #endif
    #ifdef USE_INSTANCING
      vec4 p = instanceMatrix * vec4(position, 1.0);
    #else
      vec4 p = vec4(position, 1.0);
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * p;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uOn;
  varying float vGlow;
  varying vec3 vTint;
  void main() {
    vec3 lit = uColor * vTint * uIntensity * vGlow;
    vec3 off = uColor * vTint * 0.08;
    gl_FragColor = vec4(mix(off, lit, uOn), 1.0);
  }
`

/** Unlit glowing material for bulbs and neon. Values above ~1 bloom. */
export function createGlowMaterial(color: THREE.Color, intensity: number, twinkle = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...lightUniforms,
      uColor: { value: color.clone() },
      uIntensity: { value: intensity },
      uTwinkleAmount: { value: twinkle },
    },
    vertexShader,
    fragmentShader,
  })
}

// ── geometries ───────────────────────────────────────────────────────────────────────────────

let sprig: THREE.BufferGeometry | null = null
/**
 * A pine sprig 1 m long along +Y: a stem with needles fanned around it. Instances scale it to
 * 10–30 cm. Kept very low-poly: at viewing distance the needles merge into a soft mass.
 */
export function sprigGeometry(): THREE.BufferGeometry {
  if (sprig) return sprig
  const parts: THREE.BufferGeometry[] = []
  const stem = new THREE.CylinderGeometry(0.012, 0.02, 1, 4, 1, true)
  stem.translate(0, 0.5, 0)
  parts.push(stem)
  const rows = 7
  for (let r = 0; r < rows; r++) {
    const t = 0.12 + (r / rows) * 0.88
    const len = 0.42 * (1 - t * 0.55)
    for (let k = 0; k < 4; k++) {
      const needle = new THREE.ConeGeometry(0.035, len, 3, 1, true)
      needle.translate(0, len / 2, 0)
      needle.rotateZ(-1.0 + (k % 2) * 0.12)
      needle.rotateY(k * (Math.PI / 2) + r * 0.6)
      needle.translate(0, t, 0)
      parts.push(needle)
    }
  }
  // tip
  const tip = new THREE.ConeGeometry(0.05, 0.25, 3, 1, true)
  tip.translate(0, 1.1, 0)
  parts.push(tip)
  sprig = mergeGeometries(parts.map((p) => p.toNonIndexed()))
  sprig.computeVertexNormals()
  return sprig
}

let bulb: THREE.BufferGeometry | null = null
export function bulbGeometry() {
  return (bulb ??= new THREE.IcosahedronGeometry(1, 0))
}

let ball: THREE.BufferGeometry | null = null
export function ballGeometry() {
  return (ball ??= new THREE.SphereGeometry(1, 16, 12))
}
