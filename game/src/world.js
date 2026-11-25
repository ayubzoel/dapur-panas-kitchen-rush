// world.js — Dapur Panas: Kitchen Rush
// The whole game state and its rules: stations, orders, cooking, chopping,
// washing, serving and scoring. Rendering and input live elsewhere; this
// module only knows about the kitchen and what happens in it.

import {
  VIEW_W, VIEW_H, BOARD_H, FLOOR_Y, CHEF_SPEED, CHEF_DASH_SPEED,
  DASH_TIME, DASH_COOLDOWN, CHEF_RADIUS, INTERACT_RANGE, CHOP_TIME,
  PATTY_COOK_TIME, PATTY_BURN_TIME, SOUP_COOK_TIME, WASH_TIME,
  DIRTY_PLATE_DELAY, SHIFT_TIME, TIER_AT, ORDER_SPAWN_INTERVAL,
  ORDER_TIME_LIMIT, MAX_ORDERS, EXPIRE_PENALTY, COMBO_MAX,
  INGREDIENTS, RECIPES, recipeById,
} from './config.js';

// ------------------------------------------------------------------ rng

// Small deterministic PRNG (mulberry32) so staged screenshots and the
// autopilot replay exactly the same way for a given seed.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ stations

// Station kinds and their kitchen layout. Coordinates are in the 1280x720
// logical space. Every station is reachable; there are no dead ends.
export function buildStations() {
  const st = [];
  const add = (kind, x, y, w, h, extra) => {
    st.push(Object.assign({ kind, x, y, w, h, id: kind + '-' + st.length }, extra || {}));
  };
  // Top row: ingredient crates (below the order board).
  const crateY = FLOOR_Y + 6, crateW = 96, crateH = 62, gap = 14;
  let cx = 24;
  for (const id of ['tomato', 'lettuce', 'onion', 'patty', 'bun']) {
    add('crate', cx, crateY, crateW, crateH, { item: id, label: INGREDIENTS[id].name });
    cx += crateW + gap;
  }
  // Left wall: two cutting boards, clean plates, sink.
  add('board', 24, 250, 120, 74, { item: null, progress: 0, chopping: false });
  add('board', 24, 340, 120, 74, { item: null, progress: 0, chopping: false });
  add('plates', 24, 430, 120, 74, { count: 6 });
  add('sink', 24, 520, 120, 84, { item: null, progress: 0, washing: false, dirty: 0 });
  // Middle: assembly counters (a 2x2 block with a gap to walk through).
  add('counter', 300, 300, 130, 70, { item: null });
  add('counter', 450, 300, 130, 70, { item: null });
  add('counter', 300, 400, 130, 70, { item: null });
  add('counter', 450, 400, 130, 70, { item: null });
  add('counter', 640, 300, 130, 70, { item: null });
  add('counter', 640, 400, 130, 70, { item: null });
  // Right wall: stove with two pans and one pot, then the serve window.
  add('pan', 1000, 250, 110, 74, { item: null, t: 0, state: 'empty' });
  add('pan', 1000, 340, 110, 74, { item: null, t: 0, state: 'empty' });
  add('pot', 1000, 430, 110, 74, { items: [], t: 0, state: 'empty' });
  add('serve', 1000, 530, 120, 80, {});
  // Bottom: trash bin, centred so it is easy to reach from anywhere.
  add('trash', 560, 620, 120, 64, {});
  return st;
}

export function stationCenter(s) {
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
}

// ------------------------------------------------------------------ state

export function createWorld(seed) {
  const rng = makeRng(seed || 1);
  return {
    seed: seed || 1,
    rng,
    mode: 'title', // title | playing | over
    time: 0, // seconds since the shift started
    timeLeft: SHIFT_TIME,
    score: 0,
    served: 0,
    servedCorrect: 0,
    servedWrong: 0,
    expired: 0,
    combo: 0,
    bestCombo: 0,
    best: 0,
    orders: [],
    orderSeq: 0,
    spawnIn: 6,
    stations: buildStations(),
    chef: {
      x: 640, y: 560, vx: 0, vy: 0, dir: 1, moving: false,
      dashT: 0, dashCd: 0, carry: null, // null | item id | {plate:true, contents:[]}
    },
    dirtyQueue: [], // {at: time} — dirty plates coming back after serving
    flash: null, // {text, color, t} floating feedback
    message: null,
    events: [], // sound cues the audio layer consumes: 'pickup','chop','cook','serve','error','expire','wash','trash','ding'
    paused: false,
    overReason: '',
  };
}

export function tierOf(elapsed) {
  if (elapsed >= TIER_AT[1]) return 2;
  if (elapsed >= TIER_AT[0]) return 1;
  return 0;
}

