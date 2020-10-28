// used code snippets from various examples provided on https://threejs.org/examples/

import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "./jsm/OrbitControls";
import { LineGeometry } from "./jsm/LineGeometry";
import { LineMaterial } from "./jsm/LineMaterial";
import { Line2 } from "./jsm/Line2";

// this is how many points will be created on one half
// (total will be double this)
const MAX_POINTS = 100;
// create camera. args: FOV, aspect, near plane, far plane
const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  1,
  10000
);
// move camera back to see (0, 0)
camera.position.z = 10;
// create scene and set background to black
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

let pathLine1, pathLine2;
let pathLength;
let pipePoints = [];

// this fn is used to create the main path lines
const createNewPathLine = (colors, positions, linewidth = 0.002) => {
  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  geometry.setColors(colors);

  // a dashed line is used as a workaround to be able to
  // animate the line growing outwards
  const matLine = new LineMaterial({
    color: 0xffffff,
    linewidth,
    vertexColors: true,
    dashed: true,
    dashSize: 1,
    gapSize: 1e9,
    dashScale: 1,
    transparent: true,
    opacity: 0.8,
  });
  const line = new Line2(geometry, matLine);
  scene.add(line);
  line.computeLineDistances();
  line.material.defines.USE_DASH = "";
  line.material.needsUpdate = true;
  return line;
};

// this is for the path reversal lines
const createNewReversalLineAt = (x, y, z, axis) => {
  // currently hardcoded to red, but can use this later
  const colorByAxis = {
    x: 0xc7170a,
    y: 0x3449eb,
    z: 0xfaf60a,
  };
  let positionsTemp = new Float32Array(6);
  let colorsTemp = [];

  // small offset is added to avoid overlapping lines glitching
  // starting point, along the main path line
  positionsTemp[0] = x + 0.001;
  positionsTemp[1] = y + 0.001;
  positionsTemp[2] = z + 0.001;

  // end point, 2 units away along the corresponding axis
  positionsTemp[3] = x + 0.001 + (axis === "z" ? 2 : 0);
  positionsTemp[4] = y + 0.001 + (axis === "x" ? 2 : 0);
  positionsTemp[5] = z + 0.001 + (axis === "y" ? 2 : 0);

  // possibility for future: can vary colour along
  // progression of the line
  for (let i = 0; i < positionsTemp.length; i++) {
    let c = new THREE.Color(colorByAxis["x"]);
    colorsTemp.push(c.r, c.g, c.b);
  }
  let geometry = new LineGeometry();

  geometry.setPositions(positionsTemp);
  geometry.setColors(colorsTemp);

  let matLine = new LineMaterial({
    color: 0xffffff,
    linewidth: 0.0012,
    vertexColors: true,
    dashed: true,
    dashSize: 0.01,
    gapSize: 0.01,
    dashScale: 0,
  });
  const line = new Line2(geometry, matLine);
  scene.add(line);
  return line;
};

