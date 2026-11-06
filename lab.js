'use strict';
/* ===== Physics (pure, testable) ===== */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const Phys = {
  snell(n1, n2, t1deg) {               // returns refraction angle in deg, or null for TIR
    const s = n1 * Math.sin(t1deg * D2R) / n2;
    return Math.abs(s) > 1 ? null : Math.asin(s) * R2D;
  },
  critical(n1, n2) { return n1 > n2 ? Math.asin(n2 / n1) * R2D : null; },
  fresnel(n1, n2, t1deg) {             // unpolarised reflectance
    const ti = t1deg * D2R, t2 = Phys.snell(n1, n2, t1deg);
    if (t2 === null) return 1;
    const tt = t2 * D2R, ci = Math.cos(ti), ct = Math.cos(tt);
    const rs = ((n1 * ci - n2 * ct) / (n1 * ci + n2 * ct)) ** 2;
    const rp = ((n1 * ct - n2 * ci) / (n1 * ct + n2 * ci)) ** 2;
    return (rs + rp) / 2;
  },
  lens(f, dO) {                         // f signed (+ convex, - concave), real-is-positive
    if (Math.abs(dO - f) < 1e-9) return { di: Infinity, m: Infinity };
    const di = dO * f / (dO - f);
    return { di, m: -di / dO };
  },
  refractVec(d, n, eta) {               // d unit, n unit facing against d, eta=n1/n2
    const ci = -(n.x * d.x + n.y * d.y), k = 1 - eta * eta * (1 - ci * ci);
    if (k < 0) return null;
    const a = eta * ci - Math.sqrt(k);
    return { x: eta * d.x + a * n.x, y: eta * d.y + a * n.y };
  },
};
window.Phys = Phys;

