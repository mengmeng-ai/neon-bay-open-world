// Keyboard + mouse input. Held keys give a steering direction; one-shot
// presses (start, pause, enter car, punch, horn, mute) are queued as bit
// flags and taken once by the loop, so a press between frames is never lost
// and never fires twice. Mouse position is in canvas CSS pixels.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_HORN = 16;
export const ACTION_MUTE = 32;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_ENTER_CAR,
  KeyF: ACTION_PUNCH,
  KeyH: ACTION_HORN,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  let mouseX = 0;
  let mouseY = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) {
      queued |= action;
      event.preventDefault();
    }
    if (event.code.startsWith('Arrow')) event.preventDefault();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onBlur() {
    keys.clear();
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    queued |= ACTION_PUNCH;
    if (event.button === 0) queued |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // WASD / arrows: x/y in -1..1, sprint while Shift is held.
  function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') };
  }

  function takeActions() {
    const out = queued;
    queued = 0;
    return out;
  }

  function mouse() {
    return { x: mouseX, y: mouseY };
  }

  return { direction, takeActions, mouse };
}
