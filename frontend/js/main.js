/* ============================================================
   AQUALINE — Home page interactions
   Coverflow-style bottle slider (ported from the Framer
   coverflow pattern): one `pos` value drives every card; the
   active card is a large centre card, neighbours are flat
   slats at a fixed pitch; cards grow while sliding in and
   shrink while sliding out; seamless infinite loop.
   ============================================================ */

(function () {
  "use strict";

var hero = document.getElementById("hero");
  var stage = document.getElementById("stage");
  var ringPar = document.getElementById("ringPar");
  var dotsWrap = document.getElementById("dots");
  var spins = ringPar ? Array.prototype.slice.call(ringPar.querySelectorAll(".spin")) : [];
  var count = spins.length;
  if (!ringPar || !spins.length) { return; }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Sizing ---------------- */

  var S = { activeW: 320, activeH: 440, restW: 104, restH: 144, gap: 22 };

function updateSizing() {
    var w = stage.clientWidth;
    var activeW = Math.min(420, w * 0.5);
    S.activeW = activeW;
    S.activeH = activeW * 1.85;
    S.restW = w < 560 ? 66 : 116;
    S.restH = S.restW * 1.85;
    S.gap = w < 560 ? 10 : 16;
  }

  /* ---------------- Card geometry (pure port) ---------------- */

  // signed wrapped distance of `index` from current position `pos`
  function relOf(index, pos) {
    var rel = ((((index - pos) % count) + count) % count);
    if (rel > count / 2) rel -= count;
    return rel;
  }

  // horizontal offset from centre for a given signed distance
  function xForRel(rel) {
    var ar = Math.abs(rel);
    var c1 = S.activeW / 2 + S.gap + S.restW / 2;
    var pitch = S.restW + S.gap;
    var mag = ar <= 1 ? ar * c1 : c1 + (ar - 1) * pitch;
    return (rel < 0 ? -1 : 1) * mag;
  }

  // 0 at centre  ™ 1 one full slot away
  function blendForRel(rel) {
    return Math.min(Math.abs(rel), 1);
  }

  // cards visible on each side (seam hidden at ±count/2)
  var R = Math.max(1, Math.min(6, Math.floor(count / 2) - 1));

  /* ---------------- Driver state ---------------- */

  var pos = 0;          // current float position (slots)
  var target = 0;       // target position
  var rafId = null;
  var lastT = null;
  var dwellAcc = 0;
  var moveDur = 0.9;    // seconds per move (slow, premium)
  var dwell = 3.6;      // seconds held on active card
  var autoOn = false;
  var dir = 1;
  var arrived = true;
  var active = 0;

  var drag = { on: false, startX: 0, lastX: 0, lastT: 0, vel: 0, startPos: 0, didMove: false };

  /* ---------------- One-frame render ---------------- */

  function render() {
    for (var i = 0; i < count; i++) {
      var rel = relOf(i, pos);
      var ar = Math.abs(rel);
      var sp = spins[i];

var x = xForRel(rel);
      var xMax = stage.clientWidth / 2 - S.restW / 2 - 4;
      if (x > xMax) x = xMax;
      if (x < -xMax) x = -xMax;
      var a = blendForRel(rel);
      var w = S.activeW + (S.restW - S.activeW) * a;
      var h = S.activeH + (S.restH - S.activeH) * a;
      var im = sp.querySelector("img");

      var op;
      if (ar <= R) op = 1;
      else if (ar >= R + 1) op = 0;
      else op = 1 - (ar - R);

      var zi = Math.round(1000 - ar * 100);

sp.style.transform = "translate(-50%, -50%) translateX(" + x + "px)";
      sp.style.width = Math.round(w) + "px";
      sp.style.height = Math.round(h) + "px";
      sp.style.opacity = op;
      sp.style.zIndex = zi;
      if (im) {
        im.style.height = Math.round(h * 0.86) + "px";
        im.style.width = "auto";
        im.style.maxWidth = "none";
      }

      var isFront = ar < 0.5;
      if (isFront) sp.classList.add("is-active");
      else sp.classList.remove("is-active");
    }

    var newActive = (Math.round(pos) % count + count) % count;
    if (newActive !== active) {
      active = newActive;
      syncDots();
    }
  }

  /* ---------------- rAF chase driver ---------------- */

  function tick(t) {
    var last = lastT === null ? t : lastT;
    var dt = Math.min((t - last) / 1000, 1 / 30);
    lastT = t;

    var cur = pos;
    var diff = target - cur;
    var step = (1 / moveDur) * dt;

    if (reduced || Math.abs(diff) <= step) {
      pos = target;
      if (autoOn) {
        dwellAcc += dt;
        if (dwellAcc >= dwell) {
          dwellAcc = 0;
          target += dir;
        }
        render();
        rafId = requestAnimationFrame(tick);
        return;
      }
      render();
      rafId = null;
      lastT = null;
      return;
    }

    pos = cur + Math.sign(diff) * (1 / moveDur) * dt;
    render();
    rafId = requestAnimationFrame(tick);
  }

  function ensureRunning() {
    if (rafId === null) {
      lastT = null;
      rafId = requestAnimationFrame(tick);
    }
  }

  /* ---------------- Navigation ---------------- */

  function goNext() { target += 1; ensureRunning(); }
  function goPrev() { target -= 1; ensureRunning(); }

  function goTo(index) {
    var d = index - target;
    d = ((d % count) + count) % count;
    if (d > count / 2) d -= count;
    target += d;
    if (reduced) { pos = target; render(); }
    else ensureRunning();
    restartAuto();
  }

  document.getElementById("prev").addEventListener("click", goPrev);
  document.getElementById("next").addEventListener("click", goNext);

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") goPrev();
    if (e.key === "ArrowRight") goNext();
  });

  // click a side card  ™ jump to it
  spins.forEach(function (sp, i) {
    sp.addEventListener("click", function () {
      if (drag.didMove) return; location.href = "products.html";
    });
  });

  /* ---------------- Dots ---------------- */

  function syncDots() {
    var dots = dotsWrap.children;
    for (var d = 0; d < dots.length; d++) {
      dots[d].classList.toggle("is-on", d === active);
      dots[d].setAttribute("aria-selected", d === active ? "true" : "false");
    }
  }

  spins.forEach(function (_, i) {
    var dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", "Show bottle " + (i + 1));
    dot.addEventListener("click", function () { goTo(i); });
    dotsWrap.appendChild(dot);
  });

  /* ---------------- Autoplay ---------------- */

  function stopAuto() {
    autoOn = false;
    dwellAcc = 0;
  }
  function resumeAuto() {}
  function restartAuto() {}

  stage.addEventListener("pointerenter", stopAuto);
  stage.addEventListener("pointerleave", resumeAuto);

  /* ---------------- Drag / swipe ---------------- */

  stage.addEventListener("pointerdown", function (e) {
    if (e.target.closest("button")) return;
    drag.on = true;
    drag.startX = e.clientX;
    drag.lastX = e.clientX;
    drag.lastT = performance.now();
    drag.vel = 0;
    drag.startPos = pos;
    drag.didMove = false;
    stopAuto();
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  });

  stage.addEventListener("pointermove", function (e) {
    if (!drag.on) return;
    var now = performance.now();
    var dx = e.clientX - drag.startX;
    if (dx > 6 || dx < -6) drag.didMove = true;
    if (now - drag.lastT > 0) drag.vel = (e.clientX - drag.lastX) / (now - drag.lastT);
    drag.lastX = e.clientX;
    drag.lastT = now;

    var pitch = S.restW + S.gap;
    var slide = dx / pitch;
    pos = drag.startPos - slide;
    render();
  });

  function endDrag() {
    if (!drag.on) return;
    drag.on = false;
    var pitch = S.restW + S.gap;
    var fling = drag.vel * 0.18;
    target = Math.round(pos + fling);
    ensureRunning();
    resumeAuto();
  }

  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  /* ---------------- Parallax (subtle, desktop) ---------------- */

  var par = { tx: 0, ty: 0, cx: 0, cy: 0, raf: null };

  hero.addEventListener("pointermove", function (e) {
    if (reduced || window.matchMedia("(pointer: coarse)").matches) return;
    var r = hero.getBoundingClientRect();
    par.tx = (e.clientX / r.width - 0.5);
    par.ty = (e.clientY / r.height - 0.5);
    if (!par.raf) par.raf = requestAnimationFrame(parallaxTick);
  });

  function parallaxTick() {
    par.cx += (par.tx - par.cx) * 0.05;
    par.cy += (par.ty - par.cy) * 0.05;

    var mx = par.cx * 12;
    var my = par.cy * 8;
    ringPar.style.transform = "translate3d(" + mx + "px," + my + "px,0)";

    var mist = hero.querySelector(".bg-mist");
    if (mist) {
      mist.style.transform = "translate3d(" + (-mx * 0.7) + "px," + (-my * 0.7) + "px,0)";
    }

    if (Math.abs(par.cx - par.tx) > 0.0005 || Math.abs(par.cy - par.ty) > 0.0005) {
      par.raf = requestAnimationFrame(parallaxTick);
    } else {
      par.raf = null;
    }
  }

  /* ---------------- Water particles ---------------- */

  var canvas = document.getElementById("particles");
  var ctx = canvas.getContext("2d");
  var parts = [];
  var tickN = 0;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resizeParticles() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    var n = w < 560 ? 16 : (w < 1100 ? 22 : 28);
    parts = [];
    for (var i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.7 + Math.random() * 2.4,
        speed: 0.05 + Math.random() * 0.16,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.04 + Math.random() * 0.18
      });
    }
  }

  function drawParticles() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    var w = window.innerWidth;
    var h = window.innerHeight;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.y -= p.speed;
      p.x += Math.sin(tickN * 0.0009 + p.phase) * 0.22;
      if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(169, 220, 236, " + p.alpha + ")";
      ctx.fill();
    }
    tickN = (tickN + 1) % 100000;
  }

  var particleLoop = null;
  function startParticles() {
    if (reduced || particleLoop) return;
    function loop() {
      particleLoop = requestAnimationFrame(loop);
      drawParticles();
    }
    loop();
  }

  if (ctx) {
    resizeParticles();
    startParticles();
    window.addEventListener("resize", resizeParticles);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (particleLoop) { cancelAnimationFrame(particleLoop); particleLoop = null; }
        stopAuto();
      } else {
        startParticles();
        resumeAuto();
      }
    });
  }

  /* ---------------- Init ---------------- */

  function onResize() {
    updateSizing();
    render();
    ensureRunning();
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  updateSizing();
  render();
  restartAuto();

  document.addEventListener("site-content-updated", function () {
    updateSizing();
    render();
  });
})();