/* ===== helpers ===== */
const $ = (id) => document.getElementById(id);
const fmt = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
const ltr = (s) => `<span class="ltr">${s}</span>`;
const kv = (k, v, cls = '') => `<div class="kv ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
const AR_FONT = '"Noto Sans Arabic","Segoe UI",Tahoma,sans-serif';
const LAT_FONT = '"Segoe UI",system-ui,"DejaVu Sans",sans-serif';

function fit(cv, aspect, maxH = 620) {
  const w = cv.parentElement.clientWidth || 800;
  if (w < 600) aspect = Math.max(aspect, 0.85);
  const h = Math.min(Math.round(w * aspect), maxH);
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.height = h + 'px';
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W: w, H: h };
}
function line(ctx, x1, y1, x2, y2, color, w = 2, dash = null, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function arrowHead(ctx, x, y, ang, color, size = 9, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * .7, size * .6); ctx.lineTo(-size * .7, -size * .6); ctx.closePath(); ctx.fill(); ctx.restore();
}
function ray(ctx, x1, y1, x2, y2, color, w = 2.5, alpha = 1, dash = null) {
  line(ctx, x1, y1, x2, y2, color, w, dash, alpha);
  if (!dash) arrowHead(ctx, (x1 + x2) / 2, (y1 + y2) / 2, Math.atan2(y2 - y1, x2 - x1), color, 7 + w, alpha);
}
function text(ctx, s, x, y, { color = '#1d2433', size = 14, align = 'center', ar = false, bold = false, base = 'middle' } = {}) {
  ctx.save(); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.direction = ar ? 'rtl' : 'ltr';
  ctx.font = `${bold ? '700 ' : ''}${size}px ${ar ? AR_FONT : LAT_FONT}`;
  ctx.fillText(s, x, y); ctx.restore();
}
function pill(ctx, s, x, y, opts = {}) {
  const size = opts.size || 13;
  ctx.save(); ctx.font = `700 ${size}px ${opts.ar ? AR_FONT : LAT_FONT}`;
  const w = ctx.measureText(s).width + 12; ctx.restore();
  ctx.save(); ctx.fillStyle = opts.bg || 'rgba(255,255,255,.9)'; ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2, y - size * .85, w, size * 1.7, 6); else ctx.rect(x - w / 2, y - size * .85, w, size * 1.7);
  ctx.fill(); ctx.restore();
  text(ctx, s, x, y, { ...opts, bold: true, size });
}

/* ===== Tabs & answers ===== */
const drawers = {};
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === b));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === b.dataset.tab));
  drawers[b.dataset.tab]();
  history.replaceState(null, '', '#' + b.dataset.tab);
}));
document.querySelectorAll('[data-ans]').forEach((b) => b.addEventListener('click', () => {
  const a = $(b.dataset.ans), on = a.classList.toggle('show');
  b.textContent = on ? 'أخفِ الجواب' : 'أظهر الجواب';
}));

/* ===== 1. Refraction between two media ===== */
(() => {
  const MEDIA = [
    { k: 'air', name: 'هواء', n: 1.00, fill: '#ffffff' },
    { k: 'water', name: 'ماء', n: 1.33, fill: '#e4f1fb' },
    { k: 'glass', name: 'زجاج', n: 1.50, fill: '#e8f2ef' },
    { k: 'diamond', name: 'ألماس', n: 2.42, fill: '#efe9fa' },
  ];
  const m1 = $('m1'), m2 = $('m2'), a1 = $('a1'), cv = $('cv-refr');
  for (const s of [m1, m2]) MEDIA.forEach((m, i) => s.add(new Option(`${m.name}  (n = ${m.n.toFixed(2)})`, i)));
  m1.value = 0; m2.value = 1;
  let side = 1; // 1: source on the left
  const LASER = '#e11d48';

  function draw() {
    const { ctx, W, H } = fit(cv, 0.62, 560);
    const A = MEDIA[m1.value], B = MEDIA[m2.value];
    const t1 = +a1.value; $('a1v').textContent = fmt(t1, 1) + '°';
    const t2 = Phys.snell(A.n, B.n, t1), tc = Phys.critical(A.n, B.n), R = Phys.fresnel(A.n, B.n, t1);
    const P = { x: W / 2, y: H / 2 };
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = A.fill; ctx.fillRect(0, 0, W, P.y);
    ctx.fillStyle = B.fill; ctx.fillRect(0, P.y, W, H - P.y);
    line(ctx, 0, P.y, W, P.y, '#9aa4b2', 1.5);
    text(ctx, `${A.name}`, W - 14, 22, { ar: true, align: 'right', size: 15, bold: true, color: '#475467' });
    text(ctx, `n₁ = ${A.n.toFixed(2)}`, W - 14, 44, { align: 'right', size: 13, color: '#667085' });
    text(ctx, `${B.name}`, W - 14, H - 40, { ar: true, align: 'right', size: 15, bold: true, color: '#475467' });
    text(ctx, `n₂ = ${B.n.toFixed(2)}`, W - 14, H - 18, { align: 'right', size: 13, color: '#667085' });
    // normal
    line(ctx, P.x, 8, P.x, H - 8, '#98a2b3', 1.3, [6, 6]);
    text(ctx, 'العمود المقام', P.x + 8, 18, { ar: true, align: 'left', size: 12, color: '#98a2b3' });
    const L = Math.hypot(W, H);
    const r = Math.min(H * 0.42, W * 0.4);
    const th1 = t1 * D2R;
    const S = { x: P.x - side * r * Math.sin(th1), y: P.y - r * Math.cos(th1) };
    // reflected
    if ($('showRefl').checked || t2 === null) {
      ray(ctx, P.x, P.y, P.x + side * L * Math.sin(th1), P.y - L * Math.cos(th1), LASER, t2 === null ? 3 : 2.2, Math.max(0.2, Math.sqrt(R)));
    }
    // refracted
    if (t2 !== null) {
      const th2 = t2 * D2R;
      ray(ctx, P.x, P.y, P.x + side * L * Math.sin(th2), P.y + L * Math.cos(th2), LASER, 3, Math.max(0.35, 1 - R * 0.8));
    }
    // incident
    ray(ctx, S.x, S.y, P.x, P.y, LASER, 3);
    // arcs
    if ($('showArcs').checked) {
      const ar = Math.min(60, r * 0.35);
      ctx.save(); ctx.strokeStyle = '#0d7a6f'; ctx.lineWidth = 1.6; ctx.beginPath();
      if (side > 0) ctx.arc(P.x, P.y, ar, -Math.PI / 2 - th1, -Math.PI / 2); else ctx.arc(P.x, P.y, ar, -Math.PI / 2, -Math.PI / 2 + th1);
      ctx.stroke(); ctx.restore();
      const mid1 = -Math.PI / 2 - side * th1 / 2;
      pill(ctx, `θ₁ = ${fmt(t1)}°`, P.x + Math.cos(mid1) * (ar + 34), P.y + Math.sin(mid1) * (ar + 14), { color: '#0d7a6f', size: 13 });
      if (t2 !== null && t2 > 0.01) {
        const th2 = t2 * D2R;
        ctx.save(); ctx.strokeStyle = '#0d7a6f'; ctx.lineWidth = 1.6; ctx.beginPath();
        if (side > 0) ctx.arc(P.x, P.y, ar, Math.PI / 2 - th2, Math.PI / 2); else ctx.arc(P.x, P.y, ar, Math.PI / 2, Math.PI / 2 + th2);
        ctx.stroke(); ctx.restore();
        const mid2 = Math.PI / 2 - side * th2 / 2;
        pill(ctx, `θ₂ = ${fmt(t2)}°`, P.x + Math.cos(mid2) * (ar + 34), P.y + Math.sin(mid2) * (ar + 14), { color: '#0d7a6f', size: 13 });
      }
    }
    if (t2 === null) pill(ctx, 'انعكاس كلي داخلي', P.x + side * W * 0.22, P.y + 30, { ar: true, color: '#b42318', size: 14, bg: '#fff4f2' });
    // laser body
    ctx.save(); ctx.translate(S.x, S.y); ctx.rotate(Math.atan2(P.y - S.y, P.x - S.x));
    ctx.fillStyle = '#1d2433'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-34, -9, 36, 18, 5) : ctx.rect(-34, -9, 36, 18); ctx.fill();
    ctx.fillStyle = LASER; ctx.fillRect(0, -4, 5, 8);
    ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(13,122,111,.35)'; ctx.lineWidth = 2; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(S.x, S.y, 24, 0, Math.PI * 2); ctx.stroke(); ctx.restore();

    // readouts
    const s1 = A.n * Math.sin(th1);
    let h = kv('زاوية السقوط '+ltr('θ₁'), ltr(fmt(t1) + '°'));
    h += kv('زاوية الانكسار '+ltr('θ₂'), t2 === null ? 'ما فيه انكسار' : ltr(fmt(t2) + '°'), t2 === null ? 'alert' : '');
    h += kv('الزاوية الحرجة', tc === null ? 'ما فيه (الضوء رايح لوسط أكثف)' : ltr(fmt(tc) + '°'));
    h += kv('نسبة المنعكس', ltr(fmt(R * 100, 0) + '%'));
    h += kv('قانون سنل', t2 === null
      ? ltr(`${A.n.toFixed(2)} × sin ${fmt(t1)}° = ${s1.toFixed(3)} > ${B.n.toFixed(2)}`) + '<br><small>أكبر من <span class="ltr">n₂</span>، فما فيه زاوية انكسار ممكنة.</small>'
      : ltr(`${A.n.toFixed(2)} × sin ${fmt(t1)}° = ${s1.toFixed(3)} = ${B.n.toFixed(2)} × sin ${fmt(t2)}°`), 'wide ' + (t2 === null ? 'alert' : 'good'));
    let st;
    if (A.n === B.n) st = 'نفس الوسط، فالضوء يكمل بدون ما ينكسر.';
    else if (t2 === null) st = `زاوية السقوط أكبر من الزاوية الحرجة (${ltr(fmt(tc) + '°')})، فالضوء كله يرجع: انعكاس كلي داخلي.`;
    else if (B.n > A.n) st = `الضوء دخل وسط أكثف، فقرّب من العمود المقام: زاوية الانكسار أصغر من زاوية السقوط.`;
    else st = `الضوء طلع لوسط أقل كثافة، فابتعد عن العمود المقام: زاوية الانكسار أكبر من زاوية السقوط.`;
    h += kv('وش صار؟', st, 'wide');
    $('ro-refr').innerHTML = h;
  }
  function fromPointer(e) {
    const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
    const dx = x - rc.width / 2, dy = Math.max(rc.height / 2 - y, 0.5);
    side = dx <= 0 ? 1 : -1;
    a1.value = Math.min(89, Math.round(Math.atan2(Math.abs(dx), dy) * R2D * 2) / 2);
    draw();
  }
  let drag = false;
  cv.addEventListener('pointerdown', (e) => { drag = true; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; fromPointer(e); });
  cv.addEventListener('pointermove', (e) => { if (drag) fromPointer(e); });
  const end = () => { drag = false; cv.style.cursor = 'grab'; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  [m1, m2, a1, $('showRefl'), $('showArcs')].forEach((el) => el.addEventListener('input', draw));
  $('swap').addEventListener('click', () => { const t = m1.value; m1.value = m2.value; m2.value = t; draw(); });
  drawers.refr = draw;
})();

/* ===== 2. Lenses ===== */
(() => {
  const cv = $('cv-lens'), fEl = $('f'), doEl = $('do'), hoEl = $('ho');
  let type = 'convex';
  const C1 = '#e11d48', C2 = '#2563eb', C3 = '#16a34a', OBJ = '#1d2433', IMG = '#0d7a6f';
  document.querySelectorAll('#lensType button').forEach((b) => b.addEventListener('click', () => {
    type = b.dataset.v;
    document.querySelectorAll('#lensType button').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  }));
  function arrowObj(ctx, x, yBase, yTip, color, dashed) {
    line(ctx, x, yBase, x, yTip, color, 3.5, dashed ? [7, 5] : null);
    arrowHead(ctx, x, yTip, yTip < yBase ? -Math.PI / 2 : Math.PI / 2, color, 11);
  }
  function draw() {
    const { ctx, W, H } = fit(cv, 0.56, 560);
    const fmag = +fEl.value, dO = +doEl.value, ho = +hoEl.value;
    const f = type === 'convex' ? fmag : -fmag;
    $('fv').textContent = `${fmt(f)} cm`; $('dov').textContent = `${fmt(dO)} cm`; $('hov').textContent = `${fmt(ho)} cm`;
    const pre = Phys.lens(f, dO);
    const ext = Math.max(dO, 2 * fmag, isFinite(pre.di) ? Math.min(Math.abs(pre.di), 55) : 0, 12) * 1.12 + 3;
    const s = Math.min(W / (2 * ext), (H * 0.42) / Math.max(ho, isFinite(pre.m) ? Math.min(Math.abs(pre.m * ho), 14) : ho, 4)), L = W * 0.5, A = H * 0.5;
    const X = (cm) => L + cm * s, Y = (cm) => A - cm * s;
    ctx.clearRect(0, 0, W, H);
    // axis + focal marks
    line(ctx, 0, A, W, A, '#98a2b3', 1.3);
    for (const k of [-2, -1, 1, 2]) {
      const x = X(k * fmag);
      if (x < 0 || x > W) continue;
      ctx.fillStyle = '#475467'; ctx.beginPath(); ctx.arc(x, A, 3.5, 0, Math.PI * 2); ctx.fill();
      const lbl = (Math.abs(k) === 2 ? '2F' : 'F') + (k > 0 ? '′' : '');
      text(ctx, lbl, x, A + 18, { size: 13, color: '#475467', bold: true });
    }
    // lens shape
    const lh = H * 0.42;
    ctx.save(); ctx.fillStyle = 'rgba(56,148,200,.16)'; ctx.strokeStyle = 'rgba(30,110,160,.75)'; ctx.lineWidth = 1.8; ctx.beginPath();
    if (type === 'convex') {
      const b = 16; ctx.moveTo(L, A - lh); ctx.quadraticCurveTo(L + b * 2, A, L, A + lh); ctx.quadraticCurveTo(L - b * 2, A, L, A - lh);
    } else {
      const e = 14, c = 5; ctx.moveTo(L - e, A - lh); ctx.lineTo(L + e, A - lh); ctx.quadraticCurveTo(L + c - e * 0.6, A, L + e, A + lh);
      ctx.lineTo(L - e, A + lh); ctx.quadraticCurveTo(L - c + e * 0.6, A, L - e, A - lh);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    line(ctx, L, A - lh, L, A + lh, 'rgba(30,110,160,.35)', 1, [3, 4]);

    const x0 = X(-dO), yT = Y(ho);
    const { di, m } = Phys.lens(f, dO);
    const hasImg = isFinite(di);
    const real = hasImg && di > 0;
    const xi = hasImg ? X(di) : null, yi = hasImg ? Y(m * ho) : null;
    const far = W * 3;
    const out = (px, py, dx, dy) => { if (dx < 0) { dx = -dx; dy = -dy; } const n = Math.hypot(dx, dy); return [px + dx / n * far, py + dy / n * far]; };
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    // Ray 1: parallel -> through back focus F'
    {
      ray(ctx, x0, yT, L, yT, C1, 2.2);
      const Bx = X(f), [ex, ey] = out(L, yT, Bx - L, A - yT);
      ray(ctx, L, yT, ex, ey, C1, 2.2);
      if (f < 0) line(ctx, L, yT, Bx, A, C1, 1.4, [6, 5], 0.8);
    }
    // Ray 2: through centre
    {
      const [ex, ey] = out(L, A, L - x0, A - yT);
      ray(ctx, x0, yT, ex, ey, C2, 2.2);
    }
    // Ray 3: toward/through front focus -> parallel
    const Fx = X(-f);
    if (Math.abs(Fx - x0) > 0.5) {
      const y3 = yT + (L - x0) * (A - yT) / (Fx - x0);
      if (Math.abs(y3 - A) < H) {
        ray(ctx, x0, yT, L, y3, C3, 2.2);
        ray(ctx, L, y3, W + 10, y3, C3, 2.2);
        if (f < 0) line(ctx, L, y3, Fx, A, C3, 1.4, [6, 5], 0.8);
        else if (dO < f) line(ctx, Fx, A, x0, yT, C3, 1.4, [6, 5], 0.8);
        if (hasImg && !real) line(ctx, L, y3, xi, yi, C3, 1.4, [6, 5], 0.8);
      }
    }
    if (hasImg && !real) {
      line(ctx, L, yT, xi, yi, C1, 1.4, [6, 5], 0.8);
      line(ctx, L, A, xi, yi, C2, 1.4, [6, 5], 0.6);
    }
    // object & image
    arrowObj(ctx, x0, A, yT, OBJ, false);
    text(ctx, 'الجسم', x0, A + 38, { ar: true, size: 13, color: OBJ, bold: true });
    let offscreen = false;
    if (hasImg) {
      offscreen = xi < 0 || xi > W || yi < 0 || yi > H;
      arrowObj(ctx, xi, A, yi, IMG, !real);
      if (!offscreen) text(ctx, real ? 'الصورة' : 'الصورة (تقديرية)', xi, yi > A ? Math.max(yi + 18, A + 40) : yi - 18, { ar: true, size: 13, color: IMG, bold: true });
    }
    ctx.restore();
    if (offscreen) pill(ctx, 'الصورة خارج حدود الرسم', W / 2, 20, { ar: true, size: 13, color: '#b42318', bg: '#fff4f2' });
    if (!hasImg) pill(ctx, 'الأشعة متوازية: ما تتكوّن صورة', W / 2, 20, { ar: true, size: 13, color: '#b42318', bg: '#fff4f2' });

    // readouts
    let h = '';
    if (!hasImg) {
      h += kv('الصورة', 'الجسم بالضبط في البؤرة، فالأشعة تطلع متوازية والصورة في اللانهاية.', 'wide alert');
    } else {
      const am = Math.abs(m);
      const size = am > 1.005 ? 'مكبّرة' : am < 0.995 ? 'مصغّرة' : 'بنفس الحجم';
      h += kv('نوع الصورة', real ? 'حقيقية' : 'تقديرية', real ? 'good' : '');
      h += kv('الاتجاه', m < 0 ? 'مقلوبة' : 'معتدلة');
      h += kv('الحجم', size);
      h += kv('بُعد الصورة <span class="ltr">d<sub>i</sub></span>', ltr(fmt(di) + ' cm'));
      h += kv('التكبير <span class="ltr">m</span>', ltr('m = ' + fmt(m, 2)));
      h += kv('طول الصورة', ltr(fmt(Math.abs(m * ho)) + ' cm'));
      h += kv('معادلة العدسة', ltr(`1/(${fmt(f)}) = 1/${fmt(dO)} + 1/(${fmt(di)})`) +
        '<br>' + ltr(`${(1 / f).toFixed(4)} = ${(1 / dO).toFixed(4)} ${di < 0 ? '−' : '+'} ${Math.abs(1 / di).toFixed(4)}`), 'wide good');
      h += kv('ملاحظة', real ? 'الصورة الحقيقية تتكوّن في الجهة الثانية من العدسة، وتقدر تعرضها على شاشة.' : 'الصورة التقديرية في نفس جهة الجسم، تشوفها بعينك من خلال العدسة وما تنعرض على شاشة.', 'wide');
    }
    $('ro-lens').innerHTML = h;
  }
  [fEl, doEl, hoEl].forEach((el) => el.addEventListener('input', draw));
  drawers.lens = draw;
})();

/* ===== 3. Prism ===== */
(() => {
  const cv = $('cv-prism'), iEl = $('pi'), aEl = $('pa'), mono = $('pwhite');
  const COLORS = [
    { name: 'أحمر', n: 1.613, c: '#ff3b30' }, { name: 'برتقالي', n: 1.616, c: '#ff9500' },
    { name: 'أصفر', n: 1.619, c: '#ffd60a' }, { name: 'أخضر', n: 1.624, c: '#34c759' },
    { name: 'أزرق', n: 1.632, c: '#0a84ff' }, { name: 'نيلي', n: 1.639, c: '#5e5ce6' },
    { name: 'بنفسجي', n: 1.647, c: '#bf5af2' },
  ];
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  function hit(p, d, a, b) {               // ray p+t d vs segment a-b
    const e = sub(b, a), den = cross(d, e);
    if (Math.abs(den) < 1e-12) return null;
    const ap = sub(a, p), t = cross(ap, e) / den, u = cross(ap, d) / den;
    return t > 1e-6 && u >= 0 && u <= 1 ? t : null;
  }
  function trace(geom, d0, n) {
    const { E, faces } = geom;
    const nin = faces[0].nOut;
    const t1 = Phys.refractVec(d0, nin, 1 / n);
    let best = null;
    for (let k = 1; k < faces.length; k++) {
      const t = hit(E, t1, faces[k].a, faces[k].b);
      if (t !== null && (!best || t < best.t)) best = { t, f: faces[k] };
    }
    const X = { x: E.x + t1.x * best.t, y: E.y + t1.y * best.t };
    const nn = { x: -best.f.nOut.x, y: -best.f.nOut.y };  // facing against inside ray
    const dOut = Phys.refractVec(t1, nn, n);
    return { inside: t1, X, dOut, face: best.f };
  }
  function geometry(W, H, alpha, inc) {
    const h2 = alpha / 2 * D2R, side = Math.min(H * 0.78, W * 0.5);
    const cx = W * 0.4, height = side * Math.cos(h2);
    const T = { x: cx, y: H / 2 - height * 0.55 };
    const BL = { x: T.x - side * Math.sin(h2), y: T.y + height };
    const BR = { x: T.x + side * Math.sin(h2), y: T.y + height };
    const faces = [
      { a: T, b: BL, nOut: { x: -Math.cos(h2), y: -Math.sin(h2) } },
      { a: T, b: BR, nOut: { x: Math.cos(h2), y: -Math.sin(h2) } },
      { a: BL, b: BR, nOut: { x: 0, y: 1 } },
    ];
    const E = { x: T.x + (BL.x - T.x) * 0.55, y: T.y + (BL.y - T.y) * 0.55 };
    const nin = { x: Math.cos(h2), y: Math.sin(h2) }, a = -inc * D2R;
    const d0 = { x: nin.x * Math.cos(a) - nin.y * Math.sin(a), y: nin.x * Math.sin(a) + nin.y * Math.cos(a) };
    return { T, BL, BR, faces, E, d0 };
  }
  window.Prism = { trace, geometry, COLORS };
  function draw() {
    const { ctx, W, H } = fit(cv, 0.58, 560);
    const inc = +iEl.value, alpha = +aEl.value;
    $('piv').textContent = fmt(inc) + '°'; $('pav').textContent = fmt(alpha, 0) + '°';
    ctx.fillStyle = '#0f1420'; ctx.fillRect(0, 0, W, H);
    const g = geometry(W, H, alpha, inc);
    const { T, BL, BR, E, d0 } = g;
    // prism
    ctx.save(); ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(BL.x, BL.y); ctx.lineTo(BR.x, BR.y); ctx.closePath();
    const grd = ctx.createLinearGradient(BL.x, T.y, BR.x, BR.y); grd.addColorStop(0, 'rgba(160,210,255,.18)'); grd.addColorStop(1, 'rgba(160,210,255,.07)');
    ctx.fillStyle = grd; ctx.fill(); ctx.strokeStyle = 'rgba(200,230,255,.7)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    // normal at E
    const nO = g.faces[0].nOut;
    line(ctx, E.x - nO.x * 60, E.y - nO.y * 60, E.x + nO.x * 60, E.y + nO.y * 60, 'rgba(255,255,255,.35)', 1, [4, 4]);
    const cols = mono.checked ? [COLORS[0]] : COLORS;
    const far = W * 2;
    // incoming beam
    const S = { x: E.x - d0.x * far, y: E.y - d0.y * far };
    ctx.save(); ctx.shadowColor = mono.checked ? '#ff3b30' : '#ffffff'; ctx.shadowBlur = 10;
    line(ctx, S.x, S.y, E.x, E.y, mono.checked ? '#ff3b30' : '#ffffff', 4); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const res = [];
    for (const c of cols) {
      const r = trace(g, d0, c.n); res.push({ ...c, ...r });
      line(ctx, E.x, E.y, r.X.x, r.X.y, c.c, 2, null, 0.7);
      if (r.dOut) {
        ctx.shadowColor = c.c; ctx.shadowBlur = 6;
        line(ctx, r.X.x, r.X.y, r.X.x + r.dOut.x * far, r.X.y + r.dOut.y * far, c.c, 3);
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
    const tir = res.some((r) => !r.dOut);
    if (tir) pill(ctx, 'انعكاس كلي داخلي: بعض الألوان ما طلعت', W / 2, 22, { ar: true, size: 13, color: '#b42318', bg: '#fff4f2' });
    text(ctx, 'ضوء أبيض', S.x + (E.x - S.x) * 0.92 - 10, E.y - (E.y - (S.y)) * 0.08 - 18, { ar: true, size: 13, color: '#cbd5e1', align: 'center' });
    // readouts
    const dev = (r) => r.dOut ? Math.acos(Math.max(-1, Math.min(1, d0.x * r.dOut.x + d0.y * r.dOut.y))) * R2D : null;
    const red = res[0], vio = res[res.length - 1];
    let h = kv('زاوية السقوط', ltr(fmt(inc) + '°')) + kv('زاوية رأس المنشور', ltr(fmt(alpha, 0) + '°'));
    h += kv('انحراف الأحمر', red.dOut ? ltr(fmt(dev(red)) + '°') : 'انعكاس كلي', red.dOut ? '' : 'alert');
    if (!mono.checked) {
      h += kv('انحراف البنفسجي', vio.dOut ? ltr(fmt(dev(vio)) + '°') : 'انعكاس كلي', vio.dOut ? '' : 'alert');
      if (red.dOut && vio.dOut) h += kv('اتساع الطيف (البنفسجي − الأحمر)', ltr(fmt(dev(vio) - dev(red), 2) + '°'), 'good');
    }
    h += kv('وش صار؟', tir ? 'زاوية السقوط على الوجه الثاني صارت أكبر من الزاوية الحرجة، فبعض الضوء رجع داخل المنشور. صغّر زاوية الرأس أو كبّر زاوية السقوط.'
      : (mono.checked ? 'لون واحد ينكسر مرتين وينحرف، بس ما يتحلل لأنه أصلاً لون واحد.' : 'كل لون انكسر بزاوية مختلفة، والبنفسجي انحرف أكثر من الأحمر، فتفرّقت الألوان.'), 'wide');
    $('ro-prism').innerHTML = h;
  }
  [iEl, aEl, mono].forEach((el) => el.addEventListener('input', draw));
  drawers.prism = draw;
})();

/* ===== init ===== */
const start = (location.hash || '#refr').slice(1);
const startTab = document.querySelector(`.tab[data-tab="${start}"]`) || document.querySelector('.tab');
startTab.click();
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => drawers[document.querySelector('.tab.active').dataset.tab](), 80); });
