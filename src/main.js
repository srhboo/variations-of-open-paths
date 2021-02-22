import "regenerator-runtime/runtime";
import * as Tone from "tone";
import * as THREE from "three";
import { OrbitControls } from "./jsm/OrbitControls";
import { LineGeometry } from "./jsm/LineGeometry";
import { LineMaterial } from "./jsm/LineMaterial";
import { Line2 } from "./jsm/Line2";

import "./styles.css";
// used code snippets from various examples provided on https://threejs.org/examples/

// CONSTANTS
// this is how many points will be created on one half
// (total will be double this)
const MAX_POINTS = 100;
// currently hardcoded to red, but can use this later
const colorByAxis = {
  x: 0xc7170a,
  y: 0x3449eb,
  z: 0xfaf60a,
  white: 0xffffff,
  red: 0xffffff,
};

// DEFINE
let camera, scene, renderer, controls, raycaster, INTERSECTED;
const mouse = new THREE.Vector2();

let pathLine1, pathLine2, pipePoints;
let pathLength;

let meshes = [];
let geometries = [];
let materials = [];

// this fn is used to create the main path lines
const createNewPathLine = (colors, positions, linewidth = 0.002) => {
  const geometry = new LineGeometry();
  geometries.push(geometry);
  geometry.setPositions(positions);
  geometry.setColors(colors);

  // a dashed line is used as a workaround to be able to
  // animate the line growing outwards
  const matLine = new LineMaterial({
    color: colorByAxis["red"],
    linewidth,
    vertexColors: true,
    dashed: true,
    dashSize: 1,
    gapSize: 1e9,
    dashScale: 1,
    transparent: true,
    opacity: 0.6,
  });
  materials.push(matLine);
  const line = new Line2(geometry, matLine);
  meshes.push(line);
  scene.add(line);
  line.computeLineDistances();
  line.material.defines.USE_DASH = "";
  line.material.needsUpdate = true;
  return line;
};

// this is for the path reversal lines
const createNewReversalLineAt = (x, y, z, axis) => {
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
  geometries.push(geometry);

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
  materials.push(matLine);
  const line = new Line2(geometry, matLine);
  meshes.push(line);
  scene.add(line);
  return line;
};

// this is for the coloured planes
const createPlaneAt = (x, y, z, axis, pipePoints) => {
  var geometry = new THREE.PlaneBufferGeometry(2, 2, 10, 10);
  geometries.push(geometry);
  // set colour based on what plane the direction of the lines it is based on
  var material = new THREE.MeshBasicMaterial({
    color: axis === "x" ? 0x595eab : axis === "y" ? 0xc7170a : 0xc2be59,
    // color: colorByAxis["red"],
    opacity: 0.6,
    side: THREE.DoubleSide,
    wireframe: true,
    transparent: true,
  });
  materials.push(material);
  let plane = new THREE.Mesh(geometry, material);
  meshes.push(plane);
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
  return pipePoints;
};

