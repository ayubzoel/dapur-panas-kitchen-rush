// main.js — Dapur Panas: Kitchen Rush
// Bootstrap: wires the canvas, input, audio, world and renderer together
// and runs the fixed-step game loop. Also honours ?shot=…&seed=… for the
// deterministic staged screenshots, and exposes a small debug hook.

import { VIEW_W, VIEW_H } from './config.js';
import {
  createWorld, startShift, update, moveChef, interact, holdInteract,
  dash, activeStation,
} from './world.js';
import { render } from './render.js';
import { createInput, clickSteering } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function readSeed() {
  const params = new URLSearchParams(window.location.search);
  const seed = parseInt(params.get('seed') || '1', 10);
  return Number.isFinite(seed) ? seed : 1;
}

function readShot() {
  return new URLSearchParams(window.location.search).get('shot');
}

const world = createWorld(readSeed());
const input = createInput(canvas);
const audio = createAudio();

// Best score survives in localStorage; a missing or broken store is fine.
try {
  world.best = parseInt(window.localStorage.getItem('dapur-panas-best') || '0', 10) || 0;
} catch (e) {
  world.best = 0;
}

function saveBest() {
  try {
    window.localStorage.setItem('dapur-panas-best', String(world.best));
  } catch (e) { /* storage unavailable: the game still works */ }
}

// Small debug hook for automated playtests: state plus the functions a
// test needs to drive the game without touching the DOM.
window.__DAPUR__ = {
  world,
  start: () => startShift(world),
  interact: () => interact(world),
  update: (dt) => update(world, dt),
  move: (x, y, dt) => moveChef(world, x, y, dt),
  stage: (name) => stageShot(world, name),
  version: '1.0.0',
};

// ------------------------------------------------------------------ shots

const shotName = readShot();
let shotStaged = false;
if (shotName) {
  // Staged screenshots: play the real rules from a fresh world, then freeze
  // the frame so the capture is stable.
  stageShot(world, shotName);
  world.paused = true;
  shotStaged = true;
  document.title = 'Dapur Panas — shot ' + shotName;
}

// ------------------------------------------------------------------ loop

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
let clickTarget = null;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;

  const pressed = input.consume();

  if (world.mode === 'title') {
    if (pressed.start || pressed.click || pressed.interact) {
      audio.ensure();
      startShift(world);
    }
  } else if (world.mode === 'over') {
    if (pressed.restart || pressed.start || pressed.click) {
      startShift(world);
    }
  } else if (world.mode === 'playing' && !shotStaged) {
    if (pressed.click) clickTarget = pressed.click;
    if (pressed.restart) startShift(world);
    if (pressed.dash) dash(world);

    // Steering: keyboard wins; a mouse click walks the chef instead.
    let ax = 0, ay = 0;
    const kb = input.axis();
    if (kb.x !== 0 || kb.y !== 0) {
      ax = kb.x; ay = kb.y;
      clickTarget = null;
    } else if (clickTarget) {
      const steer = clickSteering(world, clickTarget);
      if (steer) {
        ax = steer.x; ay = steer.y;
        if (steer.arrived) {
          clickTarget = null;
          if (steer.station) interact(world);
        }
      }
    }

    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      moveChef(world, ax, ay, STEP);
      if (input.interactHeld) holdInteract(world, STEP);
      update(world, STEP);
    }
    if (pressed.interact) interact(world);
    if (world.mode === 'over') saveBest();
  }

  audio.drain(world.events);
  render(ctx, world, activeStation(world));
}

requestAnimationFrame(frame);
