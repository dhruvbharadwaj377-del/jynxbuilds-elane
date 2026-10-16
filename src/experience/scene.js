// Procedural Elane Beauty House, built with plain Three.js.
//
// One continuous place: a limestone facade on a quiet street, reception and
// lounge inside the glass, the styling floor with its arched mirrors, and,
// through a plaster arch, the ritual lounge with its reclined basins. The
// camera is the only thing that moves.
//
// This module is loaded lazily (dynamic import) so three.js never touches the
// initial bundle. It renders on demand: frames are only drawn while the camera,
// pointer or lighting mood is still settling, and nothing runs while the
// section is offscreen. The architecture is static, so geometry is merged per
// material, shadow maps are rendered once, and the room is captured once into
// a cube map that the mirrors and metals reflect.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { segmentAt } from './timeline.js'
import * as T from './textures.js'

// ---------------------------------------------------------------------------
// Lighting moods
// ---------------------------------------------------------------------------

const MOODS = {
  evening: {
    skyTop: new THREE.Color('#2a2c3e'),
    skyHorizon: new THREE.Color('#b98f7c'),
    glow: new THREE.Color('#e9a87e'),
    glowStrength: 0.55,
    fog: new THREE.Color('#5a4c4c'),
    hemi: 0.62,
    sun: 0,
    interior: 1,
    exterior: 1,
    windows: 1,
    exposure: 1.06,
  },
  daylight: {
    skyTop: new THREE.Color('#8fa6bf'),
    skyHorizon: new THREE.Color('#ece2d4'),
    glow: new THREE.Color('#fff2dc'),
    glowStrength: 0.35,
    fog: new THREE.Color('#d8d2c8'),
    hemi: 1.15,
    sun: 2.6,
    interior: 0.85,
    exterior: 0.15,
    windows: 0.1,
    exposure: 0.92,
  },
}

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k)

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

function mat(x = 0, y = 0, z = 0, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  _e.set(rx, ry, rz)
  _q.setFromEuler(_e)
  _p.set(x, y, z)
  _s.set(sx, sy, sz)
  return _m.clone().compose(_p, _q, _s)
}

function scaleUV(g, su, sv) {
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  return g
}

// Box whose UVs are in metres / tile, so textures keep a true scale
function boxGeo(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d)
  if (tile) {
    const uv = g.attributes.uv
    const dims = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ]
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v
        uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile[0], (uv.getY(i) * dims[f][1]) / tile[1])
      }
    }
  }
  return g
}

// Rounded-top arch outline, centred on x = 0, sitting on y = 0
function archShape(width, height, inset = 0, base = inset) {
  const r = width / 2 - inset
  const s = new THREE.Shape()
  s.moveTo(-r, base)
  s.lineTo(r, base)
  s.lineTo(r, height - width / 2)
  s.absarc(0, height - width / 2, r, 0, Math.PI, false)
  s.lineTo(-r, base)
  return s
}

// A thin arch-shaped band (no bottom bar): used for brass trims
function archBand(width, height, band) {
  const r = width / 2
  const ri = r - band
  const spring = height - r
  const s = new THREE.Shape()
  s.moveTo(-r, 0)
  s.lineTo(-r, spring)
  s.absarc(0, spring, r, Math.PI, 0, true)
  s.lineTo(r, 0)
  s.lineTo(ri, 0)
  s.lineTo(ri, spring)
  s.absarc(0, spring, ri, 0, Math.PI, false)
  s.lineTo(-ri, 0)
  s.closePath()
  return s
}

// Annular sector in the xz plane, extruded upward: the curved shell of a
// tub chair or the front of a reception desk. Opening faces +x.
function shellGeo(rIn, rOut, open, height, bevel = 0.02) {
  const a0 = open
  const a1 = Math.PI * 2 - open
  const s = new THREE.Shape()
  s.absarc(0, 0, rOut, a0, a1, false)
  s.absarc(0, 0, rIn, a1, a0, true)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 40,
  })
  g.rotateX(-Math.PI / 2)
  return g
}

// ---------------------------------------------------------------------------
// Sky dome
// ---------------------------------------------------------------------------

