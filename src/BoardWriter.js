/* BoardWriter core — framework-free. Used by ChalkBoard.jsx; can be used on any <canvas>. */

/* BoardWriter — chalk-style handwriting, LaTeX and shapes on a fixed canvas, aware of what is already drawn.
   Requires MathJax 3 (tex-svg) for math; text works without it.
     const b = new BoardWriter(canvas, { size: 36, board: 'green', chalk: true, measure: hiddenDiv });
     b.at(200, 300);                          // jump the pen; await b.move(x, y) glides it
     await b.write('Solve $x^2 = 4$');        // text with inline math, then newline
     await b.math('x = \\pm 2');              // display equation on its own line
     b.mark('t'); ... await b.back('t');      // save a writing position and return to it
     await b.triangle(x1,y1,x2,y2,x3,y3); await b.circle(cx,cy,r); await b.angle(x,y,r,a1,a2,'\\theta');
     await b.label(x, y, 'A');                // write at a point, cursor unchanged
     b.avoid = true;                          // text/math step down past existing chalk instead of overwriting
     b.isFree(x, y, w, h); b.findFree(w, h);  // occupancy queries for placing figures
     await b.run(scriptText); await b.exec([{op:'at',x:0,y:0}, ...]); */
export default class BoardWriter {
  static CHALK = { white: '#f3f1e6', yellow: '#f6e58d', blue: '#a7d3ec', pink: '#f4b6c2', green: '#b9e4b4' };
  static BOARDS = { green: '#2e4d3f', black: '#1e2124', plain: '#000000' };

  constructor(canvas, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.font = opts.font || 'Kalam, cursive';
    this.pen = { size: opts.size || 36, color: BoardWriter.CHALK.white };
    this.speed = opts.speed || 1;
    this.margin = opts.margin || 60;
    this.measure = opts.measure || document.body;
    this.chalk = opts.chalk !== false;
    this.avoid = opts.avoid !== false;
    this.cell = opts.cell || 12;                        // occupancy grid resolution in px
    this.cols = Math.ceil(canvas.width / this.cell); this.rows = Math.ceil(canvas.height / this.cell);
    this.marks = {};
    this._noise = this._makeNoise();
    this.setBoard(opts.board || 'green');
    if (opts.color) this.color(opts.color);
    this.stopped = false;
  }

