import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- CONFIGURATION & CONSTANTS ---
const SVG_WIDTH = 1240;
const SVG_HEIGHT = 880;
const SCALE_FACTOR = 0.1; // 1240x880 SVG -> 124x88 3D world units

function svgToWorld(x, y) {
  return {
    x: (x - SVG_WIDTH / 2) * SCALE_FACTOR,
    z: (y - SVG_HEIGHT / 2) * SCALE_FACTOR
  };
}

// Campus Buildings & Zones Definition
const DEFAULT_CAMPUS_ZONES = [
  {
    id: 'zone-conf-centre',
    name: 'Conference Centre',
    type: 'building',
    glbFile: 'headquarters_building_office_building.glb',
    svgX: 670, svgY: 230,
    width: 50, height: 12, depth: 28,
    color: 0x24688a,
    telemetry: { occupancy: '580 / 800', temp: '21.5°C', power: '210 kW', aqi: '14 (Good)' }
  },
  {
    id: 'zone-exhib-hall',
    name: 'Exhibition Hall',
    type: 'building',
    glbFile: 'free__atlanta_corperate_office_building.glb',
    svgX: 225, svgY: 265,
    width: 24, height: 10, depth: 22,
    color: 0x24688a,
    telemetry: { occupancy: '840 / 1200', temp: '22.0°C', power: '340 kW', aqi: '19 (Good)' }
  },
  {
    id: 'zone-main-plaza',
    name: 'Main Plaza',
    type: 'plaza',
    glbFile: 'plaza.glb',
    svgX: 670, svgY: 505,
    width: 26, height: 0.6, depth: 11,
    color: 0x3a92b2,
    telemetry: { occupancy: '310 / 500', temp: 'Outdoor', power: '45 kW', aqi: '12 (Optimal)' }
  },
  {
    id: 'zone-emerg-assembly',
    name: 'Emergency Assembly',
    type: 'building',
    glbFile: 'fd0fcff7053d4d9f8829320a30d7087e.glb',
    svgX: 202.5, svgY: 510,
    width: 20, height: 6, depth: 13,
    color: 0x24688a,
    telemetry: { occupancy: '0 / 400', temp: '23.1°C', power: '15 kW', aqi: '15 (Good)' }
  },
  {
    id: 'zone-reg-area',
    name: 'Registration Area',
    type: 'building',
    glbFile: 'office_building.glb',
    svgX: 402.5, svgY: 637.5,
    width: 16, height: 5, depth: 7,
    color: 0x24688a,
    telemetry: { occupancy: '145 / 200', temp: '22.8°C', power: '28 kW', aqi: '16 (Good)' }
  },
  {
    id: 'zone-info-desk',
    name: 'Information Desk',
    type: 'building',
    glbFile: 'game_ready_building_3.glb',
    svgX: 549, svgY: 637.5,
    width: 11, height: 5, depth: 7,
    color: 0x24688a,
    telemetry: { occupancy: '35 / 50', temp: '22.5°C', power: '12 kW', aqi: '15 (Good)' }
  },
  {
    id: 'zone-food-court',
    name: 'Food Court',
    type: 'building',
    glbFile: 'restaurant_2.glb',
    svgX: 1084, svgY: 215.5,
    width: 14, height: 8, depth: 12,
    color: 0x24688a,
    telemetry: { occupancy: '220 / 300', temp: '23.4°C', power: '115 kW', aqi: '22 (Moderate)' }
  },
  {
    id: 'zone-med-centre',
    name: 'Medical Centre',
    type: 'building',
    glbFile: 'hospital.glb',
    svgX: 1084, svgY: 362,
    width: 14, height: 7, depth: 11,
    color: 0x24688a,
    telemetry: { occupancy: '12 / 50', temp: '21.0°C', power: '48 kW', aqi: '10 (Cleanroom)' }
  },
  {
    id: 'zone-parking-area',
    name: 'Parking Area',
    type: 'parking',
    glbFile: 'parking_lot.glb',
    svgX: 700, svgY: 790,
    width: 66, height: 0.3, depth: 12,
    color: 0x1b5375,
    telemetry: { occupancy: '184 / 250 vehicles', temp: 'Ambient', power: '24 kW', aqi: '25' }
  }
];

