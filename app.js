/* かたち パズル — app.js
 * 仕様書「かたちパズルアプリ 仕様書」にもとづく実装。
 * 外部ライブラリなし。データは localStorage にのみ保存する。
 */
(() => {
  'use strict';

  const APP_VERSION = '1.1.0';
  const ROUND_N = 8;            // 1回の問題数
  const CHECK_N = 8;            // くるくるチェックの問題数
  const FLY_MS = 650;

  const $ = (sel) => document.querySelector(sel);
  const now = () => performance.now();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const mod = (a, n) => ((a % n) + n) % n;

  // ---------- 形 ----------
  // すべて 100×100 の枠の中、中心 (50,50) のまわりに回す。sym = 何度回すと同じ形に戻るか（90°刻みで見て）。
  const P = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ') + ' Z';
  const regular = (n, r, start) => Array.from({ length: n }, (_, i) => {
    const a = ((start + (360 / n) * i) * Math.PI) / 180;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  });
  const starPts = (n, R, r) => Array.from({ length: n * 2 }, (_, i) => {
    const a = ((-90 + (180 / n) * i) * Math.PI) / 180;
    const rr = i % 2 ? r : R;
    return [50 + rr * Math.cos(a), 53 + rr * Math.sin(a)];
  });

  const SHAPES = {
    circle:    { d: 'M8 50 A42 42 0 1 0 92 50 A42 42 0 1 0 8 50 Z', sym: 90, name: 'まる' },
    square:    { d: P([[14, 14], [86, 14], [86, 86], [14, 86]]), sym: 90, name: 'しかく' },
    triangle:  { d: P([[50, 10], [92, 84], [8, 84]]), sym: 360, name: 'さんかく' },
    star:      { d: P(starPts(5, 46, 19)), sym: 360, name: 'ほし' },
    heart:     { d: 'M50 88 C 22 66, 6 50, 10 32 C 14 14, 40 10, 50 30 C 60 10, 86 14, 90 32 C 94 50, 78 66, 50 88 Z', sym: 360, name: 'ハート' },
    moon:      { d: 'M70 8 A42 42 0 1 0 70 92 A60 60 0 0 1 70 8 Z', sym: 360, name: 'つき' },
    hexagon:   { d: P(regular(6, 44, 0)), sym: 180, name: 'ろっかく' },
    rect:      { d: P([[8, 28], [92, 28], [92, 72], [8, 72]]), sym: 180, name: 'ながしかく' },
    rhombus:   { d: P([[50, 8], [82, 50], [50, 92], [18, 50]]), sym: 180, name: 'ひしがた' },
    ellipse:   { d: 'M6 50 A44 28 0 1 0 94 50 A44 28 0 1 0 6 50 Z', sym: 180, name: 'だえん' },
    semicircle:{ d: 'M8 72 A42 42 0 0 1 92 72 Z', sym: 360, name: 'はんえん' },
    rtri:      { d: P([[14, 14], [14, 86], [86, 86]]), sym: 360, name: 'さんかく' },
    trapezoid: { d: P([[30, 22], [70, 22], [92, 78], [8, 78]]), sym: 360, name: 'だいけい' },
    pentagon:  { d: P(regular(5, 46, -90)), sym: 360, name: 'ごかく' },
    drop:      { d: 'M50 6 C 50 6, 84 46, 84 62 A34 34 0 1 1 16 62 C 16 46, 50 6, 50 6 Z', sym: 360, name: 'しずく' },
    house:     { d: P([[50, 8], [92, 46], [78, 46], [78, 90], [22, 90], [22, 46], [8, 46]]), sym: 360, name: 'いえ' },
    arrow:     { d: P([[8, 38], [54, 38], [54, 14], [92, 50], [54, 86], [54, 62], [8, 62]]), sym: 360, name: 'やじるし' },
    lshape:    { d: P([[20, 10], [46, 10], [46, 64], [80, 64], [80, 90], [20, 90]]), sym: 360, name: 'エルの かたち' },
    tshape:    { d: P([[10, 14], [90, 14], [90, 40], [63, 40], [63, 88], [37, 88], [37, 40], [10, 40]]), sym: 360, name: 'ティーの かたち' },
    // レベル4（組み合わせ）用：枠いっぱいの形
    c_sq:      { pts: [[0, 0], [100, 0], [100, 100], [0, 100]], sym: 90, name: 'しかく' },
    c_rt:      { pts: [[0, 0], [0, 100], [100, 100]], sym: 360, name: 'さんかく' },
    c_iso:     { pts: [[0, 75], [50, 25], [100, 75]], sym: 360, name: 'さんかく' },
    c_rect:    { pts: [[0, 25], [100, 25], [100, 75], [0, 75]], sym: 180, name: 'ながしかく' },
    c_trap:    { pts: [[25, 25], [75, 25], [100, 75], [0, 75]], sym: 360, name: 'だいけい' },
  };
  Object.values(SHAPES).forEach((s) => { if (s.pts && !s.d) s.d = P(s.pts); });

  // レベル5・チェック用：正方形をつないだ形（裏返すと別の形になるものだけ）
  const POLY = {
    L4: [[0, 0], [0, 1], [0, 2], [1, 2]],
    S4: [[1, 0], [2, 0], [0, 1], [1, 1]],
    P5: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
    F5: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
    N5: [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3]],
    Y5: [[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]],
    L5: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
  };
  // 念のため、裏返しが回転で元に戻らない（キラルな）形だけを使う
  const POLY_KEYS = Object.keys(POLY).filter((k) => isChiral(POLY[k]));
  function canon(cells) {
    const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1]));
    return cells.map((c) => `${c[0] - mx},${c[1] - my}`).sort().join(';');
  }
  function rotCells(cells, times) {
    let c = cells;
    for (let t = 0; t < times; t++) c = c.map(([x, y]) => [-y, x]);
    return c;
  }
  function isChiral(cells) {
    const mir = cells.map(([x, y]) => [-x, y]);
    const forms = [0, 1, 2, 3].map((t) => canon(rotCells(cells, t)));
    return [0, 1, 2, 3].every((t) => !forms.includes(canon(rotCells(mir, t))));
  }

  const COLORS = [
    ['#FF8A65', '#D9623C'], ['#4DB6AC', '#2E8F86'], ['#5B9BFF', '#2F6FD0'], ['#FFC14D', '#C98A10'],
    ['#B07CF0', '#8450C7'], ['#F06292', '#C83A6B'], ['#7CB342', '#55892A'],
  ];
  const HOLE_FILL = '#D3DCEA', HOLE_LINE = '#97A6BE';

  function symOf(key) { return key.startsWith('poly:') ? 360 : SHAPES[key].sym; }
  function nameOf(key) { return key.startsWith('poly:') ? '' : SHAPES[key].name; }
  function sameOrient(key, a, b) { return mod(a - b, symOf(key)) === 0; }

  // 形の SVG（100×100 の枠）。mode: hole = 穴、piece = 色つきピース
  function shapeSVG(key, opt = {}) {
    const rot = opt.rot || 0;
    const mir = opt.mirror ? ' translate(100 0) scale(-1 1)' : '';
    const hole = opt.mode === 'hole';
    const [fill, line] = hole ? [HOLE_FILL, HOLE_LINE] : (opt.color || COLORS[0]);
    let inner = '';
    if (key.startsWith('poly:')) {
      const cells = POLY[key.slice(5)];
      const w = Math.max(...cells.map((c) => c[0])) + 1, h = Math.max(...cells.map((c) => c[1])) + 1;
      const u = 22, ox = (100 - w * u) / 2, oy = (100 - h * u) / 2;
      inner = cells.map(([x, y]) => {
        const rx = ox + x * u, ry = oy + y * u;
        return hole
          ? `<rect x="${rx - 0.4}" y="${ry - 0.4}" width="${u + 0.8}" height="${u + 0.8}" fill="${fill}"/>`
          : `<rect x="${rx}" y="${ry}" width="${u}" height="${u}" rx="2" fill="${fill}" stroke="#fff" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
      }).join('');
      if (!hole) inner = `<g>${inner}</g>`;
    } else {
      const d = SHAPES[key].d;
      inner = hole
        ? `<path d="${d}" fill="${fill}" stroke="${line}" stroke-width="2.5" stroke-dasharray="7 6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
        : `<path d="${d}" fill="${fill}" stroke="${line}" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    }
    return `<g transform="rotate(${rot} 50 50)${mir}">${inner}</g>`;
  }
  const svgBox = (content) => `<svg viewBox="0 0 100 100" aria-hidden="true">${content}</svg>`;

  // ---------- 組み合わせ（レベル4） ----------
  // 各パーツ：形 s を r 度回し、枠の左上を (x, y) に置く（枠は100×100）
  const COMPS = [
    { name: 'しかく', parts: [{ s: 'c_rt', r: 0, x: 0, y: 0 }, { s: 'c_rt', r: 180, x: 0, y: 0 }] },
    { name: 'いえ', parts: [{ s: 'c_iso', r: 0, x: 0, y: -25 }, { s: 'c_sq', r: 0, x: 0, y: 50 }] },
    { name: 'おおきな さんかく', parts: [{ s: 'c_rt', r: 270, x: 0, y: 0 }, { s: 'c_rt', r: 0, x: 100, y: 0 }] },
    { name: 'き', parts: [{ s: 'c_iso', r: 0, x: 0, y: -25 }, { s: 'c_rect', r: 90, x: 0, y: 50 }] },
    { name: 'やじるし', parts: [{ s: 'c_rect', r: 0, x: 0, y: 0 }, { s: 'c_iso', r: 90, x: 75, y: 0 }] },
    { name: 'ふね', parts: [{ s: 'c_rt', r: 0, x: 0, y: -25 }, { s: 'c_trap', r: 180, x: 0, y: 50 }] },
    { name: 'ロケット', parts: [{ s: 'c_iso', r: 0, x: 0, y: -25 }, { s: 'c_sq', r: 0, x: 0, y: 50 }, { s: 'c_rect', r: 0, x: 0, y: 125 }] },
  ];
  function rotPt([x, y], r) {
    switch (mod(r, 360)) {
      case 90: return [100 - y, x];
      case 180: return [100 - x, 100 - y];
      case 270: return [y, 100 - x];
      default: return [x, y];
    }
  }
  function compBBox(comp) {
    const xs = [], ys = [];
    comp.parts.forEach((p) => SHAPES[p.s].pts.forEach((pt) => {
      const [x, y] = rotPt(pt, p.r);
      xs.push(x + p.x); ys.push(y + p.y);
    }));
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
  }

  // ---------- 保存 ----------
  const STORE_KEY = 'katachi-puzzle-v1';
  const defaultData = () => ({
    settings: { level: 1, hints: true, limit: 3, guideSeen: false },
    days: {},     // 'YYYY-MM-DD' -> { rounds, puzzles, mistakes, ms }
    rounds: [],   // { ts, level, mistakes, ms }
    checks: [],   // { ts, date, n, correct, acc, ms }
  });
  function loadData() {
    const def = defaultData();
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return def;
      const d = JSON.parse(raw);
      return {
        settings: Object.assign(def.settings, d.settings || {}),
        days: d.days || {},
        rounds: Array.isArray(d.rounds) ? d.rounds : [],
        checks: Array.isArray(d.checks) ? d.checks : [],
      };
    } catch (e) {
      return def;
    }
  }
  let data = loadData();
  function saveData() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* 保存できなくても遊べる */ }
  }
  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function todayRec(create) {
    const k = dateKey();
    const blank = { rounds: 0, puzzles: 0, mistakes: 0, ms: 0 };
    if (!data.days[k] && create) data.days[k] = blank;
    return data.days[k] || blank;
  }
  function limitReached() {
    const L = Number(data.settings.limit);
    return L > 0 && todayRec(false).rounds >= L;
  }

  // ---------- 音 ----------
  const Sound = {
    ctx: null, buffers: {}, voice: null, unlocked: false, current: null,
    unlock() {
      if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (e) { /* 未対応 */ } }
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) { try { this.ctx = new AC(); } catch (e) { this.ctx = null; } }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (this.unlocked) return;
      this.unlocked = true;
      if (this.ctx) {
        const b = this.ctx.createBuffer(1, 1, 22050);
        const s = this.ctx.createBufferSource();
        s.buffer = b; s.connect(this.ctx.destination); s.start(0);
      }
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      }
      this.loadRecorded();
    },
    pickVoice() {
      if (!('speechSynthesis' in window)) return;
      const vs = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang));
      if (!vs.length) return;
      this.voice = vs.find((v) => v.localService && /kyoko|o-ren|hattori/i.test(v.name)) || vs.find((v) => v.localService) || vs[0];
    },
    async loadRecorded() {
      if (!this.ctx) return;
      try {
        const res = await fetch('audio/list.json', { cache: 'no-cache' });
        if (!res.ok) return;
        const list = await res.json();
        if (!Array.isArray(list)) return;
        await Promise.all(list.map(async (key) => {
          try {
            const r = await fetch(`audio/${key}.mp3`);
            if (!r.ok) return;
            const ab = await r.arrayBuffer();
            this.buffers[key] = await new Promise((ok, ng) => this.ctx.decodeAudioData(ab, ok, ng));
          } catch (e) { /* 合成音声に任せる */ }
        }));
      } catch (e) { /* 録音なし */ }
    },
    say(key, text) {
      const buf = this.buffers[key];
      if (buf && this.ctx) {
        if (this.current) { try { this.current.stop(); } catch (e) { /* 停止済み */ } }
        const src = this.ctx.createBufferSource();
        src.buffer = buf; src.connect(this.ctx.destination); src.start(0);
        this.current = src;
        return new Promise((ok) => setTimeout(ok, buf.duration * 1000));
      }
      if (!('speechSynthesis' in window)) return Promise.resolve();
      if (!this.voice) this.pickVoice();
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      if (this.voice) u.voice = this.voice;
      u.rate = 0.85; u.pitch = 1.15;
      return new Promise((ok) => {
        const t = setTimeout(ok, 4000);
        u.onend = u.onerror = () => { clearTimeout(t); ok(); };
        speechSynthesis.speak(u);
      });
    },
    tone(freq, dur, opts = {}) {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + (opts.delay || 0);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = opts.type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
      const v = opts.vol || 0.18;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
    fx(name) {
      switch (name) {
        case 'tap': this.tone(520, 0.08, { type: 'triangle', vol: 0.12 }); break;
        case 'turn': this.tone(700, 0.1, { type: 'triangle', to: 980, vol: 0.1 }); break;
        case 'fly': this.tone(420, 0.3, { to: 840, vol: 0.08 }); break;
        case 'lift': this.tone(560, 0.08, { type: 'triangle', to: 700, vol: 0.08 }); break;
        case 'fit': this.tone(660, 0.12, { vol: 0.15 }); this.tone(990, 0.22, { vol: 0.13, delay: 0.1 }); break;
        case 'miss': this.tone(260, 0.2, { type: 'triangle', to: 210, vol: 0.08 }); break;
        case 'end': [784, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.13, delay: i * 0.11 })); break;
        default: break;
      }
    },
  };
  if ('speechSynthesis' in window) {
    Sound.pickVoice();
    speechSynthesis.onvoiceschanged = () => Sound.pickVoice();
  }

  // ---------- 画面切り替え ----------
  let currentScreen = 'title';
  let pendingReload = false;
  function show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    $(`#screen-${name}`).classList.add('active');
    currentScreen = name;
    document.body.classList.toggle('no-gear', name === 'parent' || name === 'check');
    if (name === 'title') {
      renderTitle();
      if (pendingReload) location.reload();
    }
  }
  function renderTitle() {
    const limited = limitReached();
    $('#btn-start').hidden = limited;
    $('#title-limit').hidden = !limited;
  }
  $('#title-art').innerHTML = [['triangle', 0], ['circle', 1], ['square', 2], ['star', 3], ['heart', 5]]
    .map(([k, c]) => svgBox(shapeSVG(k, { color: COLORS[c] }))).join('');

  // ---------- 問題づくり ----------
  const POOL1 = ['circle', 'square', 'triangle', 'star', 'heart', 'moon', 'hexagon'];
  const GROUPS2 = [
    ['square', 'rect', 'rhombus'], ['circle', 'ellipse', 'semicircle'], ['triangle', 'rtri', 'trapezoid'],
    ['pentagon', 'hexagon', 'star'], ['heart', 'moon', 'drop'],
  ];
  const POOL3 = ['rtri', 'semicircle', 'house', 'arrow', 'trapezoid', 'lshape', 'tshape', 'heart', 'drop'];
  const ROTS = [0, 90, 180, 270];

  function colorsFor(n) { return shuffle(COLORS).slice(0, n); }

  function makePuzzle(level, prevKey) {
    if (level === 1) {
      const t = pick(POOL1.filter((k) => k !== prevKey));
      const d = pick(POOL1.filter((k) => k !== t));
      const cs = colorsFor(2);
      return {
        type: 'choose', key: t, hole: { key: t, rot: 0 },
        choices: shuffle([{ key: t, rot: 0, correct: true, color: cs[0] }, { key: d, rot: 0, color: cs[1] }]),
      };
    }
    if (level === 2) {
      const g = pick(GROUPS2);
      const t = pick(g.filter((k) => k !== prevKey));
      const cs = colorsFor(3);
      return {
        type: 'choose', key: t, hole: { key: t, rot: 0 },
        choices: shuffle(g.map((k, i) => ({ key: k, rot: 0, correct: k === t, color: cs[i] }))),
      };
    }
    if (level === 3) {
      const t = pick(POOL3.filter((k) => k !== prevKey));
      const hr = pick(ROTS);
      return {
        type: 'rotate', key: t, hole: { key: t, rot: hr },
        piece: { key: t, rot: hr + pick([90, 180, 270]), color: pick(COLORS) },
      };
    }
    if (level === 4) {
      const comp = pick(COMPS.filter((c) => c.name !== prevKey));
      const cs = colorsFor(comp.parts.length);
      const pieces = comp.parts.map((part, i) => {
        const bad = ROTS.filter((r) => !comp.parts.some((q) => q.s === part.s && sameOrient(part.s, r, q.r)));
        return { key: part.s, rot: pick(bad.length ? bad : ROTS), color: cs[i], placed: false };
      });
      return { type: 'compose', key: comp.name, comp, pieces: shuffle(pieces), filled: comp.parts.map(() => null) };
    }
    // level 5
    const pk = pick(POLY_KEYS.filter((k) => `poly:${k}` !== prevKey));
    const key = `poly:${pk}`;
    const hr = pick(ROTS);
    const mirRots = shuffle(ROTS).slice(0, 2);
    const cs = colorsFor(3);
    return {
      type: 'choose', key, hole: { key, rot: hr },
      choices: shuffle([
        { key, rot: hr + pick([90, 180, 270]), correct: true, color: cs[0] },
        { key, rot: mirRots[0], mirror: true, color: cs[1] },
        { key, rot: mirRots[1], mirror: true, color: cs[2] },
      ]),
    };
  }

  // ---------- ゲーム ----------
  const Q = {
    level: 1, list: [], i: 0, p: null, busy: false, misses: 0, t0: 0,
    mistakes: 0, ms: 0, done: [], timers: [], introSaid: 0, selected: -1,
  };
  function later(ms, fn) {
    const id = setTimeout(() => { Q.timers = Q.timers.filter((t) => t !== id); fn(); }, ms);
    Q.timers.push(id);
  }
  function clearTimers() { Q.timers.forEach(clearTimeout); Q.timers = []; }

  const holeEl = $('#hole');
  const trayEl = $('#tray');
  let S = 220;          // ピースと穴の一辺（px）
  let K = 2;            // レベル4：1単位あたりの px

  function computeSizes() {
    const W = window.innerWidth, H = window.innerHeight;
    S = Math.round(Math.max(130, Math.min(240, (H - 170) / 2.1, (W - 200) / 4.2)));
    document.documentElement.style.setProperty('--S', `${S}px`);
  }

  const INTRO = {
    1: ['intro1', 'おなじ かたちを あなまで はこんでね'],
    2: ['intro1', 'おなじ かたちを あなまで はこんでね'],
    3: ['intro3', 'ピースを タップすると まわるよ。むきが あったら、あなまで はこんでね'],
    4: ['intro4', 'ピースを タップして まわそう。あう ばしょまで はこんで、かたちを つくろう'],
    5: ['intro5', 'あたまの なかで まわしてね。はいる ピースを あなまで はこんでね'],
  };
  const HINTS = ['かどは いくつ？', 'とがっているのは どこ？', 'まわすと どうなる？', 'ひっくりかえすと どうなる？',
    'どっちが ながい？', 'おなじ ところは どこ？', 'どうして そう おもう？'];

  function newRound() {
    clearTimers();
    computeSizes();
    Q.level = [1, 2, 3, 4, 5].includes(Number(data.settings.level)) ? Number(data.settings.level) : 1;
    Q.list = [];
    let prev = '';
    for (let n = 0; n < ROUND_N; n++) {
      const p = makePuzzle(Q.level, prev);
      Q.list.push(p);
      prev = p.key;
    }
    Q.i = 0; Q.mistakes = 0; Q.ms = 0; Q.done = []; Q.introSaid = 0;
    $('#end-overlay').hidden = true;
    show('game');
    renderPuzzle();
  }

  function renderProgress() {
    $('#progress').innerHTML = Array.from({ length: ROUND_N }, (_, n) =>
      `<span class="${n < Q.i ? 'done' : (n === Q.i ? 'now' : '')}"></span>`).join('');
  }

  function updateHint() {
    $('#hint').textContent = data.settings.hints ? pick(HINTS) : '';
  }

  function renderPuzzle() {
    const p = Q.list[Q.i];
    Q.p = p; Q.busy = false; Q.misses = 0; Q.selected = -1; Q.t0 = now();
    holeEl.className = 'hole';
    trayEl.innerHTML = '';
    renderProgress();
    updateHint();
    if (p.type === 'compose') renderCompose(p);
    else renderSingle(p);
    if (Q.introSaid < 2) {
      Q.introSaid += 1;
      const [k, t] = INTRO[Q.level];
      later(350, () => Sound.say(k, t));
    }
  }

  const ROT_ICON = '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="#6F7A8C" stroke-width="2.6" stroke-linecap="round"/><path d="M19.5 3.5v5h-5" fill="none" stroke="#6F7A8C" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function makeCard(piece, size, idx, rotatable) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card';
    b.dataset.idx = String(idx);
    b.setAttribute('aria-label', 'ピース');
    const w = document.createElement('div');
    w.className = 'pwrap';
    w.style.width = `${size}px`;
    w.style.height = `${size}px`;
    w.style.transform = `rotate(${piece.rot}deg)`;
    w.innerHTML = svgBox(shapeSVG(piece.key, { mirror: piece.mirror, color: piece.color }));
    b.appendChild(w);
    if (rotatable) {
      const badge = document.createElement('div');
      badge.className = 'rot-badge';
      badge.innerHTML = ROT_ICON;
      b.appendChild(badge);
    }
    b.addEventListener('pointerdown', onCardDown);
    b.addEventListener('pointermove', onCardMove);
    b.addEventListener('pointerup', onCardUp);
    b.addEventListener('pointercancel', onCardCancel);
    trayEl.appendChild(b);
    return b;
  }

  // レベル1・2・3・5：穴が1つ
  function renderSingle(p) {
    // 穴はピースより少し大きく描き、ピースは飛びながら穴の大きさまで大きくなる
    const stageH = window.innerHeight - 64 - (S + 52) - 30;
    const HS = Math.round(Math.max(S, Math.min(S * 1.35, stageH * 0.92)));
    holeEl.innerHTML = `<svg viewBox="0 0 100 100" width="${HS}" height="${HS}" aria-label="あな">${shapeSVG(p.hole.key, { rot: p.hole.rot, mode: 'hole' })}</svg>`;
    holeEl.onpointerdown = null;
    if (p.type === 'rotate') makeCard(p.piece, S, 0, true);
    else p.choices.forEach((c, i) => makeCard(c, S, i, false));
  }

  // レベル4：穴がいくつかのパーツでできている
  function renderCompose(p) {
    const bb = compBBox(p.comp);
    const pad = 4;
    const stageH = window.innerHeight - 64 - (S + 52) - 30;
    K = Math.min(S / 100, stageH / (bb.h + pad * 2), (window.innerWidth * 0.6) / (bb.w + pad * 2));
    p.bb = { x: bb.x - pad, y: bb.y - pad, w: bb.w + pad * 2, h: bb.h + pad * 2 };
    const parts = p.comp.parts.map((part, j) => {
      const f = p.filled[j];
      const body = f ? shapeSVG(part.s, { rot: part.r, color: f.color }) : shapeSVG(part.s, { rot: part.r, mode: 'hole' });
      return `<g class="slot" data-slot="${j}" transform="translate(${part.x} ${part.y})">${body}</g>`;
    }).join('');
    holeEl.innerHTML = `<svg viewBox="${p.bb.x} ${p.bb.y} ${p.bb.w} ${p.bb.h}" width="${p.bb.w * K}" height="${p.bb.h * K}" aria-label="あな">${parts}</svg>`;
    holeEl.onpointerdown = null;
    p.pieces.forEach((pc, i) => { const c = makeCard(pc, 100 * K, i, true); if (pc.placed) c.classList.add('used'); });
  }

  function cardOf(idx) { return trayEl.querySelector(`.card[data-idx="${idx}"]`); }

  function holeTargetRect(slot) {
    const svg = holeEl.querySelector('svg');
    const r = svg.getBoundingClientRect();
    if (slot == null) return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width };
    const p = Q.p, part = p.comp.parts[slot];
    const left = r.left + (part.x - p.bb.x) * K, topY = r.top + (part.y - p.bb.y) * K;
    return { cx: left + 50 * K, cy: topY + 50 * K, w: 100 * K };
  }

  // ---------- ピースの動き ----------
  const tf = (dx, dy, r, s) => `translate(${dx}px, ${dy}px) rotate(${r}deg) scale(${s})`;
  const shortest = (a, b) => mod(b - a + 180, 360) - 180;

  function animateEl(el, from, to, ms) {
    if (el.animate) {
      const a = el.animate([{ transform: from }, { transform: to }], { duration: ms, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
      return a.finished.then(() => { el.style.transform = to; a.cancel(); });
    }
    el.style.transform = to;
    return Promise.resolve();
  }

  function burstAt(cx, cy, size) {
    for (let n = 0; n < 12; n++) {
      const s = document.createElement('div');
      s.className = 'star';
      const ang = (Math.PI * 2 * n) / 12 + Math.random() * 0.3;
      const dist = size * (0.6 + Math.random() * 0.4);
      s.style.left = `${cx}px`;
      s.style.top = `${cy}px`;
      s.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      s.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1200);
    }
  }

  function missFeedback(card) {
    Q.misses += 1;
    Q.mistakes += 1;
    Sound.fx('miss');
    if (card) {
      card.classList.remove('nudge');
      void card.offsetWidth;
      card.classList.add('nudge');
    }
  }

  function pieceOf(idx) {
    const p = Q.p;
    if (!p) return null;
    if (p.type === 'choose') return p.choices[idx];
    if (p.type === 'rotate') return p.piece;
    return p.pieces[idx];
  }

  // ---------- ドラッグ ----------
  // 指で8px以上動かすとドラッグ。動かさずに離すとタップ（レベル3・4は回す）。
  const DRAG_START_PX = 8;
  let D = null;

  function onCardDown(e) {
    e.preventDefault();
    if (Q.busy || currentScreen !== 'game' || D) return;
    const card = e.currentTarget;
    const idx = Number(card.dataset.idx);
    const piece = pieceOf(idx);
    if (!piece || piece.placed) return;
    try { card.setPointerCapture(e.pointerId); } catch (err) { /* 未対応の端末 */ }
    const rect = card.querySelector('.pwrap').getBoundingClientRect();
    D = { card, idx, piece, pid: e.pointerId, sx: e.clientX, sy: e.clientY, rect, el: null };
  }

  function beginDrag() {
    const pw = D.card.querySelector('.pwrap');
    const el = document.createElement('div');
    el.className = 'flyer dragging';
    el.innerHTML = pw.innerHTML;
    const r = D.rect;
    Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    el.style.transform = tf(0, 0, D.piece.rot, 1);
    $('#fly-layer').appendChild(el);
    D.el = el;
    D.card.classList.add('lifted');
    Sound.fx('lift');
  }

  function onCardMove(e) {
    if (!D || e.pointerId !== D.pid) return;
    const mx = e.clientX - D.sx, my = e.clientY - D.sy;
    if (!D.el) {
      if (Math.hypot(mx, my) < DRAG_START_PX) return;
      beginDrag();
    }
    const z = dropZone(e.clientX, e.clientY);
    // 穴に近づくと、穴の大きさにふくらんで「入りそう」を見せる
    const s = z ? z.w / D.rect.width : 1.06;
    D.el.style.transform = tf(mx, my, D.piece.rot, s);
    markZone(z);
  }

  function onCardUp(e) {
    if (!D || e.pointerId !== D.pid) return;
    const d = D;
    D = null;
    markZone(null);
    if (!d.el) { onCardTap(d); return; }
    const z = dropZone(e.clientX, e.clientY);
    if (z) dropOn(d, z); else returnHome(d);
  }

  function onCardCancel(e) {
    if (!D || e.pointerId !== D.pid) return;
    const d = D;
    D = null;
    markZone(null);
    if (d.el) returnHome(d);
  }

  // 指の位置が穴（レベル4はどのパーツ）の上か。少し外れていても入る扱いにする。
  function dropZone(x, y) {
    const svg = holeEl.querySelector('svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const p = Q.p;
    if (p.type !== 'compose') {
      const m = r.width * 0.35;
      if (x < r.left - m || x > r.right + m || y < r.top - m || y > r.bottom + m) return null;
      return Object.assign(holeTargetRect(null), { slot: null });
    }
    const m = 25 * K;
    if (x < r.left - m || x > r.right + m || y < r.top - m || y > r.bottom + m) return null;
    let slot = -1;
    const hit = document.elementFromPoint(x, y);
    const g = hit && hit.closest ? hit.closest('.slot') : null;
    if (g && !p.filled[Number(g.dataset.slot)]) slot = Number(g.dataset.slot);
    if (slot < 0) {
      let best = Infinity;
      p.comp.parts.forEach((part, j) => {
        if (p.filled[j]) return;
        const t = holeTargetRect(j);
        const dd = Math.hypot(t.cx - x, t.cy - y);
        if (dd < best) { best = dd; slot = j; }
      });
    }
    if (slot < 0) return null;
    return Object.assign(holeTargetRect(slot), { slot });
  }

  function markZone(z) {
    holeEl.classList.toggle('near', !!z && Q.p.type !== 'compose');
    holeEl.querySelectorAll('.slot').forEach((g) => g.classList.toggle('hover', !!z && Number(g.dataset.slot) === z.slot));
  }

  function returnHome(d) {
    Q.busy = true;
    animateEl(d.el, d.el.style.transform, tf(0, 0, d.piece.rot, 1), 350).then(() => {
      d.el.remove();
      d.card.classList.remove('lifted');
      Q.busy = false;
    });
  }

  function onCardTap(d) {
    const p = Q.p;
    if (p.type === 'choose') {
      // 選ぶレベルでは、タップではなく運んで入れる
      d.card.classList.remove('nudge');
      void d.card.offsetWidth;
      d.card.classList.add('nudge');
      Sound.say('hakonde', 'ゆびで あなまで はこんでね');
      return;
    }
    d.piece.rot += 90;
    d.card.querySelector('.pwrap').style.transform = `rotate(${d.piece.rot}deg)`;
    Sound.fx('turn');
  }

  function dropOn(d, z) {
    Q.busy = true;
    const p = Q.p, pc = d.piece;
    let r1 = pc.rot, ok;
    if (p.type === 'choose') {
      // レベル1・2・5：選んだピースは穴の向きまで回りながら入る
      r1 = pc.rot + shortest(pc.rot, p.hole.rot);
      ok = !!pc.correct;
    } else if (p.type === 'rotate') {
      ok = sameOrient(pc.key, pc.rot, p.hole.rot);
    } else {
      const part = p.comp.parts[z.slot];
      ok = pc.key === part.s && sameOrient(pc.key, pc.rot, part.r);
    }
    const r = d.rect;
    const to = tf(z.cx - (r.left + r.width / 2), z.cy - (r.top + r.height / 2), r1, z.w / r.width);
    Sound.fx('fly');
    animateEl(d.el, d.el.style.transform, to, 380).then(() => {
      if (ok) {
        d.el.remove();
        d.card.classList.remove('lifted');
        d.card.classList.add('used');
        if (p.type === 'compose') {
          pc.placed = true;
          p.filled[z.slot] = { color: pc.color };
          Q.misses = 0;
          renderComposeHole(p);
          Sound.fx('fit');
          if (p.filled.every(Boolean)) solvedCompose();
          else Q.busy = false;
        } else {
          solvedSingle(pc.color);
        }
        return;
      }
      // 合わない：重なった様子を見せてからトレイに戻る（×や減点はなし）
      missFeedback(d.card);
      d.el.classList.add('ghost');
      later(750, () => animateEl(d.el, to, tf(0, 0, pc.rot, 1), 450).then(() => {
        d.el.remove();
        d.card.classList.remove('lifted');
        Q.busy = false;
        afterMiss(d);
      }));
    });
  }

  function afterMiss(d) {
    const p = Q.p;
    if (p.type === 'choose') {
      if (Q.misses >= 2) cardOf(p.choices.findIndex((x) => x.correct)).classList.add('glow');
    } else if (p.type === 'rotate') {
      if (Q.misses >= 2) helpRotate(d.card, p.piece, p.hole.rot, null);
      else { holeEl.classList.remove('blink'); void holeEl.offsetWidth; holeEl.classList.add('blink'); Sound.say('yokumite', 'あなの かたちを よく みてね'); }
    } else if (Q.misses >= 2) {
      const j = p.comp.parts.findIndex((q, n) => !p.filled[n] && q.s === d.piece.key);
      if (j >= 0) helpRotate(d.card, d.piece, p.comp.parts[j].r, j);
    }
  }

  function renderComposeHole(p) {
    const svg = holeEl.querySelector('svg');
    p.comp.parts.forEach((part, j) => {
      const g = svg.querySelector(`.slot[data-slot="${j}"]`);
      const f = p.filled[j];
      g.innerHTML = f ? shapeSVG(part.s, { rot: part.r, color: f.color }) : shapeSVG(part.s, { rot: part.r, mode: 'hole' });
      g.classList.remove('hover');
    });
  }

  // 2回まちがえたときの手助け：正しい向きまで回して見せ、入れる場所を点滅させる
  function helpRotate(card, pc, targetRot, slot) {
    let steps = 0;
    while (!sameOrient(pc.key, pc.rot, targetRot) && steps < 4) {
      pc.rot += 90;
      steps += 1;
    }
    card.querySelector('.pwrap').style.transform = `rotate(${pc.rot}deg)`;
    card.classList.add('glow');
    if (steps) Sound.fx('turn');
    later(500, () => {
      if (slot == null) {
        holeEl.classList.remove('blink'); void holeEl.offsetWidth; holeEl.classList.add('blink');
      } else {
        const g = holeEl.querySelector(`.slot[data-slot="${slot}"]`);
        if (g) { g.style.animation = 'none'; void g.getBoundingClientRect(); g.style.animation = 'blink 0.5s ease-in-out 3'; }
      }
      Sound.say('koko', 'ここまで はこんでみよう');
    });
  }

  function finishPuzzle(miniSVG) {
    Q.ms += now() - Q.t0;
    Q.done.push(miniSVG);
    Q.i += 1;
    renderProgress();
    later(1500, () => {
      if (Q.i >= ROUND_N) endRound();
      else renderPuzzle();
    });
  }

  function solvedSingle(color) {
    const p = Q.p;
    const svg = holeEl.querySelector('svg');
    svg.insertAdjacentHTML('beforeend', shapeSVG(p.hole.key, { rot: p.hole.rot, color }));
    holeEl.classList.add('done');
    Sound.fx('fit');
    const r = svg.getBoundingClientRect();
    burstAt(r.left + r.width / 2, r.top + r.height / 2, r.width);
    const nm = nameOf(p.hole.key);
    later(250, () => Sound.say(nm ? `ok_${p.hole.key}` : 'pittari', nm ? `ぴったり！ ${nm}` : 'ぴったり！'));
    finishPuzzle(svgBox(shapeSVG(p.hole.key, { rot: p.hole.rot, color })));
  }

  function solvedCompose() {
    const p = Q.p;
    holeEl.classList.add('done');
    const svg = holeEl.querySelector('svg');
    const r = svg.getBoundingClientRect();
    burstAt(r.left + r.width / 2, r.top + r.height / 2, Math.max(r.width, r.height));
    later(250, () => Sound.say(`dekita_${p.comp.name}`, `できた！ ${p.comp.name}`));
    const s = Math.max(p.bb.w, p.bb.h);
    const ox = p.bb.x - (s - p.bb.w) / 2, oy = p.bb.y - (s - p.bb.h) / 2;
    const mini = `<svg viewBox="${ox} ${oy} ${s} ${s}" aria-hidden="true">${p.comp.parts.map((part, j) =>
      `<g transform="translate(${part.x} ${part.y})">${shapeSVG(part.s, { rot: part.r, color: p.filled[j].color })}</g>`).join('')}</svg>`;
    finishPuzzle(mini);
  }

  function endRound() {
    const rec = todayRec(true);
    rec.rounds += 1;
    rec.puzzles += ROUND_N;
    rec.mistakes += Q.mistakes;
    rec.ms += Q.ms;
    data.rounds.push({ ts: Date.now(), level: Q.level, mistakes: Q.mistakes, ms: Math.round(Q.ms) });
    if (data.rounds.length > 300) data.rounds = data.rounds.slice(-300);
    saveData();

    const limited = limitReached();
    $('#end-shapes').innerHTML = Q.done.map((s, n) => s.replace('<svg ', `<svg style="animation-delay:${n * 0.08}s" `)).join('');
    $('#btn-again').hidden = limited;
    $('#end-limit').hidden = !limited;
    $('#end-overlay').hidden = false;
    Sound.fx('end');
    later(700, () => (limited ? Sound.say('mataashita', 'また あしたね') : Sound.say('yattane', 'やったね！')));
  }

  function quitToTitle() {
    clearTimers();
    Q.busy = false;
    $('#end-overlay').hidden = true;
    $('#fly-layer').innerHTML = '';
    D = null;
    show('title');
  }

  $('#btn-start').addEventListener('click', () => {
    Sound.unlock();
    Sound.fx('tap');
    if (limitReached()) { renderTitle(); return; }
    newRound();
  });
  $('#btn-again').addEventListener('click', () => {
    Sound.fx('tap');
    if (limitReached()) { quitToTitle(); return; }
    newRound();
  });
  $('#btn-quit').addEventListener('click', () => { Sound.fx('tap'); quitToTitle(); });
  window.addEventListener('resize', () => {
    if (currentScreen !== 'game' || Q.busy || !Q.p) return;
    computeSizes();
    trayEl.innerHTML = '';
    if (Q.p.type === 'compose') renderCompose(Q.p); else renderSingle(Q.p);
  });

  // ---------- 保護者ゲート ----------
  const gear = $('#gear');
  let gearTimer = null;
  function gearCancel() { clearTimeout(gearTimer); gearTimer = null; gear.classList.remove('pressing'); }
  gear.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    gearCancel();
    void gear.offsetWidth;
    gear.classList.add('pressing');
    gearTimer = setTimeout(() => { gearCancel(); Sound.unlock(); openParent(); }, 2000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => gear.addEventListener(ev, gearCancel));

  // ---------- 保護者画面 ----------
  function openParent() {
    clearTimers();
    Q.busy = false;
    $('#end-overlay').hidden = true;
    $('#fly-layer').innerHTML = '';
    D = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    renderParent();
    show('parent');
  }

  function renderParent() {
    const s = data.settings;
    document.querySelectorAll('#level-seg button').forEach((b) => b.classList.toggle('on', Number(b.dataset.level) === Number(s.level)));
    $('#set-hints').checked = !!s.hints;
    const sel = $('#set-limit');
    if (!sel.options.length) {
      for (let n = 1; n <= 10; n++) sel.add(new Option(`${n}回`, String(n)));
      sel.add(new Option('上限なし', '0'));
    }
    sel.value = String(s.limit);
    const t = todayRec(false);
    $('#today-count').textContent = `今日：${t.rounds}回` + (Number(s.limit) > 0 ? `（上限 ${s.limit}）` : '');

    const sug = $('#level-suggest');
    const recent = data.rounds.filter((r) => r.level === Number(s.level)).slice(-3);
    const ready = s.level < 5 && recent.length === 3 && recent.reduce((a, r) => a + r.mistakes, 0) <= 2;
    sug.hidden = !ready;
    if (ready) sug.textContent = `直近3回でまちがいがほとんどありません。レベル${Number(s.level) + 1}を試してもよさそうです。`;

    renderRecords();
    renderCheckChart();
    $('#version').textContent = `バージョン ${APP_VERSION}`;
  }

  function renderRecords() {
    const body = $('#rec-body');
    body.innerHTML = '';
    const keys = Object.keys(data.days).sort().reverse().slice(0, 14);
    if (!keys.length) {
      body.innerHTML = '<tr><td class="empty" colspan="4">まだ記録がありません</td></tr>';
      return;
    }
    keys.forEach((k) => {
      const r = data.days[k];
      const [, m, d] = k.split('-');
      const avg = r.puzzles ? `${(r.ms / r.puzzles / 1000).toFixed(1)} 秒` : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${Number(m)}/${Number(d)}</td><td>${r.rounds}</td><td>${r.mistakes}</td><td>${avg}</td>`;
      body.appendChild(tr);
    });
  }

  function renderCheckChart() {
    const box = $('#check-chart');
    const cs = data.checks.slice(-12);
    if (!cs.length) { box.innerHTML = '<p class="empty">まだチェックの記録がありません</p>'; return; }
    const W = 520, H = 190, L = 44, R = 16, T = 28, B = 34;
    const x = (n) => (cs.length === 1 ? (L + W - R) / 2 : L + (n * (W - L - R)) / (cs.length - 1));
    const y = (v) => T + (1 - v / 100) * (H - T - B);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="くるくるチェックの正答率の推移">`;
    svg += `<text x="${L}" y="14" font-size="12" fill="#666">正答率（%）　点線は当てずっぽうの50%</text>`;
    [0, 25, 50, 75, 100].forEach((v) => {
      svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 50 ? '#B8B2A8' : '#EEE'}" ${v === 50 ? 'stroke-dasharray="5 4"' : ''}/>`;
      svg += `<text x="${L - 8}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#888">${v}</text>`;
    });
    if (cs.length > 1) svg += `<polyline points="${cs.map((c, n) => `${x(n)},${y(c.acc)}`).join(' ')}" fill="none" stroke="#2B3A55" stroke-width="2"/>`;
    cs.forEach((c, n) => {
      const [, m, d] = c.date.split('-');
      svg += `<circle cx="${x(n)}" cy="${y(c.acc)}" r="4.5" fill="#FF8A65" stroke="#fff" stroke-width="1.5"/>`;
      svg += `<text x="${x(n)}" y="${y(c.acc) - 9}" font-size="11" text-anchor="middle" fill="#333">${Math.round(c.acc)}</text>`;
      svg += `<text x="${x(n)}" y="${H - 12}" font-size="11" text-anchor="middle" fill="#888">${Number(m)}/${Number(d)}</text>`;
    });
    box.innerHTML = svg + '</svg>';
  }

  $('#level-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-level]');
    if (!b) return;
    data.settings.level = Number(b.dataset.level);
    saveData();
    renderParent();
  });
  $('#set-hints').addEventListener('change', (e) => { data.settings.hints = e.target.checked; saveData(); });
  $('#set-limit').addEventListener('change', (e) => { data.settings.limit = Number(e.target.value); saveData(); renderParent(); });
  $('#btn-reset-today').addEventListener('click', () => {
    const k = dateKey();
    if (data.days[k]) data.days[k].rounds = 0;
    saveData();
    renderParent();
  });
  $('#btn-clear').addEventListener('click', () => {
    if (!window.confirm('パズルとチェックの記録をすべて消します。よろしいですか？（設定は残ります）')) return;
    data.days = {}; data.rounds = []; data.checks = [];
    saveData();
    renderParent();
  });
  $('#btn-guide').addEventListener('click', () => { $('#guide-overlay').hidden = false; });
  $('#parent-close').addEventListener('click', () => show('title'));
  $('#guide-ok').addEventListener('click', () => {
    $('#guide-overlay').hidden = true;
    if (!data.settings.guideSeen) { data.settings.guideSeen = true; saveData(); }
  });

  // ---------- くるくる チェック ----------
  const C = { items: [], i: 0, correct: 0, ms: 0, t0: 0, accept: false };
  function startCheck() {
    computeSizes();
    C.items = Array.from({ length: CHECK_N }, () => {
      const key = `poly:${pick(POLY_KEYS)}`;
      const sr = pick(ROTS);
      const opts = shuffle([
        { rot: sr + pick([90, 180, 270]), mirror: false, correct: true },
        { rot: pick(ROTS), mirror: true, correct: false },
      ]);
      return { key, sr, opts };
    });
    C.i = 0; C.correct = 0; C.ms = 0;
    show('check');
    nextCheck();
  }
  function nextCheck() {
    $('#check-msg').textContent = '';
    if (C.i >= CHECK_N) { finishCheck(); return; }
    const it = C.items[C.i];
    $('#check-progress').innerHTML = Array.from({ length: CHECK_N }, (_, n) => `<span class="${n < C.i ? 'done' : (n === C.i ? 'now' : '')}"></span>`).join('');
    $('#check-sample').innerHTML = svgBox(shapeSVG(it.key, { rot: it.sr, color: COLORS[2] }));
    const box = $('#check-choices');
    box.innerHTML = '';
    it.opts.forEach((o, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card';
      b.dataset.n = String(n);
      b.innerHTML = `<div class="pwrap" style="transform: rotate(${o.rot}deg)">${svgBox(shapeSVG(it.key, { mirror: o.mirror, color: COLORS[2] }))}</div>`;
      b.addEventListener('pointerdown', onCheckTap);
      box.appendChild(b);
    });
    C.accept = false;
    if (C.i === 0) Sound.say('checkq', 'みほんと おなじ かたちは どっち？').then(() => { C.accept = true; C.t0 = now(); });
    setTimeout(() => { if (!C.accept) { C.accept = true; C.t0 = now(); } }, C.i === 0 ? 3500 : 300);
  }
  function onCheckTap(e) {
    e.preventDefault();
    if (!C.accept || currentScreen !== 'check') return;
    C.accept = false;
    const it = C.items[C.i];
    if (it.opts[Number(e.currentTarget.dataset.n)].correct) C.correct += 1;
    C.ms += now() - C.t0;
    Sound.fx('tap');
    $('#check-msg').textContent = 'ありがとう！';
    Sound.say('thanks', 'ありがとう！');
    C.i += 1;
    setTimeout(nextCheck, 1100);
  }
  function finishCheck() {
    data.checks.push({ ts: Date.now(), date: dateKey(), n: CHECK_N, correct: C.correct, acc: Math.round((C.correct / CHECK_N) * 1000) / 10, ms: Math.round(C.ms / CHECK_N) });
    if (data.checks.length > 100) data.checks = data.checks.slice(-100);
    saveData();
    $('#check-sample').innerHTML = '';
    $('#check-choices').innerHTML = '';
    $('#check-msg').textContent = 'おわり！';
    Sound.fx('end');
    setTimeout(() => { renderParent(); show('parent'); }, 1400);
  }
  $('#btn-check').addEventListener('click', () => { Sound.unlock(); startCheck(); });
  $('#check-close').addEventListener('click', () => { C.i = CHECK_N + 1; C.accept = false; renderParent(); show('parent'); });

  // ---------- 誤操作防止 ----------
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (currentScreen !== 'parent' && !e.target.closest('.guide-card')) e.preventDefault();
  }, { passive: false });

  // ---------- オフライン（Service Worker） ----------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      if (currentScreen === 'title') location.reload();
      else pendingReload = true;
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => { /* オフライン化なしでも動く */ });
    });
  }

  // ---------- 起動 ----------
  show('title');
  if (!data.settings.guideSeen) $('#guide-overlay').hidden = false;
})();
