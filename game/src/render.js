// render.js — Dapur Panas: Kitchen Rush
// Every pixel of the game is drawn here on a 2D canvas: the tiled floor,
// the stations, the food, the chef, the order board, the HUD and the
// title / game-over screens. No images are loaded; all art is shapes.

import {
  VIEW_W, VIEW_H, BOARD_H, FLOOR_Y, CHEF_RADIUS, CHOP_TIME, WASH_TIME,
  PATTY_COOK_TIME, PATTY_BURN_TIME, SOUP_COOK_TIME, SHIFT_TIME,
  itemColor, itemName, recipeById,
} from './config.js';
import { isPlate, stationCenter } from './world.js';

// ------------------------------------------------------------------ helpers

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, weight, align) {
  ctx.fillStyle = color;
  ctx.font = (weight || 'bold') + ' ' + size + 'px system-ui, sans-serif';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function progressBar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  rr(ctx, x, y, w, h, h / 2); ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    rr(ctx, x + 2, y + 2, Math.max(0, (w - 4) * Math.min(1, frac)), h - 4, (h - 4) / 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ food

// Draw one ingredient / dish item as recognisable shapes.
export function drawItem(ctx, item, x, y, r) {
  if (!item) return;
  if (isPlate(item)) { drawPlate(ctx, item, x, y, r); return; }
  if (item === 'burnt') {
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.25, r * 0.15, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const color = itemColor(item);
  switch (item) {
    case 'tomato':
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f7d3d';
      ctx.fillRect(x - 2, y - r - 3, 4, 6);
      break;
    case 'tomato-chopped': {
      ctx.fillStyle = color;
      for (let i = 0; i < 3; i++) {
        const a = -0.5 + i * 0.5;
        ctx.beginPath(); ctx.arc(x + a * r, y + (i % 2 ? 3 : -3), r * 0.55, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(x, y, r * 0.18, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'lettuce':
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8fd79a';
      ctx.beginPath(); ctx.ellipse(x, y - 2, r * 0.6, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'lettuce-chopped':
      ctx.fillStyle = color;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(x - r * 0.5 + i * r * 0.5, y + (i % 2 ? 4 : -3), r * 0.45, r * 0.3, 0.4, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'onion':
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y + 2, r * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8d5f2';
      ctx.beginPath(); ctx.arc(x, y + 2, r * 0.55, 0, Math.PI * 2); ctx.fill();
      break;
    case 'onion-chopped':
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(x, y + (i - 1) * 5, r * 0.55, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      }
      break;
    case 'patty':
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a06a42';
      ctx.beginPath(); ctx.ellipse(x, y - 2, r * 0.7, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'patty-cooked':
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a5a33';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(x - r * 0.5 + i * r * 0.5, y - 1, 2, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'bun':
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fill();
      ctx.fillRect(x - r, y - 1, r * 2, r * 0.45);
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath(); ctx.arc(x - r * 0.4, y - r * 0.45, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.6, 1.8, 0, Math.PI * 2); ctx.fill();
      break;
    case 'soup':
      ctx.fillStyle = '#f5f0e6';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.16, 0, Math.PI * 2); ctx.fill();
      break;
    default:
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlate(ctx, plate, x, y, r) {
  ctx.fillStyle = plate.dirty ? '#9a8f7a' : '#f7f5ef';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = plate.dirty ? '#7a6f5c' : '#c9c2ae';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, Math.PI * 2); ctx.stroke();
  if (plate.dirty) {
    ctx.fillStyle = '#6b5d43';
    ctx.beginPath(); ctx.arc(x - r * 0.3, y, r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const n = plate.contents.length;
  plate.contents.forEach((c, i) => {
    const a = n === 1 ? 0 : -0.45 + (i / (n - 1)) * 0.9;
    drawItem(ctx, c, x + Math.sin(a) * r * 0.35, y + Math.cos(a) * r * 0.15 - 2, r * 0.42);
  });
}

// ------------------------------------------------------------------ kitchen

function drawFloor(ctx) {
  ctx.fillStyle = '#e8dcc8';
  ctx.fillRect(0, FLOOR_Y, VIEW_W, VIEW_H - FLOOR_Y);
  ctx.strokeStyle = '#d5c6ab';
  ctx.lineWidth = 1;
  const tile = 64;
  for (let x = 0; x <= VIEW_W; x += tile) {
    ctx.beginPath(); ctx.moveTo(x, FLOOR_Y); ctx.lineTo(x, VIEW_H); ctx.stroke();
  }
  for (let y = FLOOR_Y; y <= VIEW_H; y += tile) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); ctx.stroke();
  }
  // Warm rug in the middle of the kitchen.
  ctx.fillStyle = '#c94f43';
  rr(ctx, 300, 520, 400, 60, 10); ctx.fill();
  ctx.fillStyle = '#e8b64c';
  rr(ctx, 312, 530, 376, 40, 8); ctx.fill();
  ctx.fillStyle = '#c94f43';
  rr(ctx, 324, 538, 352, 24, 6); ctx.fill();
}

// ------------------------------------------------------------------ stations

function stationBase(ctx, s, fill, stroke) {
  ctx.fillStyle = fill;
  rr(ctx, s.x, s.y, s.w, s.h, 10); ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  rr(ctx, s.x, s.y, s.w, s.h, 10); ctx.stroke();
}

function drawStation(ctx, world, s, highlight) {
  const c = stationCenter(s);
  if (highlight) {
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 4;
    rr(ctx, s.x - 5, s.y - 5, s.w + 10, s.h + 10, 12); ctx.stroke();
  }
  switch (s.kind) {
    case 'crate': {
      stationBase(ctx, s, '#8a5a33', '#5d3a1e');
      ctx.fillStyle = '#a06a42';
      ctx.fillRect(s.x + 6, s.y + 6, s.w - 12, 10);
      drawItem(ctx, s.item, c.x, c.y - 4, 20);
      text(ctx, s.label, c.x, s.y + s.h - 12, 13, '#fff');
      break;
    }
    case 'board': {
      stationBase(ctx, s, '#d9b380', '#a67c52');
      ctx.fillStyle = '#efe0c0';
      rr(ctx, s.x + 10, s.y + 8, s.w - 20, s.h - 26, 6); ctx.fill();
      if (s.item) {
        drawItem(ctx, s.item, c.x, c.y - 4, 18);
        if (s.progress > 0 && s.progress < CHOP_TIME) {
          progressBar(ctx, s.x + 12, s.y + s.h - 14, s.w - 24, 8, s.progress / CHOP_TIME, '#58b368');
        }
        if (s.progress >= CHOP_TIME) text(ctx, 'Siap!', c.x, s.y + s.h - 10, 12, '#2f7d3d');
      } else {
        text(ctx, 'Talenan', c.x, c.y - 2, 14, '#7a5c33');
        text(ctx, 'tahan E', c.x, c.y + 16, 11, '#9a7c52');
      }
      break;
    }
    case 'plates': {
      stationBase(ctx, s, '#7fb3d5', '#4a7ba6');
      for (let i = 0; i < Math.min(3, s.count); i++) {
        ctx.fillStyle = '#f7f5ef';
        ctx.beginPath(); ctx.ellipse(c.x, c.y + 12 - i * 7, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
      }
      text(ctx, 'Piring x' + s.count, c.x, s.y + 16, 13, '#fff');
      break;
    }
    case 'sink': {
      stationBase(ctx, s, '#5b8fb0', '#35617d');
      ctx.fillStyle = '#9fd4e8';
      rr(ctx, s.x + 10, s.y + 10, s.w - 20, s.h - 28, 8); ctx.fill();
      if (s.item) {
        drawPlate(ctx, s.item, c.x, c.y - 2, 20);
        if (s.progress > 0 && s.progress < WASH_TIME) {
          progressBar(ctx, s.x + 12, s.y + s.h - 14, s.w - 24, 8, s.progress / WASH_TIME, '#5b8fb0');
        }
        if (s.progress >= WASH_TIME) text(ctx, 'Bersih!', c.x, s.y + s.h - 10, 12, '#fff');
      } else if (s.dirty > 0) {
        text(ctx, 'Piring kotor: ' + s.dirty, c.x, c.y, 12, '#fff');
      } else {
        text(ctx, 'Wastafel', c.x, c.y - 2, 14, '#dff2fa');
        text(ctx, 'tahan E', c.x, c.y + 16, 11, '#bfe0ef');
      }
      break;
    }
    case 'counter': {
      stationBase(ctx, s, '#b08954', '#7a5c33');
      ctx.fillStyle = '#cfa96e';
      ctx.fillRect(s.x + 6, s.y + 6, s.w - 12, 8);
      if (s.item) drawItem(ctx, s.item, c.x, c.y + 2, 22);
      break;
    }
    case 'pan': {
      stationBase(ctx, s, '#3d3d3d', '#1c1c1c');
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(c.x, c.y + 2, 30, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#888'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(c.x, c.y + 2, 30, 0, Math.PI * 2); ctx.stroke();
      if (s.state === 'cooking' || s.state === 'cooked') {
        drawItem(ctx, s.state === 'cooked' ? 'patty-cooked' : 'patty', c.x, c.y + 2, 20);
        progressBar(ctx, s.x + 10, s.y + s.h - 12, s.w - 20, 7, s.t / PATTY_COOK_TIME, s.t >= PATTY_COOK_TIME ? '#58b368' : '#e8912d');
      } else if (s.state === 'burnt') {
        drawItem(ctx, 'burnt', c.x, c.y + 2, 20);
        text(ctx, 'GOSONG!', c.x, s.y + s.h - 8, 11, '#ff6b5e');
      } else {
        text(ctx, 'Wajan', c.x, c.y + 2, 13, '#aaa');
      }
      break;
    }
    case 'pot': {
      stationBase(ctx, s, '#3d3d3d', '#1c1c1c');
      ctx.fillStyle = '#4a4a4a';
      ctx.beginPath(); ctx.ellipse(c.x, c.y + 4, 34, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#666';
      ctx.beginPath(); ctx.ellipse(c.x, c.y - 2, 30, 16, 0, 0, Math.PI * 2); ctx.fill();
      if (s.state === 'cooking') {
        ctx.fillStyle = '#d98a2b';
        ctx.beginPath(); ctx.ellipse(c.x, c.y - 2, 24, 11, 0, 0, Math.PI * 2); ctx.fill();
        progressBar(ctx, s.x + 10, s.y + s.h - 12, s.w - 20, 7, s.t / SOUP_COOK_TIME, '#d98a2b');
      } else if (s.state === 'ready') {
        ctx.fillStyle = '#e8a33d';
        ctx.beginPath(); ctx.ellipse(c.x, c.y - 2, 24, 11, 0, 0, Math.PI * 2); ctx.fill();
        text(ctx, 'Sup siap!', c.x, s.y + s.h - 8, 11, '#ffd94a');
      } else if (s.items.length) {
        s.items.forEach((it, i) => drawItem(ctx, it, c.x - 12 + i * 24, c.y - 2, 12));
        text(ctx, 'butuh ' + (s.items.includes('onion-chopped') ? 'tomat' : 'bawang'), c.x, s.y + s.h - 8, 11, '#ccc');
      } else {
        text(ctx, 'Panci', c.x, c.y + 2, 13, '#aaa');
      }
      break;
    }
    case 'serve': {
      stationBase(ctx, s, '#c94f43', '#8e2f26');
      text(ctx, 'SAJIKAN', c.x, s.y + 16, 15, '#fff');
      text(ctx, 'letakkan piring', c.x, s.y + 36, 11, '#ffd9d4');
      text(ctx, 'yang cocok', c.x, s.y + 52, 11, '#ffd9d4');
      // Bell on the counter.
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.arc(c.x + 40, s.y + s.h - 14, 8, Math.PI, 0); ctx.fill();
      ctx.fillRect(c.x + 32, s.y + s.h - 14, 16, 3);
      break;
    }
    case 'trash': {
      stationBase(ctx, s, '#5a5a5a', '#333');
      ctx.fillStyle = '#333';
      rr(ctx, c.x - 26, s.y + 12, 52, 36, 6); ctx.fill();
      ctx.fillStyle = '#777';
      ctx.fillRect(c.x - 30, s.y + 6, 60, 8);
      text(ctx, 'Sampah', c.x, s.y + s.h - 10, 12, '#ddd');
      break;
    }
    default:
      break;
  }
}

// ------------------------------------------------------------------ chef

function drawChef(ctx, world) {
  const chef = world.chef;
  const bob = chef.moving ? Math.sin(world.time * 14) * 2 : 0;
  const x = chef.x, y = chef.y + bob;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(chef.x, chef.y + 18, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
  // Body (apron).
  ctx.fillStyle = '#f2f2f2';
  rr(ctx, x - 15, y - 6, 30, 30, 10); ctx.fill();
  ctx.fillStyle = '#c94f43';
  ctx.fillRect(x - 15, y + 8, 30, 6);
  // Head + chef hat.
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(x, y - 14, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x - 8, y - 24, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y - 27, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 8, y - 24, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(x - 13, y - 26, 26, 7);
  // Eyes look in the facing direction.
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(x + chef.dir * 4 - 4, y - 14, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + chef.dir * 4 + 4, y - 14, 1.8, 0, Math.PI * 2); ctx.fill();
  // Carried item floats above the head.
  if (chef.carry) {
    drawItem(ctx, chef.carry, x, y - 46, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(x, y - 46, 19, 0, Math.PI * 2); ctx.stroke();
  }
}

// ------------------------------------------------------------------ board + HUD

function drawOrderCard(ctx, order, x, y, w, h) {
  const recipe = recipeById(order.recipeId);
  const frac = Math.max(0, order.timeLeft / order.timeMax);
  const urgent = frac < 0.3;
  ctx.fillStyle = urgent && Math.floor(order.timeLeft * 4) % 2 === 0 ? '#ffe1de' : '#fff8ec';
  rr(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = urgent ? '#e8443a' : '#d9c39a';
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, 10); ctx.stroke();
  text(ctx, '#' + order.id + '  ' + recipe.name, x + 10, y + 14, 14, '#333', 'bold', 'left');
  text(ctx, recipe.points + ' pts', x + w - 10, y + 14, 12, '#8a5a33', 'bold', 'right');
  // Required ingredients as small icons.
  recipe.needs.forEach((need, i) => {
    drawItem(ctx, need, x + 22 + i * 34, y + 44, 13);
  });
  // Countdown bar.
  progressBar(ctx, x + 10, y + h - 14, w - 20, 8, frac, urgent ? '#e8443a' : '#58b368');
  text(ctx, Math.ceil(order.timeLeft) + ' dtk', x + w - 10, y + h - 26, 11, urgent ? '#e8443a' : '#666', 'bold', 'right');
}

function drawBoard(ctx, world) {
  ctx.fillStyle = '#2b2118';
  ctx.fillRect(0, 0, VIEW_W, BOARD_H);
  ctx.fillStyle = '#3a2d20';
  ctx.fillRect(0, BOARD_H - 6, VIEW_W, 6);
  text(ctx, 'DAPUR PANAS', 16, 22, 20, '#ffd94a', 'bold', 'left');
  text(ctx, 'Kitchen Rush', 16, 44, 12, '#d9c39a', 'normal', 'left');
  const cardW = 218, cardH = 88, gap = 10;
  let x = 200;
  if (world.orders.length === 0) {
    text(ctx, 'Belum ada pesanan…', 220, 52, 14, '#d9c39a', 'normal', 'left');
  }
  for (const o of world.orders) {
    drawOrderCard(ctx, o, x, 8, cardW, cardH);
    x += cardW + gap;
  }
  // Shift timer + score on the right.
  const mm = Math.floor(world.timeLeft / 60);
  const ss = String(Math.floor(world.timeLeft % 60)).padStart(2, '0');
  const urgent = world.timeLeft <= 30;
  text(ctx, mm + ':' + ss, VIEW_W - 16, 26, 30, urgent ? '#ff6b5e' : '#fff', 'bold', 'right');
  text(ctx, 'SKOR  ' + world.score, VIEW_W - 16, 56, 18, '#ffd94a', 'bold', 'right');
  text(ctx, world.combo > 1 ? 'COMBO x' + world.combo : 'combo x1', VIEW_W - 16, 78, 13, '#ffb347', 'bold', 'right');
}

function drawRecipeList(ctx) {
  // Small recipe reference at the bottom-left, above the trash row.
  const recipes = [
    'Salad Segar: tomat+selada',
    'Burger Klasik: patty+selada+roti',
    'Sup Bawang: sup+roti',
    'Burger Bawang: patty+bawang+roti',
    'Salad Komplit: tomat+selada+bawang',
  ];
  ctx.fillStyle = 'rgba(43,33,24,0.85)';
  rr(ctx, 10, VIEW_H - 118, 250, 108, 8); ctx.fill();
  text(ctx, 'RESEP', 22, VIEW_H - 104, 12, '#ffd94a', 'bold', 'left');
  recipes.forEach((r, i) => {
    text(ctx, r, 22, VIEW_H - 86 + i * 16, 11, '#f2e8d5', 'normal', 'left');
  });
}

function drawFlash(ctx, world) {
  if (!world.flash) return;
  ctx.globalAlpha = Math.min(1, world.flash.t);
  text(ctx, world.flash.text, VIEW_W / 2, 150, 26, world.flash.color, 'bold');
  ctx.globalAlpha = 1;
}

function drawHint(ctx, world, active) {
  let hint = 'WASD / Panah: gerak   •   E / Spasi: ambil & pakai   •   Q: dash   •   Klik: interaksi';
  if (active) {
    const labels = {
      crate: 'Ambil ' + (active.label || ''),
      board: active.item ? (active.progress >= CHOP_TIME ? 'Ambil hasil potongan' : 'Tahan E untuk memotong') : 'Letakkan bahan untuk dipotong',
      plates: 'Ambil piring bersih',
      sink: active.item ? (active.progress >= WASH_TIME ? 'Ambil piring bersih' : 'Tahan E untuk mencuci') : 'Letakkan piring kotor',
      counter: active.item ? 'Ambil / rakit di sini' : 'Letakkan di sini',
      pan: active.state === 'empty' ? 'Letakkan patty mentah' : active.state === 'cooked' ? 'Ambil patty masak' : active.state === 'burnt' ? 'Gosong! Buang ke sampah' : 'Memasak…',
      pot: active.state === 'ready' ? 'Sendok sup ke piring' : 'Masukkan bawang + tomat potong',
      serve: 'Sajikan piring yang cocok',
      trash: 'Buang yang dibawa',
    };
    hint = labels[active.kind] || hint;
  }
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(43,33,24,0.85)';
  const w = ctx.measureText(hint).width + 28;
  rr(ctx, (VIEW_W - w) / 2, VIEW_H - 38, w, 22, 11); ctx.fill();
  text(ctx, hint, VIEW_W / 2, VIEW_H - 27, 13, '#f2e8d5');
}

// ------------------------------------------------------------------ screens

function overlay(ctx, alpha) {
  ctx.fillStyle = 'rgba(20,14,8,' + alpha + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawTitle(ctx, world) {
  overlay(ctx, 0.55);
  text(ctx, 'DAPUR PANAS', VIEW_W / 2, 210, 72, '#ffd94a', 'bold');
  text(ctx, 'K I T C H E N   R U S H', VIEW_W / 2, 262, 22, '#fff', 'bold');
  text(ctx, 'Masak cepat, sajikan tepat waktu!', VIEW_W / 2, 300, 18, '#f2e8d5');
  ctx.fillStyle = '#c94f43';
  rr(ctx, VIEW_W / 2 - 170, 330, 340, 52, 12); ctx.fill();
  text(ctx, 'TEKAN ENTER / KLIK UNTUK MULAI', VIEW_W / 2, 357, 18, '#fff', 'bold');
  text(ctx, 'Shift 3 menit • 5 resep • Jangan biarkan patty gosong!', VIEW_W / 2, 412, 14, '#d9c39a');
  text(ctx, 'WASD / Panah gerak  •  E / Spasi interaksi  •  Q dash  •  R restart', VIEW_W / 2, 440, 14, '#d9c39a');
  text(ctx, 'Skor terbaik: ' + (world.best || 0), VIEW_W / 2, 478, 14, '#ffd94a', 'bold');
}

function drawGameOver(ctx, world) {
  overlay(ctx, 0.6);
  text(ctx, world.overReason || 'Shift Selesai!', VIEW_W / 2, 180, 44, '#ffd94a', 'bold');
  text(ctx, 'SKOR AKHIR', VIEW_W / 2, 240, 16, '#d9c39a', 'bold');
  text(ctx, String(world.score), VIEW_W / 2, 292, 64, '#fff', 'bold');
  const rows = [
    'Hidangan disajikan: ' + world.servedCorrect,
    'Pesanan hangus: ' + world.expired,
    'Sajian salah: ' + world.servedWrong,
    'Combo terbaik: x' + world.bestCombo,
    'Akurasi: ' + (world.accuracy != null ? world.accuracy : 100) + '%',
    'Skor terbaik: ' + (world.best || 0),
  ];
  rows.forEach((r, i) => text(ctx, r, VIEW_W / 2, 350 + i * 28, 16, '#f2e8d5'));
  ctx.fillStyle = '#c94f43';
  rr(ctx, VIEW_W / 2 - 150, 540, 300, 48, 12); ctx.fill();
  text(ctx, 'TEKAN R UNTUK MAIN LAGI', VIEW_W / 2, 565, 17, '#fff', 'bold');
}

// ------------------------------------------------------------------ main

export function render(ctx, world, active) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawFloor(ctx);
  for (const s of world.stations) {
    drawStation(ctx, world, s, active === s);
  }
  drawChef(ctx, world);
  drawBoard(ctx, world);
  if (world.mode === 'playing') {
    drawRecipeList(ctx);
    drawFlash(ctx, world);
    drawHint(ctx, world, active);
  }
  if (world.mode === 'title') drawTitle(ctx, world);
  if (world.mode === 'over') drawGameOver(ctx, world);
}
