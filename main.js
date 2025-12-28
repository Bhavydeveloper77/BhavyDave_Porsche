import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// Configuration
const CONFIG = {
    bgColor: 0x111111, // Solid dark background
    fogColor: 0x111111,
    fogDensity: 0.01,
    modelUrl: '/Porsche911.glb',
    // Studio Showroom HDR for reflections ONLY (not background)
    hdrUrl: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_05_1k.hdr',
    engineSoundUrl: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_5bep7532d5.mp3'
};

// State
const state = {
    isLoading: true,
    loadingProgress: 0,
    scrollProgress: 0,
    engineStarted: false,
    userInteracting: false
};

// Selectors
const container = document.getElementById('canvas-container');
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const titleElement = document.querySelector('header h1');
const subtitleElement = document.querySelector('header p');
const startBtn = document.getElementById('start-engine-btn');
const infoSections = document.querySelectorAll('.info-section');

// Audio Setup
const listener = new THREE.AudioListener();
const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();

// Variables
let carModel = null;
let headLights = [];
let tailLights = [];

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.bgColor); // Explicit solid color
scene.fog = new THREE.FogExp2(CONFIG.fogColor, CONFIG.fogDensity);

// Camera Setup
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
const initialCameraPos = { x: 5, y: 2, z: 5 };
camera.position.set(initialCameraPos.x, initialCameraPos.y, initialCameraPos.z);
scene.add(camera);

// Renderer Setup
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); // Alpha false for solid color
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 5; // Fixed distance constraints
controls.maxDistance = 10;
controls.enableZoom = false; // TRANSFORMED: Zoom Completely Disabled
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

// Interaction detection
controls.addEventListener('start', () => { state.userInteracting = true; });
controls.addEventListener('end', () => { setTimeout(() => state.userInteracting = false, 2000); });


// Showroom Podium (Visible Base)
const geometry = new THREE.CylinderGeometry(6, 6, 0.2, 64);
const material = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.2,
    metalness: 0.5
});
const podium = new THREE.Mesh(geometry, material);
podium.position.y = -0.1;
podium.receiveShadow = true;
scene.add(podium);

// Shadow Catcher (on top of podium for soft shadows)
const shadowGeo = new THREE.PlaneGeometry(12, 12);
const shadowMat = new THREE.ShadowMaterial({ opacity: 0.5 });
const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = 0.01;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);


// Lighting Setup (Studio)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// Key Light
const spotLight = new THREE.SpotLight(0xffffff, 100);
spotLight.position.set(5, 8, 5);
spotLight.angle = Math.PI / 6;
spotLight.penumbra = 0.5;
spotLight.castShadow = true;
scene.add(spotLight);

// Fill Light
const fillLight = new THREE.RectAreaLight(0xffffff, 2, 10, 10);
fillLight.position.set(-5, 2, 0);
fillLight.lookAt(0, 0, 0);
scene.add(fillLight);

// Rim Light
const rimLight = new THREE.SpotLight(0xffffff, 50);
rimLight.position.set(0, 5, -8);
rimLight.lookAt(0, 0, 0);
scene.add(rimLight);


// Asset Loading
const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = (itemsLoaded / itemsTotal) * 100;
    loadingBar.style.width = `${progress}%`;
};

loadingManager.onLoad = () => {
    setTimeout(() => {
        state.isLoading = false;
        loadingScreen.classList.add('hidden');
        titleElement.innerText = "The Showroom";
        subtitleElement.innerText = "Scroll to Inspect";
    }, 500);
};

// Load HDR (Reflections Only)
new RGBELoader(loadingManager)
    .load(CONFIG.hdrUrl, function (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        // scene.background = texture; // DISABLED: We want solid color
    });

// Load Audio
audioLoader.load(CONFIG.engineSoundUrl, function (buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(1.0);
});

