// Cut the Rope Parody: Меллстрой & Чекушок (HTML5 Canvas + Matter.js)
// Universal iOS Safari (iPhone) + Android + Desktop compatible (Stacked-Alpha H.264 MP4 + Web Audio GainNode)
(() => {
  const { Engine, World, Bodies, Body, Constraint, Vector } = Matter;

  const CANVAS_W = 540;
  const CANVAS_H = 760;
  const VID_W = 240;
  const VID_H = 240;

  const DEFAULT_MANIFEST = {
    idle: [
      { id: "HQVL9004", state: "idle", mp4: "assets/videos/idle_HQVL9004.mp4", poster: "assets/videos/idle_HQVL9004_poster.png" },
      { id: "MYAF8159", state: "idle", mp4: "assets/videos/idle_MYAF8159.mp4", poster: "assets/videos/idle_MYAF8159_poster.png" }
    ],
    eat: [
      { id: "NUGU1851", state: "eat", mp4: "assets/videos/eat_NUGU1851.mp4", poster: "assets/videos/eat_NUGU1851_poster.png" }
    ],
    win: [
      { id: "AOMM8677", state: "win", mp4: "assets/videos/win_AOMM8677.mp4", poster: "assets/videos/win_AOMM8677_poster.png" },
      { id: "GUQU0896", state: "win", mp4: "assets/videos/win_GUQU0896.mp4", poster: "assets/videos/win_GUQU0896_poster.png" },
      { id: "NUGU1851", state: "eat", mp4: "assets/videos/eat_NUGU1851.mp4", poster: "assets/videos/eat_NUGU1851_poster.png" }
    ],
    lose: [
      { id: "AFEM3498", state: "lose", mp4: "assets/videos/lose_AFEM3498.mp4", poster: "assets/videos/lose_AFEM3498_poster.png" },
      { id: "CHBA0977", state: "lose", mp4: "assets/videos/lose_CHBA0977.mp4", poster: "assets/videos/lose_CHBA0977_poster.png" },
      { id: "JJRD7341", state: "lose", mp4: "assets/videos/lose_JJRD7341.mp4", poster: "assets/videos/lose_JJRD7341_poster.png" },
      { id: "JPCI2697", state: "lose", mp4: "assets/videos/lose_JPCI2697.mp4", poster: "assets/videos/lose_JPCI2697_poster.png" },
      { id: "LDLX9404", state: "lose", mp4: "assets/videos/lose_LDLX9404.mp4", poster: "assets/videos/lose_LDLX9404_poster.png" },
      { id: "RGDY6851", state: "lose", mp4: "assets/videos/lose_RGDY6851.mp4", poster: "assets/videos/lose_RGDY6851_poster.png" },
      { id: "XKZE9004", state: "lose", mp4: "assets/videos/lose_XKZE9004.mp4", poster: "assets/videos/lose_XKZE9004_poster.png" }
    ]
  };

  function segmentsIntersect(p1, p2, p3, p4) {
    const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  }

  function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  class CutTheChekushkaGame {
    constructor() {
      this.canvas = document.getElementById("game-canvas");
      this.ctx = this.canvas.getContext("2d");

      // Offscreen canvases for iOS/Universal Stacked-Alpha (240x480 -> 240x240 RGBA)
      this.alphaWorkCanvas = document.createElement("canvas");
      this.alphaWorkCanvas.width = VID_W;
      this.alphaWorkCanvas.height = VID_H * 2;
      this.alphaWorkCtx = this.alphaWorkCanvas.getContext("2d", { willReadFrequently: true });

      this.charFrameCanvas = document.createElement("canvas");
      this.charFrameCanvas.width = VID_W;
      this.charFrameCanvas.height = VID_H;
      this.charFrameCtx = this.charFrameCanvas.getContext("2d");
      this.hasValidCharFrame = false;

      // Single DOM-mounted <video> element for 100% iOS Safari autoplay & audio reliability
      this.charVideo = document.createElement("video");
      this.charVideo.setAttribute("playsinline", "");
      this.charVideo.setAttribute("webkit-playsinline", "");
      this.charVideo.playsInline = true;
      this.charVideo.preload = "auto";
      this.charVideo.crossOrigin = "anonymous";
      this.charVideo.style.position = "fixed";
      this.charVideo.style.width = "1px";
      this.charVideo.style.height = "1px";
      this.charVideo.style.opacity = "0.01";
      this.charVideo.style.pointerEvents = "none";
      this.charVideo.style.left = "-10px";
      this.charVideo.style.top = "-10px";
      document.body.appendChild(this.charVideo);

      this.charVideo.addEventListener("ended", () => {
        if (this.charState === "idle") {
          this.setCharacterState("idle", true);
        } else {
          window.soundFX.setBgmDucked(false);
        }
      });

      this.starsPerLevel = this.loadProgress();
      this.currentLevelIdx = 0;

      this.sprites = {};
      this.videoClips = { idle: [], eat: [], win: [], lose: [] };
      this.blobUrlCache = {};
      this.stateCounters = { idle: 0, eat: 0, win: 0, lose: 0 };
      this.activeClip = null;
      this.charState = "idle";
      this.userInteracted = false;

      this.engine = null;
      this.bottleBody = null;
      this.ropes = [];
      this.stars = [];
      this.cushions = [];
      this.bumpers = [];
      this.characterPos = { x: 270, y: 650 };

      this.levelStatus = "playing";
      this.collectedStars = 0;
      this.catchAnim = null;
      this.stallTimer = 0;
      this.modalTimer = null;

      this.isPointerDown = false;
      this.lastPointer = null;
      this.bladeTrail = [];
      this.particles = [];
      this.airRings = [];
      this.floatingTexts = [];
      this.time = 0;

      this.bindUI();
      this.bootstrap();
    }

    loadProgress() {
      try {
        const raw = localStorage.getItem("mell_chekushka_stars_v1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === window.GAME_LEVELS.length) {
            return parsed;
          }
        }
      } catch (_) {}
      return new Array(window.GAME_LEVELS.length).fill(0);
    }

    saveProgress() {
      try {
        localStorage.setItem("mell_chekushka_stars_v1", JSON.stringify(this.starsPerLevel));
      } catch (_) {}
    }

    async bootstrap() {
      await Promise.all([this.loadSprites(), this.loadVideoManifest()]);
      this.renderLevelSelectGrid();
      this.startLevel(0);
      document.getElementById("screen-levels").classList.add("hidden");

      this.lastFrameTime = performance.now();
      requestAnimationFrame((ts) => this.loop(ts));
    }

    async loadSprites() {
      const names = [
        "background",
        "bottle",
        "star",
        "star_empty",
        "cushion",
        "pin",
        "ui_restart",
        "ui_menu",
        "ui_sound"
      ];
      const promises = names.map(
        (name) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              this.sprites[name] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `assets/sprites/${name}.png?v=3`;
          })
      );
      await Promise.all(promises);
    }

    async preloadVideoBlob(mp4Url) {
      if (this.blobUrlCache[mp4Url]) return this.blobUrlCache[mp4Url];
      try {
        const res = await fetch(mp4Url);
        if (res.ok) {
          const blob = await res.blob();
          const bUrl = URL.createObjectURL(blob);
          this.blobUrlCache[mp4Url] = bUrl;
          return bUrl;
        }
      } catch (_) {}
      return mp4Url;
    }

    async loadVideoManifest() {
      let manifest = DEFAULT_MANIFEST;
      try {
        const res = await fetch("assets/videos/manifest.json?v=3");
        if (res.ok) {
          manifest = await res.json();
        }
      } catch (_) {}

      const states = ["idle", "eat", "win", "lose"];
      const allMp4Urls = new Set();

      for (const st of states) {
        const list = manifest[st] || DEFAULT_MANIFEST[st] || [];
        this.videoClips[st] = list.map((item) => {
          const mp4Url = item.mp4 || (item.src ? item.src.replace(".webm", ".mp4") : "");
          allMp4Urls.add(mp4Url);

          const posterImg = new Image();
          posterImg.src = item.poster;

          return {
            ...item,
            mp4Url,
            posterImg
          };
        });
      }

      // Preload idle clips first so initial level starts immediately, then preload remaining clips in background
      for (const clip of this.videoClips.idle) {
        await this.preloadVideoBlob(clip.mp4Url);
      }
      Promise.all(Array.from(allMp4Urls).map((u) => this.preloadVideoBlob(u))).catch(() => {});
    }

    setCharacterState(state, forceNew = false) {
      if (this.charState === state && !forceNew && this.activeClip) {
        return;
      }

      this.charState = state;
      let pool = this.videoClips[state] || [];
      if (state === "win" && this.videoClips.eat && this.videoClips.eat.length > 0) {
        pool = [...this.videoClips.eat, ...this.videoClips.win];
      }
      if (!pool.length) return;

      const idx = this.stateCounters[state] % pool.length;
      this.stateCounters[state] += 1;
      const clip = pool[idx];
      this.activeClip = clip;

      // Duck BGM during win/eat/lose reaction clips
      window.soundFX.setBgmDucked(state !== "idle");

      const vid = this.charVideo;
      const playSrc = this.blobUrlCache[clip.mp4Url] || clip.mp4Url;
      if (vid.src !== playSrc) {
        vid.src = playSrc;
      }
      vid.currentTime = 0;
      vid.loop = false;

      // Apply voice volume via Web Audio GainNode + element volume
      this.syncActiveVideoVolume();
      vid.muted = window.soundFX.muted || !this.userInteracted;

      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          vid.muted = true;
          vid.play().catch(() => {});
        });
      }
    }

    syncActiveVideoVolume() {
      const targetVol =
        this.charState === "idle"
          ? window.soundFX.idleVolume
          : window.soundFX.reactionVolume;
      window.soundFX.setVoiceVolume(targetVol);
    }

    unlockAudio() {
      const firstUnlock = !this.userInteracted;
      this.userInteracted = true;

      window.soundFX.init();
      window.soundFX.connectVideoElement(this.charVideo);
      this.syncActiveVideoVolume();

      if (!window.soundFX.muted) {
        this.charVideo.muted = false;
        if (this.charVideo.paused || firstUnlock) {
          this.charVideo.play().catch(() => {});
        }
      }
    }

    bindUI() {
      const getCanvasPoint = (clientX, clientY) => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: ((clientX - rect.left) / rect.width) * CANVAS_W,
          y: ((clientY - rect.top) / rect.height) * CANVAS_H
        };
      };

      const onDown = (clientX, clientY) => {
        this.unlockAudio();
        const pt = getCanvasPoint(clientX, clientY);

        for (const c of this.cushions) {
          const d = Math.hypot(pt.x - c.x, pt.y - c.y);
          if (d <= 54) {
            this.triggerCushion(c);
            return;
          }
        }

        this.isPointerDown = true;
        this.lastPointer = pt;
        this.bladeTrail.push({ x: pt.x, y: pt.y, age: 0 });
      };

      const onMove = (clientX, clientY) => {
        if (!this.isPointerDown) return;
        const pt = getCanvasPoint(clientX, clientY);
        if (this.lastPointer) {
          const dist = Math.hypot(pt.x - this.lastPointer.x, pt.y - this.lastPointer.y);
          if (dist >= 3) {
            this.checkRopeCuts(this.lastPointer, pt);
            this.bladeTrail.push({ x: pt.x, y: pt.y, age: 0 });
            if (Math.random() < 0.45) {
              this.particles.push({
                x: pt.x,
                y: pt.y,
                vx: (Math.random() - 0.5) * 2.2,
                vy: (Math.random() - 0.5) * 2.2,
                size: 2.5 + Math.random() * 2.5,
                color: "#fff8c4",
                alpha: 0.9,
                life: 0.25,
                maxLife: 0.25
              });
            }
            this.lastPointer = pt;
          }
        } else {
          this.lastPointer = pt;
        }
      };

      const onUp = () => {
        this.isPointerDown = false;
        this.lastPointer = null;
      };

      this.canvas.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
      window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
      window.addEventListener("mouseup", onUp);

      this.canvas.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          if (e.touches.length > 0) {
            onDown(e.touches[0].clientX, e.touches[0].clientY);
          }
        },
        { passive: false }
      );
      this.canvas.addEventListener(
        "touchmove",
        (e) => {
          e.preventDefault();
          if (e.touches.length > 0) {
            onMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        },
        { passive: false }
      );
      window.addEventListener("touchend", () => {
        this.unlockAudio();
        onUp();
      });

      // Global iOS/Mobile unlock on first tap/click anywhere
      ["touchstart", "touchend", "pointerdown", "click", "keydown"].forEach((evt) => {
        window.addEventListener(evt, () => this.unlockAudio(), { once: true, passive: true });
      });

      document.getElementById("hud-btn-restart").addEventListener("click", () => {
        this.unlockAudio();
        this.startLevel(this.currentLevelIdx);
      });

      const openLevels = () => {
        this.unlockAudio();
        this.renderLevelSelectGrid();
        document.getElementById("screen-result").classList.add("hidden");
        document.getElementById("screen-levels").classList.remove("hidden");
      };

      document.getElementById("hud-btn-menu").addEventListener("click", openLevels);
      document.getElementById("btn-open-levels").addEventListener("click", openLevels);

      const updateTrackLabel = (tr) => {
        const titleEl = document.getElementById("track-title");
        if (titleEl && tr) titleEl.textContent = tr.title;
      };
      window.soundFX.onTrackChange = updateTrackLabel;
      updateTrackLabel(window.soundFX.getCurrentTrack());

      const nextTrackBtn = document.getElementById("btn-next-track");
      if (nextTrackBtn) {
        nextTrackBtn.addEventListener("click", () => {
          this.unlockAudio();
          window.soundFX.nextTrack();
        });
      }

      // Volume Settings Modal & Sliders
      const settingsScreen = document.getElementById("screen-settings");
      const openSettingsBtn = document.getElementById("btn-open-settings");
      const closeSettingsBtn = document.getElementById("btn-settings-close");
      const settingsNextTrackBtn = document.getElementById("btn-settings-next-track");

      const sliderIdle = document.getElementById("vol-idle");
      const sliderReaction = document.getElementById("vol-reaction");
      const sliderBgm = document.getElementById("vol-bgm");
      const sliderSfx = document.getElementById("vol-sfx");

      const syncSlidersFromState = () => {
        const vIdle = Math.round(window.soundFX.idleVolume * 100);
        const vReac = Math.round(window.soundFX.reactionVolume * 100);
        const vBgm = Math.round(window.soundFX.bgmVolume * 100);
        const vSfx = Math.round(window.soundFX.sfxVolume * 100);
        if (sliderIdle) sliderIdle.value = vIdle;
        if (sliderReaction) sliderReaction.value = vReac;
        if (sliderBgm) sliderBgm.value = vBgm;
        if (sliderSfx) sliderSfx.value = vSfx;
        document.getElementById("val-vol-idle").textContent = `${vIdle}%`;
        document.getElementById("val-vol-reaction").textContent = `${vReac}%`;
        document.getElementById("val-vol-bgm").textContent = `${vBgm}%`;
        document.getElementById("val-vol-sfx").textContent = `${vSfx}%`;
      };
      syncSlidersFromState();

      const onSliderInput = () => {
        this.unlockAudio();
        const idle = Number(sliderIdle.value) / 100;
        const reaction = Number(sliderReaction.value) / 100;
        const bgm = Number(sliderBgm.value) / 100;
        const sfx = Number(sliderSfx.value) / 100;
        window.soundFX.setVolumes({ idle, reaction, bgm, sfx });
        this.syncActiveVideoVolume();
        syncSlidersFromState();
      };

      [sliderIdle, sliderReaction, sliderBgm, sliderSfx].forEach((el) => {
        if (el) el.addEventListener("input", onSliderInput);
      });

      if (openSettingsBtn && settingsScreen) {
        openSettingsBtn.addEventListener("click", () => {
          this.unlockAudio();
          syncSlidersFromState();
          settingsScreen.classList.remove("hidden");
        });
      }
      if (closeSettingsBtn && settingsScreen) {
        closeSettingsBtn.addEventListener("click", () => {
          settingsScreen.classList.add("hidden");
        });
      }
      if (settingsNextTrackBtn) {
        settingsNextTrackBtn.addEventListener("click", () => {
          this.unlockAudio();
          window.soundFX.nextTrack();
        });
      }

      document.getElementById("btn-mute").addEventListener("click", (e) => {
        const muted = window.soundFX.toggleMute();
        e.currentTarget.classList.toggle("muted", muted);
        this.charVideo.muted = muted;
        this.syncActiveVideoVolume();
      });

      document.getElementById("btn-result-levels").addEventListener("click", openLevels);
      document.getElementById("btn-result-restart").addEventListener("click", () => {
        this.unlockAudio();
        document.getElementById("screen-result").classList.add("hidden");
        this.startLevel(this.currentLevelIdx);
      });
      document.getElementById("btn-result-next").addEventListener("click", () => {
        this.unlockAudio();
        document.getElementById("screen-result").classList.add("hidden");
        const nextIdx = (this.currentLevelIdx + 1) % window.GAME_LEVELS.length;
        this.startLevel(nextIdx);
      });

      window.addEventListener("keydown", (e) => {
        if (e.key === "r" || e.key === "R" || e.key === "к" || e.key === "К") {
          this.startLevel(this.currentLevelIdx);
        }
      });
    }

    renderLevelSelectGrid() {
      const grid = document.getElementById("levels-grid");
      grid.innerHTML = "";
      let totalStars = 0;

      window.GAME_LEVELS.forEach((lvl, idx) => {
        const earned = this.starsPerLevel[idx] || 0;
        totalStars += earned;

        const tile = document.createElement("button");
        tile.className = "level-tile" + (idx === this.currentLevelIdx ? " current" : "");

        const starsHtml = [0, 1, 2]
          .map((s) => {
            const src = s < earned ? "assets/sprites/star.png" : "assets/sprites/star_empty.png";
            return `<img src="${src}" alt="*" />`;
          })
          .join("");

        tile.innerHTML = `
          <div class="level-num">${lvl.id}</div>
          <div class="level-name-mini">${lvl.name}</div>
          <div class="tile-stars">${starsHtml}</div>
        `;

        tile.addEventListener("click", () => {
          this.unlockAudio();
          document.getElementById("screen-levels").classList.add("hidden");
          this.startLevel(idx);
        });

        grid.appendChild(tile);
      });

      document.getElementById("total-stars-text").textContent = `${totalStars} / ${
        window.GAME_LEVELS.length * 3
      } звёзд собрано`;
    }

    startLevel(levelIdx) {
      if (this.modalTimer) {
        clearTimeout(this.modalTimer);
        this.modalTimer = null;
      }

      this.currentLevelIdx = levelIdx;
      const lvl = window.GAME_LEVELS[levelIdx];

      document.getElementById("screen-result").classList.add("hidden");
      document.getElementById("level-indicator").textContent = `УР. ${lvl.id}`;

      const hintEl = document.getElementById("hint-toast");
      hintEl.textContent = lvl.hint || "";
      hintEl.classList.remove("fade-out");
      clearTimeout(this.hintTimeout);
      this.hintTimeout = setTimeout(() => hintEl.classList.add("fade-out"), 4500);

      this.collectedStars = 0;
      this.updateHudStars();

      this.levelStatus = "playing";
      this.catchAnim = null;
      this.stallTimer = 0;
      this.particles = [];
      this.airRings = [];
      this.floatingTexts = [];
      this.bladeTrail = [];

      this.characterPos = { x: lvl.character.x, y: lvl.character.y };
      this.setCharacterState("idle", true);

      this.engine = Engine.create();
      this.engine.gravity.y = 1.05;
      this.engine.constraintIterations = 8;
      this.engine.positionIterations = 10;
      this.engine.velocityIterations = 8;

      this.bottleBody = Bodies.circle(lvl.bottle.x, lvl.bottle.y, 26, {
        density: 0.0032,
        frictionAir: 0.008,
        restitution: 0.45,
        collisionFilter: { category: 0x0002, mask: 0x0004 }
      });
      World.add(this.engine.world, this.bottleBody);

      this.ropes = lvl.ropes.map((rDef) => this.createRope(rDef, lvl.bottle));

      this.stars = lvl.stars.map((s, i) => ({
        x: s.x,
        y: s.y,
        collected: false,
        phase: i * 1.3,
        scale: 1
      }));

      this.cushions = (lvl.cushions || []).map((c) => ({
        x: c.x,
        y: c.y,
        angle: c.angle || 0,
        range: c.range || 290,
        power: c.power || 0.024,
        squeezeAnim: 0
      }));

      this.bumpers = (lvl.bumpers || []).map((b) => {
        const body = Bodies.circle(b.x, b.y, b.radius || 30, {
          isStatic: true,
          restitution: 0.85,
          collisionFilter: { category: 0x0004, mask: 0x0002 }
        });
        World.add(this.engine.world, body);
        return {
          x: b.x,
          y: b.y,
          radius: b.radius || 30,
          body,
          hitAnim: 0
        };
      });
    }

    createRope(rDef, bottleStart) {
      const segCount = rDef.segments || Math.max(6, Math.round(rDef.length / 18));
      const nodes = [];
      const constraints = [];

      const dx = (bottleStart.x - rDef.x) / segCount;
      const dy = (bottleStart.y - 34 - rDef.y) / segCount;
      const targetSegLen = Math.max(8, (rDef.length - 30) / segCount);

      for (let i = 1; i < segCount; i++) {
        const nx = rDef.x + dx * i;
        const ny = rDef.y + dy * i;
        const node = Bodies.circle(nx, ny, 4, {
          density: 0.0007,
          frictionAir: 0.012,
          collisionFilter: { group: -1, category: 0x0001, mask: 0x0000 }
        });
        nodes.push(node);
      }
      World.add(this.engine.world, nodes);

      let prevBody = null;
      for (let i = 0; i < nodes.length; i++) {
        const c = Constraint.create({
          pointA: prevBody ? undefined : { x: rDef.x, y: rDef.y },
          bodyA: prevBody || undefined,
          bodyB: nodes[i],
          length: targetSegLen,
          stiffness: 0.96,
          damping: 0.05
        });
        constraints.push(c);
        prevBody = nodes[i];
      }

      const lastConstraint = Constraint.create({
        pointA: prevBody ? undefined : { x: rDef.x, y: rDef.y },
        bodyA: prevBody || undefined,
        bodyB: this.bottleBody,
        pointB: { x: 0, y: -34 },
        length: targetSegLen,
        stiffness: 0.96,
        damping: 0.05
      });
      constraints.push(lastConstraint);
      World.add(this.engine.world, constraints);

      return {
        anchor: { x: rDef.x, y: rDef.y },
        nodes,
        constraints,
        isCut: false,
        fadeAlpha: 1.0
      };
    }

    getConstraintEndPoints(c) {
      const pA = c.bodyA
        ? Vector.add(c.bodyA.position, c.pointA || { x: 0, y: 0 })
        : c.pointA;
      const pB = c.bodyB
        ? Vector.add(c.bodyB.position, c.pointB || { x: 0, y: 0 })
        : c.pointB;
      return { pA, pB };
    }

    checkRopeCuts(p1, p2) {
      if (this.levelStatus !== "playing") return;

      for (const rope of this.ropes) {
        if (rope.isCut) continue;

        for (let i = 0; i < rope.constraints.length; i++) {
          const c = rope.constraints[i];
          const { pA, pB } = this.getConstraintEndPoints(c);
          const hit =
            segmentsIntersect(p1, p2, pA, pB) ||
            distToSegment(pA, p1, p2) < 9 ||
            distToSegment(pB, p1, p2) < 9;

          if (hit) {
            World.remove(this.engine.world, c);
            rope.constraints.splice(i, 1);
            rope.isCut = true;
            window.soundFX.playCut();

            const midX = (pA.x + pB.x) * 0.5;
            const midY = (pA.y + pB.y) * 0.5;
            this.spawnRopeCutParticles(midX, midY);
            break;
          }
        }
      }
    }

    triggerCushion(c) {
      if (this.levelStatus !== "playing" || !this.bottleBody) return;

      c.squeezeAnim = 1.0;
      window.soundFX.playPuff();

      const nozzleDist = 42;
      const nx = c.x + Math.cos(c.angle) * nozzleDist;
      const ny = c.y + Math.sin(c.angle) * nozzleDist;

      for (let i = 0; i < 3; i++) {
        this.airRings.push({
          x: nx + Math.cos(c.angle) * (i * 14),
          y: ny + Math.sin(c.angle) * (i * 14),
          vx: Math.cos(c.angle) * (7.5 + i * 1.4),
          vy: Math.sin(c.angle) * (7.5 + i * 1.4),
          angle: c.angle,
          radius: 10 + i * 5,
          alpha: 0.9,
          life: 0.42,
          maxLife: 0.42
        });
      }

      for (let i = 0; i < 16; i++) {
        const spread = (Math.random() - 0.5) * 0.55;
        const a = c.angle + spread;
        const spd = 5 + Math.random() * 7;
        this.particles.push({
          x: nx,
          y: ny,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          size: 3.5 + Math.random() * 4,
          color: "#d9f6ff",
          alpha: 0.85,
          life: 0.35 + Math.random() * 0.15,
          maxLife: 0.5
        });
      }

      const bx = this.bottleBody.position.x;
      const by = this.bottleBody.position.y;
      const dx = bx - c.x;
      const dy = by - c.y;
      const dist = Math.hypot(dx, dy);

      if (dist < c.range && dist > 5) {
        const dirToBottle = Math.atan2(dy, dx);
        let angleDiff = dirToBottle - c.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) < 0.78) {
          const falloff = Math.max(0.28, 1 - dist / (c.range * 1.15));
          const impulseSpeed = 8.4 * falloff;
          const curVel = this.bottleBody.velocity;
          Body.setVelocity(this.bottleBody, {
            x: curVel.x + Math.cos(c.angle) * impulseSpeed,
            y: curVel.y + Math.sin(c.angle) * impulseSpeed - 1.3 * falloff
          });
          Body.setAngularVelocity(
            this.bottleBody,
            this.bottleBody.angularVelocity + (Math.cos(c.angle) >= 0 ? 0.08 : -0.08) * falloff
          );
        }
      }
    }

    spawnRopeCutParticles(x, y) {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 4.5;
        this.particles.push({
          x,
          y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd - 1.0,
          size: 2.5 + Math.random() * 3,
          color: i % 2 === 0 ? "#e2b272" : "#9c6228",
          alpha: 1,
          life: 0.38,
          maxLife: 0.38
        });
      }
    }

    spawnStarBurst(x, y) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + Math.random() * 0.2;
        const spd = 2.2 + Math.random() * 5.8;
        this.particles.push({
          x,
          y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          size: 3.5 + Math.random() * 4.5,
          color: i % 3 === 0 ? "#ffffff" : "#ffd83b",
          alpha: 1,
          life: 0.55,
          maxLife: 0.55
        });
      }
      this.floatingTexts.push({
        x,
        y: y - 10,
        text: "+1 ★",
        color: "#ffe45e",
        life: 0.75,
        maxLife: 0.75
      });
    }

    updateHudStars() {
      const imgs = document.querySelectorAll("#hud-stars .hud-star");
      imgs.forEach((img, idx) => {
        if (idx < this.collectedStars) {
          img.src = "assets/sprites/star.png";
          img.classList.add("collected");
        } else {
          img.src = "assets/sprites/star_empty.png";
          img.classList.remove("collected");
        }
      });
    }

    onBottleCaught() {
      this.levelStatus = "catching";
      this.catchAnim = {
        startX: this.bottleBody.position.x,
        startY: this.bottleBody.position.y,
        startAngle: this.bottleBody.angle,
        progress: 0
      };

      if (this.collectedStars > (this.starsPerLevel[this.currentLevelIdx] || 0)) {
        this.starsPerLevel[this.currentLevelIdx] = this.collectedStars;
        this.saveProgress();
      }

      window.soundFX.playWinChime();
      this.setCharacterState("win", true);

      for (let i = 0; i < 36; i++) {
        const a = -Math.PI + Math.random() * Math.PI;
        const spd = 3 + Math.random() * 7;
        const colors = ["#ffd83b", "#58e84c", "#45d1ff", "#ff6188"];
        this.particles.push({
          x: this.characterPos.x,
          y: this.characterPos.y - 30,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd - 2,
          size: 4 + Math.random() * 4,
          color: colors[i % colors.length],
          alpha: 1,
          life: 0.9,
          maxLife: 0.9
        });
      }

      this.floatingTexts.push({
        x: this.characterPos.x,
        y: this.characterPos.y - 95,
        text: "КАЙФ! ЧЕКУШОК!",
        color: "#76ff5b",
        life: 1.2,
        maxLife: 1.2
      });

      this.modalTimer = setTimeout(() => {
        this.levelStatus = "won";
        this.showResultModal(true);
      }, 1750);
    }

    onBottleLost() {
      if (this.levelStatus !== "playing") return;
      this.levelStatus = "lost";

      window.soundFX.playLoseBuzzer();
      this.setCharacterState("lose", true);

      this.floatingTexts.push({
        x: this.characterPos.x,
        y: this.characterPos.y - 95,
        text: "ГДЕ ЧЕКУШКА?!",
        color: "#ff5c52",
        life: 1.2,
        maxLife: 1.2
      });

      this.modalTimer = setTimeout(() => {
        this.showResultModal(false);
      }, 1750);
    }

    showResultModal(isWin) {
      const screen = document.getElementById("screen-result");
      const badge = document.getElementById("result-badge");
      const title = document.getElementById("result-title");
      const subtitle = document.getElementById("result-subtitle");
      const nextBtn = document.getElementById("btn-result-next");

      if (isWin) {
        badge.textContent = "ПОБЕДА!";
        badge.classList.remove("lose");
        title.textContent = "Чекушок доставлен!";
        subtitle.textContent =
          this.collectedStars === 3
            ? "Идеально! Все 3 звезды в кармане!"
            : `Собрано звёзд: ${this.collectedStars} из 3`;
        nextBtn.classList.remove("hidden");
      } else {
        badge.textContent = "ПРОИГРЫШ!";
        badge.classList.add("lose");
        title.textContent = "Чекушок улетел мимо!";
        subtitle.textContent = "Меллстрой в ярости — попробуй ещё раз!";
        nextBtn.classList.add("hidden");
      }

      const resStars = document.querySelectorAll("#result-stars .res-star");
      resStars.forEach((img, i) => {
        const earned = isWin && i < this.collectedStars;
        img.src = earned ? "assets/sprites/star.png" : "assets/sprites/star_empty.png";
        img.classList.toggle("earned", earned);
      });

      screen.classList.remove("hidden");
    }

    update(dt) {
      this.time += dt;

      if (this.levelStatus === "playing" && this.engine) {
        Engine.update(this.engine, 1000 / 60);

        const bx = this.bottleBody.position.x;
        const by = this.bottleBody.position.y;

        for (const s of this.stars) {
          if (!s.collected) {
            const d = Math.hypot(bx - s.x, by - s.y);
            if (d < 46) {
              s.collected = true;
              this.collectedStars += 1;
              window.soundFX.playStar(this.collectedStars);
              this.updateHudStars();
              this.spawnStarBurst(s.x, s.y);
            }
          }
        }

        for (const b of this.bumpers) {
          const d = Math.hypot(bx - b.x, by - b.y);
          if (d < b.radius + 30 && b.hitAnim <= 0.05) {
            b.hitAnim = 1.0;
          }
          if (b.hitAnim > 0) b.hitAnim = Math.max(0, b.hitAnim - dt * 4);
        }

        const targetX = this.characterPos.x;
        const targetY = this.characterPos.y - 12;
        const distToChar = Math.hypot(bx - targetX, by - targetY);
        if (distToChar < 76) {
          this.onBottleCaught();
        } else if (by > CANVAS_H + 68 || bx < -75 || bx > CANVAS_W + 75 || by < -120) {
          this.onBottleLost();
        } else {
          const allCut = this.ropes.every((r) => r.isCut);
          const speed = Math.hypot(this.bottleBody.velocity.x, this.bottleBody.velocity.y);
          if (allCut && speed < 0.25) {
            this.stallTimer += dt;
            if (this.stallTimer > 1.8) {
              this.onBottleLost();
            }
          } else {
            this.stallTimer = 0;
          }
        }
      } else if (this.levelStatus === "catching" && this.catchAnim) {
        this.catchAnim.progress = Math.min(1, this.catchAnim.progress + dt * 3.2);
      }

      for (const r of this.ropes) {
        if (r.isCut && r.fadeAlpha > 0) {
          r.fadeAlpha = Math.max(0, r.fadeAlpha - dt * 1.7);
          if (r.fadeAlpha === 0 && this.engine) {
            World.remove(this.engine.world, r.constraints);
            World.remove(this.engine.world, r.nodes);
            r.constraints = [];
            r.nodes = [];
          }
        }
      }

      for (const c of this.cushions) {
        if (c.squeezeAnim > 0) {
          c.squeezeAnim = Math.max(0, c.squeezeAnim - dt * 4.2);
        }
      }

      for (let i = this.bladeTrail.length - 1; i >= 0; i--) {
        this.bladeTrail[i].age += dt;
        if (this.bladeTrail[i].age > 0.18) {
          this.bladeTrail.splice(i, 1);
        }
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }

      for (let i = this.airRings.length - 1; i >= 0; i--) {
        const ring = this.airRings[i];
        ring.x += ring.vx;
        ring.y += ring.vy;
        ring.vx *= 0.95;
        ring.vy *= 0.95;
        ring.radius += dt * 42;
        ring.life -= dt;
        if (ring.life <= 0) {
          this.airRings.splice(i, 1);
        }
      }

      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y -= dt * 36;
        ft.life -= dt;
        if (ft.life <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      if (this.sprites.background) {
        ctx.drawImage(this.sprites.background, 0, 0, CANVAS_W, CANVAS_H);
      } else {
        ctx.fillStyle = "#c98e4e";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      this.drawCharacter(ctx);
      this.drawCushions(ctx);
      this.drawBumpers(ctx);
      this.drawStars(ctx);
      this.drawRopes(ctx);
      this.drawBottle(ctx);
      this.drawEffects(ctx);
      this.drawBladeTrail(ctx);
    }

    drawCharacter(ctx) {
      const cx = this.characterPos.x;
      const cy = this.characterPos.y;
      const drawW = 240;
      const drawH = 240;

      ctx.save();
      ctx.fillStyle = "rgba(38, 18, 5, 0.32)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 78, 92, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      if (this.levelStatus === "playing" && this.bottleBody) {
        const d = Math.hypot(
          this.bottleBody.position.x - cx,
          this.bottleBody.position.y - (cy - 12)
        );
        const proximity = Math.max(0, 1 - d / 230);
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);

        ctx.strokeStyle = `rgba(255, 225, 80, ${0.22 + proximity * 0.55})`;
        ctx.lineWidth = 3 + proximity * 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy - 12, 62 + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Decode Top-Bottom Stacked RGB+Alpha MP4 video frame -> 100% transparent RGBA on iPhone & PC
      let drawn = false;
      const vid = this.charVideo;
      if (vid && vid.readyState >= 2 && vid.videoWidth > 0) {
        try {
          this.alphaWorkCtx.drawImage(vid, 0, 0, VID_W, VID_H * 2);
          const imgData = this.alphaWorkCtx.getImageData(0, 0, VID_W, VID_H * 2);
          const data = imgData.data;
          const topBytes = VID_W * VID_H * 4;
          for (let i = 0; i < topBytes; i += 4) {
            data[i + 3] = data[i + topBytes + 1];
          }
          this.charFrameCtx.putImageData(imgData, 0, 0, 0, 0, VID_W, VID_H);
          this.hasValidCharFrame = true;
        } catch (_) {}
      }

      if (
        this.activeClip &&
        this.activeClip.posterImg &&
        this.activeClip.posterImg.complete &&
        this.activeClip.posterImg.naturalWidth > 0 &&
        (!vid || vid.readyState < 2)
      ) {
        ctx.drawImage(
          this.activeClip.posterImg,
          cx - drawW / 2,
          cy - drawH / 2 - 22,
          drawW,
          drawH
        );
        drawn = true;
      } else if (this.hasValidCharFrame) {
        ctx.drawImage(
          this.charFrameCanvas,
          cx - drawW / 2,
          cy - drawH / 2 - 22,
          drawW,
          drawH
        );
        drawn = true;
      }

      if (!drawn) {
        ctx.fillStyle = "#3a1e0a";
        ctx.beginPath();
        ctx.arc(cx, cy, 55, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    drawCushions(ctx) {
      const sprite = this.sprites.cushion;
      for (const c of this.cushions) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);

        const dashOffset = -(this.time * 48) % 24;
        ctx.strokeStyle = "rgba(215, 248, 255, 0.36)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([7, 9]);
        ctx.lineDashOffset = dashOffset;
        for (const offsetY of [-14, 0, 14]) {
          ctx.beginPath();
          ctx.moveTo(46, offsetY * 0.5);
          ctx.lineTo(Math.min(165, c.range * 0.55), offsetY * 1.45);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        const sq = Math.sin(c.squeezeAnim * Math.PI);
        const scaleX = 1 + sq * 0.22;
        const scaleY = 1 - sq * 0.22;
        ctx.scale(scaleX, scaleY);

        const sz = 96;
        if (sprite) {
          ctx.drawImage(sprite, -sz / 2, -sz / 2, sz, sz);
        } else {
          ctx.fillStyle = "#5bc8ff";
          ctx.beginPath();
          ctx.arc(0, 0, 34, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    drawBumpers(ctx) {
      for (const b of this.bumpers) {
        ctx.save();
        const scale = 1 + Math.sin(b.hitAnim * Math.PI) * 0.2;
        ctx.translate(b.x, b.y);
        ctx.scale(scale, scale);

        const r = b.radius;
        ctx.fillStyle = "#261306";
        ctx.beginPath();
        ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
        ctx.fill();

        const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 4, 0, 0, r);
        grad.addColorStop(0, "#ffe46b");
        grad.addColorStop(0.7, "#e28f16");
        grad.addColorStop(1, "#9e5708");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#fff4c2";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawStars(ctx) {
      const sprite = this.sprites.star;
      for (const s of this.stars) {
        if (s.collected) continue;

        const bobY = Math.sin(this.time * 3.4 + s.phase) * 5;
        const rot = Math.sin(this.time * 2.2 + s.phase) * 0.12;
        const pulse = 1 + Math.sin(this.time * 4.5 + s.phase) * 0.05;

        ctx.save();
        ctx.translate(s.x, s.y + bobY);

        const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 38);
        glow.addColorStop(0, "rgba(255, 230, 85, 0.55)");
        glow.addColorStop(1, "rgba(255, 200, 30, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 38, 0, Math.PI * 2);
        ctx.fill();

        ctx.rotate(rot);
        ctx.scale(pulse, pulse);

        const sz = 58;
        if (sprite) {
          ctx.drawImage(sprite, -sz / 2, -sz / 2, sz, sz);
        } else {
          ctx.fillStyle = "#ffd633";
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    drawRopes(ctx) {
      const pinSprite = this.sprites.pin;

      for (const rope of this.ropes) {
        if (rope.fadeAlpha > 0 && rope.constraints.length > 0) {
          ctx.save();
          ctx.globalAlpha = rope.fadeAlpha;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          ctx.strokeStyle = "#2b1506";
          ctx.lineWidth = 10;
          ctx.beginPath();
          for (const c of rope.constraints) {
            const { pA, pB } = this.getConstraintEndPoints(c);
            ctx.moveTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);
          }
          ctx.stroke();

          ctx.strokeStyle = "#d99f59";
          ctx.lineWidth = 6;
          ctx.stroke();

          ctx.strokeStyle = "#a36829";
          ctx.lineWidth = 4;
          ctx.setLineDash([5, 6]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.restore();
        }

        ctx.save();
        const pinSz = 44;
        if (pinSprite) {
          ctx.drawImage(
            pinSprite,
            rope.anchor.x - pinSz / 2,
            rope.anchor.y - pinSz / 2,
            pinSz,
            pinSz
          );
        } else {
          ctx.fillStyle = "#d93829";
          ctx.beginPath();
          ctx.arc(rope.anchor.x, rope.anchor.y, 14, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    drawBottle(ctx) {
      if (!this.bottleBody) return;
      const sprite = this.sprites.bottle;

      let bx = this.bottleBody.position.x;
      let by = this.bottleBody.position.y;
      let angle = this.bottleBody.angle;
      let scale = 1.0;

      if (this.levelStatus === "catching" && this.catchAnim) {
        const t = this.catchAnim.progress;
        const ease = 1 - Math.pow(1 - t, 3);
        bx = this.catchAnim.startX + (this.characterPos.x - this.catchAnim.startX) * ease;
        by =
          this.catchAnim.startY +
          (this.characterPos.y - 18 - this.catchAnim.startY) * ease;
        angle = this.catchAnim.startAngle * (1 - ease);
        scale = Math.max(0, 1 - ease * 0.92);
      } else if (this.levelStatus === "won") {
        return;
      }

      if (scale <= 0.02) return;

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(angle);
      ctx.scale(scale, scale);

      const sz = 104;
      if (sprite) {
        ctx.drawImage(sprite, -sz / 2, -sz / 2, sz, sz);
      } else {
        ctx.fillStyle = "#7ce8ff";
        ctx.fillRect(-18, -26, 36, 52);
      }
      ctx.restore();
    }

    drawEffects(ctx) {
      for (const ring of this.airRings) {
        const alpha = Math.max(0, (ring.life / ring.maxLife) * ring.alpha);
        ctx.save();
        ctx.translate(ring.x, ring.y);
        ctx.rotate(ring.angle);
        ctx.strokeStyle = `rgba(225, 250, 255, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, ring.radius * 0.45, ring.radius, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      for (const p of this.particles) {
        const alpha = Math.max(0, (p.life / p.maxLife) * p.alpha);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const ft of this.floatingTexts) {
        const alpha = Math.max(0, ft.life / ft.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = "900 22px 'Trebuchet MS', sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#261306";
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }

    drawBladeTrail(ctx) {
      if (this.bladeTrail.length < 2) return;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let i = 1; i < this.bladeTrail.length; i++) {
        const p0 = this.bladeTrail[i - 1];
        const p1 = this.bladeTrail[i];
        const ratio = Math.max(0, 1 - p1.age / 0.18);
        if (ratio <= 0) continue;

        ctx.strokeStyle = `rgba(120, 235, 255, ${ratio * 0.55})`;
        ctx.lineWidth = 14 * ratio;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 255, 255, ${ratio * 0.95})`;
        ctx.lineWidth = 5.5 * ratio;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    loop(timestamp) {
      const dt = Math.min(0.05, (timestamp - this.lastFrameTime) / 1000);
      this.lastFrameTime = timestamp;

      this.update(dt);
      this.draw();

      requestAnimationFrame((ts) => this.loop(ts));
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    window.game = new CutTheChekushkaGame();
  });
})();
