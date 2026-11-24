const motion = matchMedia('(prefers-reduced-motion: reduce)');
const tower = document.querySelector('[data-tower]');
const stages = [...document.querySelectorAll('[data-drift], [data-tower]')];
const clamp = value => Math.max(0, Math.min(1, value));
let frame;
let drawTower;
let loading = false;

function update() {
  frame = undefined;
  const height = window.innerHeight;
  for (const stage of stages) {
    const bounds = stage.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > height) continue;
    const progress = motion.matches ? .5 : clamp((height - bounds.top) / (height + bounds.height * .6));
    stage.style.setProperty('--drift', (motion.matches ? 0 : (progress - .5) * -30) + 'px');
    stage.style.setProperty('--angle', (motion.matches ? 0 : (progress - .5) * 5) + 'deg');
    if (stage === tower) drawTower?.(progress);
  }
}

function schedule() {
  frame ??= requestAnimationFrame(update);
}

async function prepareTower() {
  if (loading || motion.matches) return;
  loading = true;
  try {
    const [T, { GLTFLoader }] = await Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]);
    const { scene: model } = await new GLTFLoader().loadAsync('/media/models/desktop.glb');
    const bounds = new T.Box3().setFromObject(model);
    const center = bounds.getCenter(new T.Vector3());
    const scale = 3.4 / bounds.getSize(new T.Vector3()).length();
    const scene = new T.Scene();
    const pivot = new T.Group();
    pivot.scale.setScalar(scale);
    model.position.sub(center);
    pivot.add(model);
    scene.add(pivot);
    scene.updateMatrixWorld(true);
    const panel = model.children.find(object => (object.userData.name || object.name) === 'SidePanel');
    let hinge;
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
    const camera = new T.PerspectiveCamera(36, 1, .1, 50);
    const light = (color, intensity, position) => {
      const source = new T.DirectionalLight(color, intensity);
      source.position.set(...position);
      scene.add(source);
    };
    scene.add(new T.HemisphereLight(0xfff6ef, 0x665c6f, 1.45));
    light(0xfff6f0, 2.5, [3, 5, 4]);
    light(0xff425d, 2, [-3, 2, -2]);
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .94;
    const canvas = renderer.domElement;
    tower.prepend(canvas);
    canvas.addEventListener('webglcontextlost', () => {
      drawTower = undefined;
      tower.classList.remove('is-live');
    });
    const render = progress => {
      const opening = clamp((progress - .19) / .53);
      const eased = opening * opening * (3 - 2 * opening);
      pivot.rotation.y = motion.matches ? 0 : .3 - .48 * progress;
      if (hinge) hinge.rotation.y = -1.1 * eased;
      camera.position.set(2.3 - eased * .64, 1.4 - .28 * eased, Math.max(5.8, 5.8 / camera.aspect));
      camera.lookAt(-.18 * eased, 0, 0);
      renderer.render(scene, camera);
    };
    const resize = () => {
      const { clientWidth, clientHeight } = tower;
      if (!clientWidth || !clientHeight) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
      schedule();
    };
    drawTower = render;
    resize();
    render(.5);
    tower.classList.add('is-live');
    new ResizeObserver(resize).observe(tower);
  } catch {
    // The rendered product image stays visible if WebGL or the model is unavailable.
  }
}

const start = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) prepareTower();
}, { rootMargin: '220px' });
if (tower) start.observe(tower);
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', schedule, { passive: true });
motion.addEventListener('change', () => {
  tower?.classList.toggle('is-live', Boolean(drawTower) && !motion.matches);
  if (!motion.matches && tower && tower.getBoundingClientRect().top < innerHeight) prepareTower();
  schedule();
});
schedule();
