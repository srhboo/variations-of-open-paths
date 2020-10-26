import * as THREE from "three";

const size = 50;
export const cells = [];

for (let c = 0; c < size; c++) {
  cells[c] = [];
  for (let r = 0; r < size; r++) {
    cells[c][r] = THREE.MathUtils.randInt(0, 100) > 90 ? 1 : 0;
  }
}
