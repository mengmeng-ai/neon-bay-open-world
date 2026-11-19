// Synthesised sound only: every effect is a WebAudio oscillator/noise burst,
// so the game ships no audio files and makes no network request.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
      gain.gain.setValueAtTime(volume || 0.2, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + dur);
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  }

  function noise(dur, volume, lowpass) {
    if (!ensure() || muted) return;
    try {
      const length = Math.floor(context.sampleRate * dur);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const gain = context.createGain();
      gain.gain.value = volume || 0.25;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Ignore audio failures.
    }
  }

  function punch() {
    noise(0.12, 0.4, 900);
    tone(140, 0.1, 'sine', 0.3, 60);
  }

  function coin() {
    tone(880, 0.09, 'sine', 0.25);
    setTimeout(() => tone(1320, 0.14, 'sine', 0.22), 70);
  }

  function crash() {
    noise(0.3, 0.5, 500);
    tone(90, 0.25, 'sawtooth', 0.3, 40);
  }

  function horn() {
    tone(370, 0.22, 'square', 0.16);
    tone(466, 0.22, 'square', 0.12);
  }

  function missionDone() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => tone(freq, 0.22, 'triangle', 0.28), i * 110);
    });
  }

  function busted() {
    [400, 300, 200].forEach((freq, i) => {
      setTimeout(() => tone(freq, 0.3, 'sawtooth', 0.25), i * 160);
    });
  }

  function engineStart() {
    tone(70, 0.4, 'sawtooth', 0.25, 160);
  }

  function doorSlam() {
    noise(0.09, 0.35, 700);
    tone(110, 0.08, 'sine', 0.25, 70);
  }

  // A quiet two-note police siren that wails while the player is wanted.
  function siren(dt, wanted) {
    if (!ensure() || muted || wanted === 0) return;
    sirenTimer -= dt;
    if (sirenTimer <= 0) {
      sirenTimer = 0.55;
      tone(720, 0.5, 'sine', 0.07, 980);
      setTimeout(() => tone(980, 0.5, 'sine', 0.06, 720), 260);
    }
  }

  // Engine hum follows the car's speed; call every frame while driving.
  function engine(speedRatio) {
    if (!ensure() || muted) return;
    try {
      if (!engineOsc) {
        engineOsc = context.createOscillator();
        engineGain = context.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0;
        engineOsc.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speedRatio * 140;
      engineGain.gain.value = 0.045 + speedRatio * 0.05;
    } catch {
      // Ignore.
    }
  }

  function engineStop() {
    if (engineGain) engineGain.gain.value = 0;
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.35;
    return muted;
  }

  function unlock() {
    ensure();
    if (context && context.state === 'suspended') context.resume();
  }

  return { unlock, punch, coin, crash, horn, missionDone, busted, engineStart, doorSlam, siren, engine, engineStop, toggleMute };
}
