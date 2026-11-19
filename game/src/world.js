// Neon Bay's rules and state, with no drawing and no browser in it: the
// city grid, the player on foot or in a car, traffic, pedestrians, police,
// wanted level, pickups and particles. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react to sounds.

import { BLOCK, CAR, PALETTE, PLACES, PLAYER, POLICE, ROAD, WANTED, WORLD } from './config.js';
import { pick, range } from './random.js';

export const EVENT_PUNCH = 1;
export const EVENT_COIN = 2;
export const EVENT_CRASH = 4;
export const EVENT_BUSTED = 8;
export const EVENT_MISSION = 16;
export const EVENT_STEAL = 32;

const TWO_PI = Math.PI * 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
}

// Is this point on a road (street), rather than inside a block?
export function onRoad(x, y) {
  const bx = x % BLOCK;
  const by = y % BLOCK;
  return bx < ROAD || by < ROAD || bx > BLOCK - 1 || by > BLOCK - 1;
}

function roadCentre(x) {
  const block = Math.floor(x / BLOCK);
  const off = x - block * BLOCK;
  if (off < ROAD) return block * BLOCK + ROAD / 2;
  return block * BLOCK + BLOCK - ROAD / 2;
}

function nearestRoadPoint(x, y) {
  return { x: roadCentre(x), y: roadCentre(y) };
}

