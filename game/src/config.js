// config.js — Dapur Panas: Kitchen Rush
// All tuning constants for the game live here: canvas size, timings,
// recipes, scoring and difficulty. Nothing in this file touches the network.

export const VIEW_W = 1280;
export const VIEW_H = 720;

// The order board occupies the top strip; the kitchen floor starts below it.
export const BOARD_H = 104;
export const FLOOR_Y = BOARD_H + 8;

// Chef movement.
export const CHEF_SPEED = 265;
export const CHEF_DASH_SPEED = 560;
export const DASH_TIME = 0.16;
export const DASH_COOLDOWN = 0.9;
export const CHEF_RADIUS = 20;

// Interaction reach: how close the chef must be to a station to use it.
export const INTERACT_RANGE = 58;

// Timings (seconds).
export const CHOP_TIME = 2.0;
export const PATTY_COOK_TIME = 5.0;
export const PATTY_BURN_TIME = 8.0;
export const SOUP_COOK_TIME = 6.0;
export const WASH_TIME = 2.0;
export const DIRTY_PLATE_DELAY = 4.0;

// Shift length (seconds) and difficulty tiers.
export const SHIFT_TIME = 180;
export const TIER_AT = [60, 120];
export const ORDER_SPAWN_INTERVAL = [14, 11, 8];
export const ORDER_TIME_LIMIT = [60, 50, 45];
export const MAX_ORDERS = 4;

// Scoring.
export const EXPIRE_PENALTY = 50;
export const COMBO_MAX = 3;

// Ingredient catalogue. `choppable` items can go on a cutting board;
// `cookable` items go in a pan; `soup` items go in the pot.
export const INGREDIENTS = {
  tomato: { id: 'tomato', name: 'Tomat', color: '#e8443a', dark: '#b02a22', choppable: true },
  lettuce: { id: 'lettuce', name: 'Selada', color: '#58b368', dark: '#2f7d3d', choppable: true },
  onion: { id: 'onion', name: 'Bawang', color: '#b678d6', dark: '#7d4a9e', choppable: true },
  patty: { id: 'patty', name: 'Patty', color: '#8a5a33', dark: '#5d3a1e', cookable: true },
  bun: { id: 'bun', name: 'Roti', color: '#f2c879', dark: '#c99a4a' },
};

// Chopped / cooked variants keep the same base colour with a marker.
export const VARIANTS = {
  'tomato-chopped': { base: 'tomato', name: 'Tomat Potong', color: '#e8443a' },
  'lettuce-chopped': { base: 'lettuce', name: 'Selada Potong', color: '#58b368' },
  'onion-chopped': { base: 'onion', name: 'Bawang Potong', color: '#b678d6' },
  'patty-cooked': { base: 'patty', name: 'Patty Masak', color: '#6e4423' },
  soup: { base: 'onion', name: 'Sup Bawang', color: '#d98a2b' },
};

// Every dish is served on a plate. `needs` lists the plate contents.
export const RECIPES = [
  {
    id: 'salad',
    name: 'Salad Segar',
    needs: ['tomato-chopped', 'lettuce-chopped'],
    points: 100,
    color: '#58b368',
  },
  {
    id: 'burger',
    name: 'Burger Klasik',
    needs: ['patty-cooked', 'lettuce-chopped', 'bun'],
    points: 150,
    color: '#c98a3d',
  },
  {
    id: 'soup',
    name: 'Sup Bawang',
    needs: ['soup', 'bun'],
    points: 140,
    color: '#d98a2b',
  },
  {
    id: 'onion-burger',
    name: 'Burger Bawang',
    needs: ['patty-cooked', 'onion-chopped', 'bun'],
    points: 160,
    color: '#9a6bc0',
  },
  {
    id: 'full-salad',
    name: 'Salad Komplit',
    needs: ['tomato-chopped', 'lettuce-chopped', 'onion-chopped'],
    points: 130,
    color: '#3fae8a',
  },
];

export function recipeById(id) {
  return RECIPES.find((r) => r.id === id) || null;
}

export function itemName(itemId) {
  if (!itemId) return '';
  if (itemId === 'plate') return 'Piring';
  if (itemId === 'plate-dirty') return 'Piring Kotor';
  const v = VARIANTS[itemId];
  if (v) return v.name;
  const ing = INGREDIENTS[itemId];
  if (ing) return ing.name;
  return itemId;
}

export function itemColor(itemId) {
  if (!itemId) return '#cccccc';
  const v = VARIANTS[itemId];
  if (v) return v.color;
  const ing = INGREDIENTS[itemId];
  if (ing) return ing.color;
  return '#cccccc';
}
