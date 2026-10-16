// Procedural canvas textures for the Elane scene.
// Everything is drawn at load time, so the 3D view downloads no image files.

import * as THREE from 'three'

// Seeded random so the composition is identical on every visit.
export function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function canvasTexture(width, height, draw, { srgb = true, repeat, anisotropy = 4 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeat[0], repeat[1])
  }
  texture.anisotropy = anisotropy
  return texture
}

function speckle(ctx, w, h, rand, count, rgb, alpha, size = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(${rgb}, ${alpha * (0.4 + rand() * 0.6)})`
    const s = 0.5 + rand() * size
    ctx.fillRect(rand() * w, rand() * h, s, s)
  }
}

function mottle(ctx, w, h, rand, count, dark, light, rMin = 20, rMax = 80) {
  for (let i = 0; i < count; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = rMin + rand() * (rMax - rMin)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, rand() > 0.5 ? dark : light)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
}

// Honed travertine floor in large-format tiles (one tile = 2.4 m square,
// laid as 1.2 × 0.6 m slabs in a running bond).
export function travertineFloorTexture(rand) {
  return canvasTexture(
    1024,
    1024,
    (ctx, w, h) => {
      ctx.fillStyle = '#e4d9ca'
      ctx.fillRect(0, 0, w, h)
      const cols = 2
      const rows = 4
      const tw = w / cols
      const th = h / rows
      for (let r = 0; r < rows; r++) {
        const offset = r % 2 ? tw / 2 : 0
        for (let c = -1; c <= cols; c++) {
          const x = c * tw + offset
          const v = rand() * 10 - 5
          ctx.fillStyle = `rgb(${226 + v}, ${216 + v}, ${201 + v})`
          ctx.fillRect(x, r * th, tw, th)
          // Directional veining: travertine is cut along the bed
          for (let i = 0; i < 22; i++) {
            const y = r * th + rand() * th
            ctx.fillStyle = `rgba(${168 + rand() * 30}, ${146 + rand() * 24}, ${118 + rand() * 18}, ${0.04 + rand() * 0.07})`
            ctx.fillRect(x + rand() * tw * 0.4, y, tw * (0.25 + rand() * 0.6), 1 + rand() * 2.5)
          }
        }
      }
      mottle(ctx, w, h, rand, 90, 'rgba(150,128,100,0.025)', 'rgba(255,250,240,0.03)', 60, 180)
      // Pores
      speckle(ctx, w, h, rand, 1800, '140, 118, 92', 0.22, 2.2)
      // Fine joints
      ctx.fillStyle = 'rgba(120, 102, 80, 0.32)'
      for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * th - 1, w, 2)
      for (let r = 0; r < rows; r++) {
        const offset = r % 2 ? tw / 2 : 0
        for (let x = offset; x <= w; x += tw) ctx.fillRect(x - 1, r * th, 2, th)
      }
    },
    { repeat: [1, 1], anisotropy: 8 },
  )
}

// Roughness for the floor: honed stone with a slightly more polished path
export function floorRoughnessTexture(rand) {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = 'rgb(105,105,105)'
      ctx.fillRect(0, 0, w, h)
      mottle(ctx, w, h, rand, 40, 'rgba(70,70,70,0.4)', 'rgba(150,150,150,0.4)', 20, 60)
    },
    { srgb: false, repeat: [1, 1] },
  )
}

// Pale coursed limestone for the facade (one tile = 2.4 m × 1.8 m)
export function limestoneTexture(rand) {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#e6dccd'
      ctx.fillRect(0, 0, w, h)
      mottle(ctx, w, h, rand, 60, 'rgba(130,112,88,0.014)', 'rgba(250,244,232,0.018)', 60, 160)
      speckle(ctx, w, h, rand, 1600, '110, 94, 72', 0.1, 1.4)
      const course = h / 3
      for (let row = 0; row < 3; row++) {
        const y = row * course
        ctx.fillStyle = 'rgba(96, 82, 62, 0.32)'
        ctx.fillRect(0, y, w, 2)
        ctx.fillStyle = 'rgba(255, 250, 238, 0.2)'
        ctx.fillRect(0, y + 2, w, 1)
        const offset = row % 2 ? w / 4 : 0
        ctx.fillStyle = 'rgba(96, 82, 62, 0.24)'
        for (let x = offset; x < w + 1; x += w / 2) ctx.fillRect(x, y, 2, course)
      }
    },
    { repeat: [1, 1] },
  )
}

// Warm lime plaster: soft, cloudy, no pattern
export function plasterTexture(rand) {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#efe7dc'
      ctx.fillRect(0, 0, w, h)
      mottle(ctx, w, h, rand, 110, 'rgba(176,156,130,0.018)', 'rgba(255,252,246,0.025)', 70, 180)
      speckle(ctx, w, h, rand, 700, '160, 140, 116', 0.05, 1.2)
    },
    { repeat: [1, 1] },
  )
}

// Light rift-sawn oak, grain running along v (one tile = 1.2 m)
export function oakTexture(rand) {
  return canvasTexture(
    256,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#c4ab8c'
      ctx.fillRect(0, 0, w, h)
      for (let x = 0; x < w; x += 1) {
        const v = Math.sin(x * 0.21 + rand() * 0.4) * 10 + Math.sin(x * 0.047) * 14 + rand() * 6
        ctx.fillStyle = `rgba(${v > 0 ? '120, 86, 52' : '214, 186, 150'}, ${Math.min(Math.abs(v) / 90, 0.22)})`
        ctx.fillRect(x, 0, 1, h)
      }
      for (let i = 0; i < 70; i++) {
        const x = rand() * w
        ctx.fillStyle = `rgba(104, 72, 42, ${0.05 + rand() * 0.08})`
        ctx.fillRect(x, rand() * h, 1, 30 + rand() * 160)
      }
      // Plank joints
      ctx.fillStyle = 'rgba(70, 48, 28, 0.35)'
      for (let x = 0; x <= w; x += w / 2) ctx.fillRect(x, 0, 1, h)
    },
    { repeat: [1, 1] },
  )
}

// Vertical fluting as a tangent-space normal map. One tile = 0.32 m and
// holds eight flutes (4 cm each), the scale of a hand-finished panel.
export function flutedNormalTexture() {
  return canvasTexture(
    256,
    8,
    (ctx, w, h) => {
      const flutes = 8
      const period = w / flutes
      const img = ctx.createImageData(w, h)
      for (let x = 0; x < w; x++) {
        // Concave flute: the surface slope follows a half-cosine
        const t = (x % period) / period
        const slope = -Math.sin(t * Math.PI * 2) * 0.55
        const nx = slope
        const nz = Math.sqrt(1 - nx * nx)
        for (let y = 0; y < h; y++) {
          const i = (y * w + x) * 4
          img.data[i] = Math.round((nx * 0.5 + 0.5) * 255)
          img.data[i + 1] = 128
          img.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255)
          img.data[i + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
    },
    { srgb: false, repeat: [1, 1] },
  )
}

// Large calm stone slabs for the pavement outside
export function pavementTexture(rand) {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#8b8378'
      ctx.fillRect(0, 0, w, h)
      const rows = 4
      for (let r = 0; r < rows; r++) {
        const y = (r * h) / rows
        const offset = r % 2 ? w / 4 : 0
        for (let x = -offset; x < w; x += w / 2) {
          const v = 128 + rand() * 14
          ctx.fillStyle = `rgb(${v}, ${v - 6}, ${v - 14})`
          ctx.fillRect(x + 2, y + 2, w / 2 - 4, h / rows - 4)
        }
      }
      speckle(ctx, w, h, rand, 3000, '80, 74, 66', 0.14, 1.4)
    },
    { repeat: [1, 1] },
  )
}

// Soft radial glow for lamp halos
export function glowTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255, 255, 255, 1)')
    g.addColorStop(0.25, 'rgba(255, 236, 210, 0.5)')
    g.addColorStop(1, 'rgba(255, 220, 180, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

// Contact shadow: a soft dark pool under furniture, so pieces sit on the
// floor even on the light tier where shadow maps are off
export function blobTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.55)')
    g.addColorStop(0.5, 'rgba(0,0,0,0.25)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

// Brass lettering on transparent. Redrawn once the brand face has loaded so
// it never ships in a fallback font.
//
// With `halo`, only a soft blurred glow of the letters is drawn: laid behind
// the letters with additive blending it reads as halo-lit lettering, the
// letters standing off a softly lit wall.
export function signageTexture(text, { sub, font = 'Manrope', weight = 500, color = '#d8bd8c', halo = 0 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 512
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8

  const spaced = (ctx, str, y, spacing) => {
    const letters = [...str]
    const widths = letters.map((ch) => ctx.measureText(ch).width)
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (letters.length - 1)
    let x = (canvas.width - total) / 2
    // Halo: draw far off-canvas and let only the offset shadow land on it
    // (canvas `filter` is not available in every Safari)
    const shift = halo ? 4096 : 0
    letters.forEach((ch, i) => {
      ctx.fillText(ch, x + widths[i] / 2 - shift, y)
      x += widths[i] + spacing
    })
  }

  const draw = () => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (halo) {
      ctx.shadowColor = color
      ctx.shadowBlur = halo
      ctx.shadowOffsetX = 4096
    }
    // Letter-spaced by hand: canvas letterSpacing is not universal yet
    ctx.font = `${weight} 210px "${font}", "Helvetica Neue", Arial, sans-serif`
    const passes = halo ? 2 : 1
    for (let p = 0; p < passes; p++) {
      spaced(ctx, text, sub ? 210 : 256, 120)
      if (sub) {
        ctx.font = `600 58px "${font}", "Helvetica Neue", Arial, sans-serif`
        spaced(ctx, sub, 410, 38)
        ctx.font = `${weight} 210px "${font}", "Helvetica Neue", Arial, sans-serif`
      }
    }
    texture.needsUpdate = true
  }

  draw()
  const ready = document.fonts?.load
    ? document.fonts.load(`${weight} 210px "${font}"`).then(draw).catch(() => {})
    : Promise.resolve()
  return { texture, ready }
}
