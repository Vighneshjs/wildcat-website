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
    camera.fov = camera.aspect < 1 ? 40 : 34;
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    render();
  };

  let hinge;
  if (isTower) {
    const glass = model.children.find(object => (object.userData.name || object.name) === 'SidePanel');
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
  let component;
  const toggle = document.querySelector('#case-toggle');
  const turn = document.querySelector('#case-rotate');
  const components = document.querySelector('#component-controls');
  const note = document.querySelector('#component-note');
  const parts = {
    graphics: { position: [-1.223, 1.927, -3.706], message: 'The graphics card renders your games. Choose one for your display resolution and frame-rate target.' },
    memory: { position: [-1.07, 2.71, -4.30], message: 'RAM holds the data your games and apps are using. Capacity and platform compatibility matter.' },
    cooling: { position: [-1.60, 2.68, -3.68], message: 'The CPU cooler and case fans move heat out of the system. Airflow and fan placement keep temperatures steadier.' },
  };
  const marker = document.createElement('span');
  marker.className = 'part-marker';
  marker.hidden = true;
  marker.setAttribute('aria-hidden', 'true');
  if (isTower) stage.append(marker);
  function draw() {
    frame = undefined;
    const factor = reducedMotion.matches ? 1 : .16;
    turntable.rotation.y += (rotation - turntable.rotation.y) * factor;
    const target = open ? -1.28 : 0;
    if (hinge) hinge.rotation.y += (target - hinge.rotation.y) * factor;
    const cameraTarget = open ? [1.75, 1.05, 5.45] : [3.1, 1.65, 6.25];
    let moving = false;
    if (isTower) {
      for (const [index, axis] of ['x', 'y', 'z'].entries()) {
        const delta = cameraTarget[index] - camera.position[axis];
        camera.position[axis] += delta * factor;
        moving ||= Math.abs(delta) > .006;
      }
      camera.lookAt(0, 0, 0);
    }
    render();
    if (component && open) {
      center.set(...component.position);
      model.localToWorld(center).project(camera);
      marker.style.left = ((center.x + 1) * 50) + '%';
      marker.style.top = ((1 - center.y) * 50) + '%';
    }
    if (moving || Math.abs(rotation - turntable.rotation.y) > .002 || (hinge && Math.abs(target - hinge.rotation.y) > .002)) {
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
    components.hidden = !open;
    note.hidden = !open || !component;
    marker.hidden = note.hidden;
    toggle.textContent = open ? 'Close side panel' : 'Open side panel';
    animate();
  }
  function rotate() {
    rotation += Math.PI / 4;
    animate();
  }
  if (isTower) {
    turn.hidden = false;
    turn.addEventListener('click', () => { marker.hidden = true; component = undefined; note.hidden = true; for (const button of components.querySelectorAll('button')) button.setAttribute('aria-pressed', 'false'); rotate(); });
    if (hinge) {
      toggle.hidden = false;
      for (const button of components.querySelectorAll('button')) {
        button.addEventListener('click', () => {
          component = parts[button.dataset.component];
          for (const other of components.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button));
          note.textContent = component.message;
          note.hidden = false;
          marker.hidden = false;
          rotation = 0;
          animate();
        });
      }
      toggle.addEventListener('click', () => { manual = true; setOpen(!open); });
      const reveal = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !manual && !reducedMotion.matches) {
          setOpen(true);
          reveal.disconnect();
        }
      }, { threshold: .52 });
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
    stage.classList.add('is-loading');
    stage.querySelector('.stage-note').textContent = 'Loading 3D model…';
    const rotate = await openModel(stage, name);
    stage.classList.remove('is-loading');
    control.disabled = false;
    if (!rotate) { control.textContent = '3D preview unavailable'; control.disabled = true; return; }
    control.textContent = 'Turn ' + (name === 'cpu' ? 'CPU' : name);
    control.onclick = rotate;
    control.removeAttribute('data-model');
  }, { once: true });
}