// for the final tunnel
const createTubeAt = (lineLength, pipePoints) => {
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
  geometries.push(geometry);
  var material = new THREE.MeshBasicMaterial({
    color: colorByAxis["red"],
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  materials.push(material);
  var mesh = new THREE.Mesh(geometry, material);
  meshes.push(mesh);
  scene.add(mesh);
};

const createSpace = () => {
  pipePoints = [];
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
            createPlaneAt(x, y, z, "x", pipePoints);
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
            createPlaneAt(x, y, z, "y", pipePoints);
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
            createPlaneAt(x, y, z, "z", pipePoints);
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
  createTubeAt(pathLength, pipePoints);
};

const init = () => {
  // create camera. args: FOV, aspect, near plane, far plane
  camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  // move camera back to see (0, 0)
  camera.position.z = 10;

  raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 3;

  renderer = new THREE.WebGLRenderer({
    antialias: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0.0);
  // note: orbitcontrols have custom edit to allow zoom by FOV instead of dollying
  // which is needed because by default it changed position to zoom
  // which doesn't work when the camera is moving
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 1;
  controls.maxDistance = 1000;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.target = new THREE.Vector3(0, 0, 0);
  // create scene and set background to black
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  createSpace();
};

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

  if (soundOn) {
    // find intersections
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
      if (INTERSECTED != intersects[0].object) {
        if (INTERSECTED)
          INTERSECTED.material.color.setHex(INTERSECTED.currentColor);

        INTERSECTED = intersects[0].object;
        playGeometry(INTERSECTED.geometry);
        INTERSECTED.currentColor = INTERSECTED.material.color.getHex();
        INTERSECTED.material.color.setHex(0xfcba03);
      }
    } else {
      if (INTERSECTED) INTERSECTED.material.color.set(INTERSECTED.currentColor);

      INTERSECTED = null;
    }
  }

  renderer.render(scene, camera);
};

init();
animate();

document.getElementById("app").appendChild(renderer.domElement);

const generateButtons = document.getElementsByClassName("generate");
for (let button of generateButtons) {
  button.addEventListener("click", generateNewSpace);
}

const about = document.getElementById("about");
const description = document.getElementById("description");
const howto = document.getElementById("howto");
const audioButton = document.getElementById("audio");

const showAbout = document.getElementById("question");
showAbout.addEventListener("click", () => {
  about.style.display = "flex";
});

const controlsButton = document.getElementById("controls");
const closeAbout = document.getElementById("close");

controlsButton.addEventListener("click", () => {
  description.style.display = "none";
  closeAbout.style.display = "block";
  howto.style.display = "flex";
  controlsButton.style.display = "none";
});
let soundOn = false;
let soundStarted = false;
closeAbout.addEventListener("click", async () => {
  about.style.display = "none";
  description.style.display = "flex";
  howto.style.display = "none";
  controlsButton.style.display = "block";
  if (!soundStarted) {
    await Tone.start();
    soundStarted = true;
    soundOn = true;
  }
});
const uiButtons = document.getElementById("ui");
const chatroom = document.getElementById("chatroom-container");
const social = document.getElementById("social");

let cleared = false;

const clear = document.getElementById("clear");
clear.addEventListener("click", () => {
  if (!cleared) {
    uiButtons.classList.add("slide-left");
    chatroom.classList.add("slide-left");
    showAbout.classList.add("slide-right");
    audioButton.classList.add("slide-right");
    social.classList.add("slide-right");
    clear.innerText = "«";
  } else {
    uiButtons.classList.remove("slide-left");
    chatroom.classList.remove("slide-left");
    showAbout.classList.remove("slide-right");
    audioButton.classList.remove("slide-right");
    social.classList.remove("slide-right");
    clear.innerText = "»";
  }
  cleared = !cleared;
});

function generateNewSpace() {
  for (let i = 0; i < meshes.length; i++) {
    scene.remove(meshes[i]);
  }
  for (let i = 0; i < geometries.length; i++) {
    geometries[i].dispose();
  }
  for (let i = 0; i < materials.length; i++) {
    materials[i].dispose();
  }
  fraction = 0;
  meshes = [];
  geometries = [];
  materials = [];
  createSpace();
}

window.addEventListener("resize", onWindowResize, false);
document.addEventListener("mousemove", onDocumentMouseMove, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentMouseMove(event) {
  event.preventDefault();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

let playGeometry;

audioButton.addEventListener("click", () => {
  soundOn = !soundOn;
  if (soundOn) {
    audioButton.innerText = "·)))";
    audioButton.classList.remove("muted");
    Tone.Destination.mute = false;
  } else {
    audioButton.innerText = "-)))";
    audioButton.classList.add("muted");
    Tone.Destination.mute = true;
  }
});

const vol = new Tone.Volume(-12).toDestination();
var dist = new Tone.Distortion(0.8);
var reverb = new Tone.JCReverb(0.7).connect(vol);
var feedbackDelay = new Tone.FeedbackDelay("8n", 0.5);
const synth = new Tone.PluckSynth().chain(feedbackDelay, reverb);

var reverb2 = new Tone.JCReverb(0.4).connect(vol);
var feedbackDelay2 = new Tone.FeedbackDelay("8n", 0.9);
const synth2 = new Tone.Synth().chain(dist, feedbackDelay2, reverb2);

var reverb2 = new Tone.JCReverb(0.9).connect(vol);
var tremolo = new Tone.Tremolo(9, 0.75).start();
var polySynth = new Tone.PolySynth().chain(tremolo, reverb2);

const letters = ["C", "D", "E", "F", "G", "A", "B"];
const modNotes = ["#", "b"];
const octaves = ["1", "2", "3", "4", "5"];

const coordToNote = (x, y, z) => {
  const letterIndex = Math.abs(Math.round(x)) % letters.length;
  const letter = letters[letterIndex];
  const mod = y <= 0 ? modNotes[1] : modNotes[0];
  const octaveIndex = Math.abs(Math.round(z)) % octaves.length;
  const octave = octaves[octaveIndex];
  return `${letter}${mod}${octave}`;
};

const coordsToNotes = (coords) => {
  return coords.map(({ x, y, z }) => coordToNote(x, y, z));
};

const playNotes = (notes) => {
  const now = Tone.now();
  for (let i = 0; i < notes.length; i++) {
    synth.triggerAttackRelease(notes[i], "8n", now + i * 0.2);
  }
};

const playNotesSynth2 = (notes) => {
  const now = Tone.now();
  for (let i = 0; i < notes.length; i++) {
    synth2.triggerAttackRelease(notes[i], "8n", now + i * 0.1);
  }
};

const playNotesPolySynth = (chord) => {
  polySynth.triggerAttackRelease(chord, "8n");
};

// MDN
function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

const posToNotes = (positions) => {
  const tempPos = [...positions];
  const octaveInd = getRandomInt(octaves.length);
  const modNotesInd = getRandomInt(modNotes.length);
  const octave = octaves[octaveInd];
  const modNote = modNotes[modNotesInd];
  const letterInd = getRandomInt(letters.length);
  return tempPos.map(() => {
    return `${letters[letterInd]}${modNote}${octave}`;
  });
};

const posToChord = (normals) => {
  const x = normals[0];
  const y = normals[1];
  const z = normals[2];

  const octaveInd = getRandomInt(octaves.length);
  const octaveInd2 = getRandomInt(octaves.length);
  const modNotesInd = getRandomInt(modNotes.length);
  const offset = getRandomInt(letters.length);
  const xInd = Math.abs(offset + x * 1) % letters.length;
  const yInd = Math.abs(offset + y * 2) % letters.length;

  const zInd = Math.abs(offset + z * 3) % letters.length;
  return [
    `${letters[xInd]}${octaves[octaveInd]}${modNotes[modNotesInd]}`,
    `${letters[yInd]}${octaves[octaveInd2]}${modNotes[modNotesInd]}`,
    `${letters[zInd]}${octaves[octaveInd]}${modNotes[modNotesInd]}`,
  ];
};

playGeometry = (geometry) => {
  const { type } = geometry;
  switch (type) {
    case "TubeGeometry":
      // use pipe points
      const notes = coordsToNotes(pipePoints);
      playNotes(notes);
      break;
    case "LineGeometry":
      // convert to xyz
      const lineNotes = posToNotes(geometry.attributes.position.array);
      playNotesSynth2(lineNotes);
      break;
    case "PlaneBufferGeometry":
      // use normal of the plane
      const planeChord = posToChord(geometry.attributes.normal.array);
      playNotesPolySynth(planeChord);
      break;
    default:
      break;
  }
};
