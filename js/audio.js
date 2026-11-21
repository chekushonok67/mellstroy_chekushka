// Procedural Web Audio API sound effects + Mellstroy Background Music Radio with Volume Controls
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;

    // Load saved volume settings or defaults (Idle Mellstroy loud by default, BGM balanced)
    const saved = this.loadVolumes();
    this.bgmVolume = saved.bgm ?? 0.22;
    this.idleVolume = saved.idle ?? 0.95;
    this.reactionVolume = saved.reaction ?? 1.0;
    this.sfxVolume = saved.sfx ?? 0.8;

    this.tracks = [
      { title: "Бурмалдафон", src: "assets/audio/bgm_burmaldafon.mp3" },
      { title: "Бэм-Бэм-Бэм", src: "assets/audio/bgm_bembembem.mp3" },
      { title: "Весёлая (Меллстрой)", src: "assets/audio/bgm_veselaya.mp3" },
      { title: "Гонки Меллстроя", src: "assets/audio/bgm_hillclimb.mp3" },
      { title: "Тамада (Mellstroy)", src: "assets/audio/bgm_tamada.mp3" }
    ];
    this.currentTrackIdx = 0;
    this.isDucked = false;
    this.onTrackChange = null;

    this.bgm = new Audio();
    this.bgm.preload = "auto";
    // Auto-advance to the next track when current track ends!
    this.bgm.loop = false;
    this.bgm.volume = this.getEffectiveBgmVolume();
    this.bgm.src = this.tracks[0].src;

    this.bgm.addEventListener("ended", () => {
      this.nextTrack();
    });
  }

  loadVolumes() {
    try {
      const raw = localStorage.getItem("mell_chekushka_volumes_v2");
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {};
  }

  saveVolumes() {
    try {
      localStorage.setItem(
        "mell_chekushka_volumes_v2",
        JSON.stringify({
          bgm: this.bgmVolume,
          idle: this.idleVolume,
          reaction: this.reactionVolume,
          sfx: this.sfxVolume
        })
      );
    } catch (_) {}
  }

  getEffectiveBgmVolume() {
    const base = Math.max(0, Math.min(1, this.bgmVolume));
    return this.isDucked ? base * 0.28 : base;
  }

  setVolumes({ bgm, idle, reaction, sfx }) {
    if (typeof bgm === "number") this.bgmVolume = Math.max(0, Math.min(1, bgm));
    if (typeof idle === "number") this.idleVolume = Math.max(0, Math.min(1, idle));
    if (typeof reaction === "number") this.reactionVolume = Math.max(0, Math.min(1, reaction));
    if (typeof sfx === "number") this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.bgm.volume = this.getEffectiveBgmVolume();
    this.saveVolumes();
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    this.startBgm();
  }

  startBgm() {
    if (this.muted) return;
    this.bgm.volume = this.getEffectiveBgmVolume();
    if (this.bgm.paused) {
      this.bgm.play().catch(() => {});
    }
  }

  setBgmDucked(ducked) {
    this.isDucked = ducked;
    this.bgm.volume = this.getEffectiveBgmVolume();
  }

  nextTrack() {
    this.currentTrackIdx = (this.currentTrackIdx + 1) % this.tracks.length;
    const tr = this.tracks[this.currentTrackIdx];
    this.bgm.src = tr.src;
    this.bgm.currentTime = 0;
    this.bgm.volume = this.getEffectiveBgmVolume();
    if (!this.muted) {
      this.bgm.play().catch(() => {});
    }
    if (typeof this.onTrackChange === "function") {
      this.onTrackChange(tr);
    }
    return tr;
  }

  getCurrentTrack() {
    return this.tracks[this.currentTrackIdx];
  }

  toggleMute() {
    this.muted = !this.muted;
    this.bgm.muted = this.muted;
    if (!this.muted) {
      this.startBgm();
    }
    return this.muted;
  }

  playCut() {
    if (this.muted || this.sfxVolume <= 0.01) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.11);

    gain.gain.setValueAtTime(0.28 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playStar(starCount = 1) {
    if (this.muted || this.sfxVolume <= 0.01) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const baseFreqs = [587.33, 739.99, 880.0];
    const f1 = baseFreqs[Math.min(2, Math.max(0, starCount - 1))];
    const f2 = f1 * 1.5;

    [f1, f2].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      const t0 = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.04, t0 + 0.24);

      gain.gain.setValueAtTime(0.26 * this.sfxVolume, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.26);
    });
  }

  playPuff() {
    if (this.muted || this.sfxVolume <= 0.01) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.38));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(850, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.22);
    filter.Q.value = 1.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.48 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  playWinChime() {
    if (this.muted || this.sfxVolume <= 0.01) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      const t = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.24 * this.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  playLoseBuzzer() {
    if (this.muted || this.sfxVolume <= 0.01) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [280, 210];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      const t = now + idx * 0.14;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.linearRampToValueAtTime(freq * 0.85, t + 0.18);
      gain.gain.setValueAtTime(0.18 * this.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }
}

window.soundFX = new SoundManager();
