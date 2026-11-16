/*
 * QueueLess 3D queue scene
 * ------------------------
 * A tiny 3D engine (perspective camera, depth sorting, shading) drawn on a normal 2D canvas,
 * so it needs no libraries and works even without internet.
 *
 * It shows people standing in a single-file queue. Every few seconds the person at the
 * counter is served and walks away, everyone moves one step forward and a new person joins
 * at the back - exactly what QueueLess does for real queues.
 *
 * Usage:  const scene = QueueScene.mount(canvas, { theme: 'light' });  scene.start();
 */
(function (global) {
  'use strict';

  var THEMES = {
    light: {
      floor: '#e7ebf1', lane: '#dbe2ea', grid: '#d3d9e2',
      post: '#8392a6', ribbon: '#8392a6',
      deskTop: '#d3dbe5', deskFront: '#bcc7d5', deskSide: '#a8b4c4',
      shadow: 'rgba(24,33,45,0.16)',
      bodies: ['#66768c', '#7b8aa0', '#556579', '#8795aa'],
      pants: '#3f4c5f', skin: '#d4dbe5', clerk: '#26364b',
      chipBg: '#ffffff', chipText: '#18212d', chipLine: '#c4ccd8',
      accent: '#1f4e8c', accentText: '#ffffff',
      sign: '#18212d', signText: '#ffffff', signMuted: '#a9b4c4'
    },
    dark: {
      floor: '#16233a', lane: '#1c2c47', grid: '#243756',
      post: '#7388a8', ribbon: '#7388a8',
      deskTop: '#3d506e', deskFront: '#2f4160', deskSide: '#273752',
      shadow: 'rgba(0,0,0,0.35)',
      bodies: ['#aab8cc', '#8fa0b8', '#c3cedd', '#7f91ab'],
      pants: '#5f7290', skin: '#dbe3ee', clerk: '#e8eef7',
      chipBg: '#22344f', chipText: '#e8eef7', chipLine: '#3d506e',
      accent: '#7fb0ff', accentText: '#0f1b2d',
      sign: '#e8eef7', signText: '#0f1b2d', signMuted: '#51627c'
    }
  };

  // Same font stack as the pages, so Hindi / Kannada / Tamil / Telugu / Malayalam letters draw correctly.
  var FONT = '"Noto Sans", "Noto Sans Devanagari", "Noto Sans Kannada", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Malayalam", "Nirmala UI", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  function mount(canvas, options) {
    var opt = {
      theme: 'light',
      people: 7,          // people in the queue
      cycle: 2.6,         // seconds between "next person"
      speed: 1.5,         // walking speed, metres per second
      showYou: true,      // highlight one person as "you"
      code: 'C',          // token prefix
      startNo: 12,        // first token number
      sway: 0.32,         // how far the camera swings left/right (radians)
      zoom: 1,
      yShift: 0.56,       // where the scene sits vertically (0 = top, 1 = bottom)
      pitch: 0.46,
      desk: 'Counter 1',
      tracker: false,     // 'tracker' mode: show ONE customer's real place in line
      youToken: null,
      ahead: 0,
      labels: { youNow: 'You \u00b7 your turn', youAhead: 'You \u00b7 {0} ahead', serving: 'NOW SERVING' }
    };
    for (var k in (options || {})) { opt[k] = options[k]; }

    var T = THEMES[opt.theme] || THEMES.light;
    var ctx = canvas.getContext('2d');
    var reduceMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ------------------------------ world layout ------------------------------ */
    var THETA = 0.30;                                  // the line drifts slightly away from the viewer
    var U = { x: Math.cos(THETA), z: Math.sin(THETA) }; // direction of the queue (towards the counter)
    var NRM = { x: -Math.sin(THETA), z: Math.cos(THETA) }; // sideways
    var SP = 0.95;                                     // distance between people
    var Q0 = { x: 2.2, z: 0 };                         // position of the person being served
    var COUNT = opt.people;
    var DESK = { x: Q0.x + U.x * 1.15, z: Q0.z + U.z * 1.15 };
    var CENTER = {
      x: Q0.x - U.x * ((COUNT - 1) / 2) * SP + U.x * 0.9,
      z: Q0.z - U.z * ((COUNT - 1) / 2) * SP + U.z * 0.9
    };

    function slotPos(i) {
      return { x: Q0.x - U.x * i * SP, z: Q0.z - U.z * i * SP };
    }
    function offset(p, along, side) {
      return { x: p.x + U.x * along + NRM.x * side, z: p.z + U.z * along + NRM.z * side };
    }

    /* -------------------------------- people --------------------------------- */
    var people = [];
    var nextNo = opt.startNo;
    var servingToken = pad(opt.startNo);
    var tint = 0;
    var extra = 0, youSlot = 0;

    function pad(n) { return opt.code + '-' + (n < 100 ? (n < 10 ? '00' : '0') : '') + n; }

    function addPerson(slot, atSlot, fadeIn) {
      var pos = atSlot ? slotPos(slot) : slotPos(COUNT + 0.8);
      var p = {
        x: pos.x, z: pos.z, path: [], slot: slot,
        fx: U.x, fz: U.z, phase: Math.random() * 6,
        moving: false, alpha: fadeIn ? 0 : 1, alphaTarget: 1,
        token: pad(nextNo++), leaving: false, you: false,
        body: T.bodies[tint++ % T.bodies.length],
        height: 1.62 + (tint % 3) * 0.06
      };
      if (!atSlot) { p.path.push(slotPos(slot)); }
      people.push(p);
      return p;
    }

    function trackerReset() {
      people = []; tint = 0;
      var parts = String(opt.youToken || 'C-014').split('-');
      opt.code = parts[0] || 'C';
      var youSeq = parseInt(parts[1], 10) || 14;
      youSlot = Math.min(opt.ahead, COUNT - 1);
      extra = Math.max(0, opt.ahead - (COUNT - 1));
      for (var i = COUNT - 1; i >= 0; i--) {
        var p = addPerson(i, true, false);
        p.token = pad(Math.max(1, youSeq + (i - youSlot)));
        p.you = (i === youSlot);
      }
      people.sort(function (a, b) { return a.slot - b.slot; });
      servingToken = people[0].token;
    }

    // tracker mode: called whenever the real queue position changes
    function setAhead(n) {
      if (!opt.tracker) { return; }
      var newSlot = Math.min(Math.max(0, n), COUNT - 1);
      extra = Math.max(0, n - (COUNT - 1));
      var steps = youSlot - newSlot;
      youSlot = newSlot;
      for (var s = 0; s < steps; s++) { global.setTimeout(step, s * 700); }
    }

    function reset() {
      if (opt.tracker) { trackerReset(); return; }
      people = [];
      nextNo = opt.startNo;
      tint = 0;
      for (var i = COUNT - 1; i >= 0; i--) { addPerson(i, true, false); }
      // front of the queue has the lowest token number
      people.sort(function (a, b) { return a.slot - b.slot; });
      for (var j = 0; j < people.length; j++) { people[j].token = pad(opt.startNo + j); }
      nextNo = opt.startNo + people.length;
      servingToken = people[0].token;
      if (opt.showYou) { people[Math.min(COUNT - 1, 4)].you = true; }
    }

    function step() {
      var i, p;
      var hasYou = false;
      for (i = 0; i < people.length; i++) { if (people[i].you && !people[i].leaving) { hasYou = true; } }

      for (i = 0; i < people.length; i++) {
        p = people[i];
        if (p.leaving) { continue; }
        if (p.slot === 0) {
          p.leaving = true;
          p.slot = -1;
          p.path = [offset(Q0, 0.1, 1.75), offset(Q0, 3.4, 1.75)];
        } else {
          p.slot -= 1;
          p.path = [slotPos(p.slot)];
        }
      }
      var fresh = addPerson(COUNT - 1, false, true);
      if (opt.showYou && !hasYou) { fresh.you = true; }
    }

    function update(dt) {
      var i, p, target, dx, dz, dist, move, len;
      for (i = people.length - 1; i >= 0; i--) {
        p = people[i];
        target = p.path[0];
        p.moving = false;
        if (target) {
          dx = target.x - p.x;
          dz = target.z - p.z;
          dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 0.02) {
            p.path.shift();
          } else {
            move = Math.min(dist, opt.speed * dt);
            p.x += dx / dist * move;
            p.z += dz / dist * move;
            p.phase += move * 6.2;
            p.moving = true;
            len = Math.sqrt(p.fx * p.fx + p.fz * p.fz) || 1;
            var ease = Math.min(1, dt * 9);
            p.fx = p.fx / len + (dx / dist - p.fx / len) * ease;
            p.fz = p.fz / len + (dz / dist - p.fz / len) * ease;
          }
        } else {
          // standing: slowly turn to face the counter
          var e2 = Math.min(1, dt * 5);
          p.fx += (U.x - p.fx) * e2;
          p.fz += (U.z - p.fz) * e2;
        }
        if (p.leaving && p.path.length <= 1) { p.alphaTarget = 0; }
        if (p.alpha < p.alphaTarget) { p.alpha = Math.min(p.alphaTarget, p.alpha + dt * 1.3); }
        else if (p.alpha > p.alphaTarget) { p.alpha = Math.max(p.alphaTarget, p.alpha - dt * 1.1); }

        if (p.slot === 0 && !p.leaving) {
          var s0 = slotPos(0);
          if (Math.abs(p.x - s0.x) + Math.abs(p.z - s0.z) < 0.2) { servingToken = p.token; }
        }
        if (p.leaving && p.alpha <= 0.02 && p.alphaTarget === 0) { people.splice(i, 1); }
      }
    }

    /* -------------------------------- camera --------------------------------- */
    var W = 0, H = 0, dpr = 1;
    var yaw = 0, pitch = opt.pitch, camDist = 13, ppm = 60;
    var cosY = 1, sinY = 0, cosP = 1, sinP = 0;

    function setCamera(t) {
      yaw = Math.sin(t * 0.28) * opt.sway - 0.12;
      cosY = Math.cos(yaw); sinY = Math.sin(yaw);
      cosP = Math.cos(pitch); sinP = Math.sin(pitch);
    }

    // world point -> { x, y (screen), k (pixels per metre at that depth), d (depth) }
    function project(x, y, z) {
      var rx = x - CENTER.x, ry = y - 0.8, rz = z - CENTER.z;
      var x1 = rx * cosY - rz * sinY;
      var z1 = rx * sinY + rz * cosY;
      var y1 = ry * cosP + z1 * sinP;
      var z2 = -ry * sinP + z1 * cosP;
      var d = z2 + camDist;
      var k = ppm * camDist / Math.max(0.5, d);
      return { x: W * 0.5 + x1 * k, y: H * opt.yShift - y1 * k, k: k, d: d };
    }

    function resize() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth || 600;
      var h = canvas.clientHeight || 340;
      W = w; H = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // metres of floor that must fit across the canvas: the queue plus the counter and some margin
      var widthMetres = COUNT * SP + 3.95;
      ppm = Math.min(W / widthMetres, H / 4.6) * opt.zoom;
    }

    /* ------------------------------- drawing --------------------------------- */
    function line(a, b, widthM, color, alpha) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, widthM * (a.k + b.k) / 2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function chip(sx, sy, text, bg, fg, border, size) {
      ctx.font = '600 ' + size + 'px ' + FONT;
      var w = ctx.measureText(text).width + size * 1.1;
      var h = size * 1.7;
      ctx.globalAlpha = 1;
      roundRect(sx - w / 2, sy - h, w, h, h / 2);
      ctx.fillStyle = bg;
      ctx.fill();
      if (border) { ctx.lineWidth = 1; ctx.strokeStyle = border; ctx.stroke(); }
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, sx, sy - h / 2 + 0.5);
    }

    function drawFloor() {
      var x, z, a, b, i;
      // base floor grid
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = T.grid;
      for (i = -9; i <= 9; i++) {
        a = project(i, 0, -5); b = project(i, 0, 6);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (i = -5; i <= 6; i++) {
        a = project(-9, 0, i); b = project(9, 0, i);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // queue lane
      var c1 = offset(slotPos(COUNT + 0.4), 0, -0.85);
      var c2 = offset(slotPos(COUNT + 0.4), 0, 0.85);
      var c3 = offset(slotPos(-0.4), 0, 0.85);
      var c4 = offset(slotPos(-0.4), 0, -0.85);
      var pts = [c1, c2, c3, c4].map(function (c) { return project(c.x, 0, c.z); });
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (i = 1; i < pts.length; i++) { ctx.lineTo(pts[i].x, pts[i].y); }
      ctx.closePath();
      ctx.fillStyle = T.lane;
      ctx.fill();
    }

    function faces(items, center, hu, hn, hh) {
      // a box centred on `center` with half-sizes along U, NRM and up
      function corner(su, sn, y) {
        var p = offset(center, su * hu, sn * hn);
        return project(p.x, y, p.z);
      }
      var c = {
        a: corner(-1, -1, 0), b: corner(1, -1, 0), c: corner(1, 1, 0), d: corner(-1, 1, 0),
        e: corner(-1, -1, hh), f: corner(1, -1, hh), g: corner(1, 1, hh), h: corner(-1, 1, hh)
      };
      var list = [
        { pts: [c.e, c.f, c.g, c.h], color: T.deskTop },     // top
        { pts: [c.a, c.d, c.h, c.e], color: T.deskFront },   // face towards the queue
        { pts: [c.b, c.c, c.g, c.f], color: T.deskSide },    // face towards the clerk
        { pts: [c.a, c.b, c.f, c.e], color: T.deskSide },    // short end
        { pts: [c.d, c.c, c.g, c.h], color: T.deskSide }     // short end
      ];
      list.forEach(function (f) {
        f.d = (f.pts[0].d + f.pts[1].d + f.pts[2].d + f.pts[3].d) / 4;
      });
      list.sort(function (x, y) { return y.d - x.d; });
      return list;
    }

    function drawDesk() {
      var fs = faces(null, DESK, 0.38, 1.15, 1.0);
      var sh = project(DESK.x, 0, DESK.z);
      ctx.globalAlpha = 1;
      ctx.fillStyle = T.shadow;
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, 1.5 * sh.k, 0.55 * sh.k * Math.sin(pitch), 0, 0, Math.PI * 2);
      ctx.fill();
      fs.forEach(function (f) {
        ctx.beginPath();
        ctx.moveTo(f.pts[0].x, f.pts[0].y);
        for (var i = 1; i < 4; i++) { ctx.lineTo(f.pts[i].x, f.pts[i].y); }
        ctx.closePath();
        ctx.fillStyle = f.color;
        ctx.fill();
      });
    }

    function drawPost(pos) {
      var a = project(pos.x, 0, pos.z);
      var b = project(pos.x, 0.95, pos.z);
      ctx.globalAlpha = 1;
      line(a, b, 0.05, T.post, 1);
      ctx.fillStyle = T.post;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 0.045 * b.k, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawRibbon(p1, p2) {
      var a = project(p1.x, 0.88, p1.z);
      var b = project(p2.x, 0.88, p2.z);
      line(a, b, 0.018, T.ribbon, 0.8);
    }

    function drawPerson(p, color, isClerk) {
      var bob = p.moving ? Math.abs(Math.sin(p.phase)) * 0.035 : 0;
      var swing = p.moving ? Math.sin(p.phase) : 0;
      var fl = Math.sqrt(p.fx * p.fx + p.fz * p.fz) || 1;
      var fx = p.fx / fl, fz = p.fz / fl;
      var sx = -fz, sz = fx;               // sideways vector
      var hipY = 0.92 + bob, shY = 1.44 + bob;
      var lean = p.moving ? 0.06 : 0;

      var base = project(p.x, 0, p.z);
      ctx.globalAlpha = p.alpha;
      // shadow
      ctx.fillStyle = T.shadow;
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, 0.34 * base.k, 0.34 * base.k * Math.sin(pitch), 0, 0, Math.PI * 2);
      ctx.fill();

      var hipL = project(p.x + sx * 0.09, hipY, p.z + sz * 0.09);
      var hipR = project(p.x - sx * 0.09, hipY, p.z - sz * 0.09);
      var footL = project(p.x + sx * 0.09 + fx * swing * 0.26, 0.03, p.z + sz * 0.09 + fz * swing * 0.26);
      var footR = project(p.x - sx * 0.09 - fx * swing * 0.26, 0.03, p.z - sz * 0.09 - fz * swing * 0.26);
      var hip = project(p.x, hipY, p.z);
      var sho = project(p.x + fx * lean, shY, p.z + fz * lean);

      // far leg, torso, near leg ordering is approximated by drawing legs first
      line(hipL, footL, 0.13, T.pants, p.alpha);
      line(hipR, footR, 0.13, T.pants, p.alpha);

      // arms behind torso
      var shL = project(p.x + fx * lean + sx * 0.2, shY - 0.04, p.z + fz * lean + sz * 0.2);
      var shR = project(p.x + fx * lean - sx * 0.2, shY - 0.04, p.z + fz * lean - sz * 0.2);
      var handL = project(p.x + sx * 0.22 - fx * swing * 0.22, shY - 0.58, p.z + sz * 0.22 - fz * swing * 0.22);
      var handR = project(p.x - sx * 0.22 + fx * swing * 0.22, shY - 0.58, p.z - sz * 0.22 + fz * swing * 0.22);
      line(shL, handL, 0.085, color, p.alpha);
      line(shR, handR, 0.085, color, p.alpha);

      // torso with a soft highlight for volume
      line(hip, sho, 0.38, color, p.alpha);
      var hi1 = project(p.x + fx * lean - 0.07, hipY + 0.12, p.z + fz * lean);
      var hi2 = project(p.x + fx * lean - 0.07, shY - 0.05, p.z + fz * lean);
      ctx.globalAlpha = p.alpha * 0.22;
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, 0.12 * hi1.k);
      ctx.beginPath(); ctx.moveTo(hi1.x, hi1.y); ctx.lineTo(hi2.x, hi2.y); ctx.stroke();

      // head
      var head = project(p.x + fx * lean * 1.4, shY + 0.2, p.z + fz * lean * 1.4);
      var r = 0.125 * head.k;
      var g = ctx.createRadialGradient(head.x - r * 0.35, head.y - r * 0.4, r * 0.15, head.x, head.y, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, T.skin);
      g.addColorStop(1, shade(T.skin, -0.28));
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
      ctx.fill();

      // "you" marker: a ring on the floor in the accent colour
      if (p.you && !isClerk) {
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = T.accent;
        ctx.lineWidth = Math.max(2, 0.06 * base.k);
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, 0.52 * base.k, 0.52 * base.k * Math.sin(pitch), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return head;
    }

    function shade(hex, amt) {
      var n = parseInt(hex.slice(1), 16);
      var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      function f(c) { return Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt)))); }
      return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
    }

    function render(t) {
      ctx.clearRect(0, 0, W, H);
      setCamera(t);
      drawFloor();

      var items = [];
      var i, k, pos;

      // posts and ribbons along both sides of the lane
      for (k = 0; k <= COUNT; k++) {
        [-0.8, 0.8].forEach(function (side) {
          pos = offset(slotPos(k - 0.5), 0, side);
          items.push({ d: project(pos.x, 0, pos.z).d, draw: function () { drawPost(pos); } });
          if (k < COUNT) {
            var nxt = offset(slotPos(k + 0.5), 0, side);
            var cur = pos;
            items.push({
              d: project((cur.x + nxt.x) / 2, 0.88, (cur.z + nxt.z) / 2).d,
              draw: function () { drawRibbon(cur, nxt); }
            });
          }
        });
      }

      // counter desk
      items.push({ d: project(DESK.x, 0.5, DESK.z).d, draw: drawDesk });

      // clerk behind the counter
      var clerk = { x: DESK.x + U.x * 0.95, z: DESK.z + U.z * 0.95, fx: -U.x, fz: -U.z, phase: 0, moving: false, alpha: 1, you: false };
      items.push({ d: project(clerk.x, 0, clerk.z).d, draw: function () { drawPerson(clerk, T.clerk, true); } });

      var chips = [];
      people.forEach(function (p) {
        items.push({
          d: project(p.x, 0, p.z).d,
          draw: function () {
            var head = drawPerson(p, p.body, false);
            if (p.alpha > 0.5 && !p.leaving && p.you) {
              chips.push({ p: p, head: head });
            }
          }
        });
      });

      items.sort(function (a, b) { return b.d - a.d; });
      for (i = 0; i < items.length; i++) { items[i].draw(); }

      // token chips above heads (drawn last so they are never hidden)
      chips.forEach(function (c) {
        var size = Math.max(10, Math.min(15, c.head.k * 0.2));
        var y = c.head.y - c.head.k * 0.2;
        if (c.p.you) {
          var label = c.p.slot === 0 ? opt.labels.youNow : opt.labels.youAhead.replace('{0}', c.p.slot + extra);
          chip(c.head.x, y, label, T.accent, T.accentText, null, size);
        } else {
          chip(c.head.x, y, c.p.token, T.chipBg, T.chipText, T.chipLine, size);
        }
      });

      // display above the counter
      var top = project(DESK.x, 2.25, DESK.z);
      var bw = Math.max(86, top.k * 1.9), bh = Math.max(40, top.k * 0.78);
      ctx.globalAlpha = 1;
      roundRect(top.x - bw / 2, top.y - bh / 2, bw, bh, Math.max(6, bh * 0.18));
      ctx.fillStyle = T.sign;
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = T.signMuted;
      ctx.font = '600 ' + Math.max(8, bh * 0.2) + 'px ' + FONT;
      var servSize = Math.max(8, bh * 0.2);
      while (servSize > 6 && ctx.measureText(opt.labels.serving).width > bw - 10) {
        servSize -= 0.5;
        ctx.font = '600 ' + servSize + 'px ' + FONT;
      }
      ctx.fillText(opt.labels.serving, top.x, top.y - bh * 0.24);
      ctx.fillStyle = T.signText;
      ctx.font = '700 ' + Math.max(14, bh * 0.42) + 'px ' + FONT;
      ctx.fillText(servingToken, top.x, top.y + bh * 0.16);
    }

    /* ------------------------------- main loop -------------------------------- */
    var running = false, visible = true, raf = 0, last = 0, clock = 0, acc = 0;
    var observer = null;

    function frame(now) {
      raf = 0;
      if (!running || !visible || (global.document && global.document.hidden)) { last = 0; schedule(); return; }
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      clock += dt;
      acc += dt;
      if (!opt.tracker && acc >= opt.cycle) { acc -= opt.cycle; step(); }
      update(dt);
      render(clock);
      schedule();
    }

    function schedule() {
      if (!raf && running) { raf = global.requestAnimationFrame(frame); }
    }

    function drawStill() {
      if (opt.tracker) { render(0.5); return; }
      // used for "reduced motion": simulate a few moves, then show one calm frame
      for (var n = 0; n < 3; n++) { step(); for (var s = 0; s < 40; s++) { update(0.05); } }
      render(0.5);
    }

    reset();
    resize();
    global.addEventListener('resize', function () { resize(); if (!running) { render(clock); } });

    if ('IntersectionObserver' in global) {
      observer = new global.IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) { last = 0; schedule(); }
      });
      observer.observe(canvas);
    }

    return {
      start: function () {
        if (reduceMotion) { drawStill(); return; }
        running = true; last = 0; schedule();
      },
      stop: function () {
        running = false;
        if (raf) { global.cancelAnimationFrame(raf); raf = 0; }
      },
      destroy: function () {
        this.stop();
        if (observer) { observer.disconnect(); }
      },
      resize: resize,
      setAhead: setAhead
    };
  }

  global.QueueScene = { mount: mount };
})(window);
