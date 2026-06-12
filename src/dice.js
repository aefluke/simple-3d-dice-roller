import * as THREE from 'three'

// ─── Color palettes ───────────────────────────────────────────────────────────
const PALETTES = [
  { bg: '#6080c8', face: '#4060b0', rim: '#90b8f8', fg: '#ffffff', tint: 0xddeeff },  // sky opal
  { bg: '#3a9878', face: '#2a7858', rim: '#70e0b8', fg: '#ffffff', tint: 0xddfff4 },  // mint opal
  { bg: '#b84870', face: '#982858', rim: '#f890b8', fg: '#ffffff', tint: 0xffddec },  // rose opal
  { bg: '#7848c8', face: '#5828a8', rim: '#c090f8', fg: '#ffffff', tint: 0xeeddff },  // violet opal
  { bg: '#b88820', face: '#987000', rim: '#f8d060', fg: '#ffffff', tint: 0xfff4cc },  // amber opal
  { bg: '#208888', face: '#006868', rim: '#60e0e0', fg: '#ffffff', tint: 0xddfff8 },  // teal opal
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
    ctx.fillStyle = palette.fg
    ctx.shadowColor = palette.rim
    ctx.shadowBlur = 12
    ctx.fillText(String(num), cx, cy + 3)
    ctx.shadowBlur = 0

    // Underline for 6 and 9 to avoid confusion
    if (num === 6 || num === 9) {
      const tw = ctx.measureText(String(num)).width
      const uy = cy + fontSize * 0.58
      ctx.fillStyle = palette.fg
      ctx.beginPath()
      ctx.roundRect(cx - tw * 0.42, uy, tw * 0.84, 6, 3)
      ctx.fill()
    }
  })

  return canvas
}

// ─── Opal material factory ────────────────────────────────────────────────────
function makeDiceMat(tex, palette) {
  return new THREE.MeshPhysicalMaterial({
    map: tex,
    color: new THREE.Color(palette.tint),
    roughness: 0.12,
    metalness: 0,
    transmission: 0.5,
    thickness: 1.2,
    ior: 1.45,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    sheen: 0.6,
    sheenRoughness: 0.3,
    sheenColor: new THREE.Color(palette.rim),
    iridescence: 0.65,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 400],
  })
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
  const mat = makeDiceMat(tex, palette)
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
  const mat = makeDiceMat(tex, palette)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true

  return { mesh, faceNormals, faceNumbers: D6_QUADS.map(q => q.num) }
}

// ─── Geometry builder: d4 (tetrahedron) ──────────────────────────────────────
// 4 vertices, 4 triangular faces. Result = top VERTEX (apex pointing up).
// Each face shows 3 numbers, one near each corner.
const D4_CIRCUMR = Math.sqrt(3)

const D4_RAW_VERTS = [
  [ 1,  1,  1],  // v0 → die 1
  [ 1, -1, -1],  // v1 → die 2
  [-1,  1, -1],  // v2 → die 3
  [-1, -1,  1],  // v3 → die 4
]

// vertex index to die number
const D4_VERTEX_NUMS = [1, 2, 3, 4]

// [i0, i1, i2] — CCW from outside; i0→apex UV, i1→base-left UV, i2→base-right UV
const D4_FACE_VERTS = [
  [0, 1, 2],  // normal ≈ ( 1, 1,-1)
  [0, 3, 1],  // normal ≈ ( 1,-1, 1)
  [0, 2, 3],  // normal ≈ (-1, 1, 1)
  [1, 3, 2],  // normal ≈ (-1,-1,-1)
]

