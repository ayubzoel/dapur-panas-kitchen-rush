// input.js — Hot Kitchen Rush
// Keyboard, mouse and touch input, kept apart from the game rules. The
// module exposes a small state object the main loop reads every frame,
// plus a click-to-interact helper that points the chef at the nearest
// station. Touch state (joystick axis + held interact) is written by
// touch.js and read here exactly like the keyboard.

import { VIEW_W, VIEW_H } from './config.js';
import { nearestStation, stationCenter } from './world.js';

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    // Edge-triggered actions, consumed by the main loop once.
    pressedInteract: false,
    pressedDash: false,
    pressedStart: false,
    pressedRestart: false,
    // Mouse click target (canvas coordinates) for click-to-interact.
    click: null,
    // Touch state, written by touch.js: joystick axis and held INTERACT.
    touchAxis: { x: 0, y: 0 },
    touchInteractHeld: false,
    // Whether the interact key is currently held (for chopping / washing).
    get interactHeld() {
      return this.keys.has('KeyE') || this.keys.has('Space') || this.touchInteractHeld;
    },
    axis() {
      let x = 0, y = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
      if (x === 0 && y === 0) {
        x = this.touchAxis.x;
        y = this.touchAxis.y;
      }
      return { x, y };
    },
    consume() {
      const out = {
        interact: this.pressedInteract,
        dash: this.pressedDash,
        start: this.pressedStart,
        restart: this.pressedRestart,
        click: this.click,
      };
      this.pressedInteract = false;
      this.pressedDash = false;
      this.pressedStart = false;
      this.pressedRestart = false;
      this.click = null;
      return out;
    },
  };

  const down = (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    input.keys.add(e.code);
    if (e.code === 'KeyE' || e.code === 'Space') input.pressedInteract = true;
    if (e.code === 'KeyQ') input.pressedDash = true;
    if (e.code === 'Enter') input.pressedStart = true;
    if (e.code === 'KeyR') input.pressedRestart = true;
  };
  const up = (e) => input.keys.delete(e.code);
  const blur = () => input.keys.clear();

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);

  // Pointer down covers mouse clicks and finger taps alike: a tap on the
  // canvas starts the game or walks the chef to the tapped station.
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = VIEW_W / rect.width;
    const scaleY = VIEW_H / rect.height;
    input.click = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  });

  input.dispose = () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
  return input;
}

// A mouse click near a station walks the chef toward it and interacts when
// close. Returns the steering direction for this frame, or null.
export function clickSteering(world, click) {
  if (!click) return null;
  const s = nearestStation(world, click.x, click.y, 90);
  if (!s) return { x: 0, y: 0, arrived: true, station: null };
  const c = stationCenter(s);
  const dx = c.x - world.chef.x;
  const dy = c.y - world.chef.y;
  const d = Math.hypot(dx, dy);
  if (d < 46) return { x: 0, y: 0, arrived: true, station: s };
  return { x: dx / d, y: dy / d, arrived: false, station: s };
}
