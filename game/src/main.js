// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens:
// title, play, paused, busted, and win (all three jobs done).
//
// ?seed=N fixes the city. ?shot=cover|street|mission|wanted (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_COIN, EVENT_CRASH, EVENT_PUNCH, EVENT_STEAL } from './world.js';
import { createMissions, MISSION_EVENT_COMPLETE } from './missions.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_HORN, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const missions = createMissions(world);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best haul then lasts this visit only.
  }
}

function saveGame() {
  try {
    const s = world.state;
    const data = {
      cash: s.cash,
      missionIndex: s.missionIndex,
      missionStage: s.missionStage,
      x: s.player.x,
      y: s.player.y,
      health: s.player.health,
      kills: s.kills,
      carsStolen: s.carsStolen,
      wanted: s.wanted,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be off; the game still plays.
  }
}

function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const s = world.state;
    s.cash = data.cash || 0;
    s.player.cash = data.cash || 0;
    s.missionIndex = data.missionIndex || 0;
    s.missionStage = data.missionStage || 'to-target';
    s.player.x = data.x || s.player.x;
    s.player.y = data.y || s.player.y;
    s.player.health = data.health || 100;
    s.kills = data.kills || 0;
    s.carsStolen = data.carsStolen || 0;
    s.wanted = data.wanted || 0;
    s.camera.x = s.player.x;
    s.camera.y = s.player.y;
    return true;
  } catch {
    return false;
  }
}

function runShot(name) {
  const scene = stageShot(name, world, missions);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, readBest(), missions);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  // A punch pressed between frames is held here until the next world step.
  let punchQueued = false;
  let hadSave = false;
  try {
    hadSave = window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    hadSave = false;
  }

  function announce(message) {
    status.textContent = message;
  }

  // Debug hook for automated play-testing: read-only snapshot of play state.
  window.__neonState = () => {
    const s = world.state;
    const p = s.player;
    return {
      screen,
      x: Math.round(p.x),
      y: Math.round(p.y),
      inCar: !!p.inCar,
      carSpeed: p.inCar ? Math.round(p.inCar.speed) : 0,
      carAngle: p.inCar ? Math.round((p.inCar.angle * 180) / Math.PI) : null,
      carsStolen: s.carsStolen,
      missionIndex: s.missionIndex,
      missionStage: s.missionStage,
      wanted: s.wanted,
      cash: s.cash,
      health: Math.round(p.health),
      parked: s.cars.filter((c) => c.parked).map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), color: c.color })),
    };
  };

  function startGame(fresh) {
    if (fresh) {
      world.reset();
      missions.startMission(0);
    } else if (hadSave) {
      world.reset();
      loadGame();
    } else {
      world.reset();
      missions.startMission(0);
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing Neon Bay. Steal the teal coupe at the Harbor Docks.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    saveGame();
    audio.busted();
    announce(`Busted. Haul $${world.state.cash}. Best $${best}.`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    saveGame();
    audio.missionDone();
    announce(`All three jobs done. Haul $${world.state.cash}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(!hadSave);
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame(true);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        saveGame();
        announce('Paused. Progress saved.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_PUNCH) punchQueued = true;
    if (actions & ACTION_ENTER_CAR) {
      if (world.state.player.inCar) {
        world.exitCar();
        audio.doorSlam();
      } else {
        const events = world.enterCar();
        if (events & EVENT_STEAL) audio.engineStart();
        else audio.doorSlam();
      }
    }
    if (actions & ACTION_HORN) audio.horn();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, sprint: false }, 0);
      return;
    }
    const dir = input.direction();
    const punch = punchQueued ? 8 : 0;
    punchQueued = false;
    const events = world.step(STEP, dir, punch);
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_STEAL) audio.engineStart();
    if (events & EVENT_BUSTED) {
      endGame();
      return;
    }
    const missionEvents = missions.update();
    if (missionEvents & MISSION_EVENT_COMPLETE) {
      audio.missionDone();
      saveGame();
      if (world.state.missionDone) winGame();
    }
    // Engine hum and sirens follow the action.
    const car = world.state.player.inCar;
    if (car) audio.engine(Math.abs(car.speed) / 560);
    else audio.engineStop();
    audio.siren(STEP, world.state.wanted);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, missions);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame();
      announce('Paused.');
    }
  });

  announce(hadSave ? 'Neon Bay. Press Enter to continue your saved game.' : 'Neon Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