// Each face cell shows 3 vertex numbers near the triangle corners.
// Corner positions in canvas pixels come from setTriUV geometry (H=cell*0.82, W=cell*0.44).
function buildD4Atlas(palette) {
  const cell = 256
  const cols = 2, rows = 2
  const canvas = document.createElement('canvas')
  canvas.width = cell * cols
  canvas.height = cell * rows
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const H = cell * 0.82
  const W = cell * 0.44
  // Pull labels 55 % of the way from center toward vertex
  const INSET = 0.55
  const rel = [
    { dx: 0,       dy: -(2 / 3) * H * INSET },  // apex (face vertex 0)
    { dx: -W * INSET, dy:  (1 / 3) * H * INSET },  // base-left (face vertex 1)
    { dx:  W * INSET, dy:  (1 / 3) * H * INSET },  // base-right (face vertex 2)
  ]

  D4_FACE_VERTS.forEach(([i0, i1, i2], fi) => {
    const col = fi % cols
    const row = Math.floor(fi / cols)
    const cx = col * cell + cell / 2
    const cy = row * cell + cell / 2

    // Triangle background (full extent, un-inset)
    const pts = rel.map(({ dx, dy }) => [cx + dx / INSET, cy + dy / INSET])
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, H * 0.68)
    grad.addColorStop(0, palette.face)
    grad.addColorStop(1, palette.bg)
    ctx.beginPath()
    ctx.moveTo(...pts[0])
    ctx.lineTo(...pts[1])
    ctx.lineTo(...pts[2])
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = palette.rim + '55'
    ctx.lineWidth = 3
    ctx.stroke()

    // Number near each corner, rotated so its top points toward that corner
    const nums = [D4_VERTEX_NUMS[i0], D4_VERTEX_NUMS[i1], D4_VERTEX_NUMS[i2]]
    nums.forEach((num, vi) => {
      const { dx, dy } = rel[vi]
      const angle = Math.atan2(dy, dx) + Math.PI / 2
      ctx.save()
      ctx.translate(cx + dx, cy + dy)
      ctx.rotate(angle)
      ctx.font = '900 56px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = palette.fg
      ctx.shadowColor = palette.rim
      ctx.shadowBlur = 10
      ctx.fillText(String(num), 0, 0)
      ctx.shadowBlur = 0
      ctx.restore()
    })
  })

  return canvas
}