function createSky() {
  const uniforms = {
    topColor: { value: MOODS.evening.skyTop.clone() },
    horizonColor: { value: MOODS.evening.skyHorizon.clone() },
    glowColor: { value: MOODS.evening.glow.clone() },
    glowStrength: { value: MOODS.evening.glowStrength },
    glowDir: { value: new THREE.Vector3(0.5, 0.05, -0.86).normalize() },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 glowColor;
      uniform float glowStrength;
      uniform vec3 glowDir;
      varying vec3 vDir;
      void main() {
        float h = max(vDir.y, 0.0);
        vec3 col = mix(horizonColor, topColor, pow(h, 0.6));
        float sun = max(dot(normalize(vec3(vDir.x, max(vDir.y, 0.0), vDir.z)), glowDir), 0.0);
        col += glowColor * pow(sun, 5.0) * glowStrength * (1.0 - h);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), material)
  mesh.renderOrder = -1
  return { mesh, uniforms }
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export function createSalonScene({ canvas, chapters, quality = 'high', onRender, onContextLost }) {
  const high = quality === 'high'
  const rand = T.seeded(23)

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !high, // the high tier antialiases in the composer's target instead
    alpha: false,
    powerPreference: high ? 'high-performance' : 'low-power',
  })
  // Resolution: capped by device pixel ratio and by a total pixel budget, so
  // a 4K or ultrawide screen does not render at 1.75x for every pixel. A
  // frame-time governor (in tick) lowers it further on hardware that struggles.
  const maxRatio = Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1.25)
  const pixelBudget = high ? 3.6e6 : 1.5e6
  let qualityScale = 1
  let pixelRatio = maxRatio
  renderer.setPixelRatio(pixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = high
  renderer.shadowMap.type = THREE.PCFShadowMap
  // The room never moves, so shadows are drawn once rather than every frame.
  renderer.shadowMap.autoUpdate = false

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(MOODS.evening.fog.clone(), 40, 260)

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 600)

  // Post-processing (high tier): a restrained bloom that only touches the
  // brightest emitters (mirror backlights, globes), never the surfaces.
  let composer = null
  let bloom = null
  let output = null
  if (high) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    composer = new EffectComposer(renderer, target)
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.45, 1.1)
    composer.addPass(bloom)
    output = new OutputPass()
    composer.addPass(output)
  }

  const disposables = []
  const tex = (t) => {
    disposables.push(t)
    return t
  }

  // ---------------- Materials ----------------

  const floorMap = tex(T.travertineFloorTexture(rand))
  const plasterMap = tex(T.plasterTexture(rand))
  const flutedNormal = tex(T.flutedNormalTexture())
  const oakMap = tex(T.oakTexture(rand))

  const M = {
    floor: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: floorMap,
      roughnessMap: tex(T.floorRoughnessTexture(rand)),
      roughness: 0.62,
      envMapIntensity: 0.9,
    }),
    plaster: new THREE.MeshStandardMaterial({ color: '#fbf6ef', map: plasterMap, roughness: 0.94 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#fdf9f3', map: plasterMap, roughness: 0.96 }),
    limestone: new THREE.MeshStandardMaterial({ color: '#fbf5ec', map: tex(T.limestoneTexture(rand)), roughness: 0.86 }),
    fluted: new THREE.MeshStandardMaterial({
      color: '#d8c8b4',
      map: plasterMap,
      normalMap: flutedNormal,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.82,
    }),
    flutedStone: new THREE.MeshStandardMaterial({
      color: '#f1e9de',
      map: plasterMap,
      normalMap: flutedNormal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.6,
    }),
    oak: new THREE.MeshStandardMaterial({ color: '#f6efe6', map: oakMap, roughness: 0.58 }),
    stoneTop: new THREE.MeshStandardMaterial({ color: '#f1ebe2', map: plasterMap, roughness: 0.3 }),
    // Paler oak for the slatted wall, which is seen large and in low light
    slat: new THREE.MeshStandardMaterial({ color: '#f7f2ec', map: oakMap, roughness: 0.6 }),
    slatBack: new THREE.MeshStandardMaterial({ color: '#8a7765', roughness: 0.9 }),
    espressoStone: new THREE.MeshStandardMaterial({ color: '#3d3029', roughness: 0.48 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c9a56c', roughness: 0.3, metalness: 1, envMapIntensity: 1.4 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#4a3c31', roughness: 0.38, metalness: 0.8 }),
    boucle: new THREE.MeshPhysicalMaterial({
      color: '#ece4d7',
      roughness: 0.96,
      sheen: 0.7,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color('#ffffff'),
    }),
    leather: new THREE.MeshStandardMaterial({ color: '#9d8a79', roughness: 0.5 }),
    rug: new THREE.MeshStandardMaterial({ color: '#d9cbb8', roughness: 1 }),
    ceramic: new THREE.MeshStandardMaterial({ color: '#f5f1ea', roughness: 0.14, side: THREE.DoubleSide }),
    towel: new THREE.MeshStandardMaterial({ color: '#f6f2ea', roughness: 1 }),
    // Product glassware and packaging
    amber: new THREE.MeshStandardMaterial({ color: '#7a4f2a', roughness: 0.12, metalness: 0.1 }),
    ivoryPack: new THREE.MeshStandardMaterial({ color: '#efe7da', roughness: 0.4 }),
    sandPack: new THREE.MeshStandardMaterial({ color: '#c8b49a', roughness: 0.45 }),
    darkCap: new THREE.MeshStandardMaterial({ color: '#2b211c', roughness: 0.35, metalness: 0.2 }),
    // Glass
    glass: new THREE.MeshStandardMaterial({
      color: '#c8d0cd',
      roughness: 0.04,
      metalness: 0.2,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      envMapIntensity: 1.2,
    }),
    darkGlass: new THREE.MeshStandardMaterial({ color: '#3a3d40', roughness: 0.1, metalness: 0.7, envMapIntensity: 1.1 }),
    windowLit: new THREE.MeshStandardMaterial({ color: '#2a2622', emissive: '#c99566', emissiveIntensity: 0.24, roughness: 0.12, metalness: 0.6 }),
    mirror: new THREE.MeshBasicMaterial({ color: '#d8d4cd' }),
    // Emitters (HDR so they stay luminous after tone mapping)
    led: new THREE.MeshBasicMaterial({ color: hdr('#ffe3c2', 2.4) }),
    halo: new THREE.MeshBasicMaterial({ color: hdr('#ffe2c2', 1.12) }),
    opal: new THREE.MeshBasicMaterial({ color: hdr('#ffe9cf', 2.0) }),
    nicheGlow: new THREE.MeshBasicMaterial({ color: hdr('#f6dcc0', 1.05) }),
    skylight: new THREE.MeshBasicMaterial({ color: hdr('#fbeedd', 1.25) }),
    // Planting
    leaf: new THREE.MeshStandardMaterial({ color: '#6b7650', roughness: 0.88 }),
    stem: new THREE.MeshStandardMaterial({ color: '#8b7458', roughness: 0.85 }),
    pavement: new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex(T.pavementTexture(rand)), roughness: 0.8 }),
    neighbour: new THREE.MeshStandardMaterial({ color: '#cbbfae', map: plasterMap, roughness: 0.92 }),
    neighbour2: new THREE.MeshStandardMaterial({ color: '#b3a491', map: plasterMap, roughness: 0.92 }),
  }

  // Floor scale: one floor texture tile = 2.4 m
  const TILE = [2.4, 2.4]

  // ---------------- Batching ----------------
  // Every static part is collected per material and merged into one mesh.

  const batches = new Map()
  function add(material, geometry, matrix, { cast = true, receive = true } = {}) {
    const key = `${material.uuid}:${cast}:${receive}`
    let batch = batches.get(key)
    if (!batch) {
      batch = { material, cast, receive, geos: [] }
      batches.set(key, batch)
    }
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name)
    }
    g.clearGroups()
    if (matrix) g.applyMatrix4(matrix)
    batch.geos.push(g)
  }

  // Axis-aligned box from min/max corners: reads like a plan drawing
  function box(material, [x0, y0, z0], [x1, y1, z1], { tile, cast = true, receive = true } = {}) {
    const g = boxGeo(x1 - x0, y1 - y0, z1 - z0, tile)
    add(material, g, mat((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), { cast, receive })
    g.dispose()
  }

  const root = new THREE.Group()
  scene.add(root)

  // Contact shadows, so furniture sits on the floor even without shadow maps
  const blobMat = new THREE.MeshBasicMaterial({
    color: '#000',
    map: tex(T.blobTexture()),
    transparent: true,
    opacity: high ? 0.55 : 0.8,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  const blobGeo = new THREE.PlaneGeometry(1, 1)
  function blob(x, z, sx, sz = sx, y = 0.003) {
    add(blobMat, blobGeo, mat(x, y, z, { rx: -Math.PI / 2, sx, sy: sz }), { cast: false, receive: false })
  }

  // Light pools: a soft additive wash on the floor beneath a fitting
  const glowMap = tex(T.glowTexture())
  const poolMats = { interior: [], exterior: [] }
  const poolCache = new Map()
  function pool(x, y, z, size, { color = '#ffd9b0', opacity = 0.12, kind = 'interior', rx = -Math.PI / 2, ry = 0 } = {}) {
    const key = `${kind}:${color}:${opacity}`
    let material = poolCache.get(key)
    if (!material) {
      material = new THREE.MeshBasicMaterial({
        color,
        map: glowMap,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      })
      material.userData.base = opacity
      poolMats[kind].push(material)
      poolCache.set(key, material)
    }
    add(material, blobGeo, mat(x, y, z, { rx, ry, sx: size, sy: size }), { cast: false, receive: false })
  }

  // Lights, tagged with a mood channel
  const lights = []
  function light(object, kind) {
    object.userData.base = object.intensity
    object.userData.kind = kind
    scene.add(object)
    if (object.target) scene.add(object.target)
    lights.push(object)
    return object
  }

  // ---------------- Shell ----------------
  // Interior: x[-6, 6], z[-20, 0], floor y = 0, ceiling y = 3.6

  const W = 6
  const H = 3.6
  const BACK = -20

  // Travertine floor, running out through the door to the threshold
  {
    const g = new THREE.PlaneGeometry(12, 20.4)
    scaleUV(g, 12 / TILE[0], 20.4 / TILE[1])
    add(M.floor, g, mat(0, 0, -9.8, { rx: -Math.PI / 2 }), { cast: false })
    g.dispose()
  }
  // Walls
  box(M.plaster, [-W - 0.3, 0, BACK], [-W, H, 0], { tile: TILE })
  box(M.plaster, [W, 0, BACK], [W + 0.3, H, 0], { tile: TILE })
  box(M.plaster, [-W, 0, BACK - 0.3], [W, H, BACK], { tile: TILE })
  // Ceiling
  box(M.ceiling, [-W - 0.3, H, BACK - 0.3], [W + 0.3, H + 0.2, 0.4], { tile: TILE, cast: false })

  // Skirting: a shadow gap in espresso stone that lifts the walls off the floor
  box(M.espressoStone, [-W, 0, BACK], [-W + 0.012, 0.06, 0], { cast: false })
  box(M.espressoStone, [W - 0.012, 0, BACK], [W, 0.06, 0], { cast: false })

  // Ceiling coves with a continuous warm line, front and rear rooms
  function cove(z0, z1, x0 = -W, x1 = W) {
    const d = 0.5
    const y0 = H - 0.24
    box(M.ceiling, [x0, y0, z1], [x0 + d, H, z0], { cast: false })
    box(M.ceiling, [x1 - d, y0, z1], [x1, H, z0], { cast: false })
    box(M.ceiling, [x0 + d, y0, z1], [x1 - d, H, z1 + d], { cast: false })
    box(M.ceiling, [x0 + d, y0, z0 - d], [x1 - d, H, z0], { cast: false })
    const t = 0.018
    box(M.led, [x0 + d, y0 + 0.2, z1 + d], [x0 + d + t, y0 + 0.215, z0 - d], { cast: false, receive: false })
    box(M.led, [x1 - d - t, y0 + 0.2, z1 + d], [x1 - d, y0 + 0.215, z0 - d], { cast: false, receive: false })
  }
  cove(0, -12.35)
  cove(-12.65, BACK)

  // ---------------- Facade ----------------
  // Limestone front on z[0, 0.4]. Shopfront opening x[-4.6, 4.6], y[0, 3.3].

  const FZ = 0.4
  const FH = 7.6
  box(M.limestone, [-9, -0.15, 0], [-4.6, FH, FZ], { tile: [2.4, 1.8] })
  box(M.limestone, [4.6, -0.15, 0], [9, FH, FZ], { tile: [2.4, 1.8] })
  box(M.limestone, [-4.6, 3.3, 0], [4.6, FH, FZ], { tile: [2.4, 1.8] })
  // Cornice and a base course in the same stone
  box(M.limestone, [-9.15, FH, -0.1], [9.15, FH + 0.24, FZ + 0.18], { tile: [2.4, 1.8] })
  box(M.limestone, [-9.05, -0.15, FZ], [-4.6, 0.32, FZ + 0.06], { tile: [2.4, 1.8] })
  box(M.limestone, [4.6, -0.15, FZ], [9.05, 0.32, FZ + 0.06], { tile: [2.4, 1.8] })

  // Bronze portal framing the shopfront
  box(M.bronze, [-4.72, 0, FZ - 0.02], [-4.6, 3.42, FZ + 0.06])
  box(M.bronze, [4.6, 0, FZ - 0.02], [4.72, 3.42, FZ + 0.06])
  box(M.bronze, [-4.72, 3.3, FZ - 0.02], [4.72, 3.42, FZ + 0.06])

  // Glazing set back in the reveal; the door bay stands open
  const GZ = 0.16
  box(M.glass, [-4.6, 0.04, GZ - 0.01], [-0.85, 3.3, GZ + 0.01], { cast: false, receive: false })
  box(M.glass, [0.85, 0.04, GZ - 0.01], [4.6, 3.3, GZ + 0.01], { cast: false, receive: false })
  for (const x of [-4.6, -2.7, -0.85, 0.85, 2.7, 4.6]) {
    box(M.bronze, [x - 0.03, 0, GZ - 0.04], [x + 0.03, 3.3, GZ + 0.04])
  }
  box(M.bronze, [-4.6, 2.62, GZ - 0.04], [4.6, 2.68, GZ + 0.04])
  box(M.bronze, [-4.6, 0, GZ - 0.04], [-0.85, 0.08, GZ + 0.04])
  box(M.bronze, [0.85, 0, GZ - 0.04], [4.6, 0.08, GZ + 0.04])
  // Transom glass above the open door
  box(M.glass, [-0.85, 2.68, GZ - 0.01], [0.85, 3.3, GZ + 0.01], { cast: false, receive: false })

  // Canopy: a thin bronze blade with downlights
  box(M.bronze, [-4.72, 3.42, FZ], [4.72, 3.5, FZ + 0.9])

  // Threshold slab and pavement
  box(M.limestone, [-4.72, -0.15, FZ], [4.72, 0, FZ + 1.1], { tile: [2.4, 1.8], cast: false })
  {
    const g = new THREE.PlaneGeometry(90, 50)
    scaleUV(g, 90 / 4.8, 50 / 4.8)
    add(M.pavement, g, mat(0, -0.15, FZ + 25, { rx: -Math.PI / 2 }), { cast: false })
    g.dispose()
  }
  // Kerb and road beyond
  box(M.limestone, [-45, -0.3, 13.8], [45, -0.15, 14.1], { tile: [2.4, 1.8], cast: false })
  {
    const road = new THREE.MeshStandardMaterial({ color: '#4a4643', roughness: 0.9 })
    M.road = road
    const g = new THREE.PlaneGeometry(90, 40)
    add(road, g, mat(0, -0.3, 34, { rx: -Math.PI / 2 }), { cast: false })
    g.dispose()
  }

  // Upper floor windows: tall, dark, with slim bronze balconettes
  for (const x of [-6.8, -2.3, 2.3, 6.8]) {
    box(M.limestone, [x - 0.85, 5.0, FZ], [x + 0.85, 5.08, FZ + 0.12], { tile: [2.4, 1.8] })
    box(x === -2.3 ? M.windowLit : M.darkGlass, [x - 0.68, 5.08, FZ - 0.06], [x + 0.68, 7.0, FZ - 0.02])
    box(M.bronze, [x - 0.72, 5.5, FZ + 0.12], [x + 0.72, 5.53, FZ + 0.16])
    for (let i = 0; i <= 8; i++) {
      const bx = x - 0.7 + i * 0.175
      box(M.bronze, [bx - 0.008, 5.08, FZ + 0.13], [bx + 0.008, 5.5, FZ + 0.15], { receive: false })
    }
  }
  // The upper windows are punched into the stone band: frame them
  for (const x of [-6.8, -2.3, 2.3, 6.8]) {
    box(M.limestone, [x - 0.78, 7.0, FZ - 0.08], [x + 0.78, 7.08, FZ], { tile: [2.4, 1.8] })
  }

  // ELANE in dark bronze letters, halo-lit: each letter stands off the stone
  // with a warm glow behind it
  const signage = T.signageTexture('ELANE', { sub: 'BEAUTY HOUSE', color: '#4c3a2a' })
  const signHalo = T.signageTexture('ELANE', { sub: 'BEAUTY HOUSE', color: '#ffcf96', halo: 26 })
  disposables.push(signage.texture, signHalo.texture)
  const signMat = new THREE.MeshStandardMaterial({
    map: signage.texture,
    transparent: true,
    alphaTest: 0.4,
    metalness: 0.6,
    roughness: 0.38,
  })
  const signHaloMat = new THREE.MeshBasicMaterial({
    map: signHalo.texture,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const signGeo = new THREE.PlaneGeometry(4.6, 1.15)
  const signGlow = new THREE.Mesh(signGeo, signHaloMat)
  signGlow.position.set(0, 4.28, FZ + 0.006)
  const sign = new THREE.Mesh(signGeo, signMat)
  sign.position.set(0, 4.28, FZ + 0.035)
  root.add(signGlow, sign)

  // Planters either side of the door, with clipped box topiary
  const leafGeo = new THREE.IcosahedronGeometry(1, 4)
  {
    const pos = leafGeo.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const n = 1 + Math.sin(v.x * 9.1 + v.y * 4.3) * 0.025 + Math.sin(v.z * 11.7 - v.x * 3.1) * 0.025
      v.multiplyScalar(n)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    leafGeo.computeVertexNormals()
  }
  for (const x of [-5.6, 5.6]) {
    box(M.limestone, [x - 0.42, -0.15, FZ + 0.25], [x + 0.42, 0.62, FZ + 1.09], { tile: [2.4, 1.8] })
    add(M.leaf, leafGeo, mat(x, 1.08, FZ + 0.67, { sx: 0.5, sy: 0.48, sz: 0.5 }))
    add(M.leaf, leafGeo, mat(x, 1.72, FZ + 0.67, { sx: 0.32, sy: 0.3, sz: 0.32 }))
    box(M.stem, [x - 0.02, 0.6, FZ + 0.65], [x + 0.02, 1.5, FZ + 0.69])
    blob(x, FZ + 0.67, 1.5, 1.5, -0.147)
  }

  // Neighbouring buildings, kept quiet so the stone front leads
  function neighbour(x0, x1, height, material, cols) {
    box(material, [x0, -0.15, -1.2], [x1, height, -0.2], { tile: TILE })
    box(material, [x0 - 0.05, height, -1.3], [x1 + 0.05, height + 0.18, -0.06], { tile: TILE })
    const span = (x1 - x0) / cols
    for (let c = 0; c < cols; c++) {
      const cx = x0 + span * (c + 0.5)
      for (const [y0, y1] of [
        [0.6, 3.0],
        [4.0, 6.0],
      ]) {
        if (y1 > height - 0.5) continue
        const lit = rand() > 0.62
        box(lit ? M.windowLit : M.darkGlass, [cx - 0.55, y0, -0.24], [cx + 0.55, y1, -0.18])
        box(material, [cx - 0.65, y0 - 0.1, -0.2], [cx + 0.65, y0, 0.0], { tile: TILE })
      }
    }
  }
  neighbour(-30, -9.2, 7.0, M.neighbour, 9)
  neighbour(9.2, 30, 8.2, M.neighbour2, 9)

  // ---------------- Reusable furniture geometry ----------------

  // Tub chair: curved upholstered shell around a soft round cushion
  const chairParts = {
    // Low arms wrap the seat; a taller back rises behind them
    arms: shellGeo(0.235, 0.3, 0.75, 0.2, 0.03),
    back: shellGeo(0.235, 0.3, 1.95, 0.44, 0.035),
    cushion: new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.24, 0),
        new THREE.Vector2(0.272, 0.018),
        new THREE.Vector2(0.282, 0.06),
        new THREE.Vector2(0.272, 0.1),
        new THREE.Vector2(0.24, 0.118),
        new THREE.Vector2(0, 0.122),
      ],
      40,
    ),
    plinth: new THREE.CylinderGeometry(0.3, 0.29, 0.08, 40),
    pole: new THREE.CylinderGeometry(0.032, 0.04, 0.4, 20),
    base: new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0.034),
        new THREE.Vector2(0.24, 0.03),
        new THREE.Vector2(0.27, 0.018),
        new THREE.Vector2(0.272, 0.004),
        new THREE.Vector2(0.26, 0),
        new THREE.Vector2(0, 0),
      ],
      48,
    ),
    foot: new THREE.TorusGeometry(0.2, 0.011, 8, 48),
    leg: new THREE.CylinderGeometry(0.012, 0.012, 0.2, 10),
  }

  // A styling chair (pedestal) or a lounge chair (short brass legs).
  // Local forward is +x; `ry` turns it to face its station.
  function tubChair(x, z, ry, { lounge = false } = {}) {
    const seat = lounge ? 0.34 : 0.5
    const place = (geo, material, lx, ly, lz, opts = {}) => {
      const local = mat(lx, ly, lz, opts)
      add(material, geo, mat(x, 0, z, { ry }).multiply(local))
    }
    place(chairParts.plinth, M.boucle, 0, seat - 0.02, 0)
    place(chairParts.cushion, M.boucle, 0.01, seat + 0.02, 0)
    place(chairParts.arms, M.boucle, 0, seat + 0.03, 0)
    place(chairParts.back, M.boucle, -0.005, seat + 0.03, 0)
    if (lounge) {
      for (const a of [0.6, 2.2, 3.8, 5.4]) {
        place(chairParts.leg, M.brass, Math.cos(a) * 0.22, 0.12, Math.sin(a) * 0.22)
      }
    } else {
      place(chairParts.pole, M.brass, 0, 0.24, 0)
      place(chairParts.base, M.brass, 0, 0, 0)
      place(chairParts.foot, M.brass, 0.05, 0.2, 0, { rx: Math.PI / 2 })
    }
    blob(x, z, lounge ? 0.95 : 0.85)
  }

  // Product bottles: a slim lathe profile shared by every bottle in the house
  const bottleGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.028, 0),
      new THREE.Vector2(0.031, 0.006),
      new THREE.Vector2(0.031, 0.1),
      new THREE.Vector2(0.024, 0.118),
      new THREE.Vector2(0.012, 0.126),
      new THREE.Vector2(0.012, 0.14),
      new THREE.Vector2(0, 0.14),
    ],
    18,
  )
  const capGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.035, 14)
  const jarGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.05, 24)
  const packs = [M.amber, M.ivoryPack, M.sandPack, M.ivoryPack]
  function bottle(x, y, z, scale = 1, material = packs[Math.floor(rand() * packs.length)]) {
    add(material, bottleGeo, mat(x, y, z, { sx: scale, sy: scale, sz: scale }), { cast: false })
    add(M.darkCap, capGeo, mat(x, y + 0.155 * scale, z, { sx: scale, sy: scale, sz: scale }), { cast: false })
  }
  function jar(x, y, z) {
    add(M.ivoryPack, jarGeo, mat(x, y + 0.025, z), { cast: false })
    add(M.brass, jarGeo, mat(x, y + 0.056, z, { sy: 0.25 }), { cast: false })
  }

  // Opal globe pendant on a brass rod
  const globeGeo = new THREE.SphereGeometry(1, 32, 16)
  const rodGeo = new THREE.CylinderGeometry(0.006, 0.006, 1, 8)
  const canopyGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 20)
  function pendant(x, y, z, r = 0.13) {
    add(M.opal, globeGeo, mat(x, y, z, { sx: r, sy: r, sz: r }), { cast: false, receive: false })
    const len = H - (y + r)
    add(M.brass, rodGeo, mat(x, y + r + len / 2, z, { sy: len }), { cast: false })
    add(M.brass, canopyGeo, mat(x, H - 0.01, z), { cast: false })
    add(M.brass, canopyGeo, mat(x, y + r + 0.01, z, { sx: 0.4, sz: 0.4 }), { cast: false })
  }

  // Recessed downlight: a warm disc in the ceiling
  const discGeo = new THREE.CircleGeometry(0.045, 20)
  function downlight(x, z, y = H) {
    add(M.led, discGeo, mat(x, y - 0.002, z, { rx: Math.PI / 2 }), { cast: false, receive: false })
  }

  // Dried stems in a tall vase: sculptural, not decorative clutter
  function stems(x, y, z, count, height, spread) {
    const vase = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.07, 0),
        new THREE.Vector2(0.1, 0.08),
        new THREE.Vector2(0.09, 0.22),
        new THREE.Vector2(0.045, 0.3),
        new THREE.Vector2(0.05, 0.34),
        new THREE.Vector2(0.04, 0.34),
      ],
      28,
    )
    add(M.ceramic, vase, mat(x, y, z), { cast: true })
    vase.dispose()
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2
      const lean = 0.12 + rand() * spread
      const h = height * (0.7 + rand() * 0.3)
      const pts = []
      for (let k = 0; k <= 4; k++) {
        const t = k / 4
        pts.push(
          new THREE.Vector3(
            x + Math.cos(a) * lean * t * t * h * 0.5,
            y + 0.3 + t * h,
            z + Math.sin(a) * lean * t * t * h * 0.5,
          ),
        )
      }
      const curve = new THREE.CatmullRomCurve3(pts)
      const tube = new THREE.TubeGeometry(curve, 12, 0.005, 5, false)
      add(M.stem, tube, null, { cast: false })
      tube.dispose()
      // Seed heads along the upper stem
      const tip = curve.getPoint(1)
      add(M.stem, leafGeo, mat(tip.x, tip.y, tip.z, { sx: 0.035, sy: 0.09, sz: 0.035 }), { cast: false })
    }
  }

  // ---------------- Reception and lounge (z 0 → -5) ----------------

  // Fluted oak feature wall behind the desk, on the west wall
  box(M.fluted, [-W, 0.06, -5.2], [-W + 0.06, H - 0.24, -1.2], { tile: [0.32, 3.4] })
  // Brand mark in brass on the feature wall
  const innerSign = T.signageTexture('ELANE', { color: '#c9a66d' })
  const innerHalo = T.signageTexture('ELANE', { color: '#ffd7a6', halo: 22 })
  disposables.push(innerSign.texture, innerHalo.texture)
  const innerSignMat = new THREE.MeshStandardMaterial({
    map: innerSign.texture,
    transparent: true,
    alphaTest: 0.4,
    metalness: 1,
    roughness: 0.3,
    envMapIntensity: 1.5,
  })
  const innerHaloMat = new THREE.MeshBasicMaterial({
    map: innerHalo.texture,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const innerSignGeo = new THREE.PlaneGeometry(2.0, 0.5)
  const innerGlow = new THREE.Mesh(innerSignGeo, innerHaloMat)
  innerGlow.position.set(-W + 0.065, 2.62, -3.2)
  innerGlow.rotation.y = Math.PI / 2
  const innerSignMesh = new THREE.Mesh(innerSignGeo, innerSignMat)
  innerSignMesh.position.set(-W + 0.09, 2.62, -3.2)
  innerSignMesh.rotation.y = Math.PI / 2
  root.add(innerGlow, innerSignMesh)
  // Soft wash down the feature wall
  pool(-W + 0.07, 2.2, -3.2, 3.8, { opacity: 0.1, rx: 0, ry: Math.PI / 2 })

  // Curved reception desk: fluted travertine front, stone top
  {
    const cx = -4.55
    const cz = -3.2
    const r = 1.05
    // Half-angle of the curved front, centred on +x (the room side).
    // CylinderGeometry measures theta from +z toward +x.
    const half = 1.15
    const front = new THREE.CylinderGeometry(r, r, 1.0, 64, 1, true, Math.PI / 2 - half, half * 2)
    scaleUV(front, (r * half * 2) / 0.32, 1)
    add(M.flutedStone, front, mat(cx, 0.5, cz))
    front.dispose()
    // Top slab: the same sector, thin, with a slight overhang. shellGeo
    // covers the -x side, so it is turned to face the room.
    const top = shellGeo(r - 0.42, r + 0.04, Math.PI - half - 0.04, 0.04, 0.008)
    add(M.stoneTop, top, mat(cx, 1.0, cz, { ry: Math.PI }))
    top.dispose()
    // Brass kick line at the floor
    const kick = new THREE.CylinderGeometry(r - 0.03, r - 0.03, 0.05, 64, 1, true, Math.PI / 2 - half, half * 2)
    add(M.brass, kick, mat(cx, 0.025, cz))
    kick.dispose()
    // Back counter (staff side)
    box(M.oak, [cx - 0.55, 0, cz - 0.9], [cx - 0.25, 0.76, cz + 0.9], { tile: [0.6, 1.2] })
    blob(cx + 0.3, cz, 2.6, 2.4)
    // On the desk: a short stack of stems and a brass dish
    stems(cx + 0.2, 1.04, cz - 0.62, 7, 0.55, 0.5)
    const dish = new THREE.CylinderGeometry(0.11, 0.09, 0.02, 32)
    add(M.brass, dish, mat(cx + 0.55, 1.05, cz + 0.4), { cast: false })
    dish.dispose()
  }
  // Pendant trio over the desk, hung below the brand mark
  pendant(-3.95, 2.02, -2.55, 0.12)
  pendant(-3.85, 1.9, -3.2, 0.14)
  pendant(-3.95, 2.08, -3.85, 0.11)
  pool(-4.25, 0.004, -3.2, 3.2, { opacity: 0.1 })

  // Lounge by the window: two tub chairs, a round table, a rug
  {
    const rug = new THREE.CylinderGeometry(1.45, 1.45, 0.012, 64)
    add(M.rug, rug, mat(3.75, 0.006, -2.2), { cast: false })
    rug.dispose()
    tubChair(3.0, -2.7, Math.PI * 0.18, { lounge: true })
    tubChair(4.6, -2.75, Math.PI * 0.82, { lounge: true })
    const tableTop = new THREE.CylinderGeometry(0.36, 0.36, 0.035, 48)
    const tableBase = new THREE.CylinderGeometry(0.2, 0.26, 0.4, 40)
    add(M.stoneTop, tableTop, mat(3.8, 0.44, -1.75))
    add(M.espressoStone, tableBase, mat(3.8, 0.21, -1.75))
    tableTop.dispose()
    tableBase.dispose()
    blob(3.8, -1.75, 1.0)
    // Books and a small vessel on the table
    box(M.ivoryPack, [3.62, 0.458, -1.86], [3.9, 0.49, -1.66])
    box(M.sandPack, [3.64, 0.49, -1.84], [3.88, 0.512, -1.68])
    stems(4.0, 0.458, -1.6, 4, 0.32, 0.4)
  }
  pendant(3.8, 2.3, -2.0, 0.17)

  // ---------------- Styling floor (z -5 → -12.5) ----------------

  const STATIONS = [-5.4, -7.2, -9.0, -10.8]

  // Fluted panelling along the station wall
  box(M.fluted, [W - 0.06, 0.06, -11.8], [W, H - 0.24, -4.4], { tile: [0.32, 3.4] })

  const mirrorShape = archShape(0.94, 1.92)
  const mirrorGeo = new THREE.ShapeGeometry(mirrorShape, 40)
  const haloGeo = new THREE.ShapeGeometry(archShape(1.08, 2.06), 40)
  const frameShape = archShape(0.99, 1.965)
  frameShape.holes.push(archShape(0.99, 1.965, 0.025))
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.03, bevelEnabled: false, curveSegments: 40 })

  const mirrors = []
  STATIONS.forEach((z, i) => {
    const y0 = 0.86
    // Halo: the LED wash behind the mirror reads as a soft outline of light
    add(M.halo, haloGeo, mat(W - 0.065, y0 - 0.07, z, { ry: -Math.PI / 2 }), { cast: false, receive: false })
    add(M.brass, frameGeo, mat(W - 0.11, y0 - 0.0225, z, { ry: -Math.PI / 2 }), { cast: false })
    const mirror = new THREE.Mesh(mirrorGeo, M.mirror)
    mirror.position.set(W - 0.105, y0, z)
    mirror.rotation.y = -Math.PI / 2
    mirror.updateMatrix()
    mirror.matrixAutoUpdate = false
    root.add(mirror)
    mirrors.push(mirror)

    // Floating stone console with a brass edge
    box(M.stoneTop, [W - 0.5, 0.78, z - 0.55], [W - 0.06, 0.82, z + 0.55])
    box(M.brass, [W - 0.505, 0.775, z - 0.55], [W - 0.495, 0.825, z + 0.55], { cast: false })
    // On the console: products, a jar, a brass tray with tools
    bottle(W - 0.2, 0.82, z + 0.38, 1.1)
    bottle(W - 0.16, 0.82, z + 0.3, 0.9)
    jar(W - 0.3, 0.82, z - 0.42)
    box(M.brass, [W - 0.42, 0.82, z - 0.3], [W - 0.2, 0.83, z - 0.06], { cast: false })
    box(M.darkCap, [W - 0.38, 0.83, z - 0.24], [W - 0.36, 0.842, z - 0.1], { cast: false })
    box(M.darkCap, [W - 0.32, 0.83, z - 0.26], [W - 0.3, 0.842, z - 0.08], { cast: false })

    tubChair(W - 1.05, z, 0)

    // Ivory trolley between stations (not after the last)
    if (i < STATIONS.length - 1 && i % 2 === 0) {
      const tz = z - 0.9
      const trolley = new RoundedBoxGeometry(0.36, 0.72, 0.36, 2, 0.02)
      add(M.ivoryPack, trolley, mat(W - 0.42, 0.42, tz))
      trolley.dispose()
      for (let d = 0; d < 3; d++) box(M.brass, [W - 0.605, 0.3 + d * 0.2, tz - 0.06], [W - 0.6, 0.31 + d * 0.2, tz + 0.06], { cast: false })
      blob(W - 0.42, tz, 0.6)
    }

    // A globe between each pair of mirrors, and a downlight over each chair
    if (i > 0) pendant(W - 0.45, 2.55, z + 0.9, 0.11)
    downlight(W - 1.0, z, H - 0.24)
    pool(W - 1.05, 0.004, z, 2.0, { opacity: 0.1 })
  })
  frameGeo.dispose()
  haloGeo.dispose()

  // Product wall: two arched, backlit niches in oak on the west wall
  const nicheShape = archShape(1.3, 2.5)
  const nicheFrame = archShape(1.5, 2.7)
  nicheFrame.holes.push(archShape(1.5, 2.7, 0.1, 0.1))
  const nicheFrameGeo = new THREE.ExtrudeGeometry(nicheFrame, { depth: 0.32, bevelEnabled: false, curveSegments: 32 })
  scaleUV(nicheFrameGeo, 1 / 1.2, 1 / 1.2)
  const nicheBackGeo = new THREE.ShapeGeometry(nicheShape, 32)
  for (const z of [-6.9, -9.6]) {
    const y0 = 0.25
    add(M.oak, nicheFrameGeo, mat(-W, y0, z, { ry: Math.PI / 2 }))
    add(M.nicheGlow, nicheBackGeo, mat(-W + 0.02, y0 + 0.1, z, { ry: Math.PI / 2 }), { cast: false, receive: false })
    // Oak plinth below
    box(M.oak, [-W, 0, z - 0.75], [-W + 0.34, y0, z + 0.75], { tile: [0.6, 1.2] })
    // Glass shelves with products
    for (const y of [0.85, 1.35, 1.85]) {
      box(M.stoneTop, [-W + 0.02, y0 + y - 0.02, z - 0.55], [-W + 0.3, y0 + y, z + 0.55], { cast: false })
      const count = 5 + Math.floor(rand() * 3)
      for (let k = 0; k < count; k++) {
        const bz = z - 0.45 + (k / (count - 1)) * 0.9
        if (rand() > 0.75) jar(-W + 0.16, y0 + y, bz)
        else bottle(-W + 0.16, y0 + y, bz, 0.85 + rand() * 0.35)
      }
    }
    pool(-W + 0.4, 0.004, z, 2.2, { opacity: 0.08 })
  }
  nicheFrameGeo.dispose()
  nicheBackGeo.dispose()

  // Bench between the niches
  {
    const seat = new RoundedBoxGeometry(0.46, 0.16, 1.1, 3, 0.05)
    add(M.boucle, seat, mat(-W + 0.42, 0.44, -8.25))
    seat.dispose()
    box(M.oak, [-W + 0.2, 0, -8.75], [-W + 0.64, 0.36, -7.75], { tile: [0.6, 1.2] })
    blob(-W + 0.42, -8.25, 0.9, 1.5)
  }

  // Linear pendant down the centre of the floor
  box(M.brass, [-0.02, 2.75, -10.6], [0.02, 2.79, -5.6], { cast: false })
  box(M.led, [-0.015, 2.745, -10.55], [0.015, 2.75, -5.65], { cast: false, receive: false })
  for (const z of [-5.8, -10.4]) {
    const len = H - 0.24 - 2.79
    add(M.brass, rodGeo, mat(0, 2.79 + len / 2, z, { sy: len }), { cast: false })
  }
  pool(0, 0.004, -8.1, 4.5, { opacity: 0.07 })

  // ---------------- The arch (z = -12.5) ----------------

  {
    const ARCH_W = 3.0
    const ARCH_H = 3.0
    const shape = new THREE.Shape()
    shape.moveTo(-W, 0)
    shape.lineTo(W, 0)
    shape.lineTo(W, H)
    shape.lineTo(-W, H)
    shape.lineTo(-W, 0)
    shape.holes.push(archShape(ARCH_W, ARCH_H, 0, 0.002))
    const wall = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false, curveSegments: 48 })
    scaleUV(wall, 1 / TILE[0], 1 / TILE[1])
    add(M.plaster, wall, mat(0, 0, -12.65))
    wall.dispose()
    const trim = new THREE.ExtrudeGeometry(archBand(ARCH_W, ARCH_H, 0.025), {
      depth: 0.32,
      bevelEnabled: false,
      curveSegments: 48,
    })
    add(M.brass, trim, mat(0, 0, -12.66), { cast: false })
    trim.dispose()
  }

  // ---------------- Ritual lounge (z -12.5 → -20) ----------------

  // Oak slatted wall behind the basins, over a dark shadow gap
  box(M.slatBack, [-W, 0, BACK], [W, H - 0.24, BACK + 0.02], { cast: false })
  for (let x = -W + 0.06; x < W - 0.03; x += 0.09) {
    box(M.slat, [x - 0.024, 0, BACK + 0.02], [x + 0.024, H - 0.24, BACK + 0.06], { tile: [0.6, 1.2] })
  }

  // Backlit oval in the ceiling: diffuse, sky-like, the room's main light
  {
    const oval = new THREE.CircleGeometry(1, 64)
    add(M.skylight, oval, mat(0, H - 0.005, -16.3, { rx: Math.PI / 2, sx: 3.0, sy: 1.7 }), { cast: false, receive: false })
    const ring = new THREE.RingGeometry(0.97, 1.0, 64)
    add(M.brass, ring, mat(0, H - 0.008, -16.3, { rx: Math.PI / 2, sx: 3.06, sy: 1.75 }), { cast: false })
    oval.dispose()
    ring.dispose()
  }
  pool(0, 0.004, -16.6, 6.0, { opacity: 0.07, color: '#fff0de' })

  // Wash units: stone cabinet, ceramic basin, brass spout, reclined chair
  const basinGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.001, -0.2),
      new THREE.Vector2(0.14, -0.19),
      new THREE.Vector2(0.25, -0.13),
      new THREE.Vector2(0.3, -0.04),
      new THREE.Vector2(0.305, 0),
      new THREE.Vector2(0.28, 0.0),
      new THREE.Vector2(0.265, -0.04),
      new THREE.Vector2(0.22, -0.11),
      new THREE.Vector2(0.12, -0.155),
      new THREE.Vector2(0.001, -0.165),
    ],
    48,
  )
  const spoutGeo = new THREE.TorusGeometry(0.12, 0.012, 10, 24, Math.PI)
  // Recliner: one continuous upholstered profile (leg rest, seat, raked back)
  // drawn in side elevation and extruded across the seat width
  const recliner = (() => {
    const v2 = (u, v) => new THREE.Vector2(u, v)
    const shape = new THREE.Shape()
    shape.moveTo(-0.8, 0.86)
    shape.splineThru([v2(-0.52, 0.66), v2(-0.24, 0.52), v2(0.08, 0.49), v2(0.4, 0.48), v2(0.68, 0.43), v2(0.95, 0.36)])
    shape.lineTo(0.96, 0.25)
    shape.splineThru([v2(0.66, 0.31), v2(0.36, 0.35), v2(0.0, 0.36), v2(-0.32, 0.41), v2(-0.62, 0.6), v2(-0.84, 0.75)])
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.56,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.035,
      bevelSegments: 4,
      curveSegments: 28,
    })
    // Shape u runs along world z, the extrusion across world x
    g.rotateY(-Math.PI / 2)
    g.translate(0.28, 0, 0)
    return g
  })()
  const armGeo = new RoundedBoxGeometry(0.07, 0.08, 0.56, 2, 0.03)

  const BASINS = [-2.6, 0.4, 3.4]
  for (const x of BASINS) {
    const bz = BACK + 0.62
    // Cabinet: fluted ivory stone with a stone top that holds the basin
    box(M.flutedStone, [x - 0.45, 0, BACK + 0.06], [x + 0.45, 0.76, BACK + 0.82], { tile: [0.32, 0.76] })
    box(M.stoneTop, [x - 0.47, 0.76, BACK + 0.06], [x + 0.47, 0.8, BACK + 0.84])
    box(M.brass, [x - 0.45, 0, BACK + 0.82], [x + 0.45, 0.03, BACK + 0.83], { cast: false })
    add(M.ceramic, basinGeo, mat(x, 0.97, bz, { rx: 0.18 }))
    // Basin pedestal into the cabinet top
    box(M.ceramic, [x - 0.12, 0.8, bz - 0.12], [x + 0.12, 0.84, bz + 0.12])
    // Spout from the slatted wall
    add(M.brass, spoutGeo, mat(x, 1.12, BACK + 0.25, { ry: Math.PI / 2, sx: 1.6 }), { cast: false })
    box(M.brass, [x - 0.02, 0.8, BACK + 0.06], [x + 0.02, 1.12, BACK + 0.1], { cast: false })

    // Reclined chair facing the room, its head at the basin
    const sz = BACK + 1.63
    add(M.leather, recliner, mat(x, 0, sz))
    for (const side of [-1, 1]) add(M.leather, armGeo, mat(x + side * 0.33, 0.6, sz + 0.05))
    box(M.espressoStone, [x - 0.22, 0, sz - 0.22], [x + 0.22, 0.36, sz + 0.3])
    box(M.brass, [x - 0.23, 0, sz - 0.23], [x + 0.23, 0.02, sz + 0.31], { cast: false })
    blob(x, sz, 1.0, 1.9)
    downlight(x, sz - 0.2)
  }
  recliner.dispose()
  armGeo.dispose()

  // Side tables with rolled towels between the basins
  const towelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.34, 20)
  for (const x of [-1.1, 1.9]) {
    box(M.stoneTop, [x - 0.28, 0, BACK + 0.15], [x + 0.28, 0.58, BACK + 0.6])
    const rows = [
      [-0.13, 0, 0.13],
      [-0.065, 0.065],
      [0],
    ]
    rows.forEach((row, r) => {
      for (const ox of row) add(M.towel, towelGeo, mat(x + ox, 0.64 + r * 0.105, BACK + 0.38, { rx: Math.PI / 2 }), { cast: false })
    })
  }

  // Skin ritual corner: a treatment bed along the west wall
  {
    const bx = -4.6
    const bz = -17.35
    const bed = new RoundedBoxGeometry(0.75, 0.16, 1.95, 3, 0.06)
    add(M.boucle, bed, mat(bx, 0.72, bz))
    bed.dispose()
    const pillow = new RoundedBoxGeometry(0.42, 0.1, 0.28, 3, 0.04)
    add(M.towel, pillow, mat(bx, 0.84, bz - 0.75))
    pillow.dispose()
    box(M.oak, [bx - 0.3, 0, bz - 0.8], [bx + 0.3, 0.64, bz + 0.8], { tile: [0.6, 1.2] })
    blob(bx, bz, 1.4, 2.6)
    // Folded towels at the foot
    box(M.towel, [bx - 0.25, 0.8, bz + 0.6], [bx + 0.25, 0.86, bz + 0.88])
    box(M.towel, [bx - 0.22, 0.86, bz + 0.62], [bx + 0.22, 0.9, bz + 0.85])
    pool(bx, 0.004, bz, 2.6, { opacity: 0.08 })
  }
  stems(-5.4, 0, -19.4, 9, 1.25, 0.55)

  // Opal half-moon sconces on the side walls of the ritual room
  const sconceGeo = new THREE.SphereGeometry(0.14, 24, 12, 0, Math.PI)
  for (const z of [-14.4, -17.8]) {
    add(M.opal, sconceGeo, mat(W - 0.01, 1.9, z, { ry: -Math.PI / 2 }), { cast: false, receive: false })
    add(M.opal, sconceGeo, mat(-W + 0.01, 1.9, z, { ry: Math.PI / 2 }), { cast: false, receive: false })
    pool(W - 0.02, 1.9, z, 1.6, { opacity: 0.12, rx: 0, ry: -Math.PI / 2 })
    pool(-W + 0.02, 1.9, z, 1.6, { opacity: 0.12, rx: 0, ry: Math.PI / 2 })
  }

  // ---------------- Lighting ----------------

  const hemi = new THREE.HemisphereLight('#fff2e2', '#a8927a', MOODS.evening.hemi)
  scene.add(hemi)

  // Daylight sun (off in the evening mood)
  const sun = new THREE.DirectionalLight('#fff1dc', 0)
  sun.position.set(14, 22, 30)
  sun.target.position.set(0, 2, 0)
  scene.add(sun, sun.target)

  const warm = '#ffe1c0'

  // Front room: reception and lounge
  light(new THREE.PointLight(warm, high ? 7 : 11, 9, 2), 'interior').position.set(-3.6, 2.6, -3.0)
  light(new THREE.PointLight(warm, high ? 5 : 8, 8, 2), 'interior').position.set(3.6, 2.5, -2.2)

  // Styling floor: one spot over each pair of stations, and a soft fill.
  // Every dynamic light costs every pixel, so the smaller fittings are
  // carried by emissive discs and floor pools instead.
  for (const z of [-6.3, -9.9]) {
    const spot = new THREE.SpotLight(warm, high ? 24 : 26, 7.5, 0.95, 0.85, 2)
    spot.position.set(W - 1.6, H - 0.25, z)
    spot.target.position.set(W - 0.6, 0.6, z)
    if (high) {
      spot.castShadow = true
      spot.shadow.mapSize.set(1024, 1024)
      spot.shadow.bias = -0.0004
      spot.shadow.normalBias = 0.02
      spot.shadow.radius = 4
      spot.shadow.camera.near = 0.4
      spot.shadow.camera.far = 6
    }
    light(spot, 'interior')
  }
  light(new THREE.PointLight(warm, high ? 6 : 10, 10, 2), 'interior').position.set(-2.5, 2.8, -8.2)

  // Ritual lounge: lower, softer, a touch warmer
  const ritualKey = new THREE.PointLight('#ffe0bf', high ? 9 : 13, 10, 2)
  ritualKey.position.set(0, 3.2, -16.3)
  light(ritualKey, 'interior')
  if (high) {
    const basinSpot = new THREE.SpotLight('#ffcf9e', 10, 6, 0.9, 0.9, 2)
    basinSpot.position.set(0, H - 0.1, -17.2)
    basinSpot.target.position.set(0, 0.4, -19.2)
    basinSpot.castShadow = true
    basinSpot.shadow.mapSize.set(1024, 1024)
    basinSpot.shadow.bias = -0.0004
    basinSpot.shadow.normalBias = 0.02
    basinSpot.shadow.radius = 5
    basinSpot.shadow.camera.near = 0.4
    basinSpot.shadow.camera.far = 6
    light(basinSpot, 'interior')
  }

  // Exterior: one broad canopy downlight (the discs and pools carry the rest)
  {
    const down = new THREE.SpotLight('#ffd5a6', high ? 26 : 30, 7, 1.1, 0.8, 2)
    down.position.set(0, 3.4, FZ + 0.6)
    down.target.position.set(0, 0, FZ + 1.8)
    light(down, 'exterior')
  }
  // Narrow grazers either side of the portal: a soft scallop up the stone
  for (const x of high ? [-5.3, 5.3] : []) {
    const graze = new THREE.SpotLight('#ffdcb8', high ? 12 : 16, 9, 0.22, 1, 2)
    graze.position.set(x, 0.02, FZ + 0.3)
    graze.target.position.set(x, 7, FZ - 0.1)
    light(graze, 'exterior')
  }
  // Sign wash from the top of the canopy
  const signWash = new THREE.SpotLight('#ffe2bd', high ? 9 : 12, 6, 0.8, 1, 2)
  signWash.position.set(0, 3.55, FZ + 1.3)
  signWash.target.position.set(0, 4.8, FZ)
  light(signWash, 'exterior')
  for (const x of [-3.2, 0, 3.2]) {
    add(M.led, discGeo, mat(x, 3.418, FZ + 0.55, { rx: Math.PI / 2 }), { cast: false, receive: false })
    pool(x, -0.146, FZ + 1.5, 2.6, { opacity: 0.14, kind: 'exterior' })
  }
  // Interior spill onto the pavement
  pool(0, -0.146, FZ + 2.2, 9, { opacity: 0.06, kind: 'exterior', color: '#ffcf9a' })

  // ---------------- Sky ----------------

  const sky = createSky()
  scene.add(sky.mesh)

  // ---------------- Merge ----------------

  for (const batch of batches.values()) {
    const merged = mergeGeometries(batch.geos, false)
    for (const g of batch.geos) g.dispose()
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, batch.material)
    mesh.castShadow = batch.cast && high
    mesh.receiveShadow = batch.receive && high
    mesh.matrixAutoUpdate = false
    root.add(mesh)
  }
  batches.clear()
  for (const g of Object.values(chairParts)) g.dispose()
  ;[blobGeo, bottleGeo, capGeo, jarGeo, globeGeo, rodGeo, canopyGeo, discGeo, leafGeo, basinGeo, spoutGeo, towelGeo, sconceGeo].forEach(
    (g) => g.dispose(),
  )

  // ---------------- Reflections ----------------
  // A neutral studio environment first, then the room itself is captured once
  // from the middle of the styling floor. Mirrors reflect that capture, and a
  // prefiltered copy lights every surface, so stone, brass and glass all pick
  // up the same warm room rather than a generic studio.

  const pmrem = new THREE.PMREMGenerator(renderer)
  const studio = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = studio.texture
  scene.environmentIntensity = 0.25

  const cubeTarget = new THREE.WebGLCubeRenderTarget(high ? 512 : 256, { type: THREE.HalfFloatType })
  const cubeCamera = new THREE.CubeCamera(0.05, 120, cubeTarget)
  cubeCamera.position.set(0, 1.55, -8.2)
  scene.add(cubeCamera)

  let roomEnv = null
  function captureRoom() {
    for (const m of mirrors) m.visible = false
    renderer.shadowMap.needsUpdate = true
    cubeCamera.update(renderer, scene)
    for (const m of mirrors) m.visible = true
    roomEnv?.dispose()
    roomEnv = pmrem.fromCubemap(cubeTarget.texture)
    scene.environment = roomEnv.texture
    scene.environmentIntensity = 0.55
    M.mirror.envMap = cubeTarget.texture
    M.mirror.needsUpdate = true
    renderer.shadowMap.needsUpdate = true
  }

  // ---------------- Camera path ----------------
  // One curve per chapter segment, through that segment's via points. The
  // camera rests at every chapter mark, so the joins are never seen in motion.

  const v3 = (a) => new THREE.Vector3(...a)
  const segments = []
  for (let i = 0; i < chapters.length - 1; i++) {
    const from = chapters[i]
    const to = chapters[i + 1]
    const curve = (stops, key) =>
      stops.length > 2
        ? new THREE.CatmullRomCurve3(stops.map((s) => v3(s[key])), false, 'centripetal')
        : new THREE.LineCurve3(v3(stops[0][key]), v3(stops[1][key]))
    const stops = [from.camera, ...(to.via || []), to.camera]
    const segment = { pos: curve(stops, 'position'), target: curve(stops, 'target'), from, to }
    // Chapters may give phones their own framing; that path is blended in by
    // how portrait the screen is, so landscape screens never see it.
    if (from.portraitCamera || to.portraitCamera) {
      const tall = [from.portraitCamera || from.camera, ...(to.via || []), to.portraitCamera || to.camera]
      segment.posTall = curve(tall, 'position')
      segment.targetTall = curve(tall, 'target')
    }
    segments.push(segment)
  }
  // Pointer parallax: generous on the street, tiny indoors so the camera
  // never leans into a mirror or a chair
  const parallaxFor = (chapter) => (chapter.id === 'arrival' ? 0.5 : chapter.id === 'transformation' ? 0.03 : 0.08)

  // ---------------- State & loop ----------------

  const state = {
    progress: 0,
    progressTarget: 0,
    pointer: new THREE.Vector2(),
    pointerTarget: new THREE.Vector2(),
    mood: 0,
    moodTarget: 0,
    active: true,
    frame: 0,
    last: 0,
    width: 1,
    height: 1,
    portrait: 0,
  }

  const camPos = new THREE.Vector3()
  const camTarget = new THREE.Vector3()
  const right = new THREE.Vector3()
  const camUp = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const tmp = new THREE.Vector3()

  const ledBase = M.led.color.clone()
  const haloBase = M.halo.color.clone()
  const opalBase = M.opal.color.clone()
  const nicheBase = M.nicheGlow.color.clone()
  const skyBase = M.skylight.color.clone()

  function applyMood(t) {
    const a = MOODS.evening
    const b = MOODS.daylight
    sky.uniforms.topColor.value.copy(a.skyTop).lerp(b.skyTop, t)
    sky.uniforms.horizonColor.value.copy(a.skyHorizon).lerp(b.skyHorizon, t)
    sky.uniforms.glowColor.value.copy(a.glow).lerp(b.glow, t)
    sky.uniforms.glowStrength.value = lerp(a.glowStrength, b.glowStrength, t)
    scene.fog.color.copy(a.fog).lerp(b.fog, t)
    hemi.intensity = lerp(a.hemi, b.hemi, t)
    sun.intensity = lerp(a.sun, b.sun, t)
    const scale = {
      interior: lerp(a.interior, b.interior, t),
      exterior: lerp(a.exterior, b.exterior, t),
    }
    for (const l of lights) l.intensity = l.userData.base * scale[l.userData.kind]
    for (const [kind, materials] of Object.entries(poolMats)) {
      for (const m of materials) m.opacity = m.userData.base * scale[kind]
    }
    M.led.color.copy(ledBase).multiplyScalar(scale.interior)
    M.halo.color.copy(haloBase).multiplyScalar(scale.interior)
    M.opal.color.copy(opalBase).multiplyScalar(scale.interior)
    M.nicheGlow.color.copy(nicheBase).multiplyScalar(lerp(1, 0.92, t))
    M.skylight.color.copy(skyBase).multiplyScalar(lerp(1, 1.1, t))
    M.windowLit.emissiveIntensity = 0.24 * lerp(a.windows, b.windows, t)
    signHaloMat.opacity = 0.95 * Math.max(scale.exterior, 0.12)
    innerHaloMat.opacity = 0.8 * scale.interior
    renderer.toneMappingExposure = lerp(a.exposure, b.exposure, t)
  }

  function updateCamera() {
    const { index, travel } = segmentAt(state.progress, segments.length)
    const seg = segments[index]
    seg.pos.getPointAt(travel, camPos)
    seg.target.getPointAt(travel, camTarget)
    if (seg.posTall && state.portrait > 0) {
      camPos.lerp(seg.posTall.getPointAt(travel, tmp), state.portrait)
      camTarget.lerp(seg.targetTall.getPointAt(travel, tmp), state.portrait)
    }

    // Portrait screens: step back along the view axis where the chapter allows
    if (state.portrait > 0) {
      const push = lerp(seg.from.portraitPush || 0, seg.to.portraitPush || 0, travel) * state.portrait
      if (push > 0) {
        forward.subVectors(camPos, camTarget)
        camPos.addScaledVector(forward, push)
      }
    }

    camera.position.copy(camPos)
    camera.lookAt(camTarget)

    if (state.pointer.lengthSq() > 1e-6) {
      const amount = lerp(parallaxFor(seg.from), parallaxFor(seg.to), travel)
      right.setFromMatrixColumn(camera.matrix, 0)
      camUp.setFromMatrixColumn(camera.matrix, 1)
      camera.position.addScaledVector(right, state.pointer.x * amount)
      camera.position.addScaledVector(camUp, state.pointer.y * amount * 0.5)
      camera.lookAt(camTarget)
    }
  }

  function render() {
    updateCamera()
    if (composer) composer.render()
    else renderer.render(scene, camera)
    if (onRender) onRender(project, state.progress)
  }

  function project(position) {
    tmp.set(position[0], position[1], position[2]).project(camera)
    return {
      x: (tmp.x * 0.5 + 0.5) * state.width,
      y: (-tmp.y * 0.5 + 0.5) * state.height,
      visible: tmp.z < 1 && Math.abs(tmp.x) < 0.92 && Math.abs(tmp.y) < 0.88,
    }
  }

  function tick(now) {
    state.frame = 0
    if (!state.active) return
    const dt = Math.min((now - (state.last || now)) / 1000, 0.1)
    state.last = now

    // Frame-rate independent damping
    const kProgress = 1 - Math.exp(-dt * 4.5)
    const kPointer = 1 - Math.exp(-dt * 3)
    const kMood = 1 - Math.exp(-dt * 2.2)

    state.progress += (state.progressTarget - state.progress) * kProgress
    state.pointer.lerp(state.pointerTarget, kPointer)
    state.mood += (state.moodTarget - state.mood) * kMood
    applyMood(state.mood)
    render()
    govern(dt)

    const settled =
      Math.abs(state.progressTarget - state.progress) < 1e-4 &&
      state.pointer.distanceToSquared(state.pointerTarget) < 1e-6 &&
      Math.abs(state.moodTarget - state.mood) < 1e-3

    if (settled) {
      state.progress = state.progressTarget
      state.pointer.copy(state.pointerTarget)
      state.mood = state.moodTarget
      state.last = 0
      applyMood(state.mood)
      render()
      return
    }
    state.frame = requestAnimationFrame(tick)
  }

  function invalidate() {
    if (!state.frame && state.active) state.frame = requestAnimationFrame(tick)
  }

  // Frame-time governor: measured only while the camera is moving. If frames
  // consistently take longer than ~30 fps, render fewer pixels (and drop the
  // bloom pass); never below 0.6 of the starting resolution.
  const perf = { sum: 0, count: 0 }
  function govern(dt) {
    if (dt <= 0) return
    perf.sum += dt
    perf.count++
    if (perf.count < 45) return
    const average = perf.sum / perf.count
    perf.sum = 0
    perf.count = 0
    if (average > 1 / 32 && qualityScale > 0.6) {
      qualityScale = Math.max(0.6, qualityScale * 0.8)
      if (bloom && qualityScale < 0.7) bloom.enabled = false
      resize(state.width, state.height)
    }
  }

  function resize(width, height) {
    state.width = Math.max(1, width)
    state.height = Math.max(1, height)
    const fit = Math.sqrt(pixelBudget / (state.width * state.height))
    pixelRatio = Math.max(0.6, Math.min(maxRatio, fit) * qualityScale)
    renderer.setPixelRatio(pixelRatio)
    const aspect = state.width / state.height
    // 0 on landscape, rising to 1 on a tall phone
    state.portrait = clamp01((1.05 - aspect) / 0.55)
    camera.aspect = aspect
    camera.fov = aspect >= 1.6 ? 40 : aspect >= 1.25 ? 46 : aspect >= 0.85 ? 54 : 64
    // On portrait screens the chapter text sits in the lower half, so shift
    // the optical centre up to keep the subject in the visible area.
    if (state.portrait > 0) {
      camera.setViewOffset(state.width, state.height, 0, state.height * 0.17 * state.portrait, state.width, state.height)
    } else camera.clearViewOffset()
    camera.updateProjectionMatrix()
    renderer.setSize(state.width, state.height, false)
    if (composer) {
      composer.setPixelRatio(pixelRatio)
      composer.setSize(state.width, state.height)
    }
    render()
  }

  // ---------------- Context loss ----------------

  const onLost = (event) => {
    event.preventDefault()
    state.active = false
    if (onContextLost) onContextLost()
  }
  canvas.addEventListener('webglcontextlost', onLost)

  applyMood(0)
  captureRoom()
  // Redraw the signs once the brand face has arrived
  Promise.all([signage.ready, signHalo.ready, innerSign.ready, innerHalo.ready]).then(() => invalidate())

  return {
    setProgress(value, { instant = false } = {}) {
      state.progressTarget = clamp01(value)
      if (instant) state.progress = state.progressTarget
      invalidate()
    },
    setPointer(x, y) {
      state.pointerTarget.set(x, y)
      invalidate()
    },
    setMood(value, { instant = false } = {}) {
      state.moodTarget = value
      if (instant) {
        state.mood = value
        applyMood(value)
      }
      invalidate()
    },
    setActive(active) {
      state.active = active
      if (active) invalidate()
      else if (state.frame) {
        cancelAnimationFrame(state.frame)
        state.frame = 0
        state.last = 0
      }
    },
    resize,
    render,
    // Diagnostics for QA tooling
    stats() {
      return {
        quality,
        pixelRatio: Number(pixelRatio.toFixed(2)),
        qualityScale: Number(qualityScale.toFixed(2)),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        lights: lights.length,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
      }
    },
    dispose() {
      state.active = false
      if (state.frame) cancelAnimationFrame(state.frame)
      canvas.removeEventListener('webglcontextlost', onLost)
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) material?.dispose?.()
      })
      for (const l of lights) l.shadow?.map?.dispose()
      for (const texture of disposables) texture.dispose()
      for (const material of Object.values(M)) material?.dispose?.()
      mirrorGeo.dispose()
      studio.dispose()
      roomEnv?.dispose()
      cubeTarget.dispose()
      pmrem.dispose()
      bloom?.dispose()
      output?.dispose()
      composer?.dispose()
      renderer.dispose()
    },
  }
}
