import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)

export function getTopFace(faceNormals, faceNumbers, meshQuaternion) {
  let bestFace = 0
  let bestAngle = Math.PI * 2

  for (let i = 0; i < faceNormals.length; i++) {
    const worldNormal = faceNormals[i].clone().applyQuaternion(meshQuaternion)
    const angle = worldNormal.angleTo(UP)
    if (angle < bestAngle) {
      bestAngle = angle
      bestFace = i
    }
  }

  return faceNumbers[bestFace]
}
