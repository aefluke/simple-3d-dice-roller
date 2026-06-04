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

  if (type === 'd6') {
    const s = radius / Math.sqrt(3)  // half-side matching dice.js
    shape = new CANNON.Box(new CANNON.Vec3(s, s, s))
  } else if (type === 'd20') {
    const scale = radius / ICO_LEN
    const vertices = D20_RAW.map(([x, y, z]) => new CANNON.Vec3(x * scale, y * scale, z * scale))
    shape = new CANNON.ConvexPolyhedron({ vertices, faces: D20_FACES_IDX })
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
  }

  const body = new CANNON.Body({
    mass: 1,
    shape,
    linearDamping: 0.25,
    angularDamping: 0.25,
    sleepTimeLimit: 0.6,
    sleepSpeedLimit: 0.15,
  })
  body.allowSleep = true
  return body
}

// Invisible wall segments arranged in a ring — prevent dice from escaping the tray.
// Uses Box shapes so dice thrown from high up can fly OVER the walls, but
// horizontal sliding after landing is blocked.
export function createWalls(world) {
  const WALL_R = 5.15
  const WALL_H = 1.4
  const N = 28
  const segW = (2 * Math.PI * WALL_R / N) * 1.08  // slight overlap between segments

  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const seg = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
    seg.addShape(new CANNON.Box(new CANNON.Vec3(segW / 2, WALL_H / 2, 0.12)))
    seg.position.set(Math.cos(a) * WALL_R, WALL_H / 2, Math.sin(a) * WALL_R)
    seg.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), a)
    world.addBody(seg)
  }
}

export function syncMeshToBody(mesh, body) {
  mesh.position.set(body.position.x, body.position.y, body.position.z)
  mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
}
