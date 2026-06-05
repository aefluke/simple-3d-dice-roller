import * as THREE from 'three'
import { createScene } from './scene.js'
import { buildDie } from './dice.js'
import { createWorld, createWalls, createDiceBody, syncMeshToBody } from './physics.js'
import { roll, isSettled } from './roller.js'
import { getTopFace } from './result.js'

const RADIUS = 1
const MAX_PER_TYPE = 4
const ROLL_TIMEOUT_MS = 12000  // force-settle after 12s
const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd20']

const canvas = document.getElementById('canvas')
const labelsContainer = document.getElementById('labels')
const rollBtn = document.getElementById('rollBtn')
const rollBtnMobile = document.getElementById('rollBtnMobile')

const { renderer, scene, camera } = createScene(canvas)
const world = createWorld()
createWalls(world)

// ─── State ────────────────────────────────────────────────────────────────────
let nextId = 0
const instances = []
const counts = {}
DIE_TYPES.forEach(t => (counts[t] = 0))

let rolling = false
let rollBtnCooldown = false
let rollStartTime = 0
let rollCount = 0

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomTablePos() {
  const r = 0.5 + Math.random() * 3.5
  const a = Math.random() * Math.PI * 2
  return [Math.cos(a) * r, Math.sin(a) * r]
}

function createLabel() {
  const el = document.createElement('div')
  el.className = 'die-label'
  labelsContainer.appendChild(el)
  return el
}

function findLastIndex(arr, fn) {
  for (let i = arr.length - 1; i >= 0; i--) if (fn(arr[i])) return i
  return -1
}

// ─── Die management ───────────────────────────────────────────────────────────
function addDie(type) {
  if (rolling || counts[type] >= MAX_PER_TYPE) return

  const [x, z] = randomTablePos()
  const dieData = buildDie(type, RADIUS)

  // Place on table with random orientation
  const q = new THREE.Quaternion(
    Math.random() - 0.5, Math.random() - 0.5,
    Math.random() - 0.5, Math.random() - 0.5,
  ).normalize()
  dieData.mesh.quaternion.copy(q)
  dieData.mesh.position.set(x, 0.9, z)
  scene.add(dieData.mesh)

  const body = createDiceBody(type, RADIUS)
  body.position.set(x, 1.1, z)
  body.quaternion.set(q.x, q.y, q.z, q.w)
  body.velocity.set(0, -0.3, 0)
  body.angularVelocity.set(0, 0, 0)
  world.addBody(body)

  const label = createLabel()
  instances.push({ id: nextId++, type, mesh: dieData.mesh, body, faceNormals: dieData.faceNormals, faceNumbers: dieData.faceNumbers, label, settled: false })
  counts[type]++
  updateUI()
}

function removeDie(type) {
  if (rolling) return
  const idx = findLastIndex(instances, d => d.type === type)
  if (idx === -1) return

  const die = instances[idx]
  scene.remove(die.mesh)
  die.mesh.geometry.dispose()
  die.mesh.material.map?.dispose()
  die.mesh.material.dispose()
  world.removeBody(die.body)
  die.label.remove()
  instances.splice(idx, 1)
  counts[type]--
  updateUI()
}

// ─── Rolling ──────────────────────────────────────────────────────────────────
function rollAll() {
  if (rollBtnCooldown || instances.length === 0) return
  rolling = true
  rollBtnCooldown = true
  rollStartTime = performance.now()
  setTimeout(() => { rollBtnCooldown = false; updateUI() }, 1000)

  instances.forEach(die => {
    die.settled = false
    die.label.classList.remove('visible')
    die.label.textContent = ''
    roll(die.body)
  })
  updateUI()
}

function settleOne(die) {
  if (die.settled) return
  die.settled = true
  die.result = getTopFace(die.faceNormals, die.faceNumbers, die.mesh.quaternion)
  die.label.textContent = die.result
  setTimeout(() => die.label.classList.add('visible'), 120)
}

// ─── Log ──────────────────────────────────────────────────────────────────────
const logEntriesEl = document.getElementById('log-entries')
const logEmptyEl = document.getElementById('log-empty')

function addLogEntry() {
  rollCount++
  const results = instances.map(d => ({ type: d.type, value: d.result ?? '?' }))
  const total = results.reduce((s, r) => s + (Number(r.value) || 0), 0)
  const now = new Date()
  const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const entry = document.createElement('div')
  entry.className = 'log-entry'
  entry.innerHTML = `
    <div class="log-header">
      <span class="log-num">#${rollCount}</span>
      <span class="log-time">${time}</span>
      <span class="log-total">Σ ${total}</span>
    </div>
    <div class="log-dice">
      ${results.map(r => `<span class="log-die log-${r.type}">${r.type.toUpperCase()} · ${r.value}</span>`).join('')}
    </div>`

  logEntriesEl.insertBefore(entry, logEntriesEl.firstChild)
  logEmptyEl.style.display = 'none'

  // Keep at most 100 entries
  while (logEntriesEl.children.length > 100) logEntriesEl.removeChild(logEntriesEl.lastChild)
}