export function difficulty(world) {
  const tier = tierOf(world.time);
  return {
    tier,
    spawnInterval: ORDER_SPAWN_INTERVAL[tier],
    orderTime: ORDER_TIME_LIMIT[tier],
  };
}

// ------------------------------------------------------------------ helpers

export function isPlate(item) {
  return item && typeof item === 'object' && item.plate === true;
}

export function plateContents(item) {
  return isPlate(item) ? item.contents : [];
}

export function emptyPlate() {
  return { plate: true, contents: [] };
}

export function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort().join(',');
  const sb = [...b].sort().join(',');
  return sa === sb;
}

// Find the order a plate would satisfy, if any.
export function matchingOrder(world, plate) {
  if (!isPlate(plate)) return null;
  for (const o of world.orders) {
    const recipe = recipeById(o.recipeId);
    if (recipe && sameMultiset(plate.contents, recipe.needs)) return o;
  }
  return null;
}

export function nearestStation(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist == null ? Infinity : maxDist;
  for (const s of world.stations) {
    const c = stationCenter(s);
    const d = Math.hypot(c.x - x, c.y - y);
    // Reach is measured to the station edge, not its centre.
    const edge = Math.max(0, d - Math.max(s.w, s.h) / 2);
    if (edge < bestD) { bestD = edge; best = s; }
  }
  return best;
}

function pushEvent(world, name) {
  world.events.push(name);
}

function setFlash(world, text, color) {
  world.flash = { text, color, t: 1.4 };
}

// ------------------------------------------------------------------ orders

export function spawnOrder(world) {
  if (world.orders.length >= MAX_ORDERS) return null;
  const diff = difficulty(world);
  const recipe = RECIPES[Math.floor(world.rng() * RECIPES.length)];
  const order = {
    id: ++world.orderSeq,
    recipeId: recipe.id,
    timeLeft: diff.orderTime,
    timeMax: diff.orderTime,
  };
  world.orders.push(order);
  pushEvent(world, 'ding');
  return order;
}

export function serveOrder(world, order, plate) {
  const recipe = recipeById(order.recipeId);
  const tip = Math.round((order.timeLeft / order.timeMax) * 50);
  world.combo = Math.min(world.combo + 1, COMBO_MAX);
  world.bestCombo = Math.max(world.bestCombo, world.combo);
  const gained = (recipe.points + tip) * world.combo;
  world.score += gained;
  world.served += 1;
  world.servedCorrect += 1;
  world.orders = world.orders.filter((o) => o.id !== order.id);
  world.dirtyQueue.push({ at: world.time + DIRTY_PLATE_DELAY });
  setFlash(world, '+' + gained + '  ' + recipe.name + (world.combo > 1 ? '  x' + world.combo : ''), '#ffd94a');
  pushEvent(world, 'serve');
  return gained;
}

function expireOrder(world, order) {
  world.orders = world.orders.filter((o) => o.id !== order.id);
  world.score -= EXPIRE_PENALTY;
  world.combo = 0;
  world.expired += 1;
  setFlash(world, 'Order hangus! -' + EXPIRE_PENALTY, '#ff6b5e');
  pushEvent(world, 'expire');
}

// ------------------------------------------------------------------ interaction

