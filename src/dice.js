import * as THREE from 'three'

// ─── Color palettes ───────────────────────────────────────────────────────────
const PALETTES = [
  { bg: '#0f2d6e', face: '#1d4ed8', rim: '#60a5fa' },
  { bg: '#14532d', face: '#15803d', rim: '#4ade80' },
  { bg: '#7c2d12', face: '#c2410c', rim: '#fb923c' },
  { bg: '#4a1d96', face: '#7c3aed', rim: '#c4b5fd' },
  { bg: '#881337', face: '#be123c', rim: '#fb7185' },
  { bg: '#134e4a', face: '#0f766e', rim: '#5eead4' },
]

export function randomPalette() {
  return PALETTES[Math.floor(Math.random() * PALETTES.length)]
}

// ─── Atlas builder ────────────────────────────────────────────────────────────
// Returns a canvas with numbers drawn in a grid.
// faceNumbers: array of numbers in face order (index = logical face index)
function buildAtlas(faceNumbers, palette) {
  const N = faceNumbers.length
  const cols = Math.ceil(Math.sqrt(N))
  const rows = Math.ceil(N / cols)
  const cell = 256

  const canvas = document.createElement('canvas')
  canvas.width = cell * cols
  canvas.height = cell * rows
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  faceNumbers.forEach((num, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = col * cell + cell / 2
    const cy = row * cell + cell / 2

    // Face circle
    const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, cell * 0.44)
    grad.addColorStop(0, palette.face)
    grad.addColorStop(1, palette.bg)
    ctx.beginPath()
    ctx.arc(cx, cy, cell * 0.44, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    // Rim
    ctx.beginPath()
    ctx.arc(cx, cy, cell * 0.44, 0, Math.PI * 2)
    ctx.strokeStyle = palette.rim + '66'
    ctx.lineWidth = 3
    ctx.stroke()

    // Number
    const fontSize = num >= 10 ? 80 : 90
    ctx.font = `900 ${fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = palette.rim
    ctx.shadowBlur = 12
    ctx.fillText(String(num), cx, cy + 3)
    ctx.shadowBlur = 0

    // Underline for 6 and 9 to avoid confusion
    if (num === 6 || num === 9) {
      const tw = ctx.measureText(String(num)).width
      const uy = cy + fontSize * 0.58
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(cx - tw * 0.42, uy, tw * 0.84, 6, 3)
      ctx.fill()
    }
  })

  return canvas
}

// ─── UV helpers ───────────────────────────────────────────────────────────────
// For a triangular face, assign UVs so the triangle centroid maps to the
// atlas cell center. (Equilateral triangle, centroid = 2/3 from apex)
function setTriUV(uv, triIdx, u0, u1, v0, v1) {
  const uc = (u0 + u1) / 2
  const vc = (v0 + v1) / 2
  const H = (v1 - v0) * 0.82        // height of UV triangle
  const W = (u1 - u0) * 0.44        // half-base
  const vApex = vc + (2 / 3) * H    // apex above centroid
  const vBase = vc - (1 / 3) * H    // base below centroid

  const b = triIdx * 6
  uv[b + 0] = uc;    uv[b + 1] = vApex  // apex
  uv[b + 2] = uc - W; uv[b + 3] = vBase  // base-left
  uv[b + 4] = uc + W; uv[b + 5] = vBase  // base-right
}

// For a quad face (2 triangles), assign UVs using vertex projection.
// localU, localV: per-vertex values in [0,1] (position within the quad)
function setQuadUV(uv, triIdx, localUVs, u0, u1, v0, v1) {
  const b = triIdx * 6
  const cw = u1 - u0
  const ch = v1 - v0
  for (let v = 0; v < 3; v++) {
    uv[b + v * 2]     = u0 + localUVs[v][0] * cw
    uv[b + v * 2 + 1] = v0 + localUVs[v][1] * ch
  }
}

// Compute atlas cell UV bounds for face at index faceIdx in a grid of cols×rows
function cellUV(faceIdx, cols, rows) {
  const col = faceIdx % cols
  const row = Math.floor(faceIdx / cols)
  return {
    u0: col / cols,
    u1: (col + 1) / cols,
    v0: 1 - (row + 1) / rows,
    v1: 1 - row / rows,
  }
}

// ─── Geometry builder: d20 ────────────────────────────────────────────────────
const PHI = (1 + Math.sqrt(5)) / 2
const ICO_LEN = Math.sqrt(1 + PHI * PHI)

const D20_RAW_VERTS = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
]

// [v0, v1, v2, dieNumber]
const D20_FACES = [
  [0, 11, 5, 1],  [0, 5, 1, 2],   [0, 1, 7, 3],   [0, 7, 10, 4],  [0, 10, 11, 5],
  [1, 5, 9, 6],   [5, 11, 4, 7],  [11, 10, 2, 8],  [10, 7, 6, 9],  [7, 1, 8, 10],
  [3, 9, 4, 11],  [3, 4, 2, 12],  [3, 2, 6, 13],   [3, 6, 8, 14],  [3, 8, 9, 15],
  [4, 9, 5, 16],  [2, 4, 11, 17], [6, 2, 10, 18],  [8, 6, 7, 19],  [9, 8, 1, 20],
]

function buildD20Geo(radius, palette) {
  const scale = radius / ICO_LEN
  const verts = D20_RAW_VERTS.map(([x, y, z]) => [x * scale, y * scale, z * scale])
  const N = D20_FACES.length
  const cols = 5, rows = 4

  const pos = new Float32Array(N * 9)
  const nrm = new Float32Array(N * 9)
  const uvArr = new Float32Array(N * 6)
  const faceNormals = []
  const faceNumbers = D20_FACES.map(f => f[3])

  D20_FACES.forEach(([i0, i1, i2, num], fi) => {
    const a = new THREE.Vector3(...verts[i0])
    const b = new THREE.Vector3(...verts[i1])
    const c = new THREE.Vector3(...verts[i2])
    const normal = new THREE.Vector3()
      .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
      .normalize()
    faceNormals.push(normal.clone())

    const base = fi * 9
    pos.set([...verts[i0], ...verts[i1], ...verts[i2]], base)
    for (let v = 0; v < 3; v++) {
      nrm[base + v * 3] = normal.x
      nrm[base + v * 3 + 1] = normal.y
      nrm[base + v * 3 + 2] = normal.z
    }

    const { u0, u1, v0, v1 } = cellUV(fi, cols, rows)
    setTriUV(uvArr, fi, u0, u1, v0, v1)
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2))

  const atlas = buildAtlas(faceNumbers, palette)
  const tex = new THREE.CanvasTexture(atlas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.5 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true

  return { mesh, faceNormals, faceNumbers }
}

// ─── Geometry builder: d6 ─────────────────────────────────────────────────────
// 6 quad faces. Convention: opposite faces sum to 7 (1↔6, 2↔5, 3↔4).
const D6_QUADS = [
  { vi: [0,1,2,3], normal: [0,0,1],  num: 1 },  // front  +Z
  { vi: [5,4,7,6], normal: [0,0,-1], num: 6 },  // back   -Z
  { vi: [1,5,6,2], normal: [1,0,0],  num: 2 },  // right  +X
  { vi: [4,0,3,7], normal: [-1,0,0], num: 5 },  // left   -X
  { vi: [3,2,6,7], normal: [0,1,0],  num: 3 },  // top    +Y
  { vi: [4,5,1,0], normal: [0,-1,0], num: 4 },  // bottom -Y
]

function buildD6Geo(radius, palette) {
  const s = radius / Math.sqrt(3)  // half-side so circumradius = radius
  const verts = [
    [-s,-s, s], [ s,-s, s], [ s, s, s], [-s, s, s],
    [-s,-s,-s], [ s,-s,-s], [ s, s,-s], [-s, s,-s],
  ]

  const N = 6
  const totalTris = 12
  const pos = new Float32Array(totalTris * 9)
  const nrm = new Float32Array(totalTris * 9)
  const uvArr = new Float32Array(totalTris * 6)
  const faceNormals = []
  const faceNumbers = D6_QUADS.map(q => q.num)

  // Atlas: sort faces by die number so atlas index = num-1
  const sortedFaces = [...D6_QUADS].sort((a, b) => a.num - b.num)
  const cols = 3, rows = 2  // 3×2 for 6 faces

  D6_QUADS.forEach((quad, qi) => {
    const [n0, n1, n2] = quad.normal
    faceNormals.push(new THREE.Vector3(n0, n1, n2))

    // Atlas position by die number
    const atlasIdx = quad.num - 1
    const { u0, u1, v0, v1 } = cellUV(atlasIdx, cols, rows)

    // Determine local U/V axes for this face to do proper quad UV projection
    let uAxis, vAxis
    if (n2 > 0.5)       { uAxis = [1,0,0]; vAxis = [0,1,0] }
    else if (n2 < -0.5) { uAxis = [-1,0,0]; vAxis = [0,1,0] }
    else if (n0 > 0.5)  { uAxis = [0,0,-1]; vAxis = [0,1,0] }
    else if (n0 < -0.5) { uAxis = [0,0,1]; vAxis = [0,1,0] }
    else if (n1 > 0.5)  { uAxis = [1,0,0]; vAxis = [0,0,-1] }
    else                { uAxis = [1,0,0]; vAxis = [0,0,1] }

    // Quad → 2 triangles: [q0,q1,q2] and [q0,q2,q3]
    const triDefs = [
      [quad.vi[0], quad.vi[1], quad.vi[2]],
      [quad.vi[0], quad.vi[2], quad.vi[3]],
    ]

    triDefs.forEach((tri, ti) => {
      const triIdx = qi * 2 + ti
      const base = triIdx * 9

      const localUVs = tri.map(vi => {
        const v = verts[vi]
        const pu = v[0]*uAxis[0] + v[1]*uAxis[1] + v[2]*uAxis[2]
        const pv = v[0]*vAxis[0] + v[1]*vAxis[1] + v[2]*vAxis[2]
        return [(pu / s + 1) / 2, (pv / s + 1) / 2]  // normalize to [0,1]
      })

      tri.forEach((vi, j) => {
        const vp = verts[vi]
        pos[base + j*3]     = vp[0]
        pos[base + j*3 + 1] = vp[1]
        pos[base + j*3 + 2] = vp[2]
        nrm[base + j*3]     = n0
        nrm[base + j*3 + 1] = n1
        nrm[base + j*3 + 2] = n2
      })

      setQuadUV(uvArr, triIdx, localUVs, u0, u1, v0, v1)
    })
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2))

  const atlas = buildAtlas(faceNumbers.sort((a,b)=>a-b), palette)
  const tex = new THREE.CanvasTexture(atlas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.4 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true

  return { mesh, faceNormals, faceNumbers: D6_QUADS.map(q => q.num) }
}

// ─── Geometry builder: d10 (pentagonal bipyramid) ─────────────────────────────
// 10 triangular faces, 7 vertices (top pole + bottom pole + 5 equatorial)
function buildD10Verts(radius) {
  const h = radius * 0.618   // pole height (golden ratio)
  const r = radius           // equatorial radius
  const v = [[0, h, 0], [0, -h, 0]]  // top=0, bottom=1
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5
    v.push([Math.cos(a) * r, 0, Math.sin(a) * r])  // eq[i] = index 2+i
  }
  return v
}

// [v0, v1, v2, dieNumber] — outward normals verified
const D10_FACE_DEFS = [
  [0, 3, 2, 1], [0, 4, 3, 2], [0, 5, 4, 3], [0, 6, 5, 4], [0, 2, 6, 5],  // upper
  [1, 2, 3, 6], [1, 3, 4, 7], [1, 4, 5, 8], [1, 5, 6, 9], [1, 6, 2, 10], // lower
]

function buildD10Geo(radius, palette) {
  const verts = buildD10Verts(radius)
  const N = D10_FACE_DEFS.length
  const cols = Math.ceil(Math.sqrt(N)), rows = Math.ceil(N / cols)

  const pos = new Float32Array(N * 9)
  const nrm = new Float32Array(N * 9)
  const uvArr = new Float32Array(N * 6)
  const faceNormals = []
  const faceNumbers = D10_FACE_DEFS.map(f => f[3])

  D10_FACE_DEFS.forEach(([i0, i1, i2], fi) => {
    const a = new THREE.Vector3(...verts[i0])
    const b = new THREE.Vector3(...verts[i1])
    const c = new THREE.Vector3(...verts[i2])
    const normal = new THREE.Vector3()
      .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
      .normalize()
    faceNormals.push(normal.clone())

    const base = fi * 9
    pos.set([...verts[i0], ...verts[i1], ...verts[i2]], base)
    for (let v = 0; v < 3; v++) {
      nrm[base + v*3]     = normal.x
      nrm[base + v*3 + 1] = normal.y
      nrm[base + v*3 + 2] = normal.z
    }

    const { u0, u1, v0, v1 } = cellUV(fi, cols, rows)
    setTriUV(uvArr, fi, u0, u1, v0, v1)
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2))

  const atlas = buildAtlas(faceNumbers, palette)
  const tex = new THREE.CanvasTexture(atlas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.28, metalness: 0.45 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true

  return { mesh, faceNormals, faceNumbers }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function buildDie(type, radius = 1) {
  const palette = randomPalette()
  let result
  switch (type) {
    case 'd6':  result = buildD6Geo(radius, palette);  break
    case 'd10': result = buildD10Geo(radius, palette); break
    case 'd20': result = buildD20Geo(radius, palette); break
    default: throw new Error(`Unknown die type: ${type}`)
  }
  return { ...result, type, radius }
}
