const tower = document.querySelector('#tower');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let libraries;

function loadLibraries() {
  libraries ??= Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]);
  return libraries;
}

async function showModel(stage, name) {
  const [T, { GLTFLoader }] = await loadLibraries();
  const { scene: model } = await new GLTFLoader().loadAsync('/media/models/' + name + '.glb');
  const isTower = name === 'desktop';
  const bounds = new T.Box3();
  const center = new T.Vector3();
  const size = new T.Vector3();
  model.updateMatrixWorld(true);
  if (isTower) {
    // The source desktop model contains a whole desk setup. Isolate the tower.
    for (const object of [...model.children]) {
      bounds.setFromObject(object).getCenter(center);
      bounds.getSize(size);
      if (center.z > -2.4 || center.z < -4.9 || size.z > 3.1 || size.x > 4.7 || size.y > 4.6) {
        object.removeFromParent();
      }
    }
  }
  bounds.setFromObject(model);
  if (bounds.isEmpty()) throw new Error('The model has no visible geometry.');
  bounds.getCenter(center);
  const scale = 3.65 / bounds.getSize(size).length();
  const scene = new T.Scene();
  const turntable = new T.Group();
  turntable.scale.setScalar(scale);
  turntable.add(model);
  model.position.sub(center);
  scene.add(turntable);
  const camera = new T.PerspectiveCamera(34, 1, .1, 60);
  camera.position.set(isTower ? 2.55 : 2.4, isTower ? 1.3 : 2.25, 6.1);
  camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight(0xfff5f2, 0xb48387, 2.35));
  for (const [color, power, position] of [[0xffffff, 4.5, [3, 5, 4]], [0xff333b, 4, [-3, 2, -2]]]) {
    const light = new T.DirectionalLight(color, power);
    light.position.set(...position);
    scene.add(light);
  }
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);
  const render = () => renderer.render(scene, camera);
  const resize = () => {
    if (!stage.clientWidth || !stage.clientHeight) return;
    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    render();
  };

  let hinge;
  if (isTower) {
    const glass = model.children.find(object => (object.userData.name || object.name).replace('.', '') === 'Cube012');
    if (glass) {
      scene.updateMatrixWorld(true);
      bounds.setFromObject(glass);
      bounds.getCenter(center);
      hinge = new T.Group();
      hinge.position.set(bounds.min.x, center.y, center.z);
      model.add(hinge);
      worldToModel(hinge, model);
      hinge.attach(glass);
    }
  }

  resize();
  stage.classList.add('is-ready');
  new ResizeObserver(resize).observe(stage);
  let rotation = 0;
  let open = false;
  let manual = false;
  let frame;
  const toggle = document.querySelector('#case-toggle');
  const turn = document.querySelector('#case-rotate');
  function draw() {
    frame = undefined;
    const factor = reducedMotion.matches ? 1 : .16;
    turntable.rotation.y += (rotation - turntable.rotation.y) * factor;
    const target = open ? -1.28 : 0;
    if (hinge) hinge.rotation.y += (target - hinge.rotation.y) * factor;
    render();
    if (Math.abs(rotation - turntable.rotation.y) > .002 || (hinge && Math.abs(target - hinge.rotation.y) > .002)) {
      animate();
    }
  }
  function animate() {
    frame ??= requestAnimationFrame(draw);
  }
  function setOpen(value) {
    if (open === value) return;
    open = value;
    toggle.setAttribute('aria-pressed', String(open));
    toggle.textContent = open ? 'Close side panel' : 'Open side panel';
    animate();
  }
  function rotate() {
    rotation += Math.PI / 4;
    animate();
  }
  if (isTower) {
    turn.hidden = false;
    turn.addEventListener('click', rotate);
    if (hinge) {
      toggle.hidden = false;
      toggle.addEventListener('click', () => { manual = true; setOpen(!open); });
      const reveal = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !manual && !reducedMotion.matches) {
          setOpen(true);
          reveal.disconnect();
        }
      }, { threshold: .75 });
      reveal.observe(stage);
    }
  }
  return rotate;
}

function worldToModel(hinge, model) {
  model.updateWorldMatrix(true, false);
  model.worldToLocal(hinge.position);
  hinge.updateWorldMatrix(true, false);
}

async function openModel(stage, name) {
  try {
    return await showModel(stage, name);
  } catch {
    stage.querySelector('.stage-note').textContent = '3D preview unavailable on this device.';
    return null;
  }
}

if (tower) {
  const start = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    start.disconnect();
    openModel(tower, 'desktop');
  }, { rootMargin: '200px' });
  start.observe(tower);
}

for (const control of document.querySelectorAll('[data-model]')) {
  const name = control.dataset.model;
  control.addEventListener('click', async () => {
    control.disabled = true;
    const stage = document.querySelector('#model-' + name);
    stage.querySelector('.stage-note').textContent = 'Loading 3D model…';
    const rotate = await openModel(stage, name);
    control.disabled = false;
    if (!rotate) { control.textContent = '3D preview unavailable'; control.disabled = true; return; }
    control.textContent = 'Turn ' + name;
    control.onclick = rotate;
    control.removeAttribute('data-model');
  }, { once: true });
}