// Blue Road Pathways Radial Network (Matching Image 2 Blueprint)
const DEFAULT_BLUE_ROAD_PATHS = [
  { id: 'road-main-avenue', name: 'Main Perimeter Avenue', width: 3.2, points: [{ x: 150, y: 705 }, { x: 1160, y: 705 }] },
  { id: 'road-shuttle-loop', name: 'Shuttle Pickup Loop', width: 2.8, points: [{ x: 150, y: 705 }, { x: 150, y: 790 }, { x: 360, y: 790 }] },
  { id: 'road-service-entrance', name: 'Service Entrance Road', width: 2.6, points: [{ x: 955, y: 705 }, { x: 955, y: 645 }, { x: 912, y: 618 }] },
  { id: 'road-main-entrance-conn', name: 'Main Entrance Connector', width: 2.8, points: [{ x: 670, y: 618 }, { x: 670, y: 705 }] },
  { id: 'road-plaza-conf', name: 'Main Plaza North Road', width: 2.6, points: [{ x: 670, y: 450 }, { x: 670, y: 380 }] },
  { id: 'road-plaza-exhib', name: 'Main Plaza Northwest Road', width: 2.5, points: [{ x: 540, y: 505 }, { x: 400, y: 505 }, { x: 300, y: 420 }, { x: 225, y: 380 }] },
  { id: 'road-plaza-emerg', name: 'Main Plaza West Road', width: 2.4, points: [{ x: 540, y: 505 }, { x: 305, y: 510 }] },
  { id: 'road-plaza-food', name: 'Main Plaza Northeast Road', width: 2.5, points: [{ x: 800, y: 500 }, { x: 900, y: 480 }, { x: 975, y: 430 }, { x: 975, y: 215 }, { x: 1010, y: 215 }] },
  { id: 'road-med-branch', name: 'Medical Centre Access Road', width: 2.4, points: [{ x: 975, y: 362 }, { x: 1010, y: 362 }] },
  { id: 'road-plaza-south', name: 'Main Plaza South Road', width: 2.6, points: [{ x: 670, y: 560 }, { x: 670, y: 618 }] },
  { id: 'road-entrance-info', name: 'Information Desk Access Road', width: 2.4, points: [{ x: 670, y: 618 }, { x: 605, y: 637 }] },
  { id: 'road-plaza-reg', name: 'Registration Area Access Road', width: 2.5, points: [{ x: 580, y: 560 }, { x: 470, y: 580 }, { x: 420, y: 600 }] },
  { id: 'road-plaza-vip', name: 'VIP Entrance Access Road', width: 2.5, points: [{ x: 800, y: 545 }, { x: 890, y: 618 }] },
  { id: 'road-shuttle-reg', name: 'Shuttle Registration Connector', width: 2.4, points: [{ x: 240, y: 705 }, { x: 300, y: 675 }, { x: 380, y: 675 }] }
];

// Tree Belts Matching Image 2 Blueprint
const SPECIFIC_LANDSCAPE_CANOPIES = [
  // Top Perimeter Row
  { x: 120, y: 51 }, { x: 182, y: 51 }, { x: 244, y: 51 }, { x: 306, y: 51 }, { x: 368, y: 51 },
  { x: 430, y: 51 }, { x: 492, y: 51 }, { x: 554, y: 51 }, { x: 616, y: 51 }, { x: 678, y: 51 },
  { x: 740, y: 51 }, { x: 802, y: 51 }, { x: 864, y: 51 },
  // Exhibition Hall & Assembly Buffer
  { x: 126, y: 104 }, { x: 176, y: 104 }, { x: 226, y: 104 }, { x: 276, y: 104 }, { x: 326, y: 104 },
  { x: 124, y: 410 }, { x: 178, y: 410 }, { x: 232, y: 410 }, { x: 286, y: 410 },
  // Central Plaza Buffer
  { x: 352, y: 505 }, { x: 396, y: 505 }, { x: 440, y: 505 }, { x: 484, y: 505 },
  { x: 858, y: 505 }, { x: 910, y: 505 }, { x: 962, y: 505 },
  // East Perimeter Belt
  { x: 1196, y: 196 }, { x: 1196, y: 268 }, { x: 1196, y: 340 }, { x: 1196, y: 412 },
  // South Perimeter Row
  { x: 122, y: 638 }, { x: 170, y: 638 }, { x: 218, y: 638 }, { x: 266, y: 638 }
];

// --- APP STATE ---
let scene, camera, renderer, controls, transformControls;
let gltfLoader;
let selectableObjects = [];
let sceneObjectMap = new Map();
let selectedObject = null;
let dirLight, ambientLight, groundGrid, groundMesh, landPlazasGroup, streetLampsGroup;

let roadNetworkGroup = null;
let roadTemplateScene = null;
let roadAsphaltMat = null;
let roadCurbMat = null;
let landViewMode = true;

// Waypoint Path Drawing State
let isDrawingRoadPath = false;
let currentWaypoints = [];
let waypointMarkersGroup = null;
let previewLineMesh = null;

// Target for smooth camera lerping
let targetCameraPos = null;
let targetLookAt = null;

function showToast(msg, duration = 2500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function init() {
  const container = document.getElementById('canvas-container');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a121c);
  scene.fog = new THREE.FogExp2(0x0a121c, 0.0016);

  // Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 95, 95);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Orbit Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 1.0;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 8;
  controls.maxDistance = 300;
  controls.target.set(0, 0, 0);

  // Transform Controls (Gizmo Editor)
  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.size = 0.85;
  transformControls.addEventListener('dragging-changed', (event) => {
    controls.enabled = !event.value;
    if (!event.value) {
      saveLayoutToLocalStorage(false);
    }
  });
  transformControls.addEventListener('change', () => {
    if (selectedObject) {
      updateInspectorFromObject(selectedObject);
    }
  });
  scene.add(transformControls);

  gltfLoader = new GLTFLoader();
  waypointMarkersGroup = new THREE.Group();
  waypointMarkersGroup.name = 'Waypoint Markers';
  scene.add(waypointMarkersGroup);

  setupLighting();
  buildCampusGround();
  loadRoadGLBTemplateAndNetwork();
  loadCampusAssets();
  setupEventListeners();

  window.addEventListener('resize', onWindowResize);
  animate();

  showToast('Canadian Campus Digital Twin Ready');
}

function setupLighting() {
  ambientLight = new THREE.AmbientLight(0xdceeff, 0.95);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0x7dc9f0, 0x121d28, 1.15);
  hemiLight.position.set(0, 120, 0);
  scene.add(hemiLight);

  dirLight = new THREE.DirectionalLight(0xfff8ee, 2.4);
  dirLight.position.set(45, 110, 55);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 350;
  const d = 75;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  scene.add(dirLight);
}