// What happens when the chef presses E / Space (or clicks) at a station.
// Returns a short label of what happened, or null.
export function interact(world) {
  const chef = world.chef;
  const s = nearestStation(world, chef.x, chef.y, INTERACT_RANGE + 60);
  if (!s) return null;
  const carry = chef.carry;

  switch (s.kind) {
    case 'crate': {
      if (carry) return null;
      chef.carry = s.item;
      pushEvent(world, 'pickup');
      return 'pickup';
    }
    case 'board': {
      // Put a choppable ingredient on the board, or take the chopped result.
      if (!s.item && carry && typeof carry === 'string' && INGREDIENTS[carry] && INGREDIENTS[carry].choppable) {
        s.item = carry; s.progress = 0; chef.carry = null;
        pushEvent(world, 'pickup');
        return 'place';
      }
      if (s.item && s.progress >= CHOP_TIME && !carry) {
        chef.carry = s.item + '-chopped';
        s.item = null; s.progress = 0;
        pushEvent(world, 'pickup');
        return 'pickup';
      }
      return null;
    }
    case 'plates': {
      if (carry) return null;
      if (s.count <= 0) { setFlash(world, 'Piring habis! Cuci dulu.', '#ff6b5e'); return null; }
      s.count -= 1;
      chef.carry = emptyPlate();
      pushEvent(world, 'pickup');
      return 'pickup';
    }
    case 'sink': {
      // Drop a dirty plate to wash, or pick a washed plate up.
      if (isPlate(carry) && carry.contents.length === 0 && carry.dirty) {
        s.item = carry; s.progress = 0; chef.carry = null;
        pushEvent(world, 'pickup');
        return 'place';
      }
      if (s.item && s.progress >= WASH_TIME && !carry) {
        chef.carry = emptyPlate();
        s.item = null; s.progress = 0;
        pushEvent(world, 'pickup');
        return 'pickup';
      }
      return null;
    }
    case 'counter': {
      // Put down / pick up; combine a plate with a loose ingredient.
      if (!s.item && carry) { s.item = carry; chef.carry = null; pushEvent(world, 'pickup'); return 'place'; }
      if (s.item && !carry) { chef.carry = s.item; s.item = null; pushEvent(world, 'pickup'); return 'pickup'; }
      if (s.item && carry) {
        if (isPlate(s.item) && typeof carry === 'string') {
          s.item.contents.push(carry); chef.carry = null; pushEvent(world, 'pickup'); return 'add';
        }
        if (isPlate(carry) && typeof s.item === 'string') {
          carry.contents.push(s.item); s.item = null; pushEvent(world, 'pickup'); return 'add';
        }
      }
      return null;
    }
    case 'pan': {
      if (s.state === 'empty' && carry === 'patty') {
        s.item = 'patty'; s.t = 0; s.state = 'cooking'; chef.carry = null;
        pushEvent(world, 'pickup');
        return 'place';
      }
      if (s.state === 'cooked' && !carry) {
        chef.carry = 'patty-cooked'; s.item = null; s.t = 0; s.state = 'empty';
        pushEvent(world, 'pickup');
        return 'pickup';
      }
      if (s.state === 'burnt' && !carry) {
        chef.carry = 'burnt'; s.item = null; s.t = 0; s.state = 'empty';
        pushEvent(world, 'pickup');
        return 'pickup';
      }
      return null;
    }
    case 'pot': {
      // Soup needs chopped onion + chopped tomato in the pot, then it cooks.
      if (s.state === 'empty' && (carry === 'onion-chopped' || carry === 'tomato-chopped')) {
        if (!s.items.includes(carry)) {
          s.items.push(carry); chef.carry = null; pushEvent(world, 'pickup');
          if (s.items.includes('onion-chopped') && s.items.includes('tomato-chopped')) {
            s.state = 'cooking'; s.t = 0;
          }
          return 'place';
        }
        return null;
      }
      if (s.state === 'ready' && isPlate(carry)) {
        carry.contents.push('soup'); s.items = []; s.t = 0; s.state = 'empty';
        pushEvent(world, 'pickup');
        return 'add';
      }
      return null;
    }
    case 'serve': {
      if (!isPlate(carry)) return null;
      const order = matchingOrder(world, carry);
      if (order) {
        serveOrder(world, order, carry);
        chef.carry = null;
        return 'serve';
      }
      world.servedWrong += 1;
      world.combo = 0;
      setFlash(world, 'Bukan pesanan itu!', '#ff6b5e');
      pushEvent(world, 'error');
      return 'reject';
    }
    case 'trash': {
      if (!carry) return null;
      chef.carry = null;
      pushEvent(world, 'trash');
      return 'trash';
    }
    default:
      return null;
  }
}

