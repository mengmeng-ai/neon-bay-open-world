// Neon Bay — tuning, palette, city layout and story data in one place.
// The world is a 3200 x 2400 top-down city on a street grid. The renderer
// shows a 1280 x 720 window of it, scaled to the browser window.

export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'neon-bay.save.v1';
export const BEST_KEY = 'neon-bay.best.v1';

// Streets run every 400 px; each block between them holds buildings.
export const BLOCK = 400;
export const ROAD = 96;

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  sprintSpeed: 330,
  health: 100,
  punchRange: 46,
  punchDamage: 34,
  punchCooldown: 0.38,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  maxSpeed: 560,
  reverseMax: 180,
  turnRate: 2.6,
  brake: 700,
};

export const POLICE = {
  maxSpeed: 520,
  accel: 380,
  turnRate: 2.9,
  arrestRange: 34,
  bustTime: 2.2,
};

export const WANTED = {
  decaySeconds: 26,
  // stars -> how many police cars hunt the player at once
  hunters: [0, 1, 2, 3, 4, 5],
};

export const PALETTE = {
  grass: '#0e2a1e',
  road: '#232833',
  roadLine: '#d8b13a',
  sidewalk: '#3a4152',
  building: ['#2c3550', '#3a2c50', '#50352c', '#2c5044', '#4a2c3d'],
  buildingEdge: '#5a6a8a',
  neon: ['#ff2e88', '#00e5ff', '#ffe600', '#7cff00', '#ff7a00'],
  water: '#0a3a5c',
  park: '#123f27',
  player: '#ffd23f',
  playerCar: '#00e5ff',
  trafficCar: ['#e5534b', '#4fc3f7', '#f2c94c', '#9b7ede', '#e8e8e8', '#7cff00'],
  policeCar: '#2f6df6',
  ped: ['#f2a65a', '#a8e063', '#f78fb3', '#63cdda', '#e0aaff'],
  text: '#f4f6fa',
  muted: '#9aa5b8',
  hud: 'rgba(8, 12, 24, 0.72)',
  star: '#ffd23f',
  marker: '#ff2e88',
};

// Named places on the map. x/y are world coordinates.
export const PLACES = {
  garage: { name: "Marla's Garage", x: 640, y: 560 },
  docks: { name: 'Harbor Docks', x: 2760, y: 2040 },
  pier: { name: 'Neon Pier', x: 2760, y: 360 },
  bank: { name: 'Bay Trust Bank', x: 1560, y: 1160 },
  hideout: { name: 'Rooftop Hideout', x: 480, y: 1960 },
  plaza: { name: 'Crescent Plaza', x: 1560, y: 560 },
  hospital: { name: 'St. Lumen Clinic', x: 2360, y: 1560 },
  market: { name: 'Night Market', x: 760, y: 1360 },
};

// The story: Rook, a driver new to Neon Bay, takes jobs from fixer Marla Vane.
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    brief: "Marla needs a driver. Steal the teal coupe parked at the Harbor Docks and bring it to her garage. Don't wreck it.",
    target: 'docks',
    deliver: 'garage',
    reward: 250,
    wantedOnStart: 0,
  },
  {
    id: 'neon-run',
    title: 'Neon Run',
    brief: 'A sealed case has to reach the Neon Pier before midnight. The Bay Trust security team tipped off the police — expect a tail.',
    target: 'garage',
    deliver: 'pier',
    reward: 600,
    wantedOnStart: 2,
  },
  {
    id: 'bay-heist',
    title: 'Bay Heist',
    brief: "One last job: lift the vault case from Bay Trust Bank and vanish to the Rooftop Hideout. Three stars and counting. Don't get caught.",
    target: 'bank',
    deliver: 'hideout',
    reward: 1500,
    wantedOnStart: 3,
  },
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = '"SF Mono", ui-monospace, Menlo, Consolas, monospace';

// Total mission payout across the three jobs: $250 + $600 + $1,500.
export const TOTAL_REWARD = 2350;
