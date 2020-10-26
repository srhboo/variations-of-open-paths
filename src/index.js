import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "./jsm/OrbitControls";
import { LineGeometry } from "./jsm/LineGeometry";
import { LineMaterial } from "./jsm/LineMaterial";
import { Line2 } from "./jsm/Line2";

const width = window.innerWidth;
const height = window.innerHeight;

const MAX_POINTS = 100;

const camera = new THREE.PerspectiveCamera(40, width / height, 1, 10000);
camera.position.z = 10;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

let geometries = [];
let lineLengths = [];
let lines = [];
let pipePoints = [];

const createNewLine = (colors, positions, linewidth = 0.002) => {
  let geometry = new LineGeometry();

  geometry.setPositions(positions);
  geometry.setColors(colors);
  geometries.push(geometry);
  let matLine = new LineMaterial({
    color: 0xffffff,
    linewidth, // in pixels
    vertexColors: true,
    //resolution:  // to be set by renderer, eventually
    dashed: true,
    dashSize: 1,
    gapSize: 1e9,
    dashScale: 1,
    transparent: true,
    opacity: 0.8,
  });
  const line = new Line2(geometry, matLine);
  scene.add(line);
  return line;
};

const createPlaneAt = (x, y, z, axis) => {
  var geometry = new THREE.PlaneBufferGeometry(2, 2, 10, 10);
  var material = new THREE.MeshBasicMaterial({
    color: axis === "x" ? 0x595eab : axis === "y" ? 0xc7170a : 0xc2be59,
    side: THREE.DoubleSide,
    wireframe: true,
  });
  var plane = new THREE.Mesh(geometry, material);
  let square = THREE.MathUtils.degToRad(90);
  let neg = THREE.MathUtils.randInt(0, 1);
  let mult = neg === 1 ? 1 : -1;

  switch (axis) {
    case "x":
      plane.rotation.set(0, square, 0);
      plane.position.set(x * mult, (y + 0.5) * mult, (z + 0.5) * mult);
      pipePoints.push(
        new THREE.Vector3(x * mult, (y + 0.5) * mult, (z + 0.5) * mult)
      );
      break;
    case "y":
      plane.rotation.set(square, 0, 0);
      plane.position.set((x + 0.5) * mult, y * mult, (z + 0.5) * mult);
      pipePoints.push(
        new THREE.Vector3((x + 0.5) * mult, y * mult, (z + 0.5) * mult)
      );
      break;
    case "z":
      plane.rotation.set(0, 0, 0);
      plane.position.set(x + 0.5, y + 0.5, z);
      pipePoints.push(new THREE.Vector3(x + 0.5, y + 0.5, z));
      break;
    default:
      break;
  }

  scene.add(plane);
};

const createTubeAt = (lineLength) => {
  //Create a closed wavey loop
  var curve = new THREE.CatmullRomCurve3(pipePoints);
  var geometry = new THREE.TubeGeometry(
    curve,
    Math.floor(lineLength * 2.5),
    0.3,
    3,
    false
  );
  var material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  var mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
};

const createNewLineAt = (x, y, z, axis) => {
  const colorByAxis = {
    x: 0xc7170a,
    y: 0x3449eb,
    z: 0xfaf60a,
  };
  let positionsTemp = new Float32Array(6);
  let colorsTemp = [];

  positionsTemp[0] = x + 0.001;
  positionsTemp[1] = y + 0.001;
  positionsTemp[2] = z + 0.001;
  positionsTemp[3] = x + 0.001 + (axis === "z" ? 2 : 0);
  positionsTemp[4] = y + 0.001 + (axis === "x" ? 2 : 0);
  positionsTemp[5] = z + 0.001 + (axis === "y" ? 2 : 0);

  for (let i = 0; i < positionsTemp.length; i++) {
    let c = new THREE.Color(colorByAxis["x"]);
    colorsTemp.push(c.r, c.g, c.b);
  }
  // let newLine = createNewLine(colorsTemp, positionsTemp, 0.0015, 0.2);
  let geometry = new LineGeometry();

  geometry.setPositions(positionsTemp);
  geometry.setColors(colorsTemp);
  geometries.push(geometry);
  let matLine = new LineMaterial({
    color: 0xffffff,
    linewidth: 0.0012, // in pixels
    vertexColors: true,
    //resolution:  // to be set by renderer, eventually
    dashed: true,
    dashSize: 0.01,
    gapSize: 0.01,
    dashScale: 0,
  });
  const line = new Line2(geometry, matLine);
  line.computeLineDistances();
  line.scale.set(1, 1, 1);
  line.material.defines.USE_DASH = "";
  line.material.needsUpdate = true;
  scene.add(line);
  return line;
};

let positions = new Float32Array(MAX_POINTS * 3.0);
let positions2 = new Float32Array(MAX_POINTS * 3.0);
let lineDistances = new Float32Array(MAX_POINTS);

