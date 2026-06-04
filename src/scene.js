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
  camera.position.set(0, 14, 0)
  camera.up.set(0, 0, -1)
  camera.lookAt(0, 0, 0)

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.45))

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

  // Tray floor (inside walls)
  const trayFloor = new THREE.Mesh(
    new THREE.CircleGeometry(TRAY_R, 64),
    new THREE.MeshStandardMaterial({ color: 0x111830, roughness: 0.85, metalness: 0.05 })
  )
  trayFloor.rotation.x = -Math.PI / 2
  trayFloor.receiveShadow = true
  scene.add(trayFloor)

  // Tray wall (cylinder, rendered from outside so we see the inner face)
  const wallMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(TRAY_R, TRAY_R, 1.4, 64, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x1a2d60,
      roughness: 0.5,
      metalness: 0.6,
      side: THREE.BackSide,
    })
  )
  wallMesh.position.y = 0.7
  scene.add(wallMesh)

  // Tray rim — glowing top edge (torus)
  const rimTorus = new THREE.Mesh(
    new THREE.TorusGeometry(TRAY_R, 0.07, 8, 64),
    new THREE.MeshStandardMaterial({ color: 0x4080ff, emissive: 0x2050bb, metalness: 0.8, roughness: 0.2 })
  )
  rimTorus.rotation.x = Math.PI / 2
  rimTorus.position.y = 1.4
  scene.add(rimTorus)

  // Subtle glow ring at floor level inside tray
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(TRAY_R - 0.15, TRAY_R, 64),
    new THREE.MeshBasicMaterial({ color: 0x3060cc, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  )
  glowRing.rotation.x = -Math.PI / 2
  glowRing.position.y = 0.02
  scene.add(glowRing)

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
