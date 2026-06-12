import * as CANNON from 'cannon-es'

// Spawn die outside the tray, throw toward center
export function roll(body, type) {
  const angle = Math.random() * Math.PI * 2
  const spawnR = 7.5
  const sx = Math.cos(angle) * spawnR
  const sz = Math.sin(angle) * spawnR

  body.position.set(sx, 7.5, sz)

  // Velocity pointing toward origin with controlled randomness
  const speed = 9 + Math.random() * 3
  const spread = 1.5
  const spin = () => (Math.random() - 0.5) * 18

  body.velocity.set(
    -Math.cos(angle) * speed + (Math.random() - 0.5) * spread,
    -3.5 - Math.random() * 1.5,
    -Math.sin(angle) * speed + (Math.random() - 0.5) * spread,
  )

  if (type === 'coin') {
    // Flip around a random horizontal axis (not Y, which is the coin's normal)
    const flipSpeed = 20 + Math.random() * 12
    const dir = Math.random() > 0.5 ? 1 : -1
    const tilt = Math.random() * Math.PI * 2
    body.angularVelocity.set(
      Math.cos(tilt) * flipSpeed * dir,
      (Math.random() - 0.5) * 2,
      Math.sin(tilt) * flipSpeed * dir,
    )
  } else {
    body.angularVelocity.set(spin(), spin(), spin())
  }
  body.wakeUp()
}

export function isSettled(body) {
  return body.sleepState === CANNON.Body.SLEEPING
}

export function isValidRest(body, type) {
  if (type !== 'coin') return true
  const coinY = new CANNON.Vec3()
  body.quaternion.vmult(new CANNON.Vec3(0, 1, 0), coinY)
  return Math.abs(coinY.y) > 0.75
}

export function nudge(body, type) {
  body.wakeUp()
  if (type === 'coin') {
    // Coin is on its edge — strong upward kick + flip rotation to land flat
    const sign = () => (Math.random() > 0.5 ? 1 : -1)
    const flip = 30 + Math.random() * 20
    body.velocity.set((Math.random() - 0.5) * 2, 10 + Math.random() * 4, (Math.random() - 0.5) * 2)
    body.angularVelocity.set(sign() * flip, (Math.random() - 0.5) * 3, sign() * flip)
  } else {
    body.velocity.set(
      (Math.random() - 0.5) * 5,
      14 + Math.random() * 5,
      (Math.random() - 0.5) * 5,
    )
    body.angularVelocity.set(
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 25,
    )
  }
}

