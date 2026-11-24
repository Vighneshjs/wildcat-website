const motion = matchMedia('(prefers-reduced-motion: reduce)');
const stages = [...document.querySelectorAll('[data-models]')];
const scenes = new WeakMap();
const loading = new WeakSet();
const clamp = value => Math.max(0, Math.min(1, value));
const scrollPose = (top, height, viewport) => clamp((viewport * .86 - top) / (viewport * .58 + height * .14));
let frame;
let libraries;
let lastFrame = 0;

function schedule() {
  frame ??= requestAnimationFrame(update);
}

function update(time) {
  frame = undefined;
  if (motion.matches) return;
  for (const stage of stages) {
    const bounds = stage.getBoundingClientRect();
    if (bounds.bottom <= 0 || bounds.top >= innerHeight) continue;
    const state = scenes.get(stage);
    if (!state) continue;
    const target = scrollPose(bounds.top, bounds.height, height);
    state.progress ??= target;
    state.progress += (target - state.progress) * blend;
    state.render(state.progress, blend);
    if (Math.abs(target - state.progress) > .001) schedule();
  }
}

async function prepare(stage) {
  if (loading.has(stage) || motion.matches) return;
  loading.add(stage);
  try {
    libraries ??= Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/environments/RoomEnvironment.js')]);
    const [T, { GLTFLoader }, { RoomEnvironment }] = await libraries;
    const names = stage.dataset.models.split(' ');
    const isTower = names[0] === 'desktop';
    const isLaptop = names[0] === 'laptop-studio';
    const isPair = names.length > 1;
    const isBoard = names[0] === 'motherboard';
    const loader = new GLTFLoader();
    const models = await Promise.all(names.map(name => loader.loadAsync('/media/models/' + name + '.glb' + (name === 'laptop-studio' ? '?v=2' : ''))));
    const scene = new T.Scene();
    const turns = [];
    let hinge;
    models.forEach(({ scene: model }, index) => {
      const bounds = new T.Box3().setFromObject(model);
      const pivot = new T.Group();
      const size = isPair ? (index === 0 ? (isLaptop || isBoard ? 3.6 : 2.65) : (isLaptop || isBoard ? 1.45 : 1.95)) : 3.4;
      pivot.scale.setScalar(size / bounds.getSize(new T.Vector3()).length());
      model.position.sub(bounds.getCenter(new T.Vector3()));
      if (isPair) pivot.position.set(index === 0 ? (isLaptop || isBoard ? -1.28 : -1.08) : (isLaptop || isBoard ? 1.65 : 1.22), index === 0 ? -.18 : .24, 0);
      pivot.add(model);
      scene.add(pivot);
      turns.push(pivot);
      if (isTower) {
        scene.updateMatrixWorld(true);
        const panel = model.children.find(object => (object.userData.name || object.name) === 'SidePanel');
        if (panel) {
          const panelBounds = new T.Box3().setFromObject(panel);
          const position = panelBounds.getCenter(new T.Vector3());
          position.x = panelBounds.min.x;
          hinge = new T.Group();
          hinge.position.copy(model.worldToLocal(position));
          model.add(hinge);
          hinge.updateWorldMatrix(true, false);
          hinge.attach(panel);
        }
      }
    });

    const camera = new T.PerspectiveCamera(36, 1, .1, 50);
    const light = (color, intensity, position) => {
      const source = new T.DirectionalLight(color, intensity);
      source.position.set(...position);
      scene.add(source);
    };
    scene.add(new T.HemisphereLight(0xffffff, 0x3e3b43, .65));
    light(0xfff8f0, 1.15, [3, 5, 4]);
    light(0xff929e, .7, [-3, 2, -2]);
    light(0xe8efff, .55, [-3, 4, 6]);

    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isBoard ? .76 : .91;
    const studio = new RoomEnvironment();
    const generator = new T.PMREMGenerator(renderer);
    scene.environment = generator.fromScene(studio, .08).texture;
    scene.environmentIntensity = isBoard ? .55 : .85;
    studio.dispose();
    generator.dispose();
    const canvas = renderer.domElement;
    stage.prepend(canvas);
    let tiltX = 0;
    let tiltY = 0;
    let spin = 0;
    let dragX;

    let smoothX = 0;
    let smoothY = 0;
    const render = (progress, blend = 1) => {
      smoothX += (tiltX - smoothX) * blend;
      smoothY += (tiltY - smoothY) * blend;
      if (Math.abs(tiltX - smoothX) + Math.abs(tiltY - smoothY) > .003) schedule();
      const opening = clamp((progress - .19) / .53);
      const eased = opening * opening * (3 - 2 * opening);
      const motionProgress = clamp((progress - .05) / .78);
      const sweep = motionProgress * motionProgress * (3 - 2 * motionProgress);
      turns.forEach((pivot, index) => {
        const facing = isLaptop && index === 0 ? -1.60 : index ? -.17 : .3;
        const travel = isTower ? .48 : isLaptop ? .58 : isBoard ? .95 : .76;
        pivot.rotation.y = facing + (.5 - sweep) * travel + smoothX * .55 + spin;
        pivot.rotation.x = (isBoard ? -.30 : isPair ? -.19 : -.08) * (1 - sweep) + smoothY * .24;
      });
      if (hinge) hinge.rotation.y = -1.1 * eased;
      camera.position.set(isTower ? 2.3 - eased * .64 : .7, isTower ? 1.4 - .28 * eased : isBoard ? 3.15 : isLaptop ? 1.85 : 2.45,
        Math.max(isLaptop || isBoard ? 6.8 : 5.8, (isPair ? 7.25 : 5.6) / camera.aspect));
      camera.lookAt(isTower ? -.18 * eased : 0, 0, 0);
      renderer.render(scene, camera);
    };
    const resize = () => {
      const { clientWidth, clientHeight } = stage;
      if (!clientWidth || !clientHeight) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
      schedule();
    };
    canvas.addEventListener('webglcontextlost', () => {
      scenes.delete(stage);
      stage.classList.remove('is-live');
    });
    stage.addEventListener('pointerdown', event => {
      if (motion.matches || event.pointerType !== 'mouse' || event.button !== 0) return;
      event.preventDefault();
      dragX = event.clientX;
      stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener('pointermove', event => {
      if (motion.matches || event.pointerType !== 'mouse') return;
      if (dragX !== undefined) {
        spin += (event.clientX - dragX) * .012;
        dragX = event.clientX;
      } else {
        const bounds = stage.getBoundingClientRect();
        tiltX = (event.clientX - bounds.left) / bounds.width - .5;
        tiltY = (event.clientY - bounds.top) / bounds.height - .5;
      }
      schedule();
    });
    stage.addEventListener('lostpointercapture', () => { dragX = undefined; });
    stage.addEventListener('pointerleave', () => { tiltX = tiltY = 0; schedule(); });
    scenes.set(stage, { render });
    resize();
    const bounds = stage.getBoundingClientRect();
    const state = scenes.get(stage);
    state.progress = scrollPose(bounds.top, bounds.height, innerHeight);
    render(state.progress);
    stage.classList.toggle('is-live', !motion.matches);
    new ResizeObserver(resize).observe(stage);
  } catch {
    // A rendered product image remains visible if WebGL or a model is unavailable.
  }
}

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) prepare(entry.target);
}, { rootMargin: '140px' });
for (const stage of stages) observer.observe(stage);
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', schedule, { passive: true });
motion.addEventListener('change', () => {
  for (const stage of stages) {
    stage.classList.toggle('is-live', scenes.has(stage) && !motion.matches);
    stage.style.removeProperty('--drift');
    stage.style.removeProperty('--angle');
    const bounds = stage.getBoundingClientRect();
    if (!motion.matches && bounds.top < innerHeight && bounds.bottom > 0) prepare(stage);
  }
  schedule();
});
schedule();
