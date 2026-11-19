// The story of Neon Bay: three jobs from fixer Marla Vane, each with a
// target to reach and a delivery to make. Missions live outside the world
// simulation so the world stays pure physics and traffic. Every payout is
// in dollars; the three jobs pay $250 + $600 + $1,500 = $2,350 in all.

import { MISSIONS, PLACES } from './config.js';

export const MISSION_EVENT_COMPLETE = 1;
export const MISSION_EVENT_STAGE = 2;

function placeOf(mission, stage) {
  const key = stage === 'to-target' ? mission.target : mission.deliver;
  return PLACES[key];
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createMissions(world) {
  const state = world.state;

  function current() {
    if (state.missionIndex >= MISSIONS.length) return null;
    return MISSIONS[state.missionIndex];
  }

  function targetPlace() {
    const mission = current();
    if (!mission) return null;
    return placeOf(mission, state.missionStage);
  }

  function objectiveText() {
    const mission = current();
    if (!mission) return 'Free roam — Neon Bay is yours. Grab cash, steal cars, stay out of jail.';
    if (state.missionStage === 'to-target') {
      if (state.missionIndex === 0) return `Steal the teal coupe at ${PLACES[mission.target].name}`;
      if (state.missionIndex === 1) return `Pick up the sealed case at ${PLACES[mission.target].name}`;
      return `Reach ${PLACES[mission.target].name} and lift the vault case`;
    }
    return `Deliver to ${PLACES[mission.deliver].name}`;
  }

  // Call every frame: returns MISSION_EVENT_* flags when a stage completes.
  function update() {
    const mission = current();
    if (!mission) return 0;
    const place = targetPlace();
    if (!place) return 0;
    if (dist(state.player, place) > 90) return 0;

    if (state.missionStage === 'to-target') {
      if (state.missionIndex === 0) {
        // The coupe has to be stolen, not walked to: only the teal car counts.
        const car = state.player.inCar;
        if (!car || car.color !== '#00e5ff') return 0;
      }
      state.missionStage = 'to-deliver';
      world.showMessage(`Got it. Now take it to ${PLACES[mission.deliver].name}.`, 3.5);
      world.burst(state.player.x, state.player.y, '#00e5ff', 16, 180);
      return MISSION_EVENT_STAGE;
    }

    // Delivery reached: pay out, advance the story.
    state.cash += mission.reward;
    state.player.cash += mission.reward;
    world.showMessage(`Mission complete: ${mission.title} — +$${mission.reward}`, 4);
    world.burst(state.player.x, state.player.y, '#ffd23f', 24, 220);
    state.missionIndex += 1;
    state.missionStage = 'to-target';
    if (state.missionIndex < MISSIONS.length) {
      const next = MISSIONS[state.missionIndex];
      world.addWanted(next.wantedOnStart);
      setTimeout(() => {
        world.showMessage(`Marla: "${next.brief}"`, 5);
      }, 100);
    } else {
      state.missionDone = true;
      world.showMessage('All jobs done. Neon Bay is yours, Rook.', 5);
    }
    return MISSION_EVENT_COMPLETE;
  }

  function startMission(index) {
    state.missionIndex = index;
    state.missionStage = 'to-target';
    state.missionDone = false;
    const mission = MISSIONS[index];
    if (mission) world.addWanted(mission.wantedOnStart);
  }

  return { current, targetPlace, objectiveText, update, startMission };
}
