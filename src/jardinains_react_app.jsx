import React, { useRef, useEffect, useState } from "react";
import { useSound } from "./hooks/useSound";
import { Settings, Play, Pause, RotateCcw, Volume2, VolumeX, HelpCircle, X, Trophy, Heart, Activity } from "lucide-react";

// BrickBloom - Single-file React component
// Default export a React component (App) ready to drop into a React project.
// Uses Tailwind classes for UI. Stores high score + settings in localStorage (no backend).

const STORAGE_KEY = "jardinains:v1";

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { highScore: 0, settings: { sound: true } };
  } catch (e) {
    return { highScore: 0, settings: { sound: true } };
  }
}

function saveStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { }
}

export default function App() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  /* Game States */
  const GAME_STATE = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    TRANSITION: 'TRANSITION',
    GAMEOVER: 'GAMEOVER'
  };

  const [gameState, setGameState] = useState(GAME_STATE.MENU);
  const [levelMsg, setLevelMsg] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);


  const [storage, setStorage] = useState(loadStorage());
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const isPaused = gameState === GAME_STATE.PAUSED;

  const sounds = useSound(storage.settings.sound);
  const soundsRef = useRef(sounds);
  useEffect(() => { soundsRef.current = sounds; });

  // Game state refs for performance
  const stateRef = useRef({});

  // Ref to hold stable state values for the render loop and logic
  const gameDataRef = useRef({ score, lives, storage });
  useEffect(() => {
    gameDataRef.current = { score, lives, storage };
  }, [score, lives, storage]);

  // Init or reset the playfield
  function resetField(nextLevel = 1, preserveScore = false) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    // paddle
    const paddle = {
      w: Math.max(80, Math.min(220, 120)),
      h: 14,
      x: W / 2 - 60,
      y: H - 40,
      speed: 0.6,
      sticky: false,
    };

    // balls
    const balls = [
      {
        x: W / 2,
        y: H - 60,
        r: 7,
        vx: 3 + nextLevel * 0.2,
        vy: -4 - nextLevel * 0.15,
        sticky: true,
      },
    ];

    // bricks layout: rows x cols
    const rows = 4 + Math.min(6, nextLevel); // ramp up rows by level

    // Responsive brick layout
    // Use fewer columns on very narrow screens (< 400px)
    const cols = W < 400 ? 5 : 8;

    // Dynamic padding: smaller on mobile
    const paddingX = W < 600 ? 10 : 40;
    const spacing = 6;

    // Calculate brick width to fill available space
    const totalSpacing = (cols - 1) * spacing;
    const availableWidth = W - (paddingX * 2);
    const brickW = Math.floor((availableWidth - totalSpacing) / cols);

    const bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // create some variety
        const hp = 1 + Math.floor((r + c + nextLevel) / 8);
        bricks.push({
          x: paddingX + c * (brickW + spacing),
          y: (W < 600 ? 50 : 60) + r * 28, // Shift up slightly on mobile
          w: brickW,
          h: 22,
          hp,
          maxHp: hp,
          hasGnome: Math.random() < 0.12, // some bricks have gnomes
        });
      }
    }

    stateRef.current = {
      W,
      H,
      paddle,
      balls,
      bricks,
      lastTime: performance.now(),
      accum: 0,
      level: nextLevel,
      tick: 0,
      powerups: [],
      fireMode: false,
      fireTimer: 0,
      slowMode: false,
      slowTimer: 0,
      particles: [],
      shake: 0,
    };

    if (!preserveScore) {
      setScore(0);
      setLives(3);
    }
    setLevel(nextLevel);
  }

  // Start game
  // Start game from Menu or Restart
  function startGame(nextLevel = 1) {
    resetField(nextLevel);
    setGameState(GAME_STATE.PLAYING);
    setIsRunning(true); // for hook compat
  }

  function endGame() {
    setGameState(GAME_STATE.GAMEOVER);
    setIsRunning(false); // stop loop
    // update highscore
    const { score: currentScore, storage: currentStorage } = gameDataRef.current;
    if (currentScore > currentStorage.highScore) {
      const newStorage = { ...currentStorage, highScore: currentScore };
      setStorage(newStorage);
      saveStorage(newStorage);
    }
  }

  function setPaused(paused) {
    if (paused) setGameState(GAME_STATE.PAUSED);
    else setGameState(GAME_STATE.PLAYING);
  }

  // Level Clear Transition
  function nextLevelTransition() {
    setGameState(GAME_STATE.TRANSITION);
    setLevelMsg(`Level ${level + 1}`);
    soundsRef.current.playLevelComplete();
    setTimeout(() => {
      const nl = level + 1;
      resetField(nl, true); // Preserve score during level transition
      setLevel(nl);
      setLives((l) => Math.min(9, l + 1));
      setScore((sc) => sc + nl * 50);
      setGameState(GAME_STATE.PLAYING);
    }, 2000);
  }

  // Resize canvas to container
  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      const ratio = window.devicePixelRatio || 1;
      const width = Math.floor(parent.clientWidth - (window.innerWidth < 640 ? 0 : 32));
      // Calculate available height: Window height - HUD height (approx) - padding
      // On mobile HUD is top bar (approx 60px), on desktop it's sidebar (full height)
      const hudHeight = window.innerWidth < 768 ? 64 : 40;
      const availableHeight = window.innerHeight - hudHeight;

      // On mobile, use full height. On desktop, maintain aspect ratio.
      let height;
      if (window.innerWidth < 768) {
        height = availableHeight;
      } else {
        height = Math.min(Math.round((width * 3) / 4), availableHeight);
      }

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      // re-init if running
      if (gameState === GAME_STATE.PLAYING) resetField(level);
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [isRunning]);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function drawFrame(now) {
      const s = stateRef.current;
      if (!s) {
        rafRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      // Only update physics if PLAYING or TRANSITION (visuals only)
      if (gameState === GAME_STATE.PLAYING) {
        const dt = Math.min(40, now - s.lastTime);
        updateGame(dt / 16.6667);
      }

      s.lastTime = now;
      render(ctx); // Always render
      rafRef.current = requestAnimationFrame(drawFrame);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState]);

  // Particle system
  function spawnParticles(x, y, color, count = 8, type = "debris") {
    const s = stateRef.current;
    if (!s) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (type === "sparkle" ? 2 : 0),
        life: 1.0,
        color,
        type,
        size: Math.random() * 3 + 2
      });
    }
  }

  function updateParticles(delta, particles) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= 0.02 * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;

      if (p.type === "debris") p.vy += 0.15 * delta; // gravity

      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // Update game logic
  function updateGame(delta) {
    const s = stateRef.current;
    if (!s) return;
    s.tick++;

    // update particles
    updateParticles(delta, s.particles);

    // decay shake
    if (s.shake > 0) s.shake = Math.max(0, s.shake - delta * 0.5);

    // check timers
    const now = performance.now();
    if (s.fireMode && now > s.fireTimer) s.fireMode = false;
    if (s.slowMode && now > s.slowTimer) s.slowMode = false;

    // speed modifier
    const speedMod = s.slowMode ? 0.6 : 1.0;
    const effectiveDelta = delta * speedMod;

    // move paddle towards mouse target if present
    if (s.mouseTargetX !== undefined) {
      const dx = s.mouseTargetX - s.paddle.x - s.paddle.w / 2;
      s.paddle.x += dx * 0.35; // smooth follow
      // clamp
      s.paddle.x = Math.max(8, Math.min(s.W - s.paddle.w - 8, s.paddle.x));
    }

    // update balls
    for (let bi = s.balls.length - 1; bi >= 0; bi--) {
      const b = s.balls[bi];
      if (b.sticky) {
        // stick to paddle
        b.x = s.paddle.x + s.paddle.w / 2;
        b.y = s.paddle.y - b.r - 1;
      } else {
        b.x += b.vx * effectiveDelta;
        b.y += b.vy * effectiveDelta;

        // walls
        if (b.x - b.r < 0) {
          b.x = b.r;
          b.vx = -b.vx;
          soundsRef.current.playWallBounce();
        }
        if (b.x + b.r > s.W) {
          b.x = s.W - b.r;
          b.vx = -b.vx;
          soundsRef.current.playWallBounce();
        }
        if (b.y - b.r < 0) {
          b.y = b.r;
          b.vy = -b.vy;
          soundsRef.current.playWallBounce();
        }

        // paddle collision
        if (
          b.y + b.r >= s.paddle.y &&
          b.y + b.r <= s.paddle.y + s.paddle.h + 8 &&
          b.x >= s.paddle.x - 4 &&
          b.x <= s.paddle.x + s.paddle.w + 4 &&
          b.vy > 0
        ) {
          const rel = (b.x - (s.paddle.x + s.paddle.w / 2)) / (s.paddle.w / 2);
          const speed = Math.hypot(b.vx, b.vy);
          const angle = rel * (Math.PI / 3); // wide angle
          b.vx = speed * Math.sin(angle);
          b.vy = -Math.abs(speed * Math.cos(angle));
          soundsRef.current.playPaddleHit();
          // small nudge to ensure upward motion
          b.y = s.paddle.y - b.r - 1;
          if (s.paddle.sticky) b.sticky = true;
        }

        // bottom - lost ball
        if (b.y - b.r > s.H) {
          s.balls.splice(bi, 1);
        }
      }
    }

    // if no balls - lose life
    if (s.balls.length === 0) {
      setLives((l) => {
        const nl = l - 1;
        if (nl <= 0) {
          // game over
          s.shake = 20;
          soundsRef.current.playGameOver();
          endGame(); // State change
        } else {
          // respawn ball
          s.balls.push({
            x: s.W / 2,
            y: s.H - 60,
            r: 7,
            vx: 3,
            vy: -4,
            sticky: true,
          });
        }
        return Math.max(0, nl);
      });
    }

    // ball-brick collisions
    for (let bi = 0; bi < s.balls.length; bi++) {
      const b = s.balls[bi];
      if (b.sticky) continue;
      for (let i = s.bricks.length - 1; i >= 0; i--) {
        const br = s.bricks[i];
        if (rectCircleColliding(br, b)) {
          // basic collision response: reflect depending on side
          // compute centers
          const cx = br.x + br.w / 2;
          const cy = br.y + br.h / 2;
          const dx = (b.x - cx) / (br.w / 2);
          const dy = (b.y - cy) / (br.h / 2);
          if (Math.abs(dx) > Math.abs(dy)) {
            if (!s.fireMode) b.vx = -b.vx;
          } else {
            if (!s.fireMode) b.vy = -b.vy;
          }

          // damage brick
          br.hp--;
          soundsRef.current.playBrickHit();
          if (br.hp <= 0) {
            soundsRef.current.playBrickBreak();

            // particles
            const r = Math.floor(120 + 120 * (1 - (br.maxHp > 1 ? 0.5 : 0))); // approx color
            spawnParticles(br.x + br.w / 2, br.y + br.h / 2, `rgb(${r},200,100)`, 8, "debris");

            if (s.fireMode) s.shake = 5;
            // drop simple powerup sometimes
            if (Math.random() < 0.12) {
              // powerup types: enlarge, sticky, multi, fire, slow, life
              const types = ["enlarge", "sticky", "multi", "fire", "slow", "life"];
              // weighted random
              const r = Math.random();
              let kind = "enlarge";
              if (r < 0.25) kind = "enlarge";
              else if (r < 0.45) kind = "sticky";
              else if (r < 0.60) kind = "multi";
              else if (r < 0.75) kind = "fire";
              else if (r < 0.90) kind = "slow";
              else kind = "life";

              s.powerups.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, kind, vy: 1.3 });
            }
            // score increase
            setScore((sc) => sc + br.maxHp * 10);
            s.bricks.splice(i, 1);
          } else {
            setScore((sc) => sc + 5);
          }

          // small speed up
          if (!s.fireMode) {
            b.vx *= 1.02;
            b.vy *= 1.02;
          }
          break;
        }
      }
    }

    // powerups falling
    for (let pi = s.powerups.length - 1; pi >= 0; pi--) {
      const p = s.powerups[pi];
      p.y += p.vy * delta;
      // catch by paddle
      if (p.y >= s.paddle.y && p.x >= s.paddle.x && p.x <= s.paddle.x + s.paddle.w) {
        // activate
        spawnParticles(p.x, p.y, "#ffd700", 12, "sparkle");
        soundsRef.current.playPowerUp();
        if (p.kind === "enlarge") {
          s.paddle.w = Math.min(s.W - 40, s.paddle.w * 1.4);
        } else if (p.kind === "sticky") {
          s.paddle.sticky = true;
          setTimeout(() => {
            s.paddle.sticky = false;
          }, 10000);
        } else if (p.kind === "multi") {
          soundsRef.current.playPowerUpSplit();
          // duplicate every ball
          const newBalls = [];
          for (const b of s.balls) {
            newBalls.push({
              ...b,
              vx: b.vx * Math.cos(0.2) - b.vy * Math.sin(0.2),
              vy: b.vx * Math.sin(0.2) + b.vy * Math.cos(0.2)
            });
            newBalls.push({
              ...b,
              vx: b.vx * Math.cos(-0.2) - b.vy * Math.sin(-0.2),
              vy: b.vx * Math.sin(-0.2) + b.vy * Math.cos(-0.2)
            });
          }
          s.balls.push(...newBalls);
        } else if (p.kind === "fire") {
          soundsRef.current.playPowerUpFire();
          s.fireMode = true;
          s.fireTimer = performance.now() + 10000;
        } else if (p.kind === "slow") {
          soundsRef.current.playPowerUp();
          s.slowMode = true;
          s.slowTimer = performance.now() + 10000;
        } else if (p.kind === "life") {
          soundsRef.current.playExtraLife();
          setLives(l => Math.min(9, l + 1));
        }
        s.powerups.splice(pi, 1);
      } else if (p.y > s.H + 40) {
        s.powerups.splice(pi, 1);
      }
    }

    // level clear
    if (s.bricks.length === 0 && gameState === GAME_STATE.PLAYING) {
      // next level transition
      nextLevelTransition();
      return;
    }
  }

  // collision helper
  function rectCircleColliding(rect, circle) {
    const distX = Math.abs(circle.x - rect.x - rect.w / 2);
    const distY = Math.abs(circle.y - rect.y - rect.h / 2);
    if (distX > rect.w / 2 + circle.r) return false;
    if (distY > rect.h / 2 + circle.r) return false;
    if (distX <= rect.w / 2) return true;
    if (distY <= rect.h / 2) return true;
    const dx = distX - rect.w / 2;
    const dy = distY - rect.h / 2;
    return dx * dx + dy * dy <= circle.r * circle.r;
  }

  // Render everything to canvas
  function render(ctx) {
    const s = stateRef.current;
    if (!s) return;
    const W = s.W;
    const H = s.H;

    // apply shake
    ctx.save();
    if (s.shake > 0) {
      const dx = (Math.random() - 0.5) * s.shake;
      const dy = (Math.random() - 0.5) * s.shake;
      ctx.translate(dx, dy);
    }
    // background
    ctx.fillStyle = "#dff6e3";
    ctx.fillRect(0, 0, W, H);

    // decorative grass
    ctx.fillStyle = "#bde0a8";
    ctx.fillRect(0, H - 28, W, 28);

    // bricks
    for (const br of s.bricks) {
      // color by hp
      const t = br.hp / br.maxHp;
      const r = Math.floor(120 + 120 * (1 - t));
      const g = Math.floor(200 - 80 * (1 - t));
      const b = Math.floor(100 + 40 * t);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      roundRect(ctx, br.x, br.y, br.w, br.h, 4, true, false);
      // damage indicator
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = "12px sans-serif";
      ctx.fillText(br.hp > 1 ? br.hp : "", br.x + 6, br.y + 16);
      // draw gnome emoji if present
      if (br.hasGnome) {
        ctx.font = "18px serif";
        ctx.fillText("🧌", br.x + br.w - 22, br.y + 18);
      }
    }

    // powerups
    for (const p of s.powerups) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#111";
      ctx.font = "11px sans-serif";
      let label = "P";
      if (p.kind === "enlarge") { ctx.fillStyle = "#ffd166"; label = "+P"; }
      else if (p.kind === "sticky") { ctx.fillStyle = "#06d6a0"; label = "S"; }
      else if (p.kind === "multi") { ctx.fillStyle = "#10b981"; label = "M"; }
      else if (p.kind === "fire") { ctx.fillStyle = "#ef476f"; label = "F"; }
      else if (p.kind === "slow") { ctx.fillStyle = "#118ab2"; label = "Sl"; }
      else if (p.kind === "life") { ctx.fillStyle = "#ff90b3"; label = "♥"; }

      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.fillText(label, p.x - 7, p.y + 4);
    }

    // paddle
    ctx.fillStyle = "#50616d";
    roundRect(ctx, s.paddle.x, s.paddle.y, s.paddle.w, s.paddle.h, 6, true, false);
    if (s.paddle.sticky) {
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText("STICKY", s.paddle.x + 8, s.paddle.y - 6);
    }

    // balls
    for (const b of s.balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(b.x - b.r / 2, b.y - b.r / 2, 1, b.x, b.y, b.r);
      if (s.fireMode) {
        grd.addColorStop(0, "#fff5f5");
        grd.addColorStop(1, "#f03e3e");
      } else {
        grd.addColorStop(0, "#ffffff");
        grd.addColorStop(1, "#7db9b6");
      }
      ctx.fillStyle = grd;
      ctx.fill();
      // tiny sparkle
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(b.x - 1, b.y - 3, 2, 2);
    }

    // particles
    for (const p of s.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      if (p.type === "sparkle") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const sz = p.size * p.life;
        ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
    }
    ctx.globalAlpha = 1.0;
    ctx.restore();

    // HUD
    ctx.fillStyle = "#0f172a";
    ctx.font = "16px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";

    const { score: currentScore, lives: currentLives, storage: currentStorage } = gameDataRef.current;

    ctx.fillText(`Score: ${currentScore}`, 16, 24);
    ctx.fillText(`High: ${currentStorage.highScore}`, 16, 44);
    ctx.fillText(`Lives: ${currentLives}`, W - 140, 24);
    ctx.fillText(`Level: ${s.level}`, W - 140, 44);

    // small footer
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#084c61";
    ctx.fillText("Happy Playing", 16, H - 8);
  }


  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (typeof r === "undefined") r = 5;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // Mouse handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const s = stateRef.current;
      if (s) s.mouseTargetX = x;
    }
    function onClick(e) {
      const s = stateRef.current;
      if (!s) return;
      // release sticky balls
      for (const b of s.balls) if (b.sticky) b.sticky = false;
      // if not running start
      if (gameState === GAME_STATE.MENU || gameState === GAME_STATE.GAMEOVER) startGame(1);
      if (gameState === GAME_STATE.PAUSED) setPaused(false);
    }
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("touchmove", onMove, { passive: true });
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onClick);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("touchmove", onMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchstart", onClick);
    };
  }, [isRunning]);




  function saveSettings(newSettings) {
    const newStorage = { ...storage, settings: { ...storage.settings, ...newSettings } };
    setStorage(newStorage);
    saveStorage(newStorage);
  }

  function clearHighScore() {
    const newStorage = { ...storage, highScore: 0 };
    setStorage(newStorage);
    saveStorage(newStorage);
  }



  // UI Components
  const MainMenu = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 backdrop-blur-sm z-20">
      <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500 mb-8 drop-shadow-lg">
        BrickBloom
      </h1>
      <button onClick={() => startGame(1)} className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold text-xl text-white shadow-xl transition-all hover:scale-105 active:scale-95">
        <span className="flex items-center gap-2"><Play fill="currentColor" /> Play Game</span>
      </button>
      <div className="mt-6 flex gap-4">
        <button onClick={() => setShowSettings(true)} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-all hover:scale-105">
          <Settings />
        </button>
        <button onClick={() => setShowHelp(true)} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-all hover:scale-105">
          <HelpCircle />
        </button>
      </div>
      <div className="mt-8 text-slate-400 text-sm">High Score: {storage.highScore}</div>
    </div>
  );

  const GameOverScreen = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-30 animate-in fade-in duration-300">
      <h2 className="text-5xl font-bold text-red-500 mb-2">Game Over</h2>
      <div className="text-2xl text-white mb-6">Final Score: <span className="text-emerald-400 font-mono">{score}</span></div>
      <div className="flex gap-4">
        <button onClick={() => startGame(1)} className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all flex items-center gap-2">
          <RotateCcw size={20} /> Try Again
        </button>
        <button onClick={() => setGameState(GAME_STATE.MENU)} className="px-6 py-3 border border-gray-600 text-gray-300 font-bold rounded-lg hover:bg-gray-800 transition-all">
          Menu
        </button>
      </div>
    </div>
  );

  const PauseScreen = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] z-30">
      <h2 className="text-4xl font-bold text-white mb-6 tracking-widest">PAUSED</h2>
      <button onClick={() => setPaused(false)} className="px-8 py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-all flex items-center gap-2 hover:scale-105">
        <Play fill="currentColor" /> Resume
      </button>
      <button onClick={() => setGameState(GAME_STATE.MENU)} className="mt-4 text-gray-400 hover:text-white underline">
        Quit to Menu
      </button>
    </div>
  );

  const LevelTransition = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
      <h2 className="text-6xl font-black text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.8)] animate-bounce">
        {levelMsg}
      </h2>
    </div>
  );

  const SettingsModal = () => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Settings className="text-emerald-400" /> Settings</h2>
          <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white"><X /></button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-gray-200 flex items-center gap-2">
              {storage.settings.sound ? <Volume2 size={20} /> : <VolumeX size={20} />} Sound Effects
            </span>
            <button
              onClick={() => saveSettings({ sound: !storage.settings.sound })}
              className={`w-14 h-7 rounded-full transition-colors flex items-center px-1 ${storage.settings.sound ? 'bg-emerald-500 justify-end' : 'bg-gray-600 justify-start'}`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          <div className="pt-6 border-t border-gray-700">
            <button onClick={() => { clearHighScore(); setShowSettings(false); }} className="w-full py-3 rounded-lg border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-colors">
              Reset High Score
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full overflow-hidden bg-gradient-to-br from-gray-950 to-slate-900 font-sans mobile-friendly flex flex-col md:items-center md:justify-center md:p-6">
      {/* Modals */}
      {showSettings && <SettingsModal />}
      {showHelp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-gray-800 max-w-lg rounded-2xl p-6 shadow-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex gap-2"><HelpCircle className="text-cyan-400" /> How to Play</h3>
              <button onClick={() => setShowHelp(false)}><X className="text-gray-400" /></button>
            </div>
            <div className="space-y-3 text-slate-300">
              <p>Break all the bricks to advance to the next level. Catch power-ups to gain abilities!</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><span className="text-yellow-400">P</span> Enlarge Paddle</li>
                <li><span className="text-emerald-400">S</span> Sticky Paddle (Catch ball)</li>
                <li><span className="text-green-500">M</span> Multi-ball (Triple balls!)</li>
                <li><span className="text-red-500">F</span> Fire Ball (Cut through bricks)</li>
                <li><span className="text-blue-400">Sl</span> Slow Motion</li>
                <li><span className="text-pink-400">♥</span> Extra Life</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="w-full h-full max-w-5xl flex flex-col md:grid md:grid-cols-3 gap-0 md:gap-6">

        {/* Main Game Area */}
        <div className="order-2 md:order-1 md:col-span-2 relative bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden ring-4 ring-gray-800/50">

          {/* Overlays */}
          {gameState === GAME_STATE.MENU && <MainMenu />}
          {gameState === GAME_STATE.GAMEOVER && <GameOverScreen />}
          {gameState === GAME_STATE.PAUSED && <PauseScreen />}
          {gameState === GAME_STATE.TRANSITION && <LevelTransition />}

          {/* Canvas */}
          <canvas ref={canvasRef} className="block w-full h-full bg-gray-950 touch-none" />

        </div>

        {/* Responsive HUD */}
        <aside className="order-1 md:order-2 shrink-0 bg-gray-900/90 md:bg-gray-800/50 backdrop-blur-md md:rounded-2xl p-2 md:p-6 border-b md:border border-gray-700 shadow-xl flex flex-row md:flex-col justify-around md:justify-start items-center md:items-stretch gap-2 md:gap-6 h-14 md:h-fit z-10 w-full">

          <div className="flex md:flex-col items-center gap-4 md:gap-4 w-full justify-between md:justify-start">

            {/* Score */}
            <div className="bg-transparent md:bg-gray-900/50 p-0 md:p-4 rounded-xl border-0 md:border border-gray-700/50 flex flex-col items-center">
              <div className="text-[10px] md:text-xs font-bold text-emerald-500 uppercase tracking-wider mb-0 md:mb-1">Score</div>
              <div className="text-xl md:text-4xl font-mono text-white tracking-tight leading-none">{score}</div>
            </div>

            <div className="flex gap-4 md:grid md:grid-cols-2 md:w-full">
              {/* Lives */}
              <div className="bg-transparent md:bg-gray-900/50 p-0 md:p-3 rounded-xl border-0 md:border border-gray-700/50 flex flex-col items-center">
                <div className="text-[10px] md:text-xs font-bold text-pink-500 uppercase tracking-wider mb-0 md:mb-1 flex items-center gap-1"><Heart className="w-3 h-3" fill="currentColor" /> <span className="hidden md:inline">Lives</span></div>
                <div className="text-lg md:text-2xl font-mono text-white leading-none">{lives}</div>
              </div>
              {/* Level */}
              <div className="bg-transparent md:bg-gray-900/50 p-0 md:p-3 rounded-xl border-0 md:border border-gray-700/50 flex flex-col items-center">
                <div className="text-[10px] md:text-xs font-bold text-cyan-500 uppercase tracking-wider mb-0 md:mb-1 flex items-center gap-1"><Activity className="w-3 h-3" /> <span className="hidden md:inline">Level</span></div>
                <div className="text-lg md:text-2xl font-mono text-white leading-none">{level}</div>
              </div>
            </div>

            {/* Controls (Mobile Only) */}
            <div className="flex md:hidden gap-2">
              <button onClick={() => setPaused(!isPaused)} className="p-2 bg-gray-700 rounded text-white">
                {isPaused ? <Play size={16} fill="white" /> : <Pause size={16} fill="white" />}
              </button>
              <button onClick={() => setShowSettings(true)} className="p-2 bg-gray-700 rounded text-white">
                <Settings size={16} />
              </button>
            </div>

          </div>

          <div className="hidden md:block border-t border-gray-700 pt-6">
            <div className="flex gap-2">
              <button
                onClick={() => setPaused(!isPaused)}
                className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isPaused ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
              >
                {isPaused ? <><Play size={18} fill="currentColor" /> Resume</> : <><Pause size={18} fill="currentColor" /> Pause</>}
              </button>
              <button onClick={() => setShowSettings(true)} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors">
                <Settings size={20} />
              </button>
            </div>

            <div className="text-xs text-center text-gray-500 mt-4">
              High Score: <span className="text-gray-300 font-bold">{storage.highScore}</span>
            </div>
          </div>

        </aside>

      </div >
    </div >
  );
}