  // ---- occupancy map: which parts of the board already have chalk ----
  _occupy(x, y, w, h) {
    const c0 = Math.max(0, Math.floor(x / this.cell)), c1 = Math.min(this.cols - 1, Math.floor((x + w) / this.cell));
    const r0 = Math.max(0, Math.floor(y / this.cell)), r1 = Math.min(this.rows - 1, Math.floor((y + h) / this.cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.occ[r * this.cols + c] = 1;
  }
  isFree(x, y, w, h) {
    if (x < 0 || y < 0 || x + w > this.c.width || y + h > this.c.height) return false;
    const c0 = Math.floor(x / this.cell), c1 = Math.min(this.cols - 1, Math.floor((x + w) / this.cell));
    const r0 = Math.floor(y / this.cell), r1 = Math.min(this.rows - 1, Math.floor((y + h) / this.cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.occ[r * this.cols + c]) return false;
    return true;
  }
  findFree(w, h, opts = {}) {                        // first empty rectangle scanning rows then columns
    const step = opts.step || this.cell * 2, m = opts.margin || this.margin;
    for (let y = m; y + h <= this.c.height - m; y += step)
      for (let x = m; x + w <= this.c.width - m; x += step)
        if (this.isFree(x - 8, y - 8, w + 16, h + 16)) return { x, y };
    return null;
  }
  // Text about to be written on the current line: step down until the line is clear.
  _clearLine(w) {
    if (!this.avoid) return;
    const s = this.pen.size; let tries = 0;
    while (!this.isFree(this.x, this.y - s * 0.95, Math.min(w, this.right - this.x), s * 1.25) && tries++ < 60) {
      if (this.y + s * 1.5 > this.c.height - this.margin * 0.5) break;
      this.newline();
    }
  }

  // ---- board & chalk texture ----
  setBoard(name) {
    this.board = name;
    if (name === 'plain') this.chalk = false;
    this.bg = BoardWriter.BOARDS[name] || name;
    this._paintBoard();
    this.clear();
  }
  _paintBoard() {
    const w = this.c.width, h = this.c.height;
    const b = document.createElement('canvas'); b.width = w; b.height = h;
    const g = b.getContext('2d');
    g.fillStyle = this.bg; g.fillRect(0, 0, w, h);
    if (this.board !== 'plain') {
      const tile = document.createElement('canvas'); tile.width = tile.height = 512;
      const tg = tile.getContext('2d'), d = tg.createImageData(512, 512), p = d.data, base = this._hex(this.bg);
      for (let i = 0; i < p.length; i += 4) {
        const v = (Math.random() - 0.5) * 22;
        p[i] = base[0] + v; p[i + 1] = base[1] + v; p[i + 2] = base[2] + v; p[i + 3] = 255;
      }
      tg.putImageData(d, 0, 0);
      g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 10; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = 120 + Math.random() * 260;
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(255,255,255,0.06)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    }
    this._boardImg = b;
  }
  _hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  _makeNoise() {
    const n = document.createElement('canvas'); n.width = n.height = 256;
    const c = n.getContext('2d'), d = c.createImageData(256, 256), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const v = Math.random();
      p[i] = p[i + 1] = p[i + 2] = 255;
      p[i + 3] = v < 0.5 ? 0 : Math.floor(((v - 0.5) / 0.5) * 220);
    }
    c.putImageData(d, 0, 0);
    return c.createPattern(n, 'repeat');
  }
  _chalkify(off) {
    if (!this.chalk) return off;
    const g = off.getContext('2d');
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.translate(Math.random() * 256, Math.random() * 256);
    g.fillStyle = this._noise;
    g.fillRect(-256, -256, off.width + 512, off.height + 512);
    g.restore();
    return off;
  }
  // Draw off at (dx,dy), optionally inside a clip path built by clip() (which may transform the canvas).
  _stamp(off, dx, dy, clip) {
    const ctx = this.ctx;
    ctx.save();
    if (clip) { ctx.save(); ctx.beginPath(); clip(); ctx.restore(); ctx.clip(); }
    if (this.chalk) {
      ctx.globalAlpha = 0.22; ctx.filter = 'blur(2px)';
      ctx.drawImage(off, dx, dy);
      ctx.globalAlpha = 1; ctx.filter = 'none';
    }
    ctx.drawImage(off, dx, dy);
    ctx.restore();
  }

  // ---- pen state ----
  clear() {
    this.ctx.drawImage(this._boardImg, 0, 0);
    this.occ = new Uint8Array(this.cols * this.rows);
    this.x = this.margin; this.y = this.margin + this.pen.size;
    this.left = this.margin; this.right = this.c.width - this.margin; this.last = null;
    this.tip = { x: this.x, y: this.y };
  }
  color(v) { this.pen.color = BoardWriter.CHALK[v] || v; }
  size(v) { this.pen.size = v; }
  at(x, y) { this.x = x; this.y = y; this.left = x; this.tip = { x, y }; }
  wrap(x2) { this.right = x2; }
  stop() { this.stopped = true; }
  pause(ms) { return this._wait(ms / this.speed); }
  newline(extra = 0) { this.x = this.left; this.y += this.pen.size * 1.5 + extra; this.tip = { x: this.x, y: this.y }; }
  _wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  _frame() { return new Promise(r => requestAnimationFrame(r)); }
  _fontStr() { return `${this.pen.size}px ${this.font}`; }
  async _sweep(dur, draw) {
    const t0 = performance.now(); let prev = 0;
    while (prev < 1) {
      await this._frame(); if (this.stopped) return;
      const t = Math.min(1, (performance.now() - t0) / dur);
      draw(prev, t); prev = t;
    }
  }

  // ---- pen travel and saved positions (tip = where the chalk is; x,y = where text goes next) ----
  async move(x, y) { await this._glide(x, y); this.at(x, y); }
  async _glide(x, y) {
    const x0 = this.tip.x, y0 = this.tip.y, d = Math.hypot(x - x0, y - y0);
    if (d < 4) { this.tip = { x, y }; return; }
    await this._sweep(Math.min(700, 150 + d * 0.35) / this.speed, (p, t) => {
      const e = t * t * (3 - 2 * t); this.tip = { x: x0 + (x - x0) * e, y: y0 + (y - y0) * e };
    });
    this.tip = { x, y };
  }
  mark(name = '_') { this.marks[name] = { x: this.x, y: this.y, left: this.left, right: this.right, size: this.pen.size }; }
  async back(name = '_') {
    const m = this.marks[name]; if (!m) return;
    await this._glide(m.x, m.y);
    this.x = m.x; this.y = m.y; this.left = m.left; this.right = m.right; this.pen.size = m.size;
  }
  async label(x, y, text) {
    const save = { x: this.x, y: this.y, left: this.left, right: this.right }, avoid = this.avoid;
    await this._glide(x, y); this.at(x, y); this.wrap(this.c.width); this.avoid = false;
    await this.write(text, { newline: false });
    Object.assign(this, save); this.avoid = avoid;
  }

  // ---- text ----
  async write(text, opts = {}) {
    this.stopped = false;
    const ctx = this.ctx; ctx.font = this._fontStr();
    const parts = text.split(/(\$[^$]+\$)/).filter(Boolean);
    // estimate the first line's width so we can find a clear line before starting
    let est = 0; for (const p of parts) est += p.startsWith('$') ? this.pen.size * p.length * 0.45 : ctx.measureText(p).width;
    this._clearLine(Math.min(est, this.right - this.x));
    const startX = this.x;
    for (const part of parts) {
      if (part.startsWith('$') && part.endsWith('$')) { await this._mathInline(part.slice(1, -1)); continue; }
      for (const word of part.split(/(\s+)/)) {
        if (!word) continue;
        ctx.font = this._fontStr();
        const w = ctx.measureText(word).width;
        if (!/^\s+$/.test(word)) {
          if (this.x + w > this.right && this.x > this.left) { this.newline(); this._clearLine(w); }
          else if (this.avoid && !this.isFree(this.x, this.y - this.pen.size * 0.95, w, this.pen.size * 1.25)) { this.newline(); this._clearLine(w); }
        }
        for (const ch of word) { if (this.stopped) return; await this._glyph(ch); }
      }
    }
    this.last = { x1: startX, y: this.y, x2: this.x };
    if (opts.newline !== false) this.newline();
  }

  async _glyph(ch) {
    this.ctx.font = this._fontStr();
    const w = this.ctx.measureText(ch).width, s = this.pen.size;
    if (/\s/.test(ch)) { this.x += w; await this._wait(40 / this.speed); return; }
    const pad = Math.ceil(s * 0.4);
    const off = document.createElement('canvas');
    off.width = Math.ceil(w) + pad * 2; off.height = Math.ceil(s * 1.6) + pad * 2;
    const g = off.getContext('2d');
    g.font = this._fontStr(); g.textBaseline = 'alphabetic'; g.fillStyle = this.pen.color;
    g.translate(pad, pad + s * 1.15 + (Math.random() - 0.5) * s * 0.04);
    g.rotate((Math.random() - 0.5) * 0.05);
    g.fillText(ch, 0, 0);
    this._chalkify(off);
    const dx = this.x - pad, dy = this.y - pad - s * 1.15;
    const dur = (55 + Math.random() * 30) * Math.max(1, w / (s * 0.5)) / this.speed;
    const x0 = this.x;
    await this._sweep(dur, (prev, t) => this._stamp(off, dx, dy, () =>
      this.ctx.rect(x0 + w * prev - 2, dy, w * (t - prev) + 4, off.height)));
    this._occupy(x0, this.y - s * 0.85, w, s * 1.1);
    this.x += w; this.tip = { x: this.x, y: this.y };
  }

  // ---- math (via MathJax SVG) ----
  async _renderTex(tex, px, display) {
    if (!window.MathJax || !MathJax.tex2svg) throw new Error('MathJax not loaded');
    if (MathJax.startup && MathJax.startup.promise) await MathJax.startup.promise;
    const svg = MathJax.tex2svg(tex, { display }).querySelector('svg');
    const [minX, minY, vw, vh] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const k = px / 1000;
    const w = vw * k, h = vh * k, ascent = -minY * k;
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.removeAttribute('style');
    svg.setAttribute('color', this.pen.color);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    this.measure.innerHTML = ''; this.measure.appendChild(svg);
    const root = svg.getBoundingClientRect();
    const glyphs = [];
    for (const el of svg.querySelectorAll('use, rect, path')) {
      if (el.closest('defs')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      glyphs.push({ x: r.left - root.left, y: r.top - root.top, w: r.width, h: r.height });
    }
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    this.measure.innerHTML = '';
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const pad = 6;
    const off = document.createElement('canvas');
    off.width = Math.ceil(w) + pad * 2; off.height = Math.ceil(h) + pad * 2;
    off.getContext('2d').drawImage(img, pad, pad, w, h);
    this._chalkify(off);
    return { off, pad, w, h, ascent, glyphs };
  }

  async _drawTex(r, x, y) {
    const top = y - r.ascent, dx = x - r.pad, dy = top - r.pad;
    for (const g of r.glyphs) {
      if (this.stopped) return;
      const dur = (60 + 40 * Math.min(1, g.w / this.pen.size)) / this.speed;
      await this._sweep(dur, (prev, t) => this._stamp(r.off, dx, dy, () =>
        this.ctx.rect(x + g.x + g.w * prev - 2, top + g.y - 3, g.w * (t - prev) + 4, g.h + 6)));
      this._occupy(x + g.x, top + g.y, g.w, g.h);
      this.tip = { x: x + g.x + g.w, y };
    }
  }

  async _mathInline(tex) {
    const r = await this._renderTex(tex, this.pen.size, false);
    if (this.x + r.w > this.right && this.x > this.left) { this.newline(); this._clearLine(r.w); }
    await this._drawTex(r, this.x, this.y);
    this.x += r.w + this.pen.size * 0.15;
  }

  async math(tex, opts = {}) {
    this.stopped = false;
    const px = opts.size || this.pen.size * 1.1;
    const r = await this._renderTex(tex, px, true);
    let y = this.y + Math.max(0, r.ascent - this.pen.size), tries = 0;
    while (this.avoid && !this.isFree(this.x, y - r.ascent, r.w, r.h) && tries++ < 60 && y + r.h < this.c.height) { this.newline(); y = this.y + Math.max(0, r.ascent - this.pen.size); }
    await this._drawTex(r, this.x, y);
    this.last = { x1: this.x, y: y + (r.h - r.ascent), x2: this.x + r.w };
    this.y = y;
    if (opts.newline !== false) this.newline(Math.max(0, r.h - r.ascent - this.pen.size * 0.3));
  }

  // ---- strokes ----
  _width(opts) { return (opts && opts.width) || Math.max(2, this.pen.size / 12); }
  async _strokePath(pts, opts = {}) {                // chalk a polyline progressively; pts = [[x,y],...]
    this.stopped = false;
    if (opts.closed) pts = pts.concat([pts[0]]);
    const width = this._width(opts), pad = Math.ceil(width * 3);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
    const off = document.createElement('canvas');
    off.width = Math.ceil(Math.max(...xs) - minX) + pad; off.height = Math.ceil(Math.max(...ys) - minY) + pad;
    const g = off.getContext('2d');
    g.strokeStyle = this.pen.color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] - minX, p[1] - minY) : g.moveTo(p[0] - minX, p[1] - minY)); g.stroke();
    this._chalkify(off);
    const segs = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]); segs.push({ a: pts[i-1], b: pts[i], s: total, L }); total += L; }
    if (!total) return;
    await this._glide(pts[0][0], pts[0][1]);
    await this._sweep(total / (0.9 * this.speed), (prev, t) => {
      const from = prev * total, to = t * total;
      for (const sg of segs) {
        const s0 = Math.max(from, sg.s), s1 = Math.min(to, sg.s + sg.L);
        if (s1 <= s0) continue;
        const ang = Math.atan2(sg.b[1] - sg.a[1], sg.b[0] - sg.a[0]);
        this._stamp(off, minX, minY, () => {
          this.ctx.translate(sg.a[0], sg.a[1]); this.ctx.rotate(ang);
          this.ctx.rect(s0 - sg.s - 2, -pad, s1 - s0 + 4, pad * 2);
        });
        const k = (s1 - sg.s) / sg.L; this.tip = { x: sg.a[0] + (sg.b[0] - sg.a[0]) * k, y: sg.a[1] + (sg.b[1] - sg.a[1]) * k };
      }
    });
    // mark occupancy along each segment (thin strips, not the whole bounding box)
    for (const sg of segs) {
      const n = Math.max(1, Math.ceil(sg.L / this.cell));
      for (let i = 0; i <= n; i++) { const k = i / n; this._occupy(sg.a[0] + (sg.b[0] - sg.a[0]) * k - width, sg.a[1] + (sg.b[1] - sg.a[1]) * k - width, width * 2, width * 2); }
    }
  }
  strokeTo(x1, y1, x2, y2, width) {                   // instant segment for freehand drawing
    const w = width || this._width(), pad = Math.ceil(w * 3);
    const minX = Math.min(x1, x2) - pad, minY = Math.min(y1, y2) - pad;
    const off = document.createElement('canvas');
    off.width = Math.ceil(Math.abs(x2 - x1)) + pad * 2; off.height = Math.ceil(Math.abs(y2 - y1)) + pad * 2;
    const g = off.getContext('2d');
    g.strokeStyle = this.pen.color; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1 - minX, y1 - minY); g.lineTo(x2 - minX, y2 - minY); g.stroke();
    this._stamp(this._chalkify(off), minX, minY); this.tip = { x: x2, y: y2 };
    this._occupy(Math.min(x1, x2) - w, Math.min(y1, y2) - w, Math.abs(x2 - x1) + 2 * w, Math.abs(y2 - y1) + 2 * w);
  }
  line(x1, y1, x2, y2, opts) { return this._strokePath([[x1, y1], [x2, y2]], opts); }
  polygon(...c) { const pts = []; for (let i = 0; i + 1 < c.length; i += 2) pts.push([c[i], c[i+1]]); return this._strokePath(pts, { closed: true }); }
  triangle(x1, y1, x2, y2, x3, y3) { return this.polygon(x1, y1, x2, y2, x3, y3); }
  box(x, y, w, h) { return this.polygon(x, y, x + w, y, x + w, y + h, x, y + h); }
  _arcPts(cx, cy, r, a1, a2) {                        // degrees, 0 = right, 90 = up
    const n = Math.max(8, Math.ceil(Math.abs(a2 - a1) / 4)), pts = [];
    for (let i = 0; i <= n; i++) { const a = (a1 + (a2 - a1) * i / n) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]); }
    return pts;
  }
  circle(cx, cy, r) { return this._strokePath(this._arcPts(cx, cy, r, 90, 450)); }
  arc(cx, cy, r, a1, a2) { return this._strokePath(this._arcPts(cx, cy, r, a1, a2)); }
  async angle(x, y, r, a1, a2, text) {                // angle mark at vertex (x,y) between directions a1 and a2
    if (Math.abs(Math.abs(a2 - a1) - 90) < 0.5) {     // right angle: square mark
      const s = r * 0.6, mid = (a1 + a2) / 2, P = (a, d) => [x + d * Math.cos(a * Math.PI / 180), y - d * Math.sin(a * Math.PI / 180)];
      await this._strokePath([P(a1, s), P(mid, s * Math.SQRT2), P(a2, s)]);
    } else await this.arc(x, y, r, a1, a2);
    if (text) {
      const mid = (a1 + a2) / 2 * Math.PI / 180, d = r + this.pen.size * 0.9;
      await this.label(x + d * Math.cos(mid) - this.pen.size * 0.3, y - d * Math.sin(mid) + this.pen.size * 0.35, '$' + text + '$');
    }
  }
  async arrow(x1, y1, x2, y2) {
    await this.line(x1, y1, x2, y2);
    const a = Math.atan2(y2 - y1, x2 - x1), h = this.pen.size * 0.5, s = 0.5;
    await this._strokePath([[x2 - h * Math.cos(a - s), y2 - h * Math.sin(a - s)], [x2, y2], [x2 - h * Math.cos(a + s), y2 - h * Math.sin(a + s)]]);
  }
  async dot(x, y) {
    await this._glide(x, y);
    const r = this._width() * 1.6, off = document.createElement('canvas'); off.width = off.height = Math.ceil(r * 2 + 8);
    const g = off.getContext('2d'); g.fillStyle = this.pen.color; g.beginPath(); g.arc(r + 4, r + 4, r, 0, 7); g.fill();
    this._stamp(this._chalkify(off), x - r - 4, y - r - 4); this._occupy(x - r, y - r, 2 * r, 2 * r);
  }
  async underline() {
    if (!this.last) return;
    const y = this.last.y + this.pen.size * 0.3;
    await this.line(this.last.x1, y, this.last.x2, y + (Math.random() - 0.5) * 3);
  }

  // ---- script runner: one command per line ----
  async run(script) {
    this.stopped = false;
    for (const raw of script.split('\n')) {
      if (this.stopped) return;
      const line = raw.trim(); if (!line) { this.newline(); continue; }
      const [cmd, ...a] = line.split(/\s+/);
      const n = a.map(Number);
      switch (cmd) {
        case 'math': await this.math(a.join(' ')); break;
        case 'color': this.color(a[0]); break;
        case 'size': this.size(n[0]); break;
        case 'pause': await this.pause(n[0]); break;
        case 'clear': this.clear(); break;
        case 'at': this.at(n[0], n[1]); break;
        case 'move': await this.move(n[0], n[1]); break;
        case 'mark': this.mark(a[0]); break;
        case 'back': await this.back(a[0]); break;
        case 'wrap': this.wrap(n[0]); break;
        case 'label': await this.label(n[0], n[1], a.slice(2).join(' ')); break;
        case 'underline': await this.underline(); break;
        case 'line': await this.line(n[0], n[1], n[2], n[3]); break;
        case 'arrow': await this.arrow(n[0], n[1], n[2], n[3]); break;
        case 'box': await this.box(n[0], n[1], n[2], n[3]); break;
        case 'triangle': await this.triangle(...n.slice(0, 6)); break;
        case 'polygon': await this.polygon(...n); break;
        case 'circle': await this.circle(n[0], n[1], n[2]); break;
        case 'arc': await this.arc(n[0], n[1], n[2], n[3], n[4]); break;
        case 'angle': await this.angle(n[0], n[1], n[2], n[3], n[4], a.slice(5).join(' ')); break;
        case 'dot': await this.dot(n[0], n[1]); break;
        default: await this.write(line);
      }
    }
  }

  // ---- JSON command runner for agents ----
  async exec(cmds) {
    this.stopped = false;
    for (const c of cmds) {
      if (this.stopped) return;
      if (c.color) this.color(c.color);
      if (c.size) this.size(c.size);
      switch (c.op) {
        case 'at': this.at(c.x, c.y); break;
        case 'move': await this.move(c.x, c.y); break;
        case 'mark': this.mark(c.name); break;
        case 'back': await this.back(c.name); break;
        case 'wrap': this.wrap(c.x2); break;
        case 'write': if (c.x != null) this.at(c.x, c.y); await this.write(c.text, c); break;
        case 'math': if (c.x != null) this.at(c.x, c.y); await this.math(c.tex, c); break;
        case 'label': await this.label(c.x, c.y, c.text); break;
        case 'line': await this.line(c.x1, c.y1, c.x2, c.y2); break;
        case 'arrow': await this.arrow(c.x1, c.y1, c.x2, c.y2); break;
        case 'box': await this.box(c.x, c.y, c.w, c.h); break;
        case 'triangle': case 'polygon': await this.polygon(...c.points.flat()); break;
        case 'circle': await this.circle(c.cx, c.cy, c.r); break;
        case 'arc': await this.arc(c.cx, c.cy, c.r, c.a1, c.a2); break;
        case 'angle': await this.angle(c.x, c.y, c.r, c.a1, c.a2, c.text); break;
        case 'dot': await this.dot(c.x, c.y); break;
        case 'underline': await this.underline(); break;
        case 'pause': await this.pause(c.ms || 500); break;
        case 'clear': this.clear(); break;
      }
    }
  }

  // ---- helpers for agents ----
  // Loads MathJax (tex-svg + mhchem) from cdnjs if it is not already on the page. Resolves when ready.
  static loadMathJax(src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js') {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.MathJax && window.MathJax.tex2svg) return window.MathJax.startup.promise;
    if (BoardWriter._mjPromise) return BoardWriter._mjPromise;
    BoardWriter._mjPromise = new Promise((res, rej) => {
      if (!window.MathJax) window.MathJax = { loader: { load: ['[tex]/mhchem'] }, tex: { packages: { '[+]': ['mhchem'] } }, svg: { fontCache: 'local' }, startup: { typeset: false } };
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = () => window.MathJax.startup.promise.then(res, rej); s.onerror = rej;
      document.head.appendChild(s);
    });
    return BoardWriter._mjPromise;
  }
  // Loads the handwriting font from Google Fonts if the page has not loaded it.
  static loadFont(family = 'Kalam') {
    if (typeof document === 'undefined') return Promise.resolve();
    const id = 'boardwriter-font-' + family;
    if (!document.getElementById(id)) {
      const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
      document.head.appendChild(l);
    }
    return document.fonts.load(`36px ${family}`).catch(() => {});
  }
  // PNG (or other) data URL of the board, for a vision model or for saving.
  snapshot(type = 'image/png', quality) { return this.c.toDataURL(type, quality); }
  // Compact description of the board for a text-only agent: pen, marks, and where there is free space.
  state() {
    const W = this.c.width, H = this.c.height, cols = 4, rows = 3, regions = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = Math.floor(c * W / cols), y = Math.floor(r * H / rows), w = Math.floor(W / cols), h = Math.floor(H / rows);
      let used = 0, n = 0;
      for (let yy = y; yy < y + h; yy += this.cell) for (let xx = x; xx < x + w; xx += this.cell) { n++; if (this.occ[Math.floor(yy / this.cell) * this.cols + Math.floor(xx / this.cell)]) used++; }
      regions.push({ x, y, w, h, freePercent: Math.round(100 * (1 - used / n)) });
    }
    let used = 0; for (let i = 0; i < this.occ.length; i++) used += this.occ[i];
    return {
      width: W, height: H,
      pen: { x: Math.round(this.x), y: Math.round(this.y), size: this.pen.size, color: this.pen.color, wrapRight: this.right },
      marks: Object.fromEntries(Object.entries(this.marks).map(([k, v]) => [k, { x: Math.round(v.x), y: Math.round(v.y) }])),
      usedPercent: Math.round(100 * used / this.occ.length),
      regions,
      largeFreeSpot: this.findFree(600, 450),
      mediumFreeSpot: this.findFree(400, 300)
    };
  }
}