// this is for the coloured planes
const createPlaneAt = (x, y, z, axis) => {
  var geometry = new THREE.PlaneBufferGeometry(2, 2, 10, 10);
  // set colour based on what plane the direction of the lines it is based on
  var material = new THREE.MeshBasicMaterial({
    color: axis === "x" ? 0x595eab : axis === "y" ? 0xc7170a : 0xc2be59,
    side: THREE.DoubleSide,
    wireframe: true,
  });
  var plane = new THREE.Mesh(geometry, material);

  // convert 90 deg angle to radians
  let square = THREE.MathUtils.degToRad(90);

  // randomly assign the plane to one of the halves of the world
  // aka one of the reflections across each axis
  let neg = THREE.MathUtils.randInt(0, 1);
  let mult = neg === 1 ? 1 : -1;

  // depending on which axis the red lines are formed from,
  // rotate the planes
  // the offsets are to line up the planes with the lines
  switch (axis) {
    case "x":
      plane.rotation.set(0, square, 0);
      plane.position.set(x * mult, (y + 0.5) * mult, (z + 0.5) * mult);
      // store points to make tunnel later
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

// for the final tunnel
const createTubeAt = (lineLength) => {
  // create a curve using the center points of all
  // the planes
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
// positions of first main line
let positions = new Float32Array(MAX_POINTS * 3.0);
// positions of second main line
let positions2 = new Float32Array(MAX_POINTS * 3.0);
// distances to calculate the line animation
// (need to track the total length to be able to
// calculate what fraction should be showing)
let lineDistances = new Float32Array(MAX_POINTS);

let x = 0,
  y = 0,
  z = 0,
  index = 0,
  points = [];
let colors = [];

let lastVectors = [x, y, z];
// bad form, garbage placeholders
let lastRevisions = ["s", "t", "r"];

// generate the random points
// must be along edges of cube
for (let i = 0, l = MAX_POINTS; i < l; i++) {
  // store points for both lines (one is for the reflection)
  positions2[i * 3] = x * -1;
  positions2[i * 3 + 1] = y * -1;
  positions2[i * 3 + 2] = z * -1;
  positions[index++] = x;
  positions[index++] = y;
  positions[index++] = z;

  const color = new THREE.Color(0xffffff);
  colors.push(color.r, color.g, color.b);
  points.push(new THREE.Vector3(x, y, z));

  // randomize x, y, or z direction
  let dimension = THREE.MathUtils.randInt(0, 2);
  // randomize positive or negative direction
  let direction = THREE.MathUtils.randInt(0, 1) === 0 ? 1 : -1;
  // hard coded to 1
  let magnitude = THREE.MathUtils.randInt(1, 1);

  // keep track of last direction of path
  let lastXDir = lastVectors[0];
  let lastYDir = lastVectors[1];
  let lastZDir = lastVectors[2];

  // dimension x = 0, y = 1, z = 2
  switch (dimension) {
    case 0:
      let xDir = direction * magnitude;
      if (xDir * lastXDir !== 0 && xDir * lastXDir < 0) {
        // create path reversal line if new vector
        // is the exact opposite of last
        // one for each reflection
        createNewReversalLineAt(x, y, z, "x");
        createNewReversalLineAt(-x, -y, -z, "x");
        lastRevisions.push("x");
        // this checks if the last two reversals are in the
        // same direction, and if a plane should be created
        if (
          lastRevisions[lastRevisions.length - 1] ===
            lastRevisions[lastRevisions.length - 2] &&
          // probability that it should be rendered
          THREE.MathUtils.randInt(0, 10) > 5
        ) {
          createPlaneAt(x, y, z, "x", magnitude);
        }
      }
      // update current point / last direction data
      lastVectors[0] = xDir;
      x += direction * magnitude;
      break;
    case 1:
      let yDir = direction * magnitude;
      if (yDir * lastYDir !== 0 && yDir * lastYDir < 0) {
        createNewReversalLineAt(x, y, z, "y");
        createNewReversalLineAt(-x, -y, -z, "y");
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
        createNewReversalLineAt(x, y, z, "z");
        createNewReversalLineAt(-x, -y, -z, "z");
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
pathLength = lineDistances[MAX_POINTS - 1];

// create the path line
pathLine1 = createNewPathLine(colors, positions, 0.0014);
// create its reflection
pathLine2 = createNewPathLine(colors, positions2, 0.0014);

// create the tube
createTubeAt(pathLength);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0.0);

// note: orbitcontrols have custom edit to allow zoom by FOV instead of dollying
// which is needed because by default it changed position to zoom
// which doesn't work when the camera is moving
const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 1;
controls.maxDistance = 1000;
controls.enablePan = true;
controls.enableZoom = true;
controls.target = new THREE.Vector3(0, 0, 0);

let fraction = 0;

const animate = () => {
  requestAnimationFrame(animate);

  // workaround to animate the main lines
  fraction = fraction + 0.0001 >= 1 ? 1 : fraction + 0.0003; // fraction in [ 0, 1 ]
  pathLine1.material.dashSize = fraction * pathLength;
  pathLine1.geometry.attributes.position.needsUpdate = true;

  pathLine2.material.dashSize = fraction * pathLength;
  pathLine2.geometry.attributes.position.needsUpdate = true;

  // animate the camera path
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
