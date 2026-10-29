import { useEffect, useRef } from "react";
import "./TradingBackdrop.css";

/*
  TradingBackdrop
  A live-feeling candlestick chart that sits behind every page: price grid,
  candles, volume, a 20-period EMA, a last-price tag, an OHLC legend and a
  crosshair that follows the mouse. Everything is drawn on one <canvas>.

  Mount it ONCE at the app root (outside your router's <Routes>) so the chart
  keeps running as people move between pages.

  The data is simulated. It is atmosphere, not market data.
*/

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const EMA_K = 2 / 21;

/* ---------- seeded random so the chart looks the same on every visit ---------- */
function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Random walk with volatility clusters and gentle mean reversion */
function createGenerator(seed, basePrice, volatility) {
  const rand = mulberry32(seed);
  const gauss = () => (rand() + rand() + rand() + rand() - 2) * 1.7;
  let drift = 0;
  let volMult = 1;
  let left = 0;

  return {
    rand,
    step(prev) {
      if (left-- <= 0) {
        left = 15 + Math.floor(rand() * 30);
        volMult = 0.5 + rand() * 1.4;
        drift = (rand() - 0.5) * volatility * 0.7;
      }
      const vol = volatility * volMult;
      const body = (gauss() * vol + drift) * prev + (basePrice - prev) * 0.002;
      return {
        o: prev,
        c: prev + body,
        wu: Math.abs(gauss()) * vol * 0.5 * prev,
        wd: Math.abs(gauss()) * vol * 0.5 * prev,
        v: (0.35 + rand() * 0.9) * (1 + Math.abs(gauss()) * volMult * 0.6),
      };
    },
  };
}

function niceStep(raw) {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / pow;
  return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * pow;
}

function readColors(el) {
  const cs = getComputedStyle(el);
  const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    up: get("--tb-up", get("--positive", "#2ebd85")),
    down: get("--tb-down", get("--negative", "#f6465d")),
    grid: get("--tb-grid", get("--border", "#2b323d")),
    text: get("--tb-text", get("--text-muted", "#8f98a6")),
    accent: get("--tb-accent", get("--accent", "#4cc2a0")),
    tagText: get("--tb-tag-text", "#0b0e11"),
  };
}

