// Web Audio API Sound Effects + iOS-Compatible Web Audio Background Music Radio & Voice Gain
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.unlocked = false;

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

    // Web Audio API nodes for BGM (works 100% on iPhone where HTMLAudioElement.volume is read-only)
    this.bgmGainNode = null;
    this.bgmSourceNode = null;
    this.bgmBuffers = {};
    this.bgmLoadingToken = 0;
    this.bgmIsPlaying = false;

    // Web Audio API GainNode for Character Video Voice on iOS/Desktop
    this.voiceGainNode = null;
    this.connectedVideoEl = null;
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
    if (this.muted) return 0;
    const base = Math.max(0, Math.min(1, this.bgmVolume));
    return this.isDucked ? base * 0.25 : base;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.bgmGainNode = this.ctx.createGain();
        this.bgmGainNode.gain.value = this.getEffectiveBgmVolume();
        this.bgmGainNode.connect(this.ctx.destination);
      }
    }
    return this.ctx;
  }

  init() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // Play 1-sample silent buffer on first user gesture to permanently unlock iOS Safari Web Audio
    if (!this.unlocked) {
      try {
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        this.unlocked = true;
      } catch (_) {}
    }

    if (!this.bgmIsPlaying && !this.muted) {
      this.playTrackAtIndex(this.currentTrackIdx);
    }
  }

  connectVideoElement(videoEl) {
    const ctx = this.ensureContext();
    if (!ctx || this.connectedVideoEl === videoEl) return;
    try {
      const mediaSrc = ctx.createMediaElementSource(videoEl);
      this.voiceGainNode = ctx.createGain();
      this.voiceGainNode.gain.value = this.muted ? 0 : this.idleVolume;
      mediaSrc.connect(this.voiceGainNode);
      this.voiceGainNode.connect(ctx.destination);
      this.connectedVideoEl = videoEl;
    } catch (_) {
      // Fallback if createMediaElementSource is not allowed
    }
  }

  setVoiceVolume(vol) {
    const v = this.muted ? 0 : Math.max(0, Math.min(1.5, vol));
    if (this.voiceGainNode && this.ctx) {
      this.voiceGainNode.gain.setValueAtTime(v, this.ctx.currentTime);
    }
    if (this.connectedVideoEl) {
      this.connectedVideoEl.volume = Math.max(0, Math.min(1, v));
    }
  }

  updateBgmGain() {
    if (this.bgmGainNode && this.ctx) {
      this.bgmGainNode.gain.setValueAtTime(
        this.getEffectiveBgmVolume(),
        this.ctx.currentTime
      );
    }
  }

  setVolumes({ bgm, idle, reaction, sfx }) {
    if (typeof bgm === "number") this.bgmVolume = Math.max(0, Math.min(1, bgm));
    if (typeof idle === "number") this.idleVolume = Math.max(0, Math.min(1, idle));
    if (typeof reaction === "number") this.reactionVolume = Math.max(0, Math.min(1, reaction));
    if (typeof sfx === "number") this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.updateBgmGain();
    this.saveVolumes();
  }

  setBgmDucked(ducked) {
    this.isDucked = ducked;
    this.updateBgmGain();
  }

  async playTrackAtIndex(idx) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.currentTrackIdx = ((idx % this.tracks.length) + this.tracks.length) % this.tracks.length;
    const tr = this.tracks[this.currentTrackIdx];
    if (typeof this.onTrackChange === "function") {
      this.onTrackChange(tr);
    }

    // Stop previous track source
    if (this.bgmSourceNode) {
      try {
        this.bgmSourceNode.onended = null;
        this.bgmSourceNode.stop();
        this.bgmSourceNode.disconnect();
      } catch (_) {}
      this.bgmSourceNode = null;
    }

    this.bgmIsPlaying = true;
    const token = ++this.bgmLoadingToken;

    try {
      let audioBuf = this.bgmBuffers[tr.src];
      if (!audioBuf) {
        const res = await fetch(tr.src);
        const arr = await res.arrayBuffer();
        audioBuf = await new Promise((resolve, reject) => {
          ctx.decodeAudioData(arr, resolve, reject);
        });
        this.bgmBuffers[tr.src] = audioBuf;
      }

      if (token !== this.bgmLoadingToken) return;

      const srcNode = ctx.createBufferSource();
      srcNode.buffer = audioBuf;
      srcNode.loop = false;
      srcNode.connect(this.bgmGainNode);
      this.updateBgmGain();

      srcNode.onended = () => {
        if (token === this.bgmLoadingToken && this.bgmIsPlaying) {
          this.nextTrack();
        }
      };

      this.bgmSourceNode = srcNode;
      srcNode.start(0);
    } catch (_) {
      this.bgmIsPlaying = false;
    }
  }

  nextTrack() {
    const nextIdx = (this.currentTrackIdx + 1) % this.tracks.length;
    this.playTrackAtIndex(nextIdx);
    return this.tracks[nextIdx];
  }

  getCurrentTrack() {
    return this.tracks[this.currentTrackIdx];
  }

  toggleMute() {
    this.muted = !this.muted;
    this.updateBgmGain();
    if (!this.muted && !this.bgmIsPlaying) {
      this.playTrackAtIndex(this.currentTrackIdx);
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
