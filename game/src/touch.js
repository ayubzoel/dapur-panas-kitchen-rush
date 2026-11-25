// touch.js — Hot Kitchen Rush
// Touch controls for phones: a virtual joystick on the left for movement
// and INTERACT / DASH / RESTART buttons on the right, plus a rotate hint
// in portrait. The controls are plain DOM elements floating over the
// canvas; the game loop reads them through the same input object as the
// keyboard, so touch and keyboard drive exactly the same rules. The order
// board is never covered: the joystick sits in the bottom-left corner, the
// buttons in the bottom-right corner, and RESTART just below the board.
// No network, no images, no dependencies.

export const TOUCH = typeof window !== 'undefined'
  && (('ontouchstart' in window)
    || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));

const JOY_RADIUS = 34; // px the knob may travel from the pad centre
const DEAD_ZONE = 0.16;

function el(tag, cls, html) {
  const node = document.createElement(tag);
  node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

function makeButton(label, key, cls, onDown, onUp) {
  const btn = el('div', 'touch-btn ' + cls, '<span>' + label + '</span><span class="key">' + key + '</span>');
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.classList.add('pressed');
    onDown();
  });
  const release = (e) => {
    btn.classList.remove('pressed');
    if (onUp) onUp();
  };
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
  return btn;
}

// Build the controls and wire them into `input` (the object createInput
// returns). Returns null on non-touch devices.
export function createTouchControls(input) {
  if (!TOUCH) return null;
  const root = document.getElementById('touch-root');
  if (!root) return null;
  root.classList.add('on');
  document.body.classList.add('touch-on');

  const setPortrait = () => {
    document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth);
  };
  setPortrait();
  window.addEventListener('resize', setPortrait);
  window.addEventListener('orientationchange', setPortrait);

  // ---- virtual joystick (left) ----
  const pad = el('div', 'touch-joy');
  const knob = el('div', 'touch-knob');
  pad.appendChild(knob);
  let joyPointer = null;

  const updateJoy = (e) => {
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (e.clientX - cx) / JOY_RADIUS;
    let dy = (e.clientY - cy) / JOY_RADIUS;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const mag = Math.hypot(dx, dy);
    if (mag < DEAD_ZONE) { dx = 0; dy = 0; }
    input.touchAxis.x = dx;
    input.touchAxis.y = dy;
    knob.style.transform = 'translate(' + (dx * JOY_RADIUS) + 'px,' + (dy * JOY_RADIUS) + 'px)';
  };
  const endJoy = () => {
    joyPointer = null;
    input.touchAxis.x = 0;
    input.touchAxis.y = 0;
    knob.style.transform = 'translate(0px,0px)';
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    joyPointer = e.pointerId;
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    updateJoy(e);
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyPointer) updateJoy(e);
  });
  pad.addEventListener('pointerup', (e) => {
    if (e.pointerId === joyPointer) endJoy();
  });
  pad.addEventListener('pointercancel', (e) => {
    if (e.pointerId === joyPointer) endJoy();
  });
  root.appendChild(pad);

  // ---- action buttons (right) ----
  const interactBtn = makeButton('INTERACT', 'E', 'interact',
    () => { input.pressedInteract = true; input.touchInteractHeld = true; },
    () => { input.touchInteractHeld = false; });
  const dashBtn = makeButton('DASH', 'Q', 'dash',
    () => { input.pressedDash = true; });
  const restartBtn = makeButton('RESTART', 'R', 'restart',
    () => { input.pressedRestart = true; });
  root.appendChild(interactBtn);
  root.appendChild(dashBtn);
  root.appendChild(restartBtn);

  return { root, pad, interactBtn, dashBtn, restartBtn };
}