export function createWorld(random) {
  // --- city: one building per block, with a neon sign colour and height ---
  const buildings = [];
  for (let bx = 0; bx < WORLD.width / BLOCK; bx += 1) {
    for (let by = 0; by < WORLD.height / BLOCK; by += 1) {
      const x = bx * BLOCK + ROAD + 14;
      const y = by * BLOCK + ROAD + 14;
      const w = BLOCK - ROAD - 28;
      const h = BLOCK - ROAD - 28;
      // The south-west block is the bay: water instead of buildings.
      if (bx === 0 && by === 5) continue;
      // The plaza block stays open.
      if (bx === 3 && by === 1) continue;
      buildings.push({
        x, y, w, h,
        color: pick(random, PALETTE.building),
        neon: pick(random, PALETTE.neon),
        sign: pick(random, ['HOTEL', 'BAR', 'RAMEN', 'CLUB', '24H', 'PIER', 'TAXI', 'GYM', 'NEON', 'BAY']),
      });
    }
  }

  const player = {
    x: PLACES.plaza.x, y: PLACES.plaza.y, angle: -Math.PI / 2,
    health: PLAYER.health, cash: 0, speed: 0,
    inCar: null, punchTimer: 0, hurtTimer: 0, dead: false,
  };

  // Parked cars the player can steal, scattered near roads.
  function makeParkedCar(x, y, color) {
    return { x, y, angle: random() * TWO_PI, color, parked: true, speed: 0, driver: false };
  }
  const cars = [
    makeParkedCar(PLACES.docks.x - 40, PLACES.docks.y - 20, '#00e5ff'),
    makeParkedCar(PLACES.garage.x + 90, PLACES.garage.y + 30, '#e5534b'),
    makeParkedCar(PLACES.pier.x - 60, PLACES.pier.y + 40, '#f2c94c'),
    makeParkedCar(PLACES.market.x + 40, PLACES.market.y - 60, '#9b7ede'),
    makeParkedCar(PLACES.hospital.x - 80, PLACES.hospital.y + 20, '#e8e8e8'),
  ];
  // Moving traffic, one car per street lane at start.
  for (let i = 0; i < 16; i += 1) {
    const horizontal = random() < 0.5;
    const lane = intLane(random);
    cars.push({
      x: horizontal ? range(random, 100, WORLD.width - 100) : lane,
      y: horizontal ? lane : range(random, 100, WORLD.height - 100),
      angle: horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      color: pick(random, PALETTE.trafficCar),
      parked: false, speed: range(random, 90, 170), driver: true,
    });
  }
  function intLane(r) {
    const block = Math.floor(r() * (WORLD.width / BLOCK));
    return block * BLOCK + ROAD / 2 + (r() < 0.5 ? 0 : ROAD / 2 - 6);
  }

  // Parked cars sit next to their place, which can leave a car's collision
  // circle half inside a building — and a car that starts overlapping a
  // building can never drive out, because the driving step refuses any move
  // while the circle overlaps. Push each parked car out of buildings along
  // the smallest penetration, so every stealable car starts on a road.
  function pushOutOfBuildings(car) {
    const r = CAR.length / 2;
    for (let guard = 0; guard < 8; guard += 1) {
      let fixed = true;
      for (const b of buildings) {
        const ox = Math.min(car.x + r, b.x + b.w) - Math.max(car.x - r, b.x);
        const oy = Math.min(car.y + r, b.y + b.h) - Math.max(car.y - r, b.y);
        if (ox <= 0 || oy <= 0) continue;
        fixed = false;
        const east = b.x + b.w + r - car.x;
        const west = car.x - (b.x - r);
        const south = b.y + b.h + r - car.y;
        const north = car.y - (b.y - r);
        const m = Math.min(east, west, south, north);
        if (m === east) car.x = b.x + b.w + r;
        else if (m === west) car.x = b.x - r;
        else if (m === south) car.y = b.y + b.h + r;
        else car.y = b.y - r;
      }
      if (fixed) break;
    }
  }
  for (const car of cars) if (car.parked) pushOutOfBuildings(car);

  // Remember where each parked car started, so a reset puts the city back.
  const parkedSpots = cars.filter((car) => car.parked).map((car) => ({ car, x: car.x, y: car.y, angle: car.angle }));

  const peds = [];
  for (let i = 0; i < 42; i += 1) {
    peds.push({
      x: range(random, 80, WORLD.width - 80),
      y: range(random, 80, WORLD.height - 80),
      angle: random() * TWO_PI, speed: range(random, 30, 70),
      color: pick(random, PALETTE.ped), state: 'walk', timer: range(random, 1, 5),
      scared: 0, health: 30,
    });
  }

  const police = [];
  for (let i = 0; i < 5; i += 1) {
    police.push({
      x: -1000, y: -1000, angle: 0, speed: 0, active: false, bustTimer: 0, color: '#2f6df6',
    });
  }

  const pickups = [];
  for (let i = 0; i < 14; i += 1) {
    pickups.push({
      x: range(random, 120, WORLD.width - 120),
      y: range(random, 120, WORLD.height - 120),
      value: pick(random, [25, 25, 50, 50, 100]),
      active: true, bob: random() * TWO_PI,
    });
  }

  const particles = [];

  const state = {
    player, cars, peds, police, pickups, particles, buildings,
    wanted: 0, wantedTimer: 0, elapsed: 0, timeOfDay: 0.32,
    missionIndex: 0, missionStage: 'to-target', missionDone: false,
    cash: 0, kills: 0, carsStolen: 0, busted: false, message: '', messageTimer: 0,
    camera: { x: player.x, y: player.y },
  };

  function reset() {
    player.x = PLACES.plaza.x;
    player.y = PLACES.plaza.y;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.cash = 0;
    player.inCar = null;
    player.punchTimer = 0;
    player.hurtTimer = 0;
    player.dead = false;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.elapsed = 0;
    state.timeOfDay = 0.32;
    state.missionIndex = 0;
    state.missionStage = 'to-target';
    state.missionDone = false;
    state.cash = 0;
    state.kills = 0;
    state.carsStolen = 0;
    state.busted = false;
    state.message = '';
    state.messageTimer = 0;
    for (const spot of parkedSpots) {
      spot.car.x = spot.x;
      spot.car.y = spot.y;
      spot.car.angle = spot.angle;
      spot.car.parked = true;
      spot.car.speed = 0;
      spot.car.stolenBefore = false;
    }
    for (const ped of peds) { ped.state = 'walk'; ped.scared = 0; ped.health = 30; }
    for (const cop of police) { cop.active = false; cop.x = -1000; cop.y = -1000; cop.bustTimer = 0; }
    for (const pickup of pickups) pickup.active = true;
    particles.length = 0;
  }

  function showMessage(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 3.5;
  }

  function addWanted(stars) {
    state.wanted = clamp(state.wanted + stars, 0, 5);
    state.wantedTimer = WANTED.decaySeconds;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * TWO_PI;
      const s = range(random, speed * 0.3, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(random, 0.3, 0.8), max: 0.8, color, size: range(random, 2, 5) });
    }
  }

  function hitBuilding(x, y, radius) {
    for (const b of buildings) {
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
    }
    return null;
  }

  function moveWithCollision(entity, dx, dy, radius) {
    const nx = entity.x + dx;
    if (!hitBuilding(nx, entity.y, radius)) entity.x = clamp(nx, radius, WORLD.width - radius);
    const ny = entity.y + dy;
    if (!hitBuilding(entity.x, ny, radius)) entity.y = clamp(ny, radius, WORLD.height - radius);
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      const d = dist(player, car);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar() {
    const car = nearestCar(70);
    if (!car) return 0;
    player.inCar = car;
    car.parked = false;
    car.driver = true;
    if (car.color === '#00e5ff' && state.missionIndex === 0 && state.missionStage === 'to-target') {
      // The teal coupe is the mission car; stealing it is the job.
    }
    if (!car.stolenBefore) {
      car.stolenBefore = true;
      state.carsStolen += 1;
      addWanted(1);
      showMessage('Car stolen! The cops noticed — 1 star.', 3);
      burst(car.x, car.y, '#ffd23f', 10, 120);
      return EVENT_STEAL;
    }
    return 0;
  }

  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    player.inCar = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
    player.x = clamp(player.x, 20, WORLD.width - 20);
    player.y = clamp(player.y, 20, WORLD.height - 20);
    car.speed = 0;
    car.parked = true;
  }

  function punch() {
    if (player.punchTimer > 0 || player.inCar) return 0;
    player.punchTimer = PLAYER.punchCooldown;
    let events = EVENT_PUNCH;
    // Hit the nearest pedestrian in front of the player.
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const d = dist(player, ped);
      if (d > PLAYER.punchRange) continue;
      const facing = Math.abs(angleDiff(player.angle, angleTo(player, ped)));
      if (facing > 1.2) continue;
      ped.health -= PLAYER.punchDamage;
      ped.scared = 3;
      burst(ped.x, ped.y, '#ff5a5a', 8, 140);
      if (ped.health <= 0) {
        ped.state = 'down';
        state.kills += 1;
        addWanted(1);
        showMessage('That was assault, Rook. The law noticed.', 2.5);
      }
      break;
    }
    // Punching a parked car window also counts as trouble.
    const car = nearestCar(PLAYER.punchRange + 20);
    if (car && car.parked) {
      burst(car.x, car.y, '#9aa5b8', 6, 100);
      addWanted(1);
    }
    return events;
  }

  function stepPlayer(dt, dir, punchPressed) {
    if (player.dead) return 0;
    let events = 0;
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (player.hurtTimer > 0) player.hurtTimer -= dt;
    if (punchPressed) events |= punch();

    if (player.inCar) {
      const car = player.inCar;
      const forward = -dir.y; // W = forward
      const steer = dir.x;
      if (forward > 0) car.speed += CAR.accel * dt;
      else if (forward < 0) car.speed -= (car.speed > 10 ? CAR.brake : CAR.accel * 0.5) * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
      car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
      if (Math.abs(car.speed) > 20) {
        car.angle += steer * CAR.turnRate * dt * Math.sign(car.speed) * (car.speed < 0 ? -1 : 1);
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const hit = hitBuilding(nx, ny, CAR.length / 2);
      if (hit) {
        if (Math.abs(car.speed) > 260) {
          events |= EVENT_CRASH;
          burst(car.x, car.y, '#ffaa00', 14, 200);
          player.health -= 8;
        }
        car.speed *= -0.25;
      } else {
        car.x = clamp(nx, 30, WORLD.width - 30);
        car.y = clamp(ny, 30, WORLD.height - 30);
      }
      // Running over pedestrians is a crime in Neon Bay.
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        if (dist(car, ped) < 30) {
          ped.state = 'down';
          ped.health = 0;
          state.kills += 1;
          addWanted(1);
          events |= EVENT_CRASH;
          burst(ped.x, ped.y, '#ff5a5a', 10, 160);
        }
      }
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = car.speed;
      return events;
    }

    // On foot.
    const speed = dir.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    if (dir.x !== 0 || dir.y !== 0) {
      player.angle = Math.atan2(dir.y, dir.x);
      moveWithCollision(player, dir.x * speed * dt, dir.y * speed * dt, PLAYER.radius);
    }
    player.speed = dir.x !== 0 || dir.y !== 0 ? speed : 0;
    return events;
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (car.parked || car === player.inCar) continue;
      // Traffic follows the road grid: steer toward the nearest lane centre.
      const target = nearestRoadPoint(car.x + Math.cos(car.angle) * 60, car.y + Math.sin(car.angle) * 60);
      const want = angleTo(car, target);
      const diff = angleDiff(car.angle, want);
      car.angle += clamp(diff, -1.4 * dt, 1.4 * dt);
      car.speed = clamp(car.speed + (140 - car.speed) * dt * 0.4, 60, 190);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.x < 40 || car.x > WORLD.width - 40 || car.y < 40 || car.y > WORLD.height - 40) {
        car.angle += Math.PI;
        car.x = clamp(car.x, 60, WORLD.width - 60);
        car.y = clamp(car.y, 60, WORLD.height - 60);
      }
      // Keep traffic out of buildings.
      if (hitBuilding(car.x, car.y, 24)) {
        car.angle += Math.PI / 2;
        car.x = clamp(car.x - Math.cos(car.angle) * 40, 60, WORLD.width - 60);
        car.y = clamp(car.y - Math.sin(car.angle) * 40, 60, WORLD.height - 60);
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      if (ped.scared > 0) {
        ped.scared -= dt;
        // Flee from the player.
        const away = angleTo(player, ped);
        ped.angle = away;
        moveWithCollision(ped, Math.cos(away) * 150 * dt, Math.sin(away) * 150 * dt, 10);
        continue;
      }
      ped.timer -= dt;
      if (ped.timer <= 0) {
        ped.timer = range(random, 2, 6);
        ped.angle = random() * TWO_PI;
      }
      moveWithCollision(ped, Math.cos(ped.angle) * ped.speed * dt, Math.sin(ped.angle) * ped.speed * dt, 10);
      // Pedestrians get scared when the player speeds past in a car.
      if (player.inCar && Math.abs(player.speed) > 300 && dist(player, ped) < 120) ped.scared = 2;
    }
  }

  function stepPolice(dt) {
    const wantedCount = WANTED.hunters[state.wanted] || 0;
    let active = 0;
    for (const cop of police) if (cop.active) active += 1;
    // Spawn hunters until the wanted level's count is met.
    for (const cop of police) {
      if (active >= wantedCount) break;
      if (cop.active) continue;
      const a = random() * TWO_PI;
      cop.x = clamp(player.x + Math.cos(a) * 700, 60, WORLD.width - 60);
      cop.y = clamp(player.y + Math.sin(a) * 700, 60, WORLD.height - 60);
      cop.active = true;
      cop.speed = 0;
      active += 1;
    }
    for (const cop of police) {
      if (!cop.active) continue;
      if (state.wanted === 0) {
        cop.active = false;
        cop.x = -1000;
        cop.y = -1000;
        continue;
      }
      const want = angleTo(cop, player);
      cop.angle += clamp(angleDiff(cop.angle, want), -POLICE.turnRate * dt, POLICE.turnRate * dt);
      cop.speed = clamp(cop.speed + POLICE.accel * dt, 0, POLICE.maxSpeed);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      if (hitBuilding(cop.x, cop.y, 24)) {
        cop.angle += Math.PI / 3;
        cop.speed *= 0.5;
      }
      // Arrest: a cop that catches the player on foot holds them.
      const d = dist(cop, player);
      if (d < POLICE.arrestRange && !player.inCar && state.wanted >= 2) {
        cop.bustTimer += dt;
        if (cop.bustTimer > POLICE.bustTime) {
          state.busted = true;
          player.dead = true;
        }
      } else {
        cop.bustTimer = Math.max(0, cop.bustTimer - dt);
      }
      // Ramming a police car is a bad idea, but it slows them down.
      if (player.inCar && d < 52) {
        cop.speed *= 0.4;
        cop.angle += 0.6;
        burst(cop.x, cop.y, '#2f6df6', 8, 150);
      }
    }
  }

  function stepPickups(dt) {
    for (const pickup of pickups) {
      if (!pickup.active) continue;
      pickup.bob += dt * 3;
      if (dist(player, pickup) < 34) {
        pickup.active = false;
        player.cash += pickup.value;
        state.cash += pickup.value;
        burst(pickup.x, pickup.y, '#ffd23f', 10, 120);
      }
    }
  }

  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // Mission progress is owned by missions.js; the world only reports events.
  function step(dt, dir, actions) {
    let events = 0;
    state.elapsed += dt;
    state.timeOfDay = (state.timeOfDay + dt / 240) % 1;
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (state.messageTimer <= 0) state.message = '';
    }
    // Wanted level cools off when the player stays out of trouble.
    if (state.wanted > 0) {
      state.wantedTimer -= dt;
      if (state.wantedTimer <= 0) {
        state.wanted -= 1;
        state.wantedTimer = WANTED.decaySeconds;
        if (state.wanted === 0) showMessage('You lost the heat. Stay clean.', 2.5);
      }
    }
    if (player.health <= 0 && !player.dead) {
      player.dead = true;
      state.busted = true;
      events |= EVENT_BUSTED;
    }
    events |= stepPlayer(dt, dir, (actions & 8) !== 0);
    stepTraffic(dt);
    stepPeds(dt);
    stepPolice(dt);
    stepPickups(dt);
    stepParticles(dt);
    // Camera eases toward the player.
    state.camera.x += (player.x - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (player.y - state.camera.y) * Math.min(1, dt * 5);
    if (state.busted) events |= EVENT_BUSTED;
    return events;
  }

  reset();
  return {
    state, reset, step, enterCar, exitCar, punch, addWanted, showMessage, burst,
    nearestCar, hitBuilding,
  };
}
