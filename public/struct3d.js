/* 构造三维台：同一套高程+地层同时画三维块体、地形图、剖面。离线 Canvas，无外链。 */
(function (root) {
  "use strict";
  var BEDS = [
    { fill: "#c4a574", stroke: "#8a6a3a", name: "T 砂岩" },
    { fill: "#e2c36a", stroke: "#b08920", name: "S 页岩" },
    { fill: "#d9896a", stroke: "#a34b32", name: "R 灰岩" },
    { fill: "#7dae7a", stroke: "#3d7a3d", name: "Q 砂岩" },
    { fill: "#6aa3c9", stroke: "#2f6f99", name: "P 泥岩" },
    { fill: "#9b7ab8", stroke: "#6a4a8a", name: "O 灰岩" },
    { fill: "#8a9aa8", stroke: "#556270", name: "C 石英岩" },
    { fill: "#c9b896", stroke: "#8a7a58", name: "盖层 1" },
    { fill: "#efe6c8", stroke: "#b8a878", name: "盖层 2" },
    { fill: "#f4e7b0", stroke: "#c4a84a", name: "盐岩" }
  ];
  var MODELS = [
    { id: "horizontal", name: "水平岩层", dip: 0, dipDir: 90, valley: 1, exam: "水平层：界线随等高，新在高处。坡缓露头宽，真厚度=顶底高程差。" },
    { id: "vertical", name: "直立岩层", dip: 90, dipDir: 90, valley: 1, exam: "直立层：露头线即走向线，直线穿地形，规定倾角 90°。" },
    { id: "downstream", name: "顺向坡（同大）", dip: 48, dipDir: 90, valley: 1, exam: "同向且倾角＞坡角：界线与等高线反弯，V 尖指下游=指向倾向。口诀：同反。" },
    { id: "upstream", name: "反向坡", dip: 32, dipDir: 270, valley: 1, exam: "反向：界线与等高线同弯，曲率更缓。V 尖指上游=指向倾向。口诀：反同。" },
    { id: "equalgrad", name: "等坡临界", dip: 18, dipDir: 90, valley: 1, exam: "倾角≈谷坡：河谷中界线拉直、不成 V。口诀：等坡不成 V。" },
    { id: "anticline", name: "背斜", fold: "anticline", valley: 1, exam: "核部老、两翼新。平面上两翼对称重复；未倒转时核部出露最老层。" },
    { id: "syncline", name: "向斜", fold: "syncline", valley: 1, exam: "核部新、两翼老。地形上常成谷，但向斜也可以成山，先看核翼新老。" },
    { id: "plunge", name: "倾伏背斜", fold: "plunge", valley: 1, exam: "平面闭合/V 形露头，闭合端指示倾伏向。枢纽倾伏，两翼交线指向倾伏方向。" },
    { id: "dome", name: "穹隆", fold: "dome", valley: 0.4, exam: "构造等高线闭合且内高外低；露头成环，核老翼新。闭合内高是穹隆。" },
    { id: "basin", name: "构造盆地", fold: "basin", valley: 0.4, exam: "构造等高线闭合且内低外高（可加示坡线）；核新翼老。闭合内低是盆地。" },
    { id: "normal", name: "正断层", fault: "normal", dip: 12, dipDir: 90, valley: 0.7, exam: "上盘相对下滑，张性。标志层断开、断层崖、地形等高线在断层处错开。" },
    { id: "reverse", name: "逆断层", fault: "reverse", dip: 12, dipDir: 90, valley: 0.7, exam: "上盘相对上冲，压性。剖面上盘重复变厚，平面可出现老岩推到新岩之上。" },
    { id: "strikeslip", name: "走滑断层", fault: "strike", dip: 10, dipDir: 90, valley: 1, exam: "水平错开河谷与标志层。右行=对面右移。水系同步拐弯是平面标志。" },
    { id: "unconformity", name: "角度不整合", fold: "anticline", unconf: 1, valley: 0.6, exam: "下伏倾斜/褶皱被削截，上覆较新近水平层。接触代表一次变形+剥蚀+再沉积。" },
    { id: "graben", name: "地堑地垒", fault: "graben", dip: 8, dipDir: 90, valley: 0.5, exam: "两条相向正断层，中间盘下降为地堑、两侧上升为地垒。伸展组合。" },
    { id: "thrust", name: "逆冲推覆", fault: "thrust", dip: 8, dipDir: 90, valley: 0.35, exam: "低角度逆冲：上盘沿缓断面远距离上冲，老岩叠覆新岩。平面上推覆体前缘可成飞来峰/构造窗。龙门山即叠瓦逆冲。" },
    { id: "flower", name: "正花状构造", fault: "flower", dip: 10, dipDir: 90, valley: 0.45, exam: "走滑兼挤压：剖面上两条相向逆断层交于深部走滑干，中间盘上涌成正向花状。平面线性谷+中央背斜/隆起。" },
    { id: "salt", name: "盐丘", fold: "salt", valley: 0.25, exam: "盐岩密度低、塑性上涌成底辟。围岩被拱起，顶部可成披覆背斜圈闭。平面环形露头，核为盐，翼部披覆。" },
    { id: "volcano", name: "破火山口", fold: "volcano", valley: 0.12, exam: "锥体中央因岩浆房排空塌陷成洼地。平面环形界线；破火山口尺度一般＞约1 km，火山口更小。俄勒冈火山口湖是破火山口积水。" }
  ];

  var S = {
    model: "downstream",
    yaw: 0.72,
    pitch: 0.52,
    dist: 1,
    cut: 0.5,
    topoFollow: 0,
    showStruct: 0,
    spin: 0,
    pin: null
  };
  var host = null;
  var raf = 0;
  var dragging = null;

  function model() {
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === S.model) return MODELS[i];
    return MODELS[0];
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mod(n, m) { return ((n % m) + m) % m; }

  function height(m, x, y) {
    var h = 0.46;
    h += 0.055 * Math.sin(2 * Math.PI * x) * Math.cos(2 * Math.PI * y);
    h += 0.03 * Math.cos(4.2 * Math.PI * x);
    h += 0.07 * Math.exp(-(Math.pow(x - 0.22, 2) + Math.pow(y - 0.22, 2)) / 0.035);
    h += 0.06 * Math.exp(-(Math.pow(x - 0.78, 2) + Math.pow(y - 0.78, 2)) / 0.04);
    var vAmt = (m.valley == null ? 1 : m.valley);
    var thalweg = Math.exp(-Math.pow((y - 0.5) / 0.11, 2));
    h -= 0.20 * vAmt * thalweg;
    h -= 0.09 * vAmt * x * thalweg;
    if (S.topoFollow) {
      if (m.fold === "anticline" || m.fold === "plunge") h += 0.09 * Math.cos(2 * Math.PI * (x - 0.5));
      if (m.fold === "syncline") h -= 0.09 * Math.cos(2 * Math.PI * (x - 0.5));
      if (m.fold === "dome") h += 0.10 * Math.exp(-((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5)) / 0.07);
      if (m.fold === "basin") h -= 0.08 * Math.exp(-((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5)) / 0.07);
      if (m.fold === "salt") h += 0.10 * Math.exp(-((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5)) / 0.05);
      if (m.fault === "flower" && x > 0.42 && x < 0.58) h += 0.07;
      if (m.fault === "thrust" && x > 0.38) h += 0.06;
    }
    if (m.fault === "normal") {
      if (x > 0.52) h -= 0.07;
    } else if (m.fault === "reverse") {
      if (x > 0.50) h += 0.045;
    } else if (m.fault === "graben") {
      if (x > 0.38 && x < 0.62) h -= 0.08;
    } else if (m.fault === "thrust") {
      if (x > 0.40) h += 0.05;
    } else if (m.fault === "flower") {
      if (x > 0.42 && x < 0.58) h += 0.055;
    }
    if (m.fold === "volcano") {
      var rv = Math.sqrt((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5));
      h += 0.26 * Math.max(0, 1 - rv / 0.44);
      if (rv < 0.10) h -= 0.16;
    }
    if (m.fold === "salt") {
      var rs = Math.sqrt((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5));
      h += 0.07 * Math.exp(-rs * rs / 0.045);
    }
    return clamp(h, 0.10, 0.88);
  }

  function strat(m, x, y, z) {
    var xx = x, yy = y;
    if (m.fault === "strike" && x > 0.5) yy = y - 0.14;
    if (m.fault === "flower" && x > 0.5) yy = y - 0.08;
    if (m.fault === "normal" && x > 0.52) z += 0.09;
    if (m.fault === "reverse" && x > 0.50) z -= 0.08;
    if (m.fault === "graben" && x > 0.38 && x < 0.62) z += 0.09;
    if (m.fault === "thrust" && x > 0.40) z -= 0.12;
    if (m.fault === "flower" && x > 0.42 && x < 0.58) z -= 0.08;
    if (m.fold === "salt") {
      var rs2 = Math.sqrt((xx - 0.5) * (xx - 0.5) + (yy - 0.5) * (yy - 0.5));
      var rSalt = 0.06 + 0.20 * Math.max(0, 0.85 - z);
      if (rs2 < rSalt) return 9;
    }
    if (m.unconf && z >= 0.46) {
      return 7 + Math.min(1, Math.floor((z - 0.46) / 0.08));
    }
    var s = z;
    var amp = 0.11;
    if (m.fold === "anticline") s -= amp * Math.cos(2 * Math.PI * (xx - 0.5));
    else if (m.fold === "syncline") s += amp * Math.cos(2 * Math.PI * (xx - 0.5));
    else if (m.fold === "plunge") s -= amp * Math.cos(2 * Math.PI * (xx - 0.5)) * (0.25 + 0.9 * yy);
    else if (m.fold === "dome") s -= 0.14 * Math.exp(-((xx - 0.5) * (xx - 0.5) + (yy - 0.5) * (yy - 0.5)) / 0.055);
    else if (m.fold === "basin") s += 0.14 * Math.exp(-((xx - 0.5) * (xx - 0.5) + (yy - 0.5) * (yy - 0.5)) / 0.055);
    else if (m.fold === "salt") {
      var rs3 = Math.sqrt((xx - 0.5) * (xx - 0.5) + (yy - 0.5) * (yy - 0.5));
      s -= 0.12 * Math.exp(-rs3 * rs3 / 0.05);
    } else if (m.fold === "volcano") {
      var rv2 = Math.sqrt((xx - 0.5) * (xx - 0.5) + (yy - 0.5) * (yy - 0.5));
      if (rv2 < 0.11 && z > 0.40) return 0;
      s += 0.16 * rv2;
    }
    else {
      var dip = m.dip || 0;
      var dir = (m.dipDir || 90) * Math.PI / 180;
      if (dip >= 89) {
        s = 0.35 + 1.6 * (Math.sin(dir) * (xx - 0.5) + Math.cos(dir) * (yy - 0.5));
      } else {
        s += Math.tan(dip * Math.PI / 180) * (Math.sin(dir) * (xx - 0.5) + Math.cos(dir) * (yy - 0.5));
      }
    }
    return mod(Math.floor(s / 0.07), 7);
  }

  function bedZ(m, x, y, k) {
    var lo = 0.05, hi = 0.9, mid, i;
    for (i = 0; i < 14; i++) {
      mid = (lo + hi) / 2;
      if (strat(m, x, y, mid) > k) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  function project(x, y, z, w, h) {
    var cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
    var cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
    var X = x - 0.5, Y = y - 0.5, Z = z - 0.32;
    var x1 = X * cy - Y * sy;
    var y1 = X * sy + Y * cy;
    var y2 = y1 * cp - Z * sp;
    var z2 = y1 * sp + Z * cp;
    var s = (Math.min(w, h) * 0.86 * S.dist) / (1.55 + y2);
    return { x: w * 0.5 + x1 * s, y: h * 0.58 - z2 * s, d: y2 };
  }

  function shade(rgb, k) {
    function hex(n) { n = clamp(Math.round(n), 0, 255); return (n < 16 ? "0" : "") + n.toString(16); }
    var r = parseInt(rgb.slice(1, 3), 16) * k;
    var g = parseInt(rgb.slice(3, 5), 16) * k;
    var b = parseInt(rgb.slice(5, 7), 16) * k;
    return "#" + hex(r) + hex(g) + hex(b);
  }

  function poly(ctx, pts, fill, stroke) {
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.6; ctx.stroke(); }
  }

  function draw3d(canvas) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var w = canvas.clientWidth || 320, h = canvas.clientHeight || 260;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#cfe0ee"); g.addColorStop(1, "#eef3f7");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    var m = model();
    var N = 22;
    var faces = [];
    function add(pts, col, k, dBoost) {
      if (pts.length < 3) return;
      var d = 0, i;
      for (i = 0; i < pts.length; i++) d += pts[i].d;
      d = d / pts.length + (dBoost || 0);
      faces.push({ pts: pts, col: col, k: k, d: d });
    }
    var i, j, x0, y0, x1, y1, z00, z10, z01, z11, b, p00, p10, p01, p11;
    for (j = 0; j < N; j++) {
      for (i = 0; i < N; i++) {
        x0 = i / N; y0 = j / N; x1 = (i + 1) / N; y1 = (j + 1) / N;
        z00 = height(m, x0, y0); z10 = height(m, x1, y0);
        z01 = height(m, x0, y1); z11 = height(m, x1, y1);
        b = strat(m, (x0 + x1) / 2, (y0 + y1) / 2, (z00 + z11) / 2);
        p00 = project(x0, y0, z00, w, h);
        p10 = project(x1, y0, z10, w, h);
        p01 = project(x0, y1, z01, w, h);
        p11 = project(x1, y1, z11, w, h);
        var nx = (z10 - z00) * N, ny = (z01 - z00) * N;
        var lum = clamp(0.62 + 0.38 * (-nx * 0.4 + 0.75 - ny * 0.2), 0.42, 1.05);
        add([p00, p10, p11, p01], shade((BEDS[b] || BEDS[0]).fill, lum), 0);
      }
    }
    function side(axis, at, u0, u1, v0, v1, kShade) {
      var steps = 18, zs = 10, u, v, z, zz, b2, pts;
      for (var su = 0; su < steps; su++) {
        u = lerp(u0, u1, su / steps);
        var un = lerp(u0, u1, (su + 1) / steps);
        var hA = axis === "y" ? height(m, at, u) : height(m, u, at);
        var hB = axis === "y" ? height(m, at, un) : height(m, un, at);
        var hTop = Math.max(hA, hB);
        for (var sz = 0; sz < zs; sz++) {
          z = (sz / zs) * hTop;
          zz = ((sz + 1) / zs) * hTop;
          if (z > hTop) continue;
          var za = Math.min(zz, hA), zb = Math.min(zz, hB);
          if (za <= z && zb <= z) continue;
          b2 = axis === "y" ? strat(m, at, (u + un) / 2, (z + zz) / 2) : strat(m, (u + un) / 2, at, (z + zz) / 2);
          if (axis === "y") {
            pts = [
              project(at, u, Math.min(z, hA), w, h),
              project(at, un, Math.min(z, hB), w, h),
              project(at, un, Math.min(zz, hB), w, h),
              project(at, u, Math.min(zz, hA), w, h)
            ];
          } else {
            pts = [
              project(u, at, Math.min(z, hA), w, h),
              project(un, at, Math.min(z, hB), w, h),
              project(un, at, Math.min(zz, hB), w, h),
              project(u, at, Math.min(zz, hA), w, h)
            ];
          }
          add(pts, shade((BEDS[b2] || BEDS[0]).fill, kShade), 0, 0.01);
        }
      }
    }
    side("y", 0, 0, 1, 0, 1, 0.72);
    side("y", 1, 0, 1, 0, 1, 0.86);
    side("x", 0, 0, 1, 0, 1, 0.64);
    side("x", 1, 0, 1, 0, 1, 0.90);

    var cut = S.cut;
    var cpts = [];
    for (i = 0; i <= N; i++) {
      var xx = i / N, zz = height(m, xx, cut);
      cpts.push(project(xx, cut, zz, w, h));
    }
    faces.sort(function (a, b) { return b.d - a.d; });
    for (i = 0; i < faces.length; i++) poly(ctx, faces[i].pts, faces[i].col, "rgba(40,50,60,.18)");

    ctx.beginPath();
    ctx.moveTo(cpts[0].x, cpts[0].y);
    for (i = 1; i < cpts.length; i++) ctx.lineTo(cpts[i].x, cpts[i].y);
    ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 1.6; ctx.stroke();

    if (S.pin) {
      var pz = height(m, S.pin.x, S.pin.y);
      var pp = project(S.pin.x, S.pin.y, pz, w, h);
      ctx.beginPath(); ctx.arc(pp.x, pp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#dc2626"; ctx.fill();
    }
    ctx.fillStyle = "rgba(22,32,46,.72)";
    ctx.font = "11px sans-serif";
    ctx.fillText("拖动旋转 · 滚轮远近", 8, 16);
  }

  function marching(fn, w, n, iso) {
    var segs = [], i, j, a, b, c, d, idx, p;
    function interp(x0, y0, v0, x1, y1, v1) {
      var t = (iso - v0) / ((v1 - v0) || 1e-6);
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
    }
    for (j = 0; j < n; j++) {
      for (i = 0; i < n; i++) {
        var x0 = i / n, y0 = j / n, x1 = (i + 1) / n, y1 = (j + 1) / n;
        a = fn(x0, y0); b = fn(x1, y0); c = fn(x1, y1); d = fn(x0, y1);
        idx = (a > iso ? 1 : 0) | (b > iso ? 2 : 0) | (c > iso ? 4 : 0) | (d > iso ? 8 : 0);
        p = [];
        if (idx === 0 || idx === 15) continue;
        if (idx === 1 || idx === 14 || idx === 13 || idx === 2) p.push(interp(x0, y0, a, x1, y0, b));
        if (idx === 2 || idx === 13 || idx === 11 || idx === 4) p.push(interp(x1, y0, b, x1, y1, c));
        if (idx === 4 || idx === 11 || idx === 7 || idx === 8) p.push(interp(x1, y1, c, x0, y1, d));
        if (idx === 8 || idx === 7 || idx === 14 || idx === 1) p.push(interp(x0, y1, d, x0, y0, a));
        if (idx === 5 || idx === 10) {
          segs.push([interp(x0, y0, a, x1, y0, b), interp(x1, y0, b, x1, y1, c)]);
          segs.push([interp(x1, y1, c, x0, y1, d), interp(x0, y1, d, x0, y0, a)]);
        } else if (p.length >= 2) segs.push([p[0], p[1]]);
      }
    }
    return segs;
  }

  function toMap(x, y, w, h, pad) {
    return { x: pad + x * (w - 2 * pad), y: pad + (1 - y) * (h - 2 * pad) };
  }

  function drawMap(canvas) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var w = canvas.clientWidth || 320, h = canvas.clientHeight || 260;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f4efe4";
    ctx.fillRect(0, 0, w, h);
    var m = model();
    var pad = 28;
    var n = 48, i, j, x, y, z, b, p, q;
    for (j = 0; j < n; j++) {
      for (i = 0; i < n; i++) {
        x = (i + 0.5) / n; y = (j + 0.5) / n;
        z = height(m, x, y);
        b = strat(m, x, y, z);
        p = toMap(i / n, (j + 1) / n, w, h, pad);
        q = toMap((i + 1) / n, j / n, w, h, pad);
        ctx.fillStyle = (BEDS[b] || BEDS[0]).fill;
        ctx.fillRect(p.x, q.y, q.x - p.x + 0.6, p.y - q.y + 0.6);
      }
    }
    function hfun(xx, yy) { return height(m, xx, yy); }
    var levels = [0.22, 0.28, 0.34, 0.40, 0.46, 0.52, 0.58, 0.64];
    ctx.lineJoin = "round";
    for (i = 0; i < levels.length; i++) {
      var segs = marching(hfun, w, 36, levels[i]);
      ctx.beginPath();
      var index = i % 2 === 0;
      ctx.strokeStyle = index ? "#8b4513" : "#c4a484";
      ctx.lineWidth = index ? 1.4 : 0.7;
      for (j = 0; j < segs.length; j++) {
        var a = toMap(segs[j][0].x, segs[j][0].y, w, h, pad);
        var c = toMap(segs[j][1].x, segs[j][1].y, w, h, pad);
        ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
      }
      ctx.stroke();
    }
    if (S.showStruct) {
      function sfun(xx, yy) { return bedZ(m, xx, yy, 3); }
      var sl = [0.20, 0.28, 0.36, 0.44, 0.52, 0.60];
      ctx.strokeStyle = "#6d28d9"; ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (i = 0; i < sl.length; i++) {
        segs = marching(sfun, w, 28, sl[i]);
        for (j = 0; j < segs.length; j++) {
          a = toMap(segs[j][0].x, segs[j][0].y, w, h, pad);
          c = toMap(segs[j][1].x, segs[j][1].y, w, h, pad);
          ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
        }
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (i = 0; i <= 24; i++) {
      x = i / 24;
      p = toMap(x, 0.5, w, h, pad);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    var cutp0 = toMap(0, S.cut, w, h, pad), cutp1 = toMap(1, S.cut, w, h, pad);
    ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 1.4; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(cutp0.x, cutp0.y); ctx.lineTo(cutp1.x, cutp1.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#dc2626"; ctx.font = "11px sans-serif";
    ctx.fillText("A", cutp0.x - 12, cutp0.y - 4);
    ctx.fillText("A′", cutp1.x + 4, cutp1.y - 4);

    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1.5;
    ctx.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);
    ctx.fillStyle = "#1e293b"; ctx.font = "12px sans-serif";
    ctx.fillText("N", w / 2 - 4, pad - 8);
    ctx.beginPath(); ctx.moveTo(w / 2, pad - 2); ctx.lineTo(w / 2 - 5, pad + 8); ctx.lineTo(w / 2 + 5, pad + 8); ctx.closePath(); ctx.fill();
    ctx.font = "10px sans-serif";
    ctx.fillText("等高距示意 · 棕色=地形  色块=露头  蓝线=河谷", pad, h - 8);
    if (S.showStruct) ctx.fillText("紫虚线=构造等高（标志层）", pad, h - 20);

    if (S.pin) {
      p = toMap(S.pin.x, S.pin.y, w, h, pad);
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#dc2626"; ctx.fill();
    }
  }

  function drawSec(canvas) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var w = canvas.clientWidth || 640, h = canvas.clientHeight || 120;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f7f1e6"; ctx.fillRect(0, 0, w, h);
    var m = model();
    var pad = 16, innerW = w - 2 * pad, innerH = h - 28;
    var n = 80, i, x, z, b, px, py, z2;
    function X(xx) { return pad + xx * innerW; }
    function Y(zz) { return pad + (0.85 - zz) * innerH / 0.85; }
    for (i = 0; i < n; i++) {
      x = (i + 0.5) / n;
      var x0 = i / n, x1 = (i + 1) / n;
      z = height(m, x, S.cut);
      for (var k = 0; k < 12; k++) {
        var za = k / 12 * z, zb = (k + 1) / 12 * z;
        b = strat(m, x, S.cut, (za + zb) / 2);
        ctx.fillStyle = (BEDS[b] || BEDS[0]).fill;
        ctx.fillRect(X(x0), Y(zb), X(x1) - X(x0) + 0.4, Y(za) - Y(zb) + 0.4);
      }
    }
    ctx.beginPath();
    for (i = 0; i <= n; i++) {
      x = i / n; z = height(m, x, S.cut);
      px = X(x); py = Y(z);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = "#1e293b"; ctx.font = "11px sans-serif";
    ctx.fillText("A", pad, h - 6); ctx.fillText("A′", w - pad - 12, h - 6);
    ctx.fillText("剖面  上为新（未倒转）· 切线位置可用滑条移动", pad + 24, h - 6);
  }

  function noteText() {
    var m = model();
    var extra = S.topoFollow ? "当前地形随构造起伏（可对比背斜成山）。" : "当前地形独立于构造（夷平面上的露头型式，实习常用）。";
    extra += S.showStruct ? " 紫虚线是标志层的构造等高线：间距密=倾角陡，闭合内高=穹隆。" : "";
    return m.exam + " " + extra + " 三维块、平面图、A—A′ 剖面共用同一高程场和同一套地层。";
  }

  function paint() {
    if (!host) return;
    var c3 = host.querySelector("#s3d-c3");
    var cm = host.querySelector("#s3d-cmap");
    var cs = host.querySelector("#s3d-csec");
    if (c3) draw3d(c3);
    if (cm) drawMap(cm);
    if (cs) drawSec(cs);
    var note = host.querySelector("#s3d-note");
    if (note) note.textContent = noteText();
    var chips = host.querySelectorAll("[data-s3d-model]");
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle("on", chips[i].getAttribute("data-s3d-model") === S.model);
    var spinBtn = host.querySelector("#s3d-spin");
    if (spinBtn) spinBtn.classList.toggle("on", !!S.spin);
    var follow = host.querySelector("#s3d-follow");
    if (follow) follow.classList.toggle("on", !!S.topoFollow);
    var sc = host.querySelector("#s3d-struct");
    if (sc) sc.classList.toggle("on", !!S.showStruct);
  }

  function loop() {
    if (S.spin) {
      S.yaw += 0.008;
      paint();
      raf = root.requestAnimationFrame(loop);
    } else raf = 0;
  }

  function bindCanvas3(c) {
    var last = null;
    function pt(ev) {
      if (ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
      return { x: ev.clientX, y: ev.clientY };
    }
    c.addEventListener("pointerdown", function (ev) {
      c.setPointerCapture(ev.pointerId);
      last = pt(ev); S.spin = 0; dragging = "orb";
    });
    c.addEventListener("pointermove", function (ev) {
      if (dragging !== "orb" || !last) return;
      var p = pt(ev);
      S.yaw += (p.x - last.x) * 0.008;
      S.pitch = clamp(S.pitch + (p.y - last.y) * 0.006, 0.18, 1.2);
      last = p; paint();
    });
    c.addEventListener("pointerup", function () { dragging = null; last = null; });
    c.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      S.dist = clamp(S.dist * (ev.deltaY > 0 ? 0.94 : 1.06), 0.7, 1.6);
      paint();
    }, { passive: false });
  }

  function bindMap(c) {
    function xy(ev) {
      var r = c.getBoundingClientRect();
      var pad = 28;
      var x = (ev.clientX - r.left - pad) / (r.width - 2 * pad);
      var y = 1 - (ev.clientY - r.top - pad) / (r.height - 2 * pad);
      return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
    }
    c.addEventListener("pointerdown", function (ev) {
      S.pin = xy(ev); paint();
    });
  }

  function shell() {
    var chips = MODELS.map(function (m) {
      return '<button type="button" class="mini" data-s3d-model="' + m.id + '">' + m.name + "</button>";
    }).join("");
    return '<div class="s3d-head"><h2>构造三维台 · 块体 ↔ 地形图 ↔ 剖面</h2>' +
      '<span>同一高程场 · 交互旋转</span></div>' +
      '<div class="s3d-models">' + chips + "</div>" +
      '<div class="s3d-tools">' +
        '<button type="button" class="mini" id="s3d-spin">旋转</button>' +
        '<button type="button" class="mini" id="s3d-follow">地形随构造</button>' +
        '<button type="button" class="mini" id="s3d-struct">构造等高线</button>' +
        '<label class="s3d-cut">剖面 A—A′ <input id="s3d-cut" type="range" min="15" max="85" value="50"></label>' +
      "</div>" +
      '<div class="s3d-stage">' +
        '<div class="s3d-pane"><span class="s3d-cap">三维块体（可旋转）</span><canvas id="s3d-c3"></canvas></div>' +
        '<div class="s3d-pane"><span class="s3d-cap">对应地形地质图</span><canvas id="s3d-cmap"></canvas></div>' +
      "</div>" +
      '<div class="s3d-sec"><canvas id="s3d-csec"></canvas></div>' +
      '<p class="s3d-note" id="s3d-note"></p>' +
      '<p class="s3d-hint">口诀：反同同小，同反同大。水平随等高；直立成直线；等坡不成 V。闭合内高是穹隆，闭合内低是盆地。密陡疏缓。盐丘看核部浅色底辟与披覆；正花状看中央上涌；破火山口看环形洼地。点平面图可钉位置，三维块同步亮点。</p>';
  }

  function bind() {
    host.onclick = function (ev) {
      var t = ev.target;
      if (t.getAttribute && t.getAttribute("data-s3d-model")) {
        S.model = t.getAttribute("data-s3d-model"); S.pin = null; paint();
      }
    };
    host.querySelector("#s3d-spin").onclick = function () {
      S.spin = S.spin ? 0 : 1;
      if (S.spin && !raf) raf = root.requestAnimationFrame(loop);
      paint();
    };
    host.querySelector("#s3d-follow").onclick = function () { S.topoFollow = S.topoFollow ? 0 : 1; paint(); };
    host.querySelector("#s3d-struct").onclick = function () { S.showStruct = S.showStruct ? 0 : 1; paint(); };
    host.querySelector("#s3d-cut").oninput = function () { S.cut = this.value / 100; paint(); };
    bindCanvas3(host.querySelector("#s3d-c3"));
    bindMap(host.querySelector("#s3d-cmap"));
    if (root.ResizeObserver) {
      var ro = new ResizeObserver(function () { paint(); });
      ro.observe(host);
    }
  }

  function mount(id) {
    var el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el) return;
    host = el;
    if (el.getAttribute("data-s3d") !== "1") {
      el.className = (el.className ? el.className + " " : "") + "s3d-host";
      el.innerHTML = shell();
      el.setAttribute("data-s3d", "1");
      bind();
    }
    host.querySelector("#s3d-cut").value = String(Math.round(S.cut * 100));
    paint();
  }

  root.Struct3D = { mount: mount, models: MODELS, state: S, paint: paint };
})(window);
