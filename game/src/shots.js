// shots.js — Dapur Panas: Kitchen Rush
// Deterministic staging for the four screenshots (?shot=title|play|
// assembly|serve&seed=1). Each shot plays the real rules from a fresh
// world with a small scripted autopilot at a fixed timestep, so every
// frame is a genuine render of the game's own code — never a mock-up.
//
// The autopilot walks the chef to a station, presses E, and holds E where
// the job needs it (chopping, washing), exactly like a player would.

import { moveChef, interact, holdInteract, update, startShift, spawnOrder, stationCenter } from './world.js';

const DT = 1 / 60;

// Where to stand to use each station (just outside its rectangle, and far
// enough from every other station that E always hits the intended one).
const STAND = {
  'crate-0': [72, 200], 'crate-1': [182, 200], 'crate-2': [292, 200],
  'crate-3': [402, 200], 'crate-4': [512, 200],
  'board-5': [168, 287], 'board-6': [168, 377],
  'plates-7': [168, 467], 'sink-8': [168, 562],
  'counter-9': [365, 272], 'counter-10': [515, 272], 'counter-11': [365, 498],
  'counter-12': [515, 498], 'counter-13': [705, 272], 'counter-14': [705, 498],
  'pan-15': [958, 287], 'pan-16': [958, 377], 'pot-17': [958, 467],
  'serve-18': [958, 570], 'trash-19': [620, 592],
};

function stationById(world, id) {
  return world.stations.find((s) => s.id === id);
}

// One autopilot runner: steps are {move:[x,y]} | {press} | {hold:sec} |
// {wait:sec}. Movement steers straight at the target and sidesteps when
// stuck against a counter corner.
function runScript(world, steps) {
  for (const step of steps) {
    if (globalThis.__TRACE) console.log('STEP', JSON.stringify(step), 'chef=', JSON.stringify(world.chef.carry), 'pos=', world.chef.x.toFixed(0) + ',' + world.chef.y.toFixed(0));
    if (step.move) {
      const [tx, ty] = step.move;
      let stuck = 0, lastD = Infinity, sidestep = 0;
      for (let i = 0; i < 60 * 12; i++) {
        const dx = tx - world.chef.x, dy = ty - world.chef.y;
        const d = Math.hypot(dx, dy);
        if (d < 26) break;
        let ax = dx / d, ay = dy / d;
        if (sidestep > 0) { const px = -ay, py = ax; ax = px; ay = py; sidestep -= DT; }
        if (d < lastD - 0.5) { lastD = d; stuck = 0; } else { stuck += DT; }
        if (stuck > 0.7) { stuck = 0; sidestep = 0.5; }
        moveChef(world, ax, ay, DT);
        update(world, DT);
      }
    } else if (step.press) {
      interact(world);
      update(world, DT);
    } else if (step.hold) {
      const n = Math.round(step.hold / DT);
      for (let i = 0; i < n; i++) { holdInteract(world, DT); update(world, DT); }
    } else if (step.wait) {
      const n = Math.round(step.wait / DT);
      for (let i = 0; i < n; i++) update(world, DT);
    }
  }
}

function topUpOrders(world, count) {
  while (world.orders.length < count) spawnOrder(world);
  for (const o of world.orders) o.timeLeft = Math.min(o.timeLeft, o.timeMax * 0.85);
}

function go(world, stationId) {
  return { move: STAND[stationId] };
}

function takeFrom(world, stationId) {
  return [go(world, stationId), { press: true }];
}

// ------------------------------------------------------------------ shots

function stageTitle(world) {
  startShift(world);
  runScript(world, [
    ...takeFrom(world, 'crate-0'),
    ...takeFrom(world, 'board-5'),
    { hold: 2.2 },
    { press: true },
    ...takeFrom(world, 'counter-9'),
    ...takeFrom(world, 'crate-3'),
    ...takeFrom(world, 'pan-15'),
    { wait: 1.0 },
  ]);
  topUpOrders(world, 2);
  world.mode = 'title';
}

