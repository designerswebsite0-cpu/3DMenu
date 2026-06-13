import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// DOM Elements
const previewContainer = document.getElementById('preview-container');
const loadingOverlay = document.getElementById('loading-overlay');
const progressBarFill = document.getElementById('progress-bar-fill');
const loadingPercentage = document.getElementById('loading-percentage');
const loadingText = document.getElementById('loading-text');

const arButton = document.getElementById('ar-button');
const desktopFallback = document.getElementById('desktop-fallback');
const fallbackQr = document.getElementById('fallback-qr');

const arOverlay = document.getElementById('ar-overlay');
const arClose = document.getElementById('ar-close');
const arControls = document.getElementById('ar-controls');
const arReset = document.getElementById('ar-reset');
const arStatusTitle = document.getElementById('ar-status-title');
const arStatusDesc = document.getElementById('ar-status-desc');
const arStatusIndicator = document.getElementById('ar-status-indicator');

// Application State
let burgerModel = null;
let isModelLoaded = false;

// 3D Preview State (Landing Page)
let previewScene, previewCamera, previewRenderer, previewControls;
let previewAnimId = null;

// AR State
let xrSession = null;
let arRenderer = null;
let arScene, arCamera, arGroup, arReticle;
let hitTestSource = null;
let localRefSpace = null;
let viewerRefSpace = null;

let burgerPlaced = false;

// Interaction / Gesture State
const activePointers = {};
let initialPinchDistance = 0;
let initialModelScale = 1.0;

// Initialize Landing Page Preview and WebXR Checks
initLandingPage();
checkWebXRSupport();

/**
 * 1. LANDING PAGE PREVIEW SYSTEM
 */
function initLandingPage() {
  // Create Scene
  previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color('#ffffff');

  // Create Camera
  const aspect = previewContainer.clientWidth / previewContainer.clientHeight;
  previewCamera = new THREE.PerspectiveCamera(45, aspect, 0.01, 10);
  previewCamera.position.set(0, 0.15, 0.3); // High angle close-up look

  // Create Renderer
  previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  previewRenderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
  previewRenderer.shadowMap.enabled = true;
  previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  previewRenderer.toneMappingExposure = 1.1;
  previewContainer.appendChild(previewRenderer.domElement);

  // Orbit Controls
  previewControls = new OrbitControls(previewCamera, previewRenderer.domElement);
  previewControls.enableDamping = true;
  previewControls.dampingFactor = 0.05;
  previewControls.minDistance = 0.15;
  previewControls.maxDistance = 0.5;
  previewControls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent viewing from below
  previewControls.autoRotate = true;
  previewControls.autoRotateSpeed = 1.0;

  // Lights for Landing Page Preview
  const ambientLight = new THREE.AmbientLight('#fffaf4', 0.9);
  previewScene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight('#fffaed', 1.8);
  keyLight.position.set(0.3, 0.5, 0.4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.bias = -0.0002;
  previewScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#e3f2fd', 0.6);
  fillLight.position.set(-0.3, 0.2, -0.2);
  previewScene.add(fillLight);

  // Soft Floor Plane with Shadow
  const floorGeo = new THREE.PlaneGeometry(5, 5);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.15 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = -0.045; // Put slightly below model base
  floor.receiveShadow = true;
  previewScene.add(floor);

  // Load Model
  loadBurgerModel();

  // Animation Loop
  function animate() {
    previewAnimId = requestAnimationFrame(animate);
    previewControls.update();
    previewRenderer.render(previewScene, previewCamera);
  }
  animate();

  // Handle Resize
  window.addEventListener('resize', () => {
    if (!previewRenderer) return;
    const w = previewContainer.clientWidth;
    const h = previewContainer.clientHeight;
    previewCamera.aspect = w / h;
    previewCamera.updateProjectionMatrix();
    previewRenderer.setSize(w, h);
  });
}

/**
 * Loads the 78MB Burger.glb file and reports progress
 */
function loadBurgerModel() {
  const loader = new GLTFLoader();
  
  loadingText.textContent = "Delivering Ingredients...";
  
  loader.load(
    './public/Burger.glb',
    (gltf) => {
      burgerModel = gltf.scene;
      isModelLoaded = true;

      // Configure shadows and PBR settings on model
      burgerModel.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          // Optimize material properties for appetizing look
          if (node.material) {
            node.material.roughness = Math.max(node.material.roughness, 0.2);
            node.material.metalness = Math.min(node.material.metalness, 0.1);
          }
        }
      });

      // Align model center to (0,0,0) and ground it
      const box = new THREE.Box3().setFromObject(burgerModel);
      const center = new THREE.Vector3();
      box.getCenter(center);
      burgerModel.position.set(-center.x, -box.min.y - 0.045, -center.z); // Adjust offset to lay on ground shadow

      // Scale confirmation: model accessor bounding box is:
      // dimensions: [0.1207, 0.0900, 0.1250] meters.
      // This is exactly 12cm width, 9cm height, 12.5cm depth.
      // So model scale 1.0 is real-world perfect. We don't modify it.

      previewScene.add(burgerModel);

      // Hide loading screen with a fade-out animation
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500);

      // Enable AR Button if supported
      enableARButtonIfSupported();
    },
    (xhr) => {
      if (xhr.lengthComputable) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        progressBarFill.style.width = `${percent}%`;
        loadingPercentage.textContent = `${percent}%`;
        
        if (percent < 30) {
          loadingText.textContent = "Delivering Ingredients... (78MB)";
        } else if (percent < 60) {
          loadingText.textContent = "Grilling Angus Beef...";
        } else if (percent < 90) {
          loadingText.textContent = "Melting Vintage Cheddar...";
        } else {
          loadingText.textContent = "Assembling Premium Brioche...";
        }
      }
    },
    (error) => {
      console.error('An error happened while loading GLB:', error);
      loadingText.textContent = "Kitchen Error. Failed to load model.";
      loadingText.style.color = "#d32f2f";
      loadingPercentage.textContent = "✕";
    }
  );
}