let x = 0,
  y = 0,
  z = 0,
  index = 0,
  points = [];
let colors = [];

let lastVectors = [x, y, z];
let lastRevisions = ["s", "t", "r"];

for (let i = 0, l = MAX_POINTS; i < l; i++) {
  positions2[i * 3] = x * -1;
  positions2[i * 3 + 1] = y * -1;
  positions2[i * 3 + 2] = z * -1;
  positions[index++] = x;
  positions[index++] = y;
  positions[index++] = z;

  var color = new THREE.Color(0xffffff);
  colors.push(color.r, color.g, color.b);

  points.push(new THREE.Vector3(x, y, z));
  // if the direction is in the exact opposite
  // as the last one, draw a red wire circle
  // or sum of the last 3 pts
  let dimension = THREE.MathUtils.randInt(0, 2);
  let direction = THREE.MathUtils.randInt(0, 1) === 0 ? 1 : -1;
  let magnitude = THREE.MathUtils.randInt(1, 1);
  let lastXDir = lastVectors[0];
  let lastYDir = lastVectors[1];
  let lastZDir = lastVectors[2];
  switch (dimension) {
    case 0:
      let xDir = direction * magnitude;
      if (xDir * lastXDir !== 0 && xDir * lastXDir < 0) {
        createNewLineAt(x, y, z, "x");
        createNewLineAt(-x, -y, -z, "x");
        lastRevisions.push("x");
        if (
          lastRevisions[lastRevisions.length - 1] ===
            lastRevisions[lastRevisions.length - 2] &&
          THREE.MathUtils.randInt(0, 10) > 5
        ) {
          createPlaneAt(x, y, z, "x", magnitude);
        }
      }
      lastVectors[0] = xDir;
      x += direction * magnitude;
      break;
    case 1:
      let yDir = direction * magnitude;
      if (yDir * lastYDir !== 0 && yDir * lastYDir < 0) {
        createNewLineAt(x, y, z, "y");
        createNewLineAt(-x, -y, -z, "y");
        lastRevisions.push("y");
        if (
          lastRevisions[lastRevisions.length - 1] ===
          lastRevisions[lastRevisions.length - 2]
        ) {
          createPlaneAt(x, y, z, "y", magnitude);
        }
      }
      lastVectors[1] = yDir;
      y += direction * magnitude;
      break;
    case 2:
      let zDir = direction * magnitude;
      if (zDir * lastZDir !== 0 && zDir * lastZDir < 0) {
        createNewLineAt(x, y, z, "z");
        createNewLineAt(-x, -y, -z, "z");
        lastRevisions.push("z");
        if (
          lastRevisions[lastRevisions.length - 1] ===
            lastRevisions[lastRevisions.length - 2] &&
          THREE.MathUtils.randInt(0, 10) > 5
        ) {
          createPlaneAt(x, y, z, "z", magnitude);
        }
      }
      lastVectors[2] = zDir;
      z += direction * magnitude;
      break;
    default:
      break;
  }
  if (i > 0) {
    lineDistances[i] =
      lineDistances[i - 1] + points[i - 1].distanceTo(points[i]);
  }
}
lineLengths[0] = lineDistances[MAX_POINTS - 1];

let mainLine = createNewLine(colors, positions, 0.0014);
mainLine.computeLineDistances();
mainLine.material.defines.USE_DASH = "";
mainLine.material.needsUpdate = true;
lines.push(mainLine);

let mainLine2 = createNewLine(colors, positions2, 0.0014);
mainLine2.computeLineDistances();
mainLine2.material.defines.USE_DASH = "";
mainLine2.material.needsUpdate = true;
lines.push(mainLine2);

createTubeAt(lineLengths[0]);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
renderer.setClearColor(0x000000, 0.0);

const controls = new OrbitControls(camera, renderer.domElement);

controls.minDistance = 1;
controls.maxDistance = 1000;
controls.enablePan = true;
controls.enableZoom = true;
controls.target = new THREE.Vector3(0, 0, 0);

let fraction = 0;
// setInterval(updateTrace, 1000);

const animate = () => {
  requestAnimationFrame(animate);
  fraction = fraction + 0.0001 >= 1 ? 1 : fraction + 0.0003; // fraction in [ 0, 1 ]
  lines[0].material.dashSize = fraction * lineLengths[0];
  lines[0].geometry.attributes.position.needsUpdate = true;

  lines[1].material.dashSize = fraction * lineLengths[0];
  lines[1].geometry.attributes.position.needsUpdate = true;

  var time = -performance.now() * 0.0003;
  camera.position.x = 10 * Math.cos(time / 5);
  camera.position.z = 10 * Math.sin(time / 5);
  camera.lookAt(scene.position);
  renderer.render(scene, camera);
};

animate();

document.getElementById("app").appendChild(renderer.domElement);

window.addEventListener("resize", onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}
