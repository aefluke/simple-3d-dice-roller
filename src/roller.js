import * as CANNON from 'cannon-es'

// Spawn die outside the tray, throw toward center
export function roll(body) {
  const angle = Math.random() * Math.PI * 2
  const spawnR = 7.5
  const sx = Math.cos(angle) * spawnR
  const sz = Math.sin(angle) * spawnR

  body.position.set(sx, 7.5, sz)

  // Velocity pointing toward origin with controlled randomness
  const speed = 9 + Math.random() * 3
  const spread = 1.5
  const spin = () => (Math.random() - 0.5) * 40

  body.velocity.set(
    -Math.cos(angle) * speed + (Math.random() - 0.5) * spread,
    -3.5 - Math.random() * 1.5,
    -Math.sin(angle) * speed + (Math.random() - 0.5) * spread,
  )
  body.angularVelocity.set(spin(), spin(), spin())
  body.wakeUp()
}

export function isSettled(body) {
  return body.sleepState === CANNON.Body.SLEEPING
}