/* ================ WHAT WE DELIVER — scroll-driven cinematic scene ================ */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var deliver = document.getElementById("deliver");
  if (!deliver) { return; }

var stage = document.getElementById("deliverStage");
  var drinks = Array.prototype.slice.call(document.querySelectorAll(".drink"));
  var foot = document.getElementById("deliverFoot");
  var ripples = Array.prototype.slice.call(document.querySelectorAll(".ripple"));

  var sp = 0;
  var last = performance.now();

var P = {
    burstStart: 0.23, burstStep: 0.06, burstDur: 0.34,
    inStart: 0.26, inStep: 0.05, inDur: 0.13,
    footStart: 0.64, footEnd: 0.82
  };

  var SCALE = [0.78, 0.94, 1.16, 0.94, 0.78];
  var SLIDE = [-96, -48, 0, 48, 96];
  var slideFactor = Math.max(0.42, Math.min(1, (window.innerWidth - 150) / 550));

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function backOut(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function scrollP() {
    var r = deliver.getBoundingClientRect();
    var vh = window.innerHeight;
    var half = r.height / 4;
    var past = vh - half - r.top;
    return clamp01(past / (vh + half));
  }

  function tick(t) {
    var dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    var target = scrollP();
    var k = target > sp ? 2.9 : 4.6;
    sp += (target - sp) * (1 - Math.exp(-dt * k));
    render();
    window.requestAnimationFrame(tick);
  }

  function render() {
var p = sp;

    var i, r, rt, rs;
    for (i = 0; i < ripples.length; i++) {
      r = ripples[i];
      rt = clamp01((p - (P.burstStart + i * P.burstStep)) / P.burstDur);
      if (rt <= 0) {
        r.style.opacity = 0;
        continue;
      }
      rs = 0.25 + rt * 1.6;
      r.style.transform = "scale(" + rs + ")";
      r.style.opacity = (1 - rt) * 0.6;
    }

    var t2, d, fly;
    for (i = 0; i < drinks.length; i++) {
      d = drinks[i];
      t2 = clamp01((p - (P.inStart + i * P.inStep)) / P.inDur);
      fly = backOut(t2);
      d.style.transform =
        "translate3d(" + (SLIDE[i] * slideFactor * t2) + "px," + (150 * (1 - fly)) + "px,0) " +
        "rotate(" + ((2 - i) * 2 * t2) + "deg) " +
        "scale(" + (SCALE[i] * (0.5 + 0.5 * fly)) + ")";
      d.style.opacity = Math.min(1, t2 * 3);
    }

    var f = ease(clamp01((p - P.footStart) / (P.footEnd - P.footStart)));
    foot.style.opacity = f;
    foot.style.transform = "translateY(" + (16 * (1 - f)) + "px)";
    foot.style.pointerEvents = f > 0.5 ? "auto" : "none";
  }

function renderStatic() {
    var i, d;
    for (i = 0; i < ripples.length; i++) { ripples[i].style.opacity = 0; }
    for (i = 0; i < drinks.length; i++) {
      d = drinks[i];
      d.style.transform = "translate3d(" + (SLIDE[i] * slideFactor) + "px,0,0) scale(" + SCALE[i] + ")";
      d.style.opacity = 1;
    }
    foot.style.opacity = 1;
    foot.style.transform = "translateY(0)";
    foot.style.pointerEvents = "auto";
  }

  if (reduced) { renderStatic(); return; }

  window.requestAnimationFrame(tick);
})();

/* ================ Bottle click -> products page ================ */

(function () {
  "use strict";
  var hateMoved = false;
  var downX = null;
  var downEl = null;
  document.addEventListener("pointerdown", function (e) {
    if (!e.target.closest) return;
    var hit = e.target.closest(".spin, .drink");
    if (!hit) return;
    downX = e.clientX;
    hateMoved = false;
    downEl = hit;
  });
  document.addEventListener("pointermove", function (e) {
    if (downX === null) return;
    if (e.clientX - downX > 6 || downX - e.clientX > 6) hateMoved = true;
  });
  document.addEventListener("click", function (e) {
    if (hateMoved || !downEl) return;
    if (downEl.closest("a, button")) return;
    var hit = e.target.closest && e.target.closest(".spin, .drink");
    if (!hit && e.target.closest && e.target.closest(".hero-stage, #deliverStage")) hit = downEl;
    if (hit) { downEl = null; location.href = "products.html"; }
    downEl = null;
  });
})();