/**
 * 2. AR CAPABILITY AND SUPPORT CHECK
 */
function checkWebXRSupport() {
  if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
      if (supported) {
        enableARButtonIfSupported();
      } else {
        showDesktopFallback();
      }
    });
  } else {
    showDesktopFallback();
  }
}

function enableARButtonIfSupported() {
  if (isModelLoaded && navigator.xr) {
    arButton.removeAttribute('disabled');
    arButton.querySelector('.btn-text').textContent = "View Burger in AR";
    arButton.addEventListener('click', startAR);
  }
}

function showDesktopFallback() {
  arButton.setAttribute('disabled', 'true');
  arButton.querySelector('.btn-text').textContent = "AR Mode Offline";
  arButton.querySelector('.btn-icon').textContent = "✕";
  
  // Set fallback QR code dynamic source
  const currentUrl = window.location.href;
  fallbackQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}&color=1a1917`;
  desktopFallback.classList.remove('hidden');
}

/**
 * 3. AR SESSION MANAGEMENT
 */
async function startAR() {
  if (xrSession) return;

  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'dom-overlay'],
      domOverlay: { root: arOverlay }
    });

    onSessionStarted(session);
  } catch (error) {
    console.error('Failed to start AR session:', error);
    alert('Could not start AR mode. Please ensure camera permission is granted and your device supports WebXR.');
  }
}

function onSessionStarted(session) {
  xrSession = session;

  // Stop landing page rendering loop to conserve battery/GPU
  if (previewAnimId) {
    cancelAnimationFrame(previewAnimId);
    previewAnimId = null;
  }

  // Set up AR Renderer (tied to XR session)
  arRenderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  });
  arRenderer.setPixelRatio(window.devicePixelRatio);
  arRenderer.setSize(window.innerWidth, window.innerHeight);
  arRenderer.shadowMap.enabled = true;
  arRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  arRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  arRenderer.toneMappingExposure = 1.0;
  arRenderer.xr.enabled = true;
  arRenderer.xr.setSession(session);

  // Set up AR Scene
  arScene = new THREE.Scene();

  // AR Camera (ThreeJS will update this automatically)
  arCamera = new THREE.PerspectiveCamera();

  // AR Lights (Appetizing warm key + bright ambient)
  const ambient = new THREE.AmbientLight('#ffffff', 1.0);
  arScene.add(ambient);

  const keyLight = new THREE.DirectionalLight('#fffaed', 2.0);
  keyLight.position.set(0.3, 1.5, 0.5);
  keyLight.castShadow = true;
  // Dynamic shadows setup
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 0.05;
  keyLight.shadow.camera.far = 4.0;
  // Strict shadow box matching 12cm scale
  keyLight.shadow.camera.left = -0.3;
  keyLight.shadow.camera.right = 0.3;
  keyLight.shadow.camera.top = 0.3;
  keyLight.shadow.camera.bottom = -0.3;
  keyLight.shadow.bias = -0.001;
  arScene.add(keyLight);

  // AR Reticle for Plane Mapping
  const reticleGeo = new THREE.RingGeometry(0.045, 0.05, 32);
  reticleGeo.rotateX(-Math.PI / 2);
  const reticleMat = new THREE.MeshBasicMaterial({
    color: '#b08435',
    side: THREE.DoubleSide
  });
  arReticle = new THREE.Mesh(reticleGeo, reticleMat);
  arReticle.matrixAutoUpdate = false;
  arReticle.visible = false;
  arScene.add(arReticle);

  // Create AR Group (to hold Burger model and Shadow plane, and apply gestures)
  arGroup = new THREE.Group();
  arGroup.visible = false;
  arScene.add(arGroup);

  // Create Invisible Shadow-Only plane under the Burger
  const shadowPlaneGeo = new THREE.PlaneGeometry(1.5, 1.5);
  shadowPlaneGeo.rotateX(-Math.PI / 2);
  const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.55 });
  const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  shadowPlane.receiveShadow = true;
  arGroup.add(shadowPlane);

  // Move the Burger GLB from landing page to the AR group
  if (burgerModel) {
    // Reset position inside the group so it sits on the shadow plane
    burgerModel.position.set(0, 0, 0); 
    burgerModel.rotation.set(0, 0, 0);
    burgerModel.scale.set(1.0, 1.0, 1.0); // Start at exactly 1:1 real scale
    arGroup.add(burgerModel);
  }

  // Setup WebXR Hit Test
  session.requestReferenceSpace('viewer').then((refSpace) => {
    viewerRefSpace = refSpace;
    session.requestHitTestSource({ space: viewerRefSpace }).then((source) => {
      hitTestSource = source;
    });
  });

  session.requestReferenceSpace('local').then((refSpace) => {
    localRefSpace = refSpace;
  });

  // Display WebXR HUD
  arOverlay.style.display = 'flex';
  
  // Register DOM Overlay Touch Gestures
  setupOverlayGestures();

  // Run AR Animation Loop
  arRenderer.setAnimationLoop(onXRFrame);

  // Handle Session End
  session.addEventListener('end', onSessionEnded);
}

function onSessionEnded() {
  xrSession = null;
  hitTestSource = null;
  localRefSpace = null;
  viewerRefSpace = null;
  burgerPlaced = false;

  // Hide HUD
  arOverlay.style.display = 'none';
  arControls.classList.add('hidden');
  
  // Clean up WebGL AR resources
  if (arRenderer) {
    arRenderer.setAnimationLoop(null);
    arRenderer.dispose();
    arRenderer = null;
  }

  // Restore model to landing page preview scene
  if (burgerModel) {
    // Re-adjust offset for landing page preview box
    const box = new THREE.Box3().setFromObject(burgerModel);
    const center = new THREE.Vector3();
    box.getCenter(center);
    burgerModel.position.set(-center.x, -box.min.y - 0.045, -center.z);
    burgerModel.rotation.set(0, 0, 0);
    burgerModel.scale.set(1.0, 1.0, 1.0);
    previewScene.add(burgerModel);
  }

  // Clear pointers
  for (const id in activePointers) delete activePointers[id];

  // Restart landing page render loop
  initLandingPage();
}

/**
 * 4. WEBXR ANIMATION AND HIT-TEST LOOP
 */
function onXRFrame(time, frame) {
  if (!xrSession) return;

  const session = frame.session;
  
  // Get pose of device relative to environment
  const pose = frame.getViewerPose(localRefSpace);
  
  if (pose && hitTestSource) {
    const hitTestResults = frame.getHitTestResults(hitTestSource);

    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];
      const hitPose = hit.getPose(localRefSpace);

      // Map Reticle to detected horizontal plane
      arReticle.visible = true;
      arReticle.matrix.fromArray(hitPose.transform.matrix);

      if (!burgerPlaced) {
        arStatusTitle.textContent = "Surface Detected";
        arStatusDesc.textContent = "Tap anywhere on the screen to place the burger.";
        arStatusIndicator.className = "ar-status-ready";
      }
    } else {
      arReticle.visible = false;
      if (!burgerPlaced) {
        arStatusTitle.textContent = "Scanning Environment";
        arStatusDesc.textContent = "Move your phone slowly from side to side to map your table surface.";
        arStatusIndicator.className = "ar-status-pulse";
      }
    }
  }

  // Render Scene
  if (arRenderer) {
    arRenderer.render(arScene, arCamera);
  }
}

/**
 * 5. TOUCH GESTURES INTERACTION (DOM OVERLAY INTERCEPT)
 */
function setupOverlayGestures() {
  arOverlay.addEventListener('pointerdown', onPointerDown, { passive: true });
  arOverlay.addEventListener('pointermove', onPointerMove, { passive: true });
  arOverlay.addEventListener('pointerup', onPointerUp, { passive: true });
  arOverlay.addEventListener('pointercancel', onPointerUp, { passive: true });

  // Close AR Click
  arClose.addEventListener('click', () => {
    if (xrSession) xrSession.end();
  });

  // Reset Scale Click
  arReset.addEventListener('click', () => {
    if (burgerModel) {
      burgerModel.scale.set(1.0, 1.0, 1.0);
      burgerModel.rotation.set(0, 0, 0);
      arControls.classList.add('hidden'); // Hide reset button when back to 1.0
    }
  });
}

function onPointerDown(e) {
  activePointers[e.pointerId] = {
    x: e.clientX,
    y: e.clientY,
    startX: e.clientX,
    startY: e.clientY,
    time: Date.now()
  };

  const keys = Object.keys(activePointers);
  if (keys.length === 2 && burgerPlaced && burgerModel) {
    // 2 fingers: initialize pinch calculation
    const p1 = activePointers[keys[0]];
    const p2 = activePointers[keys[1]];
    initialPinchDistance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    initialModelScale = burgerModel.scale.x;
  }
}

function onPointerMove(e) {
  if (!activePointers[e.pointerId]) return;

  const prevX = activePointers[e.pointerId].x;
  activePointers[e.pointerId].x = e.clientX;
  activePointers[e.pointerId].y = e.clientY;

  const keys = Object.keys(activePointers);

  if (keys.length === 1 && burgerPlaced && burgerModel) {
    // 1 finger: Rotate model Y-axis
    const deltaX = e.clientX - prevX;
    burgerModel.rotation.y += deltaX * 0.007;
    
    // Show reset button if rotation departs from 0
    if (Math.abs(burgerModel.rotation.y) > 0.05) {
      arControls.classList.remove('hidden');
    }
  } else if (keys.length === 2 && burgerPlaced && burgerModel && initialPinchDistance > 0) {
    // 2 fingers: Pinch-to-scale
    const p1 = activePointers[keys[0]];
    const p2 = activePointers[keys[1]];
    const currentDistance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    
    if (currentDistance > 10) { // Avoid noise
      const scaleRatio = currentDistance / initialPinchDistance;
      let targetScale = initialModelScale * scaleRatio;
      
      // STRICT SCALING LIMITS: Minimum 0.8x, Maximum 1.5x
      targetScale = Math.max(0.8, Math.min(1.5, targetScale));
      
      burgerModel.scale.set(targetScale, targetScale, targetScale);
      
      // Show reset button if scale departs from 1.0
      if (Math.abs(targetScale - 1.0) > 0.02) {
        arControls.classList.remove('hidden');
      }
    }
  }
}

function onPointerUp(e) {
  const ptr = activePointers[e.pointerId];
  if (!ptr) return;

  const dragDistance = Math.hypot(e.clientX - ptr.startX, e.clientY - ptr.startY);
  const dragDuration = Date.now() - ptr.time;

  // Clean pointer reference
  delete activePointers[e.pointerId];
  initialPinchDistance = 0;

  // Single finger click check (drag distance is minimal and duration is short)
  if (dragDistance < 12 && dragDuration < 300 && Object.keys(activePointers).length === 0) {
    handleScreenTap();
  }
}

/**
 * Handles placing or moving the burger in response to screen taps
 */
function handleScreenTap() {
  if (!arReticle || !arReticle.visible || !burgerModel) return;

  // Get reticle translation matrix position
  const position = new THREE.Vector3();
  position.setFromMatrixPosition(arReticle.matrix);

  // Place/Move AR Group to Reticle position
  arGroup.position.copy(position);
  
  if (!burgerPlaced) {
    arGroup.visible = true;
    burgerPlaced = true;
  }

  // Update instructions overlay
  arStatusTitle.textContent = "Burger Placed";
  arStatusDesc.textContent = "• Swipe: Rotate • Pinch: Scale (0.8x - 1.5x) • Tap elsewhere: Reposition";
  arStatusIndicator.className = "ar-status-ready";
}