const pad2 = (n) => String(n).padStart(2, "0");
const hhmm = (t) => {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export default function TradingBackdrop({
  symbol = "BTCUSDT",
  timeframe = "1m",
  basePrice = 67400,
  volatility = 0.0009, // typical candle body, as a fraction of price
  intervalMs = 6000, // how often a new candle opens
  seed = 7,
  legend = true,
  crosshair = true,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const decimals = basePrice < 1 ? 5 : basePrice < 100 ? 3 : 2;
    const nf = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const fmt = (n) => nf.format(n);

    let w = 0, h = 0;
    let spacing = 14, bodyW = 9, axisW = 68, lastX = 0, volH = 0;
    let gen = null;
    let candles = [];
    let forming = null;
    let colors = readColors(canvas);
    let scaleMin = 0, scaleMax = 1, volMax = 1;
    let formingStart = 0, wobble = 0, jumpStart = -1e9, lastTick = 0;
    let dirty = true, raf = 0, resizeTimer = 0;
    const mouse = { x: 0, y: 0, t: -1e9 };

    /* ---------- data ---------- */
    function startForming(prevClose, t, emaPrev) {
      const s = gen.step(prevClose);
      forming = { ...s, t, price: s.o, hi: s.o, lo: s.o, emaPrev, ema: emaPrev };
      formingStart = performance.now();
      wobble = 0;
    }

    function build() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const small = w < 640;
      spacing = small ? 10 : 14;
      bodyW = small ? 6 : 9;
      axisW = small ? 54 : 68;
      lastX = w - axisW - spacing * 2.5;
      volH = h * 0.13;

      gen = createGenerator(seed, basePrice, volatility);
      const n = Math.ceil(lastX / spacing) + 3;
      const t0 = Math.floor(Date.now() / 60000) * 60000;
      candles = [];
      let price = basePrice;
      let ema = basePrice;
      for (let i = 0; i < n; i++) {
        const s = gen.step(price);
        ema += (s.c - ema) * EMA_K;
        candles.push({
          t: t0 - (n - i) * 60000,
          o: s.o,
          c: s.c,
          h: Math.max(s.o, s.c) + s.wu,
          l: Math.min(s.o, s.c) - s.wd,
          v: s.v,
          ema,
        });
        price = s.c;
      }
      startForming(price, t0, ema);
      fit(true);
      dirty = true;
    }

    function finalize(now) {
      const f = forming;
      candles.push({
        t: f.t,
        o: f.o,
        c: f.c,
        h: Math.max(f.hi, f.o, f.c),
        l: Math.min(f.lo, f.o, f.c),
        v: f.v,
        ema: f.ema,
      });
      candles.shift();
      jumpStart = now;
      colors = readColors(canvas); // picks up theme changes
      startForming(f.c, f.t + 60000, f.ema);
    }

    function tick(now) {
      const p = Math.min(1, (now - formingStart) / intervalMs);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      wobble = wobble * 0.6 + (gen.rand() - 0.5) * 2 * 0.4;
      const amp = ((forming.wu + forming.wd) / 2) * Math.sin(Math.PI * p);
      forming.price = p >= 1 ? forming.c : forming.o + (forming.c - forming.o) * e + wobble * amp;
      forming.hi = Math.max(forming.hi, forming.price);
      forming.lo = Math.min(forming.lo, forming.price);
      forming.ema = forming.emaPrev + (forming.price - forming.emaPrev) * EMA_K;
      if (p >= 1) finalize(now);
    }

    function fit(snap) {
      let lo = Infinity, hi = -Infinity, vmax = 0;
      for (const c of candles) {
        if (c.l < lo) lo = c.l;
        if (c.h > hi) hi = c.h;
        if (c.v > vmax) vmax = c.v;
      }
      if (forming) {
        lo = Math.min(lo, forming.lo);
        hi = Math.max(hi, forming.hi);
        vmax = Math.max(vmax, forming.v);
      }
      const pad = (hi - lo) * 0.12 || 1;
      lo -= pad;
      hi += pad;
      if (snap) {
        scaleMin = lo;
        scaleMax = hi;
      } else {
        scaleMin += (lo - scaleMin) * 0.12;
        scaleMax += (hi - scaleMax) * 0.12;
      }
      volMax = vmax || 1;
    }

    /* ---------- drawing ---------- */
    function draw(now) {
      ctx.clearRect(0, 0, w, h);

      const top = 30;
      const timeY = h - 8;
      const baseY = h - 24; // bottom of the volume zone
      const priceBottom = baseY - volH;
      const plotRight = w - axisW;
      const yOf = (p) => top + ((scaleMax - p) / (scaleMax - scaleMin)) * (priceBottom - top);
      const n = candles.length;

      const sp = Math.min(1, (now - jumpStart) / 280);
      const shift = spacing * Math.pow(1 - sp, 3); // eased slide into place
      const xOf = (k) => (k === 0 ? lastX : lastX - k * spacing + shift);

      ctx.lineWidth = 1;
      ctx.font = `11px ${MONO}`;
      ctx.textBaseline = "middle";

      /* horizontal price grid + right-axis labels */
      const step = niceStep((scaleMax - scaleMin) / 6);
      for (let v = Math.ceil(scaleMin / step) * step; v < scaleMax; v += step) {
        const y = Math.round(yOf(v)) + 0.5;
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = colors.grid;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(plotRight, y);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = colors.text;
        ctx.fillText(fmt(v), plotRight + 8, y);
      }

      /* vertical time grid, every 10 minutes */
      ctx.textAlign = "center";
      for (let i = 0; i < n; i++) {
        const c = candles[i];
        if ((c.t / 60000) % 10 !== 0) continue;
        const x = Math.round(xOf(n - i)) + 0.5;
        if (x < 0 || x > plotRight) continue;
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = colors.grid;
        ctx.beginPath();
        ctx.moveTo(x, top - 10);
        ctx.lineTo(x, baseY + 4);
        ctx.stroke();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = colors.text;
        ctx.fillText(hhmm(c.t), x, timeY);
      }
      ctx.textAlign = "left";

      /* volume */
      const drawVolume = (c, x) => {
        const vh = (c.v / volMax) * volH * 0.9;
        ctx.fillStyle = c.c >= c.o ? colors.up : colors.down;
        ctx.fillRect(x - bodyW / 2, baseY - vh, bodyW, vh);
      };
      ctx.globalAlpha = 0.42;
      for (let i = 0; i < n; i++) {
        const x = xOf(n - i);
        if (x > -spacing && x < plotRight) drawVolume(candles[i], x);
      }
      drawVolume({ ...forming, c: forming.price }, lastX);

      /* candles */
      const drawCandle = (o, c, hi, lo, x) => {
        const color = c >= o ? colors.up : colors.down;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        const wx = Math.round(x) + 0.5;
        ctx.beginPath();
        ctx.moveTo(wx, yOf(hi));
        ctx.lineTo(wx, yOf(lo));
        ctx.stroke();
        const y1 = yOf(Math.max(o, c));
        ctx.fillRect(x - bodyW / 2, y1, bodyW, Math.max(1, yOf(Math.min(o, c)) - y1));
      };
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < n; i++) {
        const x = xOf(n - i);
        if (x > -spacing && x < plotRight) {
          const c = candles[i];
          drawCandle(c.o, c.c, c.h, c.l, x);
        }
      }
      drawCandle(forming.o, forming.price, forming.hi, forming.lo, lastX);

      /* 20-period EMA */
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        const x = xOf(n - i);
        if (x < -spacing) continue;
        const y = yOf(candles[i].ema);
        started ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        started = true;
      }
      ctx.lineTo(lastX, yOf(forming.ema));
      ctx.stroke();
      ctx.lineWidth = 1;

      /* last-price line and tag */
      const isUp = forming.price >= forming.o;
      const lastColor = isUp ? colors.up : colors.down;
      const ly = Math.round(yOf(forming.price)) + 0.5;
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = lastColor;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(lastX, ly);
      ctx.lineTo(plotRight, ly);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = lastColor;
      ctx.beginPath();
      ctx.roundRect(plotRight + 2, ly - 9, axisW - 4, 18, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.tagText;
      ctx.fillText(fmt(forming.price), plotRight + 7, ly + 0.5);

      /* legend */
      if (legend) {
        ctx.font = `600 12px ${MONO}`;
        ctx.textBaseline = "alphabetic";
        let x = 14;
        const put = (text, color, alpha = 0.85) => {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          ctx.fillText(text, x, 20);
          x += ctx.measureText(text).width;
        };
        const dir = isUp ? colors.up : colors.down;
        put(`${symbol} · ${timeframe}   `, colors.text);
        if (w >= 640) {
          put("O ", colors.text); put(`${fmt(forming.o)}  `, dir);
          put("H ", colors.text); put(`${fmt(forming.hi)}  `, dir);
          put("L ", colors.text); put(`${fmt(forming.lo)}  `, dir);
        }
        put("C ", colors.text);
        put(fmt(forming.price), dir);
        const chg = ((forming.price - forming.o) / forming.o) * 100;
        put(`  ${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`, dir);
        ctx.textBaseline = "middle";
        ctx.font = `11px ${MONO}`;
      }

      /* crosshair: appears on mouse move, fades after ~2s */
      const idle = now - mouse.t;
      if (crosshair && finePointer && !reduce && idle < 2200 && mouse.x < plotRight) {
        const fade = 1 - Math.max(0, (idle - 1500) / 700);
        const k = Math.max(0, Math.min(n, Math.round((lastX - mouse.x) / spacing)));
        const cx = Math.round(xOf(k)) + 0.5;
        const cy = Math.round(mouse.y) + 0.5;
        ctx.strokeStyle = colors.text;
        ctx.globalAlpha = 0.4 * fade;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, baseY + 4);
        ctx.moveTo(0, cy);
        ctx.lineTo(plotRight, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = colors.text;
        if (mouse.y > top && mouse.y < priceBottom) {
          const price = scaleMax - ((mouse.y - top) / (priceBottom - top)) * (scaleMax - scaleMin);
          ctx.beginPath();
          ctx.roundRect(plotRight + 2, cy - 9, axisW - 4, 18, 3);
          ctx.fill();
          ctx.globalAlpha = fade;
          ctx.fillStyle = colors.tagText;
          ctx.fillText(fmt(price), plotRight + 7, cy + 0.5);
          ctx.globalAlpha = 0.85 * fade;
          ctx.fillStyle = colors.text;
        }
        const t = k === 0 ? forming.t : candles[n - k]?.t;
        if (t) {
          ctx.beginPath();
          ctx.roundRect(cx - 24, h - 20, 48, 16, 3);
          ctx.fill();
          ctx.globalAlpha = fade;
          ctx.fillStyle = colors.tagText;
          ctx.textAlign = "center";
          ctx.fillText(hhmm(t), cx, timeY);
          ctx.textAlign = "left";
        }
      }

      ctx.globalAlpha = 1;
    }

    /* ---------- loop ---------- */
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (now - lastTick > 320) {
        lastTick = now;
        tick(now);
        dirty = true;
      }
      if (now - jumpStart < 300 || now - mouse.t < 2300) dirty = true;
      if (!dirty) return;
      dirty = false;
      fit(false);
      draw(now);
    }

    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        build();
        if (reduce) settleAndDraw();
      }, 150);
    }

    function onVisible() {
      if (!document.hidden) formingStart = performance.now(); // do not "catch up" on missed candles
    }

    const onMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.t = performance.now();
    };

    // Reduced motion: one still frame, no animation and no crosshair
    function settleAndDraw() {
      forming.price = forming.c;
      forming.hi = Math.max(forming.o, forming.c) + forming.wu;
      forming.lo = Math.min(forming.o, forming.c) - forming.wd;
      forming.ema = forming.emaPrev + (forming.price - forming.emaPrev) * EMA_K;
      fit(true);
      draw(performance.now());
    }

    build();
    window.addEventListener("resize", onResize);
    if (reduce) {
      settleAndDraw();
    } else {
      document.addEventListener("visibilitychange", onVisible);
      if (crosshair && finePointer) window.addEventListener("mousemove", onMove, { passive: true });
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [symbol, timeframe, basePrice, volatility, intervalMs, seed, legend, crosshair]);

  return (
    <div className="trading-backdrop" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
