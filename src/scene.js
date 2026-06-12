import * as THREE from 'three'

const TRAY_R = 5.15  // matches physics wall radius

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0d0d1a)
  scene.fog = new THREE.Fog(0x0d0d1a, 18, 36)

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 14 * Math.cos(Math.PI / 9), 14 * Math.sin(Math.PI / 9))
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.65))

  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(4, 12, 4)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 0.1
  sun.shadow.camera.far = 40
  sun.shadow.camera.left = -10
  sun.shadow.camera.right = 10
  sun.shadow.camera.top = 10
  sun.shadow.camera.bottom = -10
  sun.shadow.bias = -0.001
  scene.add(sun)

  const fill = new THREE.PointLight(0x4a9eff, 0.5, 20)
  fill.position.set(-3, 2, -3)
  scene.add(fill)

  // Outer dark floor (background beyond tray)
  const outerFloor = new THREE.Mesh(
    new THREE.CircleGeometry(18, 64),
    new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 1, metalness: 0 })
  )
  outerFloor.rotation.x = -Math.PI / 2
  outerFloor.position.y = -0.01
  scene.add(outerFloor)

  // Visible rectangular tray
  const TRAY_W = 12, TRAY_H = 9
  const trayMat = new THREE.MeshStandardMaterial({
    color: 0x1a2a40,
    roughness: 0.85,
    metalness: 0.05,
  })
  const trayFloor = new THREE.Mesh(new THREE.PlaneGeometry(TRAY_W, TRAY_H), trayMat)
  trayFloor.rotation.x = -Math.PI / 2
  trayFloor.position.y = 0.01
  trayFloor.receiveShadow = true
  scene.add(trayFloor)

  // Tray walls (tall enough to keep dice inside)
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a3d5c, roughness: 0.7, metalness: 0.15 })
  const rimThick = 0.4
  const rimH = 2.2
  const rimPieces = [
    { w: TRAY_W + rimThick * 2, d: rimThick, x: 0,                           z: -(TRAY_H / 2 + rimThick / 2) },
    { w: TRAY_W + rimThick * 2, d: rimThick, x: 0,                           z:  (TRAY_H / 2 + rimThick / 2) },
    { w: rimThick,              d: TRAY_H,   x: -(TRAY_W / 2 + rimThick / 2), z: 0 },
    { w: rimThick,              d: TRAY_H,   x:  (TRAY_W / 2 + rimThick / 2), z: 0 },
  ]
  rimPieces.forEach(({ w, d, x, z }) => {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w, rimH, d), rimMat)
    rim.position.set(x, rimH / 2, z)
    rim.receiveShadow = true
    rim.castShadow = true
    scene.add(rim)
  })


  function onResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', onResize)
  onResize()

  return { renderer, scene, camera }
}
