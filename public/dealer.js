// dealer.js

let scene, camera, renderer, model, mixer;

function initDealer() {
    const container = document.getElementById('dealer-canvas-container');
    if (!container) return;

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    // Load model
    const loader = new THREE.GLTFLoader();
    loader.load(
        'dealer.glb',
        function (gltf) {
            model = gltf.scene;
            scene.add(model);
            mixer = new THREE.AnimationMixer(model);
            playAnimation('newuser.001');
        },
        undefined,
        function (error) {
            console.error(error);
        }
    );

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    if (mixer) {
        mixer.update(0.016);
    }
    renderer.render(scene, camera);
}

function playAnimation(animationName) {
    if (!mixer || !model) return;
    const animations = model.animations;
    const clip = THREE.AnimationClip.findByName(animations, animationName);
    if (clip) {
        const action = mixer.clipAction(clip);
        action.reset().play();
    }
}

window.addEventListener('load', initDealer);
