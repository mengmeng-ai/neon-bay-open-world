// Drawing only: the city, the cars, the people, the HUD, the minimap and
// the menus. The camera follows the player; the world is drawn in world
// coordinates and the HUD in screen coordinates.

import { BLOCK, FONT, MISSIONS, PALETTE, PLACES, ROAD, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const DAY_TINTS = [
  { t: 0.0, color: 'rgba(8, 10, 40, 0.42)' },   // night
  { t: 0.25, color: 'rgba(255, 150, 60, 0.10)' }, // dawn
  { t: 0.5, color: 'rgba(255, 255, 255, 0)' },    // noon
  { t: 0.75, color: 'rgba(255, 110, 40, 0.16)' }, // dusk
  { t: 1.0, color: 'rgba(8, 10, 40, 0.42)' },
];

function nightTint(timeOfDay) {
  for (let i = 0; i < DAY_TINTS.length - 1; i += 1) {
    const a = DAY_TINTS[i];
    const b = DAY_TINTS[i + 1];
    if (timeOfDay >= a.t && timeOfDay <= b.t) return a.color;
  }
  return 'rgba(8, 10, 40, 0.42)';
}

function clockLabel(timeOfDay) {
  const hours = Math.floor(timeOfDay * 24);
  const minutes = Math.floor((timeOfDay * 24 - hours) * 60);
  const h = hours % 12 === 0 ? 12 : hours % 12;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    offsetX = (canvas.width - VIEW.width * scale) / 2;
    offsetY = (canvas.height - VIEW.height * scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}-${bold ? 'b' : 'n'}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawRoads(camera) {
    context.fillStyle = PALETTE.grass;
    context.fillRect(camera.x - VIEW.width / 2 - 40, camera.y - VIEW.height / 2 - 40, VIEW.width + 80, VIEW.height + 80);
    // The bay: water in the south-west corner.
    context.fillStyle = PALETTE.water;
    context.fillRect(0, BLOCK * 5, BLOCK, BLOCK);
    context.fillStyle = PALETTE.park;
    context.fillRect(BLOCK * 3 + ROAD, BLOCK + ROAD, BLOCK - ROAD, BLOCK - ROAD);
    for (let x = 0; x <= WORLD.width; x += BLOCK) {
      context.fillStyle = PALETTE.road;
      context.fillRect(x, 0, ROAD, WORLD.height);
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(x + ROAD, 0, 6, WORLD.height);
    }
    for (let y = 0; y <= WORLD.height; y += BLOCK) {
      context.fillStyle = PALETTE.road;
      context.fillRect(0, y, WORLD.width, ROAD);
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, y + ROAD, WORLD.width, 6);
    }
    // Centre dashes on the roads.
    context.fillStyle = PALETTE.roadLine;
    for (let x = 0; x <= WORLD.width; x += BLOCK) {
      for (let y = 0; y < WORLD.height; y += 80) {
        context.fillRect(x + ROAD / 2 - 2, y + 20, 4, 34);
      }
    }
    for (let y = 0; y <= WORLD.height; y += BLOCK) {
      for (let x = 0; x < WORLD.width; x += 80) {
        context.fillRect(x + 20, y + ROAD / 2 - 2, 34, 4);
      }
    }
  }

  function drawBuildings(state, camera) {
    const left = camera.x - VIEW.width / 2 - 60;
    const top = camera.y - VIEW.height / 2 - 60;
    const right = camera.x + VIEW.width / 2 + 60;
    const bottom = camera.y + VIEW.height / 2 + 60;
    for (const b of state.buildings) {
      if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = PALETTE.buildingEdge;
      context.lineWidth = 3;
      context.strokeRect(b.x, b.y, b.w, b.h);
      // Windows.
      context.fillStyle = 'rgba(255, 230, 140, 0.55)';
      for (let wx = b.x + 18; wx < b.x + b.w - 18; wx += 44) {
        for (let wy = b.y + 18; wy < b.y + b.h - 18; wy += 44) {
          if ((wx + wy) % 88 === 0) context.fillRect(wx, wy, 16, 20);
        }
      }
      // Neon sign.
      context.fillStyle = b.neon;
      context.font = `700 22px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(b.sign, b.x + b.w / 2, b.y + 34);
    }
  }

  function drawCar(car, isPlayer, isPolice) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.fillRect(-28, -14, 58, 30);
    context.fillStyle = car.color;
    context.fillRect(-27, -13, 54, 26);
    context.fillStyle = '#10151f';
    context.fillRect(-8, -11, 18, 22);
    context.fillStyle = '#dfe9ff';
    context.fillRect(20, -10, 5, 20);
    if (isPolice) {
      context.fillStyle = '#ff2e2e';
      context.fillRect(-22, -13, 8, 6);
      context.fillStyle = '#2f6df6';
      context.fillRect(-22, 7, 8, 6);
      context.fillStyle = '#ffffff';
      context.font = `700 9px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('POLICE', 0, 4);
    }
    if (isPlayer) {
      context.strokeStyle = '#ffd23f';
      context.lineWidth = 3;
      context.strokeRect(-30, -16, 60, 32);
    }
    context.restore();
  }

  function drawPed(ped) {
    if (ped.state === 'down') {
      context.fillStyle = ped.color;
      context.beginPath();
      context.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#ff5a5a';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(ped.x - 8, ped.y - 8);
      context.lineTo(ped.x + 8, ped.y + 8);
      context.moveTo(ped.x + 8, ped.y - 8);
      context.lineTo(ped.x - 8, ped.y + 8);
      context.stroke();
      return;
    }
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1a1a22';
    context.beginPath();
    context.arc(ped.x + Math.cos(ped.angle) * 5, ped.y + Math.sin(ped.angle) * 5, 4, 0, Math.PI * 2);
    context.fill();
    if (ped.scared > 0) {
      text('!', ped.x + 12, ped.y - 10, 20, '#ffd23f', 'center', true);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.dead) return;
    if (p.inCar) return; // The car drawing shows the player.
    // Punch arc while punching.
    if (p.punchTimer > 0.2) {
      context.strokeStyle = 'rgba(255, 210, 63, 0.8)';
      context.lineWidth = 5;
      context.beginPath();
      context.arc(p.x, p.y, 34, p.angle - 0.7, p.angle + 0.7);
      context.stroke();
    }
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(p.x, p.y, 14, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#10151f';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(p.x, p.y, 14, 0, Math.PI * 2);
    context.stroke();
    // Facing tick.
    context.strokeStyle = '#10151f';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(p.x, p.y);
    context.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
    context.stroke();
    if (p.hurtTimer > 0 && Math.floor(p.hurtTimer * 10) % 2 === 0) {
      context.fillStyle = 'rgba(255, 60, 60, 0.4)';
      context.beginPath();
      context.arc(p.x, p.y, 18, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      if (!pickup.active) continue;
      const bob = Math.sin(pickup.bob) * 3;
      context.fillStyle = '#ffd23f';
      context.beginPath();
      context.arc(pickup.x, pickup.y + bob, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7a5c00';
      context.font = `700 13px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('$', pickup.x, pickup.y + bob + 5);
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
  }

  function drawMissionMarker(state, missions) {
    const place = missions ? missions.targetPlace() : null;
    if (!place) return;
    const pulse = 1 + Math.sin(state.elapsed * 5) * 0.15;
    context.save();
    context.translate(place.x, place.y);
    context.scale(pulse, pulse);
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, 34, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(0, -44);
    context.lineTo(14, -18);
    context.lineTo(-14, -18);
    context.closePath();
    context.fill();
    context.restore();
    text(place.name, place.x, place.y - 56, 18, '#ffffff', 'center', true);
  }

  function drawMinimap(state, missions) {
    const size = 190;
    const x0 = VIEW.width - size - 16;
    const y0 = 16;
    const sx = size / WORLD.width;
    const sy = size / WORLD.height;
    context.fillStyle = PALETTE.hud;
    context.fillRect(x0 - 6, y0 - 6, size + 12, size + 12);
    context.fillStyle = '#0e2a1e';
    context.fillRect(x0, y0, size, size);
    context.fillStyle = '#232833';
    for (let x = 0; x <= WORLD.width; x += BLOCK) context.fillRect(x0 + x * sx, y0, 3, size);
    for (let y = 0; y <= WORLD.height; y += BLOCK) context.fillRect(x0, y0 + y * sy, size, 3);
    for (const key of Object.keys(PLACES)) {
      const place = PLACES[key];
      context.fillStyle = '#8b93a3';
      context.fillRect(x0 + place.x * sx - 2, y0 + place.y * sy - 2, 4, 4);
    }
    const target = missions ? missions.targetPlace() : null;
    if (target) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(x0 + target.x * sx, y0 + target.y * sy, 6, 0, Math.PI * 2);
      context.fill();
    }
    for (const cop of state.police) {
      if (!cop.active) continue;
      context.fillStyle = '#4d8dff';
      context.beginPath();
      context.arc(x0 + cop.x * sx, y0 + cop.y * sy, 4, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(x0 + p.x * sx, y0 + p.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x0 + p.x * sx, y0 + p.y * sy, 7, 0, Math.PI * 2);
    context.stroke();
    text('NEON BAY', x0 + size / 2, y0 + size + 22, 13, PALETTE.muted, 'center', true);
  }

  function drawHud(state, missions, best) {
    // Top-left: cash, health, wanted stars.
    context.fillStyle = PALETTE.hud;
    context.fillRect(12, 12, 300, 108);
    text(`$${state.cash}`, 26, 44, 30, '#ffd23f', 'left', true);
    text(`Health ${Math.max(0, Math.round(state.player.health))}`, 26, 74, 18, PALETTE.text, 'left');
    context.fillStyle = '#3a4152';
    context.fillRect(26, 84, 180, 12);
    context.fillStyle = state.player.health > 30 ? '#37d67a' : '#e5534b';
    context.fillRect(26, 84, 180 * Math.max(0, state.player.health) / 100, 12);
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, 26, 112, 24, PALETTE.star, 'left');
    if (state.wanted > 0) text('WANTED', 170, 112, 16, '#ff5a5a', 'left', true);

    // Mission objective bar, top centre.
    const objective = missions ? missions.objectiveText() : '';
    const mission = missions ? missions.current() : null;
    context.fillStyle = PALETTE.hud;
    const barW = 520;
    context.fillRect((VIEW.width - barW) / 2, 12, barW, 54);
    text(mission ? `${mission.title} — ${mission.id === 'first-wheels' ? 'Job 1/3' : mission.id === 'neon-run' ? 'Job 2/3' : 'Job 3/3'}` : 'Free Roam', VIEW.width / 2, 34, 17, '#00e5ff', 'center', true);
    text(objective, VIEW.width / 2, 58, 15, PALETTE.text, 'center');

    drawMinimap(state, missions);

    // Bottom-left: controls + clock. Bottom-right: speed when driving.
    text(clockLabel(state.timeOfDay), 26, VIEW.height - 66, 18, PALETTE.text, 'left', true);
    if (state.player.inCar) {
      const mph = Math.round(Math.abs(state.player.inCar.speed) * 0.12);
      text(`${mph} mph`, VIEW.width - 26, VIEW.height - 66, 22, '#00e5ff', 'right', true);
    }
    text(state.player.inCar ? 'WASD drive · Space brake · E exit · H horn' : 'WASD move · Shift sprint · E steal car · F punch · Click punch', 26, VIEW.height - 40, 15, PALETTE.muted, 'left');
    text(`Best $${best} · M mute · P pause · progress auto-saves`, 26, VIEW.height - 18, 13, PALETTE.muted, 'left');

    // Centre message.
    if (state.message) {
      context.fillStyle = 'rgba(8, 12, 24, 0.8)';
      const w = 640;
      context.fillRect((VIEW.width - w) / 2, VIEW.height - 130, w, 44);
      text(state.message, VIEW.width / 2, VIEW.height - 100, 18, '#ffffff', 'center', true);
    }
    // Busted flash.
    const busting = state.police.some((cop) => cop.active && cop.bustTimer > 0);
    if (busting) {
      text('BUSTED — hold still and it is over…', VIEW.width / 2, VIEW.height / 2 - 120, 30, '#ff5a5a', 'center', true);
    }
  }

  function drawPanel(title, lines, prompt) {
    const width = 680;
    const height = 150 + lines.length * 34;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(8, 12, 24, 0.92)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = '#00e5ff';
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 64, 46, '#00e5ff', 'center', true);
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, y + 112 + i * 34, 19, PALETTE.text, 'center');
    });
    text(prompt, VIEW.width / 2, y + height - 30, 20, '#ffd23f', 'center', true);
  }

  function drawWorld(state, missions) {
    const camera = state.camera;
    context.save();
    context.translate(VIEW.width / 2 - camera.x, VIEW.height / 2 - camera.y);
    drawRoads(camera);
    drawBuildings(state, camera);
    drawPickups(state);
    drawMissionMarker(state, missions);
    for (const ped of state.peds) drawPed(ped);
    for (const car of state.cars) {
      if (car === state.player.inCar) continue;
      drawCar(car, false, false);
    }
    for (const cop of state.police) {
      if (cop.active) drawCar(cop, false, true);
    }
    if (state.player.inCar) drawCar(state.player.inCar, true, false);
    drawPlayer(state);
    drawParticles(state);
    context.restore();
    // Day/night tint over the whole view.
    context.fillStyle = nightTint(state.timeOfDay);
    context.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function draw(state, screen, best, missions) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#05070d';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    drawWorld(state, missions);
    if (screen === SCREEN_TITLE) {
      drawPanel('NEON BAY', [
        'An open-world crime game. You are Rook, a driver new to the city.',
        'Steal cars, outrun the police, and finish Marla’s three jobs.',
        'WASD move / drive · E steal car · F punch · P pause',
        `Best haul so far: $${best}`,
      ], 'Press Enter or click to start');
      return;
    }
    drawHud(state, missions, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits. Your progress is saved.', 'M mute sound · P resume'], 'Press P or click to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel(state.busted ? 'BUSTED' : 'WASTED', [
        `The Neon Bay police took you in. Cash kept: $${state.cash}.`,
        `Missions finished: ${state.missionIndex} of 3 · Cars stolen: ${state.carsStolen}`,
      ], 'Press Enter or click to try again');
    } else if (screen === SCREEN_WIN) {
      drawPanel('NEON BAY IS YOURS', [
        `All three jobs done. Final haul: $${state.cash}.`,
        'Marla is already calling about the next city.',
      ], 'Press Enter to keep cruising');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