// Holding E near a board / sink advances the work in progress.
export function holdInteract(world, dt) {
  const chef = world.chef;
  const s = nearestStation(world, chef.x, chef.y, INTERACT_RANGE + 60);
  if (!s) return false;
  if (s.kind === 'board' && s.item && s.progress < CHOP_TIME) {
    s.progress = Math.min(CHOP_TIME, s.progress + dt);
    s.chopping = true;
    if (s.progress >= CHOP_TIME) pushEvent(world, 'chop');
    return true;
  }
  if (s.kind === 'sink' && s.item && s.progress < WASH_TIME) {
    s.progress = Math.min(WASH_TIME, s.progress + dt);
    s.washing = true;
    if (s.progress >= WASH_TIME) pushEvent(world, 'wash');
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ movement

function collideStations(world, x, y) {
  // Keep the chef out of station rectangles (circle vs AABB push-out).
  for (const s of world.stations) {
    const nx = Math.max(s.x, Math.min(x, s.x + s.w));
    const ny = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < CHEF_RADIUS * CHEF_RADIUS) {
      if (d2 === 0) { y = s.y - CHEF_RADIUS; continue; }
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * CHEF_RADIUS;
      y = ny + (dy / d) * CHEF_RADIUS;
    }
  }
  return { x, y };
}

export function moveChef(world, ix, iy, dt) {
  const chef = world.chef;
  const len = Math.hypot(ix, iy);
  chef.moving = len > 0.01;
  if (len > 0.01) {
    const nx = ix / len, ny = iy / len;
    let speed = CHEF_SPEED;
    if (chef.dashT > 0) speed = CHEF_DASH_SPEED;
    chef.dir = nx !== 0 ? Math.sign(nx) : chef.dir;
    const p = collideStations(world, chef.x + nx * speed * dt, chef.y + ny * speed * dt);
    chef.x = Math.max(CHEF_RADIUS + 4, Math.min(VIEW_W - CHEF_RADIUS - 4, p.x));
    chef.y = Math.max(FLOOR_Y + CHEF_RADIUS, Math.min(VIEW_H - CHEF_RADIUS - 4, p.y));
  }
  if (chef.dashT > 0) chef.dashT -= dt;
  if (chef.dashCd > 0) chef.dashCd -= dt;
}

export function dash(world) {
  const chef = world.chef;
  if (chef.dashCd <= 0 && chef.moving) {
    chef.dashT = DASH_TIME;
    chef.dashCd = DASH_COOLDOWN;
    pushEvent(world, 'dash');
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ update

export function startShift(world) {
  world.mode = 'playing';
  world.time = 0;
  world.timeLeft = SHIFT_TIME;
  world.score = 0;
  world.served = 0;
  world.servedCorrect = 0;
  world.servedWrong = 0;
  world.expired = 0;
  world.combo = 0;
  world.bestCombo = 0;
  world.orders = [];
  world.orderSeq = 0;
  world.spawnIn = 5;
  world.dirtyQueue = [];
  world.flash = null;
  world.chef.carry = null;
  world.chef.x = 640; world.chef.y = 560;
  for (const s of world.stations) {
    if (s.kind === 'board' || s.kind === 'sink') { s.item = null; s.progress = 0; }
    if (s.kind === 'pan') { s.item = null; s.t = 0; s.state = 'empty'; }
    if (s.kind === 'pot') { s.items = []; s.t = 0; s.state = 'empty'; }
    if (s.kind === 'counter') s.item = null;
    if (s.kind === 'plates') s.count = 6;
    if (s.kind === 'sink') s.dirty = 0;
  }
  spawnOrder(world);
  spawnOrder(world);
}

export function update(world, dt) {
  if (world.mode !== 'playing' || world.paused) return;
  world.time += dt;
  world.timeLeft = Math.max(0, SHIFT_TIME - world.time);
  if (world.flash) {
    world.flash.t -= dt;
    if (world.flash.t <= 0) world.flash = null;
  }

  // Orders: countdown, expiry, spawning.
  for (const o of [...world.orders]) {
    o.timeLeft -= dt;
    if (o.timeLeft <= 0) expireOrder(world, o);
  }
  world.spawnIn -= dt;
  if (world.spawnIn <= 0) {
    if (world.orders.length < MAX_ORDERS) spawnOrder(world);
    world.spawnIn = difficulty(world).spawnInterval * (0.85 + world.rng() * 0.3);
  }

  // Cooking: pans and pot.
  for (const s of world.stations) {
    if (s.kind === 'pan' && s.state === 'cooking') {
      s.t += dt;
      if (s.t >= PATTY_BURN_TIME) { s.state = 'burnt'; pushEvent(world, 'burn'); }
      else if (s.t >= PATTY_COOK_TIME) { s.state = 'cooked'; pushEvent(world, 'cook'); }
    }
    if (s.kind === 'pot' && s.state === 'cooking') {
      s.t += dt;
      if (s.t >= SOUP_COOK_TIME) { s.state = 'ready'; pushEvent(world, 'cook'); }
    }
    if (s.kind === 'board') s.chopping = false;
    if (s.kind === 'sink') s.washing = false;
  }

  // Dirty plates come back to the sink a few seconds after serving. They
  // queue as a count so none is lost while the sink is busy.
  while (world.dirtyQueue.length && world.dirtyQueue[0].at <= world.time) {
    world.dirtyQueue.shift();
    const sink = world.stations.find((s) => s.kind === 'sink');
    if (sink) sink.dirty += 1;
  }
  const sink = world.stations.find((s) => s.kind === 'sink');
  if (sink && !sink.item && sink.dirty > 0) {
    sink.dirty -= 1;
    sink.item = { plate: true, contents: [], dirty: true };
    sink.progress = 0;
  }

  if (world.timeLeft <= 0) {
    world.mode = 'over';
    world.overReason = 'Shift selesai!';
    const total = world.servedCorrect + world.servedWrong + world.expired;
    world.accuracy = total > 0 ? Math.round((world.servedCorrect / total) * 100) : 100;
    if (world.score > world.best) world.best = world.score;
    pushEvent(world, 'over');
  }
}

// The station the chef would interact with right now (for the highlight).
export function activeStation(world) {
  if (world.mode !== 'playing') return null;
  return nearestStation(world, world.chef.x, world.chef.y, INTERACT_RANGE + 60);
}