document.getElementById('clearLogBtn').addEventListener('click', () => {
  logEntriesEl.innerHTML = ''
  logEmptyEl.style.display = ''
  rollCount = 0
})

// ─── UI ───────────────────────────────────────────────────────────────────────
function updateUI() {
  const total = instances.length
  rollBtn.disabled = rollBtnCooldown || total === 0
  if (rollBtnMobile) rollBtnMobile.disabled = rollBtnCooldown || total === 0
  document.getElementById('clearDiceBtn').disabled = rolling || total === 0

  DIE_TYPES.forEach(type => {
    const count = counts[type]
    document.querySelector(`.die-count[data-type="${type}"]`).textContent = count
    document.querySelector(`.remove-btn[data-type="${type}"]`).disabled = rolling || count === 0
    document.querySelector(`.add-btn[data-type="${type}"]`).disabled = rolling || count >= MAX_PER_TYPE
  })
}

function updateLabelPos(die) {
  const pos = die.mesh.position.clone()
  pos.y += 1.8
  pos.project(camera)
  const w = renderer.domElement.clientWidth
  const h = renderer.domElement.clientHeight
  die.label.style.left = ((pos.x + 1) / 2) * w + 'px'
  die.label.style.top = ((-pos.y + 1) / 2) * h + 'px'
}

function clearAllDice() {
  if (rolling) return
  while (instances.length) removeDie(instances[instances.length - 1].type)
}

// ─── Panel wiring ─────────────────────────────────────────────────────────────
rollBtn.addEventListener('click', rollAll)
document.getElementById('clearDiceBtn').addEventListener('click', clearAllDice)
document.addEventListener('keydown', e => {
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) rollAll()
})
document.querySelectorAll('.add-btn').forEach(btn => btn.addEventListener('click', () => addDie(btn.dataset.type)))
document.querySelectorAll('.remove-btn').forEach(btn => btn.addEventListener('click', () => removeDie(btn.dataset.type)))

// ─── Mobile wiring ────────────────────────────────────────────────────────────
if (rollBtnMobile) {
  const panel        = document.getElementById('panel')
  const logPanel     = document.getElementById('log-panel')
  const mobileOverlay = document.getElementById('mobile-overlay')
  const diceToggleBtn = document.getElementById('diceToggleBtn')
  const logToggleBtn  = document.getElementById('logToggleBtn')

  function closeAll() {
    panel.classList.remove('open')
    logPanel.classList.remove('open')
    diceToggleBtn.classList.remove('active')
    logToggleBtn.classList.remove('active')
    mobileOverlay.classList.remove('active')
  }

  rollBtnMobile.addEventListener('click', rollAll)

  diceToggleBtn.addEventListener('click', () => {
    const opening = !panel.classList.contains('open')
    closeAll()
    if (opening) {
      panel.classList.add('open')
      diceToggleBtn.classList.add('active')
      mobileOverlay.classList.add('active')
    }
  })

  logToggleBtn.addEventListener('click', () => {
    const opening = !logPanel.classList.contains('open')
    closeAll()
    if (opening) {
      logPanel.classList.add('open')
      logToggleBtn.classList.add('active')
      mobileOverlay.classList.add('active')
    }
  })

  mobileOverlay.addEventListener('click', closeAll)
}

// ─── Animation loop ───────────────────────────────────────────────────────────
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)

  const delta = Math.min(clock.getDelta(), 0.05)
  world.step(1 / 60, delta, 3)

  instances.forEach(die => {
    syncMeshToBody(die.mesh, die.body)
    updateLabelPos(die)

    if (rolling && !die.settled && isSettled(die.body)) {
      settleOne(die)
    }
  })

  if (rolling) {
    // Timeout: force-settle all dice after ROLL_TIMEOUT_MS
    if (performance.now() - rollStartTime > ROLL_TIMEOUT_MS) {
      instances.forEach(die => {
        die.body.sleep()
        settleOne(die)
      })
    }

    if (instances.every(d => d.settled)) {
      rolling = false
      updateUI()
      addLogEntry()
    }
  }

  renderer.render(scene, camera)
}

// Start with one d20
addDie('d20')
animate()