function buildD4Geo(radius, palette) {
  const scale = radius / D4_CIRCUMR
  const verts = D4_RAW_VERTS.map(([x, y, z]) => [x * scale, y * scale, z * scale])
  const N = D4_FACE_VERTS.length
  const cols = 2, rows = 2

  const pos = new Float32Array(N * 9)
  const nrm = new Float32Array(N * 9)
  const uvArr = new Float32Array(N * 6)

  D4_FACE_VERTS.forEach(([i0, i1, i2], fi) => {
    const a = new THREE.Vector3(...verts[i0])
    const b = new THREE.Vector3(...verts[i1])
    const c = new THREE.Vector3(...verts[i2])
    const normal = new THREE.Vector3()
      .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
      .normalize()

    const base = fi * 9
    pos.set([...verts[i0], ...verts[i1], ...verts[i2]], base)
    for (let v = 0; v < 3; v++) {
      nrm[base + v * 3]     = normal.x
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

  const atlas = buildD4Atlas(palette)
  const tex = new THREE.CanvasTexture(atlas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = makeDiceMat(tex, palette)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true

  // Result detection: use vertex directions — getTopFace finds the apex vertex pointing up
  const faceNormals = D4_RAW_VERTS.map(([x, y, z]) => {
    const len = Math.sqrt(x * x + y * y + z * z)
    return new THREE.Vector3(x / len, y / len, z / len)
  })

  return { mesh, faceNormals, faceNumbers: D4_VERTEX_NUMS }
}

// ─── Geometry builder: d8 (octahedron) ───────────────────────────────────────
// 6 vertices, 8 triangular faces. Opposite faces sum to 9.
const D8_RAW_VERTS = [
  [1, 0, 0],   // 0: +X
  [-1, 0, 0],  // 1: -X
  [0, 1, 0],   // 2: +Y (top pole)
  [0, -1, 0],  // 3: -Y (bottom pole)
  [0, 0, 1],   // 4: +Z
  [0, 0, -1],  // 5: -Z
]

// [v0, v1, v2, dieNumber] — outward-facing winding, opposite faces sum to 9
const D8_FACES = [
  [2, 4, 0, 1], [2, 1, 4, 2], [2, 5, 1, 3], [2, 0, 5, 4], // upper
  [3, 0, 4, 6], [3, 4, 1, 5], [3, 1, 5, 8], [3, 5, 0, 7], // lower
]

function buildD8Geo(radius, palette) {
  const verts = D8_RAW_VERTS.map(([x, y, z]) => [x * radius, y * radius, z * radius])
  const N = D8_FACES.length
  const cols = Math.ceil(Math.sqrt(N)), rows = Math.ceil(N / cols)  // matches buildAtlas layout

  const pos = new Float32Array(N * 9)
  const nrm = new Float32Array(N * 9)
  const uvArr = new Float32Array(N * 6)
  const faceNormals = []
  const faceNumbers = D8_FACES.map(f => f[3])

  D8_FACES.forEach(([i0, i1, i2], fi) => {
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
      nrm[base + v * 3]     = normal.x
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
  const mat = makeDiceMat(tex, palette)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true

  return { mesh, faceNormals, faceNumbers }
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
  const mat = makeDiceMat(tex, palette)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true

  return { mesh, faceNormals, faceNumbers }
}

// ─── Geometry builder: dFate (Fate/Fudge die) ────────────────────────────────
// 6-sided cube (same shape as D6). Faces: 2× blank (0), 2× plus (+1), 2× minus (-1).
const FATE_QUADS = [
  { vi: [0,1,2,3], normal: [0,0,1],  value:  0, atlasIdx: 0 }, // blank +Z
  { vi: [5,4,7,6], normal: [0,0,-1], value:  0, atlasIdx: 1 }, // blank -Z
  { vi: [1,5,6,2], normal: [1,0,0],  value:  1, atlasIdx: 2 }, // plus  +X
  { vi: [4,0,3,7], normal: [-1,0,0], value:  1, atlasIdx: 3 }, // plus  -X
  { vi: [3,2,6,7], normal: [0,1,0],  value: -1, atlasIdx: 4 }, // minus +Y
  { vi: [4,5,1,0], normal: [0,-1,0], value: -1, atlasIdx: 5 }, // minus -Y
]

function buildDFateAtlas(palette) {
  const cols = 3, rows = 2
  const cell = 256
  const canvas = document.createElement('canvas')
  canvas.width = cell * cols
  canvas.height = cell * rows
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // atlasIdx 0,1 = blank; 2,3 = "+"; 4,5 = "−"
  const symbols = [null, null, '+', '+', '−', '−']

  symbols.forEach((sym, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = col * cell + cell / 2
    const cy = row * cell + cell / 2

    const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, cell * 0.44)
    grad.addColorStop(0, palette.face)
    grad.addColorStop(1, palette.bg)
    ctx.beginPath()
    ctx.arc(cx, cy, cell * 0.44, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    ctx.beginPath()
    ctx.arc(cx, cy, cell * 0.44, 0, Math.PI * 2)
    ctx.strokeStyle = palette.rim + '66'
    ctx.lineWidth = 3
    ctx.stroke()

    if (sym) {
      ctx.font = '900 110px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = palette.fg
      ctx.shadowColor = palette.rim
      ctx.shadowBlur = 14
      ctx.fillText(sym, cx, cy + 4)
      ctx.shadowBlur = 0
    }
  })

  return canvas
}

function buildDFateGeo(radius, palette) {
  const s = radius / Math.sqrt(3)
  const verts = [
    [-s,-s, s], [ s,-s, s], [ s, s, s], [-s, s, s],
    [-s,-s,-s], [ s,-s,-s], [ s, s,-s], [-s, s,-s],
  ]

  const totalTris = 12
  const pos = new Float32Array(totalTris * 9)
  const nrm = new Float32Array(totalTris * 9)
  const uvArr = new Float32Array(totalTris * 6)
  const faceNormals = []
  const faceNumbers = FATE_QUADS.map(q => q.value)

  const cols = 3, rows = 2

  FATE_QUADS.forEach((quad, qi) => {
    const [n0, n1, n2] = quad.normal
    faceNormals.push(new THREE.Vector3(n0, n1, n2))

    const { u0, u1, v0, v1 } = cellUV(quad.atlasIdx, cols, rows)

    let uAxis, vAxis
    if (n2 > 0.5)       { uAxis = [1,0,0]; vAxis = [0,1,0] }
    else if (n2 < -0.5) { uAxis = [-1,0,0]; vAxis = [0,1,0] }
    else if (n0 > 0.5)  { uAxis = [0,0,-1]; vAxis = [0,1,0] }
    else if (n0 < -0.5) { uAxis = [0,0,1]; vAxis = [0,1,0] }
    else if (n1 > 0.5)  { uAxis = [1,0,0]; vAxis = [0,0,-1] }
    else                { uAxis = [1,0,0]; vAxis = [0,0,1] }

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
        return [(pu / s + 1) / 2, (pv / s + 1) / 2]
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

  const atlas = buildDFateAtlas(palette)
  const tex = new THREE.CanvasTexture(atlas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = makeDiceMat(tex, palette)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true

  return { mesh, faceNormals, faceNumbers }
}

// ─── Geometry builder: coin ──────────────────────────────────────────────────
const COIN_SEGMENTS = 48
const COIN_H_RATIO = 0.08
const COIN_PALETTE = { bg: '#a07800', face: '#7a5a00', rim: '#ffe060', fg: '#fff8e0', tint: 0xfff0b0 }

function makeCoinMat(tex) {
  return new THREE.MeshPhysicalMaterial({
    map: tex,
    color: new THREE.Color(COIN_PALETTE.tint),
    emissive: new THREE.Color('#1a0a00'),
    emissiveIntensity: 0.25,
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    sheen: 0.5,
    sheenRoughness: 0.25,
    sheenColor: new THREE.Color(COIN_PALETTE.rim),
    side: THREE.DoubleSide,
  })
}

function buildCoinAtlas() {
  const p = COIN_PALETTE
  const cell = 256
  const canvas = document.createElement('canvas')
  canvas.width = cell * 2
  canvas.height = cell
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ;['♔', '★'].forEach((sym, i) => {
    const cx = i * cell + cell / 2
    const cy = cell / 2

    const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, cell * 0.44)
    grad.addColorStop(0, p.face)
    grad.addColorStop(1, p.bg)
    ctx.beginPath()
    ctx.arc(cx, cy, cell * 0.44, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    ctx.beginPath()
    ctx.arc(cx, cy, cell * 0.44, 0, Math.PI * 2)
    ctx.strokeStyle = p.rim + '88'
    ctx.lineWidth = 4
    ctx.stroke()

    ctx.font = '900 100px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = p.fg
    ctx.shadowColor = p.rim
    ctx.shadowBlur = 18
    ctx.fillText(sym, cx, cy + 4)
    ctx.shadowBlur = 0
  })

  return canvas
}

function buildCoinGeo(radius) {
  const fullH = radius * COIN_H_RATIO * 2
  // toNonIndexed() gives each triangle its own vertices — no shared vertex
  // overwrite conflicts when remapping UVs.
  const geo = new THREE.CylinderGeometry(radius, radius, fullH, COIN_SEGMENTS, 1, false).toNonIndexed()

  // Cap UV from Three.js: u=cos(θ)·0.5+0.5, v=sin(θ)·0.5+0.5
  // Rotate −90°: (u_r=v, v_r=1−u) aligns the symbol upright from the camera.
  const uvAttr = geo.attributes.uv
  for (const grp of geo.groups) {
    for (let vi = grp.start; vi < grp.start + grp.count; vi++) {
      const u = uvAttr.getX(vi)
      const v = uvAttr.getY(vi)
      if (grp.materialIndex === 1) {
        uvAttr.setXY(vi, v * 0.5, 1 - u)
      } else if (grp.materialIndex === 2) {
        uvAttr.setXY(vi, 0.5 + v * 0.5, 1 - u)
      } else {
        uvAttr.setXY(vi, 0.03, 0.5)
      }
    }
  }
  uvAttr.needsUpdate = true

  const atlas = buildCoinAtlas()
  const tex = new THREE.CanvasTexture(atlas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = makeCoinMat(tex)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true

  return {
    mesh,
    faceNormals: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)],
    faceNumbers: ['♔', '★'],
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function buildDie(type, radius = 1) {
  const palette = randomPalette()
  let result
  switch (type) {
    case 'd4':    result = buildD4Geo(radius, palette);    break
    case 'd6':    result = buildD6Geo(radius, palette);    break
    case 'd8':    result = buildD8Geo(radius, palette);    break
    case 'd10':   result = buildD10Geo(radius, palette);   break
    case 'd20':   result = buildD20Geo(radius, palette);   break
    case 'dfate': result = buildDFateGeo(radius, palette); break
    case 'coin':  result = buildCoinGeo(radius);  break
    default: throw new Error(`Unknown die type: ${type}`)
  }
  return { ...result, type, radius }
}
