// Screenshot scenes behind ?shot=cover|street|mission|wanted. Each one plays
// the real game forward from a fresh world for a fixed number of steps,
// steered by a small autopilot, so the frame is what real play looks like
// and the same seed always gives the same frame.

import { PLACES, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Drive the player's car toward a place: steer by the angle to it.
function driveToward(state, target) {
  const car = state.player.inCar;
  if (!car) return { x: 0, y: 0, sprint: false };
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = angleDiff(car.angle, want);
  return { x: clamp(diff * 2, -1, 1), y: -1, sprint: false };
}

function walkToward(state, target) {
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length, sprint: true };
}

function runSteps(world, seconds, pilot) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, pilot(world.state), 0);
    if (world.state.busted || world.state.player.dead) break;
  }
}

function putPlayerInCar(world, color) {
  const car = world.state.cars.find((c) => c.color === color);
  if (!car) return;
  world.state.player.x = car.x;
  world.state.player.y = car.y;
  world.state.player.inCar = car;
  car.parked = false;
  car.driver = true;
  car.speed = 200;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Unknown names stage the title scene.
 */
export function stageShot(name, world, missions) {
  world.reset();
  const state = world.state;

  if (name === 'street') {
    state.timeOfDay = 0.5;
    state.player.x = PLACES.market.x;
    state.player.y = PLACES.market.y;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    runSteps(world, 6, (s) => walkToward(s, PLACES.plaza));
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    state.timeOfDay = 0.06;
    missions.startMission(2);
    state.player.x = PLACES.bank.x - 120;
    state.player.y = PLACES.bank.y + 60;
    putPlayerInCar(world, '#e5534b');
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    runSteps(world, 4, (s) => driveToward(s, PLACES.hideout));
    return { screen: SCREEN_PLAY };
  }

  if (name === 'wanted') {
    state.timeOfDay = 0.1;
    missions.startMission(1);
    world.addWanted(4);
    putPlayerInCar(world, '#f2c94c');
    state.player.x = world.state.player.inCar.x;
    state.player.y = world.state.player.inCar.y;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    runSteps(world, 8, (s) => driveToward(s, PLACES.pier));
    return { screen: SCREEN_PLAY };
  }

  if (name === 'cover') {
    state.timeOfDay = 0.78;
    missions.startMission(0);
    putPlayerInCar(world, '#00e5ff');
    state.player.x = world.state.player.inCar.x;
    state.player.y = world.state.player.inCar.y;
    world.addWanted(2);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    runSteps(world, 10, (s) => driveToward(s, PLACES.garage));
    return { screen: SCREEN_PLAY };
  }

  // Title scene: a few seconds of traffic drifting behind the menu.
  state.timeOfDay = 0.32;
  runSteps(world, 5, () => ({ x: 0, y: 0, sprint: false }));
  return { screen: SCREEN_TITLE };
}