// Build Seamless Canadian Campus Ground Plane & Terrain (NO BLUE SLABS)
function buildCampusGround() {
  const groundW = SVG_WIDTH * SCALE_FACTOR;
  const groundH = SVG_HEIGHT * SCALE_FACTOR;

  // Ground Base Terrain
  const groundGeo = new THREE.PlaneGeometry(groundW + 120, groundH + 120);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x18202a,
    roughness: 0.88,
    metalness: 0.12
  });
  groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.05;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // REMOVED ALL RECTANGULAR PLAZA BOX SLABS BELOW BUILDINGS AS REQUESTED BY USER
  landPlazasGroup = new THREE.Group();
  landPlazasGroup.name = 'Campus Lawns';
  scene.add(landPlazasGroup);

  // Green Lawn & Park Vegetation Patches
  const greenPatches = [
    { x: 520, y: 51, w: 840, h: 30 },
    { x: 225, y: 108, w: 250, h: 52 },
    { x: 202.5, y: 411, w: 205, h: 30 },
    { x: 1084, y: 458, w: 148, h: 44 },
    { x: 1196, y: 315, w: 44, h: 330 },
    { x: 195, y: 638, w: 190, h: 76 }
  ];

  const greenMat = new THREE.MeshStandardMaterial({
    color: 0x1d4d38,
    roughness: 0.9,
    metalness: 0.05
  });

  greenPatches.forEach((p) => {
    const wPos = svgToWorld(p.x, p.y);
    const pW = p.w * SCALE_FACTOR;
    const pH = p.h * SCALE_FACTOR;
    const patchGeo = new THREE.BoxGeometry(pW, 0.04, pH);
    const patchMesh = new THREE.Mesh(patchGeo, greenMat);
    patchMesh.position.set(wPos.x, 0.02, wPos.z);
    patchMesh.receiveShadow = true;
    landPlazasGroup.add(patchMesh);
  });

  // Subtle Cyber Grid (Hidden by default)
  groundGrid = new THREE.GridHelper(Math.max(groundW, groundH), 62, 0x00f2ff, 0x184c73);
  groundGrid.position.y = 0.05;
  groundGrid.material.opacity = 0.22;
  groundGrid.material.transparent = true;
  groundGrid.visible = false;
  scene.add(groundGrid);
}

// Load Road Template GLB File (`road_template.glb`) and Extract Materials & Modular Meshes
function loadRoadGLBTemplateAndNetwork() {
  roadNetworkGroup = new THREE.Group();
  roadNetworkGroup.name = 'Campus Road Network';
  scene.add(roadNetworkGroup);

  roadAsphaltMat = new THREE.MeshStandardMaterial({
    color: 0x22272e,
    roughness: 0.85,
    metalness: 0.15
  });

  roadCurbMat = new THREE.MeshStandardMaterial({
    color: 0x8a95a5,
    roughness: 0.6,
    metalness: 0.2
  });

  gltfLoader.load(
    'road_template.glb',
    (gltf) => {
      roadTemplateScene = gltf.scene;

      roadTemplateScene.traverse((c) => {
        if (c.isMesh && c.material) {
          c.receiveShadow = true;
          c.castShadow = true;
          if (c.material.name.toLowerCase().includes('lambert2')) {
            roadAsphaltMat = c.material.clone();
          }
        }
      });

      showToast('Loaded Road Template GLB');
      buildCampusRoadNetwork();
    },
    null,
    (err) => {
      console.warn('Fallback loading road_template.glb', err);
      buildCampusRoadNetwork();
    }
  );
}

// Build Campus Road Network
function buildCampusRoadNetwork() {
  while (roadNetworkGroup.children.length > 0) {
    const child = roadNetworkGroup.children[0];
    roadNetworkGroup.remove(child);
  }

  const savedRoadsStr = localStorage.getItem('amo_campus_roads');
  let roadDefs = DEFAULT_BLUE_ROAD_PATHS;
  if (savedRoadsStr) {
    try {
      const parsed = JSON.parse(savedRoadsStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        roadDefs = parsed;
        showToast('Restored custom saved road network');
      }
    } catch (e) {
      console.warn('Failed to parse saved roads', e);
    }
  }

  roadDefs.forEach((rd) => {
    create3DRoadPathMesh(rd.points, rd.width, rd.id, rd.name);
  });
}

