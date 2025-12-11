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

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) {
        mixer.update(delta);
    }
    renderer.render(scene, camera);
}

let currentAction;

function playAnimation(animationName) {
    if (!mixer || !model) return;
    const animations = model.animations;
    const clip = THREE.AnimationClip.findByName(animations, animationName);
    if (clip) {
        const newAction = mixer.clipAction(clip);
        if (currentAction && currentAction !== newAction) {
            currentAction.fadeOut(0.5);
        }
        newAction.reset().fadeIn(0.5).play();
        currentAction = newAction;
    }
}

window.addEventListener('load', initDealer);