// Load Model
const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.load(CONFIG.modelUrl, function (gltf) {
    const model = gltf.scene;
    carModel = model;

    // Auto-center and scale
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 4.0 / maxDim;
    model.scale.set(scale, scale, scale);

    // Re-calculate box
    const box2 = new THREE.Box3().setFromObject(model);

    // Drive-In Animation
    const targetZ = 0;
    const startZ = -50;
    model.position.set(0, -box2.min.y, startZ);
    model.rotation.y = -Math.PI / 12;

    let driveProgress = 0;
    const driveSpeed = 0.008;

    controls.enabled = false;
    controls.autoRotate = false;

    function driveInAnimation() {
        if (!state.isLoading) {
            driveProgress += driveSpeed;
            const t = 1 - Math.pow(1 - driveProgress, 3);
            model.position.z = startZ + (targetZ - startZ) * t;

            if (driveProgress >= 1) {
                model.position.z = targetZ;
                controls.enabled = true;
                controls.autoRotate = true;
                state.userInteracting = false;
                return;
            }
        }
        requestAnimationFrame(driveInAnimation);
    }
    setTimeout(driveInAnimation, 800);

    // Materials
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
                child.material.envMapIntensity = 1.0;
                if (child.material.name.toLowerCase().includes('body') || child.material.name.toLowerCase().includes('paint')) {
                    child.material.clearcoat = 1.0;
                    child.material.roughness = 0.15;
                    child.material.metalness = 0.8;
                }
            }
        }
    });

    // Lights (Head/Tail) are attached similarly...
    // Headlights
    const hLight1 = new THREE.SpotLight(0xffffff, 0);
    hLight1.position.set(0.7, 0.65, 1.8);
    hLight1.target.position.set(0.7, 0.2, 5);
    hLight1.angle = Math.PI / 6;
    hLight1.penumbra = 0.4;
    model.add(hLight1);
    model.add(hLight1.target);
    headLights.push(hLight1);

    const hLight2 = new THREE.SpotLight(0xffffff, 0);
    hLight2.position.set(-0.7, 0.65, 1.8);
    hLight2.target.position.set(-0.7, 0.2, 5);
    hLight2.angle = Math.PI / 6;
    hLight2.penumbra = 0.4;
    model.add(hLight2);
    model.add(hLight2.target);
    headLights.push(hLight2);

    const tLight1 = new THREE.PointLight(0xff0000, 0, 2);
    tLight1.position.set(0, 0.75, -1.9);
    model.add(tLight1);
    tailLights.push(tLight1);

    scene.add(model);
});

// Start Engine Logic
if (startBtn) {
    startBtn.addEventListener('click', () => {
        state.engineStarted = !state.engineStarted;
        if (state.engineStarted) {
            sound.play();
            startBtn.classList.add('active');
            headLights.forEach(l => l.intensity = 150);
            tailLights.forEach(l => l.intensity = 8);
        } else {
            sound.stop();
            startBtn.classList.remove('active');
            headLights.forEach(l => l.intensity = 0);
            tailLights.forEach(l => l.intensity = 0);
        }
    });
}

// Cinematic Scroll Animation (Orbit Only)
function updateCameraFromScroll() {
    const scrollY = window.scrollY;
    // We actually want standard scrolling feel.
    // The previous logic used 'maxScroll' to control the FULL animation.
    // We will keep this direct mapping because "normal scroll" usually implies
    // the user drags the scrollbar and the page content moves.
    // Our info sections MOVE up. The camera rotates. This IS normal scroll behavior 
    // for parallax sites.

    const maxScroll = document.body.offsetHeight - window.innerHeight;
    const scrollFraction = Math.max(0, Math.min(1, scrollY / maxScroll));

    state.scrollProgress = scrollFraction;

    const radius = 7.5;
    const height = 2.5;

    // Rotate 360 degrees over the full scroll
    const startAngle = Math.PI / 4;
    const totalRotation = Math.PI * 2;
    const currentAngle = startAngle + (scrollFraction * totalRotation);

    const x = Math.sin(currentAngle) * radius;
    const z = Math.cos(currentAngle) * radius;
    const targetPos = new THREE.Vector3(x, height, z);

    // Strict Camera control
    if (!state.userInteracting) {
        camera.position.copy(targetPos);
        camera.lookAt(0, 0.5, 0);
        controls.autoRotate = false;
    }

    // Info Sections
    infoSections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.75) {
            section.classList.add('visible');
        } else {
            section.classList.remove('visible');
        }
    });
}
window.addEventListener('scroll', updateCameraFromScroll);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (!state.userInteracting && state.scrollProgress < 0.05) {
        controls.autoRotate = true;
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateCameraFromScroll();
});