// Generate Smooth Catmull-Rom Spline 3D Road Mesh with Raised Concrete Curbs & Smooth Junction Aprons
function create3DRoadPathMesh(pointsArray, width = 2.5, id = null, name = null) {
  if (!pointsArray || pointsArray.length < 2) return null;

  const roadId = id || `road-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const roadName = name || `Custom Road ${sceneObjectMap.size + 1}`;

  const group = new THREE.Group();
  group.name = roadName;
  group.userData = { id: roadId, name: roadName, type: 'road', width, points: pointsArray };

  // Convert SVG/World coordinates
  const rawVecs = pointsArray.map((pt) => {
    let wPt;
    if (pt.svgX !== undefined && pt.svgY !== undefined) wPt = svgToWorld(pt.svgX, pt.svgY);
    else if (pt.x !== undefined && pt.y !== undefined && pt.z === undefined) wPt = svgToWorld(pt.x, pt.y);
    else wPt = pt;
    return new THREE.Vector3(wPt.x, 0.05, wPt.z || wPt.y || 0);
  });

  let curve;
  if (rawVecs.length > 2) {
    curve = new THREE.CatmullRomCurve3(rawVecs, false, 'catmullrom', 0.4);
  } else {
    curve = new THREE.LineCurve3(rawVecs[0], rawVecs[1]);
  }

  const totalLen = curve.getLength();
  const numSamples = Math.max(16, Math.floor(totalLen * 3.5));
  const sampledPoints = curve.getSpacedPoints(numSamples);

  const curbMat = roadCurbMat || new THREE.MeshStandardMaterial({ color: 0x8a95a5, roughness: 0.6 });
  const asphaltMat = roadAsphaltMat || new THREE.MeshStandardMaterial({ color: 0x22272e, roughness: 0.85 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0x00f2ff, emissiveIntensity: 0.15 });

  for (let i = 0; i < sampledPoints.length - 1; i++) {
    const p1 = sampledPoints[i];
    const p2 = sampledPoints[i + 1];

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 0.005) continue;

    const angle = Math.atan2(dx, dz);
    const midX = (p1.x + p2.x) / 2;
    const midZ = (p1.z + p2.z) / 2;

    const segGroup = new THREE.Group();
    segGroup.position.set(midX, 0.05, midZ);
    segGroup.rotation.y = angle;

    // 1. Dark Asphalt Road Bed
    const roadGeo = new THREE.BoxGeometry(width, 0.06, segLen + 0.04);
    const roadMesh = new THREE.Mesh(roadGeo, asphaltMat);
    roadMesh.receiveShadow = true;
    roadMesh.castShadow = true;
    segGroup.add(roadMesh);

    // 2. Left Concrete Curb Border
    const curbGeo = new THREE.BoxGeometry(0.2, 0.12, segLen + 0.04);
    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(-width / 2 - 0.1, 0.03, 0);
    leftCurb.receiveShadow = true;
    leftCurb.castShadow = true;
    segGroup.add(leftCurb);

    // 3. Right Concrete Curb Border
    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    rightCurb.position.set(width / 2 + 0.1, 0.03, 0);
    rightCurb.receiveShadow = true;
    rightCurb.castShadow = true;
    segGroup.add(rightCurb);

    // 4. Center Dashed Line Overlay
    if (i % 2 === 0) {
      const lineGeo = new THREE.BoxGeometry(0.12, 0.015, segLen * 0.9);
      const lineMesh = new THREE.Mesh(lineGeo, lineMat);
      lineMesh.position.set(0, 0.04, 0);
      segGroup.add(lineMesh);
    }

    group.add(segGroup);
  }

  // Smooth Intersection Joint Aprons at Start & End
  const hubRadius = width / 2 + 0.25;
  const hubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius, 0.06, 16);
  
  const startHub = new THREE.Mesh(hubGeo, asphaltMat);
  startHub.position.copy(sampledPoints[0]);
  startHub.position.y = 0.05;
  startHub.receiveShadow = true;
  group.add(startHub);

  const endHub = new THREE.Mesh(hubGeo, asphaltMat);
  endHub.position.copy(sampledPoints[sampledPoints.length - 1]);
  endHub.position.y = 0.05;
  endHub.receiveShadow = true;
  group.add(endHub);

  group.traverse((child) => {
    if (child.isMesh) {
      child.userData.parentRoadGroup = group;
      selectableObjects.push(child);
    }
  });

  roadNetworkGroup.add(group);
  sceneObjectMap.set(roadId, group);
  addSceneTreeItem(roadId, roadName, 'road');

  return group;
}

// Add Preset Modular Road Piece
function addPresetRoadPiece(type) {
  const roadId = `road-${type}-${Date.now()}`;
  let roadName = `New ${type.toUpperCase()} Road`;
  let points = [];

  const centerWorld = { x: 0, z: 0 };
  if (camera) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    centerWorld.x = camera.position.x + dir.x * 20;
    centerWorld.z = camera.position.z + dir.z * 20;
  }

  if (type === 'straight') {
    points = [
      { x: centerWorld.x - 6, y: 0, z: centerWorld.z },
      { x: centerWorld.x + 6, y: 0, z: centerWorld.z }
    ];
  } else if (type === 'curve') {
    roadName = 'New Curved Road';
    points = [
      { x: centerWorld.x - 6, y: 0, z: centerWorld.z },
      { x: centerWorld.x, y: 0, z: centerWorld.z },
      { x: centerWorld.x + 4, y: 0, z: centerWorld.z + 6 }
    ];
  } else if (type === 'tjunction') {
    roadName = 'New T-Junction Road';
    points = [
      { x: centerWorld.x - 6, y: 0, z: centerWorld.z },
      { x: centerWorld.x + 6, y: 0, z: centerWorld.z },
      { x: centerWorld.x, y: 0, z: centerWorld.z + 6 }
    ];
  } else if (type === 'cross') {
    roadName = 'New Crossroad Junction';
    points = [
      { x: centerWorld.x - 6, y: 0, z: centerWorld.z },
      { x: centerWorld.x + 6, y: 0, z: centerWorld.z }
    ];
  }

  const newRoadGroup = create3DRoadPathMesh(points, 2.6, roadId, roadName);
  if (newRoadGroup) {
    selectObject(newRoadGroup);
    saveRoadsToLocalStorage(true);
    showToast(`Added ${roadName}`);
  }
}

// Waypoint Path Drawing Tool
function startWaypointRoadTool() {
  isDrawingRoadPath = true;
  currentWaypoints = [];
  clearWaypointMarkers();

  const statusEl = document.getElementById('road-draw-status');
  if (statusEl) statusEl.classList.remove('hidden');

  const countEl = document.getElementById('draw-point-count');
  if (countEl) countEl.innerText = 'Click 3D ground to place points...';

  showToast('Waypoint Road Tool Active: Click on map to draw road path');
}

function addWaypointAtPoint(point) {
  currentWaypoints.push(point.clone());

  const markerGeo = new THREE.SphereGeometry(0.35, 12, 12);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
  const markerMesh = new THREE.Mesh(markerGeo, markerMat);
  markerMesh.position.copy(point);
  markerMesh.position.y = 0.2;
  waypointMarkersGroup.add(markerMesh);

  updatePreviewLine();

  const countEl = document.getElementById('draw-point-count');
  if (countEl) countEl.innerText = `${currentWaypoints.length} points placed. Click for more or 'Done'`;
}

function updatePreviewLine() {
  if (previewLineMesh) {
    scene.remove(previewLineMesh);
    previewLineMesh = null;
  }
  if (currentWaypoints.length < 2) return;

  const pts = currentWaypoints.map((p) => new THREE.Vector3(p.x, 0.1, p.z));
  const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00f2ff, linewidth: 3 });
  previewLineMesh = new THREE.Line(lineGeo, lineMat);
  scene.add(previewLineMesh);
}

function finishWaypointRoadTool() {
  if (!isDrawingRoadPath) return;

  if (currentWaypoints.length >= 2) {
    const pointsArray = currentWaypoints.map((pt) => ({ x: pt.x, y: 0, z: pt.z }));
    const roadId = `road-custom-${Date.now()}`;
    const roadName = `Drawn Road ${sceneObjectMap.size + 1}`;
    const newRoad = create3DRoadPathMesh(pointsArray, 2.6, roadId, roadName);
    if (newRoad) {
      selectObject(newRoad);
      saveRoadsToLocalStorage(true);
      showToast('Constructed new custom 3D road path!');
    }
  } else {
    showToast('Cancelled road drawing (need at least 2 points)');
  }

  isDrawingRoadPath = false;
  clearWaypointMarkers();

  const statusEl = document.getElementById('road-draw-status');
  if (statusEl) statusEl.classList.add('hidden');
}

function clearWaypointMarkers() {
  while (waypointMarkersGroup.children.length > 0) {
    waypointMarkersGroup.remove(waypointMarkersGroup.children[0]);
  }
  if (previewLineMesh) {
    scene.remove(previewLineMesh);
    previewLineMesh = null;
  }
}

// Delete Selected Road or Building Object
function deleteSelectedObject() {
  if (!selectedObject) {
    showToast('No object selected to delete');
    return;
  }

  let rootObj = selectedObject;
  while (rootObj.parent && rootObj.parent !== scene && rootObj.parent !== roadNetworkGroup && !rootObj.userData?.id) {
    rootObj = rootObj.parent;
  }

  const objId = rootObj.userData?.id || rootObj.name;
  const objName = rootObj.userData?.name || rootObj.name || 'Selected Object';

  deselectObject();

  if (rootObj.parent) {
    rootObj.parent.remove(rootObj);
  } else {
    scene.remove(rootObj);
  }

  selectableObjects = selectableObjects.filter((o) => o !== rootObj && o.userData?.parentRoadGroup !== rootObj);
  if (objId) sceneObjectMap.delete(objId);

  const treeItem = document.querySelector(`.tree-item[data-id="${objId}"]`);
  if (treeItem) treeItem.remove();

  updateZoneCountBadge();
  saveRoadsToLocalStorage(false);
  saveLayoutToLocalStorage(false);

  showToast(`Deleted ${objName}`);
}

// Save Custom Road Network State to LocalStorage
function saveRoadsToLocalStorage(showNotification = true) {
  const savedRoads = [];
  roadNetworkGroup.children.forEach((group) => {
    if (group.userData && group.userData.type === 'road' && group.userData.points) {
      savedRoads.push({
        id: group.userData.id,
        name: group.userData.name,
        width: group.userData.width || 2.5,
        points: group.userData.points,
        pos: { x: group.position.x, y: group.position.y, z: group.position.z },
        rotY: group.rotation.y,
        scale: { x: group.scale.x, y: group.scale.y, z: group.scale.z }
      });
    }
  });

  localStorage.setItem('amo_campus_roads', JSON.stringify(savedRoads));
  if (showNotification) {
    showToast('Saved custom road layout!');
  }
}

function resetRoads() {
  localStorage.removeItem('amo_campus_roads');
  buildCampusRoadNetwork();
  showToast('Reset road network to default map paths');
}

// Load Campus Buildings (BLUE SLABS REMOVED & HIDDEN BY DEFAULT)
function loadCampusAssets() {
  const sceneListEl = document.getElementById('scene-tree-list');
  if (sceneListEl) sceneListEl.innerHTML = '';

  const savedDataStr = localStorage.getItem('amo_campus_layout');
  let savedData = null;
  if (savedDataStr) {
    try {
      savedData = JSON.parse(savedDataStr);
      showToast('Restored custom saved 3D layout!');
    } catch (e) {
      console.warn('Failed to parse saved layout', e);
    }
  }

  DEFAULT_CAMPUS_ZONES.forEach((zone) => {
    const worldPos = svgToWorld(zone.svgX, zone.svgY);
    let objGroup = new THREE.Group();
    objGroup.name = zone.name;
    objGroup.userData = { ...zone };

    let customTransform = savedData && savedData[zone.id];

    // Fallback Bounding Mesh (HIDDEN BY DEFAULT - NO BLUE SLABS!)
    const geo = new THREE.BoxGeometry(zone.width, zone.height, zone.depth);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1e5a80,
      transparent: true,
      opacity: 0.0
    });
    const baseMesh = new THREE.Mesh(geo, mat);
    baseMesh.position.y = zone.height / 2;
    baseMesh.visible = false; // Hidden so NO blue box slab ever renders below building!
    objGroup.add(baseMesh);

    // Selection Outline (HIDDEN BY DEFAULT)
    const edgesGeo = new THREE.EdgesGeometry(geo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x00f2ff, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edgesGeo, edgesMat);
    wireframe.position.y = zone.height / 2;
    wireframe.name = 'selectionOutline';
    wireframe.visible = false;
    objGroup.add(wireframe);

    // Floating 2D Text Label
    const labelSprite = createTextSprite(zone.name.toUpperCase());
    labelSprite.position.set(0, zone.height + 2.5, 0);
    objGroup.add(labelSprite);

    if (customTransform && customTransform.pos) {
      objGroup.position.set(customTransform.pos.x, customTransform.pos.y, customTransform.pos.z);
      if (customTransform.rotY !== undefined) objGroup.rotation.y = customTransform.rotY;
      if (customTransform.scale) objGroup.scale.set(customTransform.scale.x, customTransform.scale.y, customTransform.scale.z);
    } else {
      objGroup.position.set(worldPos.x, 0, worldPos.z);
    }

    scene.add(objGroup);
    selectableObjects.push(baseMesh);
    sceneObjectMap.set(zone.id, objGroup);

    addSceneTreeItem(zone.id, zone.name, zone.type);

    if (zone.glbFile) {
      loadGLBForZone(zone.glbFile, objGroup, zone.width, zone.depth, zone.height);
    }
  });

  loadTreeLandscaping();
  updateZoneCountBadge();
}

function createTextSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(10, 18, 28, 0.88)';
  ctx.strokeStyle = '#00f2ff';
  ctx.lineWidth = 4;
  ctx.roundRect(16, 16, 480, 96, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'Bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(10, 2.5, 1);
  return sprite;
}

function loadGLBForZone(filename, group, targetW, targetD, targetH) {
  gltfLoader.load(
    filename,
    (gltf) => {
      const model = gltf.scene;

      const bbox = new THREE.Box3().setFromObject(model);
      const size = bbox.getSize(new THREE.Vector3());

      if (size.x > 0 && size.z > 0 && size.y > 0) {
        const scaleX = targetW / size.x;
        const scaleZ = targetD / size.z;
        const autoScale = Math.min(scaleX, scaleZ) * 0.92;
        model.scale.setScalar(autoScale);
      }

      bbox.setFromObject(model);
      const center = bbox.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= bbox.min.y;

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          selectableObjects.push(child);
        }
      });

      // Ensure fallback base mesh stays hidden
      if (group.children[0]) {
        group.children[0].visible = false;
      }
      group.add(model);
    },
    null,
    (err) => {
      console.warn(`GLB load fallback for ${filename}`, err);
    }
  );
}

function loadTreeLandscaping() {
  const treeGroup = new THREE.Group();
  treeGroup.name = 'Campus Canadian Pine Trees';
  scene.add(treeGroup);

  gltfLoader.load(
    'low_poly_forest_tree_pack.glb',
    (gltf) => {
      const fullModel = gltf.scene;
      const bbox = new THREE.Box3().setFromObject(fullModel);
      const size = bbox.getSize(new THREE.Vector3());

      let treeScale = 0.04;
      if (size.y > 0 && size.y < 10) {
        treeScale = 0.5 / size.y;
      }

      SPECIFIC_LANDSCAPE_CANOPIES.forEach((pos, idx) => {
        const wPos = svgToWorld(pos.x, pos.y);
        const clone = fullModel.clone();
        clone.scale.setScalar(treeScale * (0.8 + (idx % 3) * 0.2));
        clone.position.set(wPos.x, 0, wPos.z);
        clone.rotation.y = (idx * 60 * Math.PI) / 180;
        treeGroup.add(clone);
      });
    },
    null,
    (err) => {
      SPECIFIC_LANDSCAPE_CANOPIES.forEach((pos) => {
        const wPos = svgToWorld(pos.x, pos.y);
        const tree = createProceduralTree();
        tree.position.set(wPos.x, 0, wPos.z);
        treeGroup.add(tree);
      });
    }
  );
}

function createProceduralTree() {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1.0, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.5;
  trunk.castShadow = true;
  group.add(trunk);

  const canopyGeo = new THREE.ConeGeometry(1.0, 2.2, 6);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1f7a5c, roughness: 0.6 });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 2.0;
  canopy.castShadow = true;
  group.add(canopy);

  return group;
}

function addSceneTreeItem(id, name, type) {
  const list = document.getElementById('scene-tree-list');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'tree-item';
  div.dataset.id = id;
  div.innerHTML = `
    <span>${name}</span>
    <span class="badge">${type}</span>
  `;
  div.addEventListener('click', () => {
    const obj = sceneObjectMap.get(id);
    if (obj) selectObject(obj);
  });
  list.appendChild(div);
}

function updateZoneCountBadge() {
  const el = document.getElementById('zone-count');
  if (el) el.innerText = `${sceneObjectMap.size} Items`;
}

function selectObject(obj) {
  if (!obj) return;

  if (selectedObject) {
    const prevOutline = selectedObject.getObjectByName('selectionOutline');
    if (prevOutline) prevOutline.visible = false;
  }

  let rootObj = obj;
  while (rootObj.parent && rootObj.parent !== scene && rootObj.parent !== roadNetworkGroup && !rootObj.userData?.id) {
    rootObj = rootObj.parent;
  }

  selectedObject = rootObj;
  transformControls.attach(selectedObject);

  const outline = selectedObject.getObjectByName('selectionOutline');
  if (outline) outline.visible = true;

  document.querySelectorAll('.tree-item').forEach((el) => {
    el.classList.toggle('selected', el.dataset.id === rootObj.userData?.id);
  });

  updateInspectorFromObject(selectedObject);

  const inspectorDrawer = document.getElementById('drawer-inspector');
  if (inspectorDrawer) inspectorDrawer.classList.remove('collapsed');
}

function deselectObject() {
  if (selectedObject) {
    const outline = selectedObject.getObjectByName('selectionOutline');
    if (outline) outline.visible = false;
  }

  selectedObject = null;
  transformControls.detach();
  document.querySelectorAll('.tree-item').forEach((el) => el.classList.remove('selected'));

  const inspectorDrawer = document.getElementById('drawer-inspector');
  if (inspectorDrawer) inspectorDrawer.classList.add('collapsed');
}

function updateInspectorFromObject(obj) {
  if (!obj) return;

  const data = obj.userData || {};
  const title = document.getElementById('inspect-title');
  const sub = document.getElementById('inspect-subtitle');
  if (title) title.innerText = data.name || obj.name || 'Selected Object';
  if (sub) sub.innerText = `ID: ${data.id || 'N/A'} | Type: ${data.type || 'Custom Asset'}`;

  document.getElementById('inp-pos-x').value = obj.position.x.toFixed(2);
  document.getElementById('inp-pos-y').value = obj.position.y.toFixed(2);
  document.getElementById('inp-pos-z').value = obj.position.z.toFixed(2);

  const rotYDeg = (obj.rotation.y * 180) / Math.PI;
  document.getElementById('inp-rot-y').value = rotYDeg.toFixed(0);

  document.getElementById('inp-scale-x').value = obj.scale.x.toFixed(2);
  document.getElementById('inp-scale-y').value = obj.scale.y.toFixed(2);
  document.getElementById('inp-scale-z').value = obj.scale.z.toFixed(2);

  const telem = data.telemetry || { occupancy: '150 / 300', temp: '22.0°C', power: '85 kW', aqi: '15 (Good)' };
  document.getElementById('stat-occupancy').innerText = telem.occupancy;
  document.getElementById('stat-temp').innerText = telem.temp;
  document.getElementById('stat-power').innerText = telem.power;
  document.getElementById('stat-aqi').innerText = telem.aqi;
}

function setupEventListeners() {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName !== 'CANVAS') return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (isDrawingRoadPath) {
      const intersects = raycaster.intersectObject(groundMesh);
      if (intersects.length > 0) {
        addWaypointAtPoint(intersects[0].point);
      }
      return;
    }

    const intersects = raycaster.intersectObjects(scene.children, true);
    for (let hit of intersects) {
      let current = hit.object;
      if (current === groundGrid || current === groundMesh || current.type === 'TransformControlsPlane') continue;

      while (current.parent && current.parent !== scene) {
        if (current.userData && (current.userData.id || current.userData.parentRoadGroup)) {
          selectObject(current.userData.parentRoadGroup || current);
          return;
        }
        current = current.parent;
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObject && e.target.tagName !== 'INPUT') {
      deleteSelectedObject();
    }
    if (e.key === 'Escape') {
      if (isDrawingRoadPath) finishWaypointRoadTool();
      else deselectObject();
    }
  });

  // Drawer Toggle Handlers
  document.getElementById('toggle-road-builder-btn')?.addEventListener('click', () => {
    document.getElementById('drawer-road-builder')?.classList.toggle('collapsed');
  });
  document.getElementById('close-road-builder-btn')?.addEventListener('click', () => {
    document.getElementById('drawer-road-builder')?.classList.add('collapsed');
  });

  document.getElementById('toggle-ground-mode-btn')?.addEventListener('click', () => {
    landViewMode = !landViewMode;
    if (groundGrid) groundGrid.visible = !landViewMode;
    showToast(landViewMode ? 'Switched to Realistic Canadian Land View' : 'Switched to Blueprint Grid View');
  });

  document.getElementById('toggle-layers-btn')?.addEventListener('click', () => {
    document.getElementById('drawer-layers')?.classList.toggle('collapsed');
  });
  document.getElementById('toggle-inspector-btn')?.addEventListener('click', () => {
    document.getElementById('drawer-inspector')?.classList.toggle('collapsed');
  });
  document.getElementById('close-inspector-btn')?.addEventListener('click', deselectObject);

  // Gizmo Modes
  document.getElementById('tool-translate')?.addEventListener('click', (e) => {
    transformControls.setMode('translate');
    setActiveButton('#gizmo-tools .btn', e.currentTarget);
  });
  document.getElementById('tool-rotate')?.addEventListener('click', (e) => {
    transformControls.setMode('rotate');
    setActiveButton('#gizmo-tools .btn', e.currentTarget);
  });
  document.getElementById('tool-scale')?.addEventListener('click', (e) => {
    transformControls.setMode('scale');
    setActiveButton('#gizmo-tools .btn', e.currentTarget);
  });
  document.getElementById('tool-deselect')?.addEventListener('click', deselectObject);

  // Road Preset Buttons
  document.getElementById('btn-add-road-straight')?.addEventListener('click', () => addPresetRoadPiece('straight'));
  document.getElementById('btn-add-road-curve')?.addEventListener('click', () => addPresetRoadPiece('curve'));
  document.getElementById('btn-add-road-tjunction')?.addEventListener('click', () => addPresetRoadPiece('tjunction'));
  document.getElementById('btn-add-road-cross')?.addEventListener('click', () => addPresetRoadPiece('cross'));

  document.getElementById('btn-draw-road-path')?.addEventListener('click', startWaypointRoadTool);
  document.getElementById('btn-finish-draw-road')?.addEventListener('click', finishWaypointRoadTool);

  document.getElementById('btn-delete-selected-road')?.addEventListener('click', deleteSelectedObject);
  document.getElementById('btn-reset-roads')?.addEventListener('click', resetRoads);

  // Inspector Inputs
  const updateObjectFromInputs = () => {
    if (!selectedObject) return;
    const px = parseFloat(document.getElementById('inp-pos-x').value) || 0;
    const py = parseFloat(document.getElementById('inp-pos-y').value) || 0;
    const pz = parseFloat(document.getElementById('inp-pos-z').value) || 0;
    selectedObject.position.set(px, py, pz);

    const ry = parseFloat(document.getElementById('inp-rot-y').value) || 0;
    selectedObject.rotation.y = (ry * Math.PI) / 180;

    const sx = parseFloat(document.getElementById('inp-scale-x').value) || 1;
    const sy = parseFloat(document.getElementById('inp-scale-y').value) || 1;
    const sz = parseFloat(document.getElementById('inp-scale-z').value) || 1;
    selectedObject.scale.set(sx, sy, sz);

    saveLayoutToLocalStorage(false);
    saveRoadsToLocalStorage(false);
  };

  ['inp-pos-x', 'inp-pos-y', 'inp-pos-z', 'inp-rot-y', 'inp-scale-x', 'inp-scale-y', 'inp-scale-z'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateObjectFromInputs);
  });

  // Navigation Toolbar Controls
  document.getElementById('nav-zoom-in')?.addEventListener('click', () => zoomCamera(-15));
  document.getElementById('nav-zoom-out')?.addEventListener('click', () => zoomCamera(15));
  document.getElementById('nav-pan-left')?.addEventListener('click', () => panCamera(-10, 0));
  document.getElementById('nav-pan-right')?.addEventListener('click', () => panCamera(10, 0));
  document.getElementById('nav-pan-up')?.addEventListener('click', () => panCamera(0, -10));
  document.getElementById('nav-pan-down')?.addEventListener('click', () => panCamera(0, 10));

  document.getElementById('nav-view-top')?.addEventListener('click', (e) => {
    setActiveButton('.bottom-nav-bar .btn', e.currentTarget);
    setCameraTarget(new THREE.Vector3(0, 115, 0.1), new THREE.Vector3(0, 0, 0));
  });

  document.getElementById('nav-view-iso')?.addEventListener('click', (e) => {
    setActiveButton('.bottom-nav-bar .btn', e.currentTarget);
    setCameraTarget(new THREE.Vector3(0, 95, 95), new THREE.Vector3(0, 0, 0));
  });

  document.getElementById('nav-view-reset')?.addEventListener('click', (e) => {
    setActiveButton('.bottom-nav-bar .btn', document.getElementById('nav-view-iso'));
    setCameraTarget(new THREE.Vector3(0, 95, 95), new THREE.Vector3(0, 0, 0));
  });

  document.getElementById('btn-save-layout')?.addEventListener('click', () => {
    saveLayoutToLocalStorage(true);
    saveRoadsToLocalStorage(true);
  });

  document.getElementById('btn-reset-layout')?.addEventListener('click', () => {
    resetLayout();
    resetRoads();
  });
}

function zoomCamera(delta) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  camera.position.addScaledVector(dir, -delta * 0.4);
}

function panCamera(deltaX, deltaZ) {
  controls.target.x += deltaX * 0.4;
  controls.target.z += deltaZ * 0.4;
  camera.position.x += deltaX * 0.4;
  camera.position.z += deltaZ * 0.4;
}

function setActiveButton(selector, activeEl) {
  if (!activeEl) return;
  document.querySelectorAll(selector).forEach((b) => b.classList.remove('active'));
  activeEl.classList.add('active');
}

function setCameraTarget(pos, lookAt) {
  targetCameraPos = pos;
  targetLookAt = lookAt;
}

function saveLayoutToLocalStorage(showNotification = true) {
  const layout = {};
  sceneObjectMap.forEach((obj, id) => {
    if (obj.userData?.type !== 'road') {
      layout[id] = {
        pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotY: obj.rotation.y,
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
      };
    }
  });
  localStorage.setItem('amo_campus_layout', JSON.stringify(layout));
  if (showNotification) {
    showToast('Saved custom 3D layout!');
  }
}

function resetLayout() {
  localStorage.removeItem('amo_campus_layout');
  DEFAULT_CAMPUS_ZONES.forEach((zone) => {
    const obj = sceneObjectMap.get(zone.id);
    const worldPos = svgToWorld(zone.svgX, zone.svgY);
    if (obj) {
      obj.position.set(worldPos.x, 0, worldPos.z);
      obj.rotation.set(0, 0, 0);
      obj.scale.set(1, 1, 1);
    }
  });
  showToast('Reset Campus layout to default map positions');
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  if (targetCameraPos && targetLookAt) {
    camera.position.lerp(targetCameraPos, 0.08);
    controls.target.lerp(targetLookAt, 0.08);
    if (camera.position.distanceTo(targetCameraPos) < 0.1) {
      targetCameraPos = null;
      targetLookAt = null;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', init);