function stagePlay(world) {
  startShift(world);
  runScript(world, [
    // Lettuce onto a counter.
    ...takeFrom(world, 'crate-1'),
    ...takeFrom(world, 'counter-10'),
    // Bun onto another counter.
    ...takeFrom(world, 'crate-4'),
    ...takeFrom(world, 'counter-11'),
    // Patty into a pan to cook.
    ...takeFrom(world, 'crate-3'),
    ...takeFrom(world, 'pan-15'),
    // Chop a tomato and carry it.
    ...takeFrom(world, 'crate-0'),
    ...takeFrom(world, 'board-5'),
    { hold: 2.2 },
    { press: true },
    { move: [640, 480] },
  ]);
  topUpOrders(world, 3);
}

function stageAssembly(world) {
  startShift(world);
  runScript(world, [
    // Cook a patty and leave it on a counter.
    ...takeFrom(world, 'crate-3'),
    ...takeFrom(world, 'pan-15'),
    { wait: 5.6 },
    { press: true },
    ...takeFrom(world, 'counter-13'),
    // Take a plate and scoop the patty onto it.
    ...takeFrom(world, 'plates-7'),
    ...takeFrom(world, 'counter-13'),
    // Park the plate, chop lettuce, add it.
    ...takeFrom(world, 'counter-9'),
    ...takeFrom(world, 'crate-1'),
    ...takeFrom(world, 'board-5'),
    { hold: 2.2 },
    { press: true },
    ...takeFrom(world, 'counter-10'),
    ...takeFrom(world, 'counter-9'),
    ...takeFrom(world, 'counter-10'),
    // Plate back on the counter, bun beside it.
    ...takeFrom(world, 'counter-9'),
    ...takeFrom(world, 'crate-4'),
    ...takeFrom(world, 'counter-10'),
    // Start chopping an onion at the other board.
    ...takeFrom(world, 'crate-2'),
    ...takeFrom(world, 'board-6'),
    { hold: 1.1 },
  ]);
  topUpOrders(world, 3);
}

function stageServe(world) {
  startShift(world);
  runScript(world, [
    // Cook a patty and leave it on a counter.
    ...takeFrom(world, 'crate-3'),
    ...takeFrom(world, 'pan-15'),
    { wait: 5.6 },
    { press: true },
    ...takeFrom(world, 'counter-13'),
    // Take a plate and scoop the patty onto it.
    ...takeFrom(world, 'plates-7'),
    ...takeFrom(world, 'counter-13'),
    // Park the plate, chop lettuce, add it.
    ...takeFrom(world, 'counter-9'),
    ...takeFrom(world, 'crate-1'),
    ...takeFrom(world, 'board-5'),
    { hold: 2.2 },
    { press: true },
    ...takeFrom(world, 'counter-10'),
    ...takeFrom(world, 'counter-9'),
    ...takeFrom(world, 'counter-10'),
    // Park the plate, fetch the bun, add it, then pick the plate up.
    ...takeFrom(world, 'counter-9'),
    ...takeFrom(world, 'crate-4'),
    ...takeFrom(world, 'counter-10'),
    ...takeFrom(world, 'counter-9'),
    ...takeFrom(world, 'counter-10'),
    // Walk to the serve window carrying the finished burger.
    { move: [958, 570] },
  ]);
  // Make sure a Burger Klasik order is on the board for the shot.
  let hasBurger = world.orders.some((o) => o.recipeId === 'burger');
  if (!hasBurger) {
    world.orders = world.orders.slice(0, 2);
    world.orders.push({ id: ++world.orderSeq, recipeId: 'burger', timeLeft: 42, timeMax: 60 });
  }
  topUpOrders(world, 3);
}

const STAGES = { title: stageTitle, play: stagePlay, assembly: stageAssembly, serve: stageServe };

export function stageShot(world, name) {
  const fn = STAGES[name];
  if (!fn) return false;
  fn(world);
  return true;
}
