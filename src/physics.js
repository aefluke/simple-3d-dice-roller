import * as CANNON from 'cannon-es'
import * as THREE from 'three'

const PHI = (1 + Math.sqrt(5)) / 2
const ICO_LEN = Math.sqrt(1 + PHI * PHI)

// D20 vertices (same as dice.js)
const D20_RAW = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
]
const D20_FACES_IDX = [
  [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
  [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
  [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
  [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
]

// D4 (tetrahedron) vertices and faces
const D4_RAW = [
  [ 1,  1,  1], [ 1, -1, -1], [-1,  1, -1], [-1, -1,  1],
]
const D4_FACES_IDX = [
  [0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2],
]

// D8 (octahedron) vertices and faces
const D8_RAW = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
]
const D8_FACES_IDX = [
  [2, 4, 0], [2, 1, 4], [2, 5, 1], [2, 0, 5],
  [3, 0, 4], [3, 4, 1], [3, 1, 5], [3, 5, 0],
]

// D10 (pentagonal bipyramid) faces
const D10_FACES_IDX = [
  [0,3,2],[0,4,3],[0,5,4],[0,6,5],[0,2,6],
  [1,2,3],[1,3,4],[1,4,5],[1,5,6],[1,6,2],
]

export function createWorld() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -25, 0) })
  world.broadphase = new CANNON.SAPBroadphase(world)
  world.allowSleep = true
  world.defaultContactMaterial.friction = 0.45
  world.defaultContactMaterial.restitution = 0.3

  const floor = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
  floor.addShape(new CANNON.Plane())
  floor.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
  world.addBody(floor)

  return world
}

export function createDiceBody(type, radius = 1) {
  let shape

  if (type === 'd4') {
    const scale = radius / Math.sqrt(3)
    const vertices = D4_RAW.map(([x, y, z]) => new CANNON.Vec3(x * scale, y * scale, z * scale))
    shape = new CANNON.ConvexPolyhedron({ vertices, faces: D4_FACES_IDX })
  } else if (type === 'd6') {
    const s = radius / Math.sqrt(3)  // half-side matching dice.js
    shape = new CANNON.Box(new CANNON.Vec3(s, s, s))
  } else if (type === 'd8') {
    const vertices = D8_RAW.map(([x, y, z]) => new CANNON.Vec3(x * radius, y * radius, z * radius))
    shape = new CANNON.ConvexPolyhedron({ vertices, faces: D8_FACES_IDX })
  } else if (type === 'd20') {
    const scale = radius / ICO_LEN
    const vertices = D20_RAW.map(([x, y, z]) => new CANNON.Vec3(x * scale, y * scale, z * scale))
    shape = new CANNON.ConvexPolyhedron({ vertices, faces: D20_FACES_IDX })
  } else if (type === 'dfate') {
    const s = radius / Math.sqrt(3)
    shape = new CANNON.Box(new CANNON.Vec3(s, s, s))
  } else if (type === 'd10') {
    const h = radius * 0.618
    const r = radius
    const v = [[0, h, 0], [0, -h, 0]]
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5
      v.push([Math.cos(a) * r, 0, Math.sin(a) * r])
    }
    const vertices = v.map(([x, y, z]) => new CANNON.Vec3(x, y, z))
    shape = new CANNON.ConvexPolyhedron({ vertices, faces: D10_FACES_IDX })
  } else if (type === 'coin') {
    shape = new CANNON.Cylinder(radius, radius, radius * 0.16, 32)
  }

  const body = new CANNON.Body({
    mass: 1,
    shape,
    linearDamping: 0.25,
    angularDamping: type === 'coin' ? 0.88 : 0.25,
    sleepTimeLimit: type === 'coin' ? 0.4 : 0.6,
    sleepSpeedLimit: type === 'coin' ? 0.25 : 0.15,
  })
  body.allowSleep = true
  return body
}

// 4 rectangular walls matching the visible tray (12 × 9 units, 2.2 high)
export function createWalls(world) {
  const TRAY_W = 12, TRAY_H = 9
  const WALL_THICK = 0.4
  const WALL_H = 4.5

  const walls = [
    { hx: TRAY_W / 2 + WALL_THICK, hy: WALL_H / 2, hz: WALL_THICK / 2, x: 0,                            z: -(TRAY_H / 2 + WALL_THICK / 2) },
    { hx: TRAY_W / 2 + WALL_THICK, hy: WALL_H / 2, hz: WALL_THICK / 2, x: 0,                            z:  (TRAY_H / 2 + WALL_THICK / 2) },
    { hx: WALL_THICK / 2,          hy: WALL_H / 2, hz: TRAY_H / 2,     x: -(TRAY_W / 2 + WALL_THICK / 2), z: 0 },
    { hx: WALL_THICK / 2,          hy: WALL_H / 2, hz: TRAY_H / 2,     x:  (TRAY_W / 2 + WALL_THICK / 2), z: 0 },
  ]

  walls.forEach(({ hx, hy, hz, x, z }) => {
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
    body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)))
    body.position.set(x, WALL_H / 2, z)
    world.addBody(body)
  })
}

export function syncMeshToBody(mesh, body) {
  mesh.position.set(body.position.x, body.position.y, body.position.z)
  mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
}
