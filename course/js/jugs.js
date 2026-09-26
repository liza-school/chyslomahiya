/* Відра без поділок: симулятор переливань.
   Відро знає лише «порожнє» і «повне», тому кожне нове число народжується під час переливання:
   або різниця (друге відро наповнилося), або сума (перше спорожніло в неповне друге).
   Після такого переливання відро накривається кришкою, і симулятор питає, скільки в ньому тепер —
   на око не видно, бо рисок немає. Далі лити не можна, доки дитина не порахує. */

const JUGS = (function () {
  const el = COURSE.el;

  /* Звідки береться рідина і куди її виливають. Бензин і молоко виливати нікуди —
     тоді джерела немає взагалі, а роль озера грає найбільша повна посудина. */
  const SOURCES = {
    lake: { from: "з\u00a0озера", to: "в\u00a0озеро", place: "Озеро поруч — води скільки завгодно." },
    tap: { from: "з\u00a0крана", to: "у\u00a0раковину", place: "Кран поруч — води скільки завгодно." },
    river: { from: "з\u00a0річки", to: "у\u00a0річку", place: "Річка поруч — води скільки завгодно." },
  };

  /* Нерозривні пробіли: «14 л» і «з озера» не рвуться між рядками вузької таблиці,
     а стрілка тримається лівої половини — рядок, якщо треба, ламається саме після неї. */
  const ARROW = "\u00a0→ ";

  const MAX_H = 150; // найвища посудина на екрані, px
  const MIN_H = 28; // однолітрове відро теж має бути видно

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  function namesOf(cfg) {
    const names = cfg.vessels.map((cap) => cap + "\u00a0л");
    const twice = names.some((name, i) => names.indexOf(name) !== i);
    return twice ? names.map((name, i) => name + " (" + (i + 1) + ")") : names;
  }

  function startOf(cfg) {
    return cfg.start ? cfg.start.slice() : cfg.vessels.map(() => 0);
  }

  /* Хід записується коротко: F0 — набрати посудину 0, E1 — вилити посудину 1, P01 — перелити з 0 у 1. */
  function parse(code) {
    if (code[0] === "F") return { type: "fill", i: Number(code[1]) };
    if (code[0] === "E") return { type: "empty", i: Number(code[1]) };
    return { type: "pour", i: Number(code[1]), j: Number(code[2]) };
  }

  /* Один крок. Повертає новий стан або null, якщо крок нічого не змінює. */
  function apply(caps, state, move) {
    const next = state.slice();
    if (move.type === "fill") {
      if (next[move.i] === caps[move.i]) return null;
      next[move.i] = caps[move.i];
    } else if (move.type === "empty") {
      if (next[move.i] === 0) return null;
      next[move.i] = 0;
    } else {
      const amount = Math.min(next[move.i], caps[move.j] - next[move.j]);
      if (!amount) return null;
      next[move.i] -= amount;
      next[move.j] += amount;
    }
    return next;
  }

  function allMoves(caps, open) {
    const list = [];
    caps.forEach((_, i) => {
      if (open) list.push({ type: "fill", i: i }, { type: "empty", i: i });
      caps.forEach((__, j) => {
        if (i !== j) list.push({ type: "pour", i: i, j: j });
      });
    });
    return list;
  }

  /* Мета: потрібне число в одній із дозволених посудин або точний розклад по всіх. */
  function goalOf(cfg) {
    if (cfg.exact) return (state) => state.every((amount, i) => amount === cfg.exact[i]);
    if (cfg.target === undefined || cfg.target === null) return null;
    const where = cfg.targetIn || cfg.vessels.map((_, i) => i);
    return (state) => where.some((i) => state[i] === cfg.target);
  }

  function hitCells(cfg, state) {
    const hits = new Set();
    if (cfg.exact) {
      cfg.exact.forEach((amount, i) => {
        if (amount && state[i] === amount) hits.add(i);
      });
    } else if (cfg.target !== undefined && cfg.target !== null) {
      (cfg.targetIn || state.map((_, i) => i)).forEach((i) => {
        if (state[i] === cfg.target) hits.add(i);
      });
    }
    return hits;
  }

  /* Найкоротший шлях — пошук ушир по всіх станах. Посудин щонайбільше три по 20 л,
     тож станів кілька тисяч, і рахується це миттєво. −1 — мета недосяжна. */
  function shortest(cfg) {
    const goal = goalOf(cfg);
    if (!goal) return null;
    const caps = cfg.vessels;
    const moves = allMoves(caps, Boolean(SOURCES[cfg.source]));
    const start = startOf(cfg);
    const seen = new Set([start.join(",")]);
    let layer = [start];
    for (let depth = 0; layer.length; depth++) {
      const next = [];
      for (const state of layer) {
        if (goal(state)) return depth;
        for (const move of moves) {
          const after = apply(caps, state, move);
          if (!after) continue;
          const key = after.join(",");
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(after);
        }
      }
      layer = next;
    }
    return -1;
  }

  /* Рядок кола: що по черзі зʼявляється у великому відрі, коли ллєш мале у велике.
     Додаємо мале; перевалило за велике — віднімаємо велике; дійшли рівно до великого — коло замкнулося.
     Коло «велике в мале» дає той самий рядок задом наперед. */
  function circleRow(a, b) {
    const small = Math.min(a, b);
    const big = Math.max(a, b);
    const row = [];
    if (small === big) return row;
    let x = 0;
    for (;;) {
      x += small;
      if (x > big) x -= big;
      if (x === big) return row;
      row.push(x);
    }
  }

  /* Стрілка — куди тече рідина: «з озера → 7 л», «10 л → в озеро», «7 л → 10 л». */
  function describe(move, names, source) {
    if (move.type === "fill") return (source ? source.from : "?") + ARROW + names[move.i];
    if (move.type === "empty") return names[move.i] + ARROW + (source ? source.to : "?");
    return names[move.i] + ARROW + names[move.j];
  }

  function stepsWord(n) {
    const last = n % 10;
    const lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 14) return "кроків";
    if (last === 1) return "крок";
    if (last >= 2 && last <= 4) return "кроки";
    return "кроків";
  }

  /* Таблиця для розвʼязання: у занятті записуються лише ходи, а літри в кожному рядку
     рахує цей самий рушій. Хід, що нічого не змінює, або розвʼязання, яке не доходить
     до мети, — помилка в даних, і перевірка ловить її в консолі. */
  function play(cfg, codes) {
    const caps = cfg.vessels;
    const goal = goalOf(cfg);
    let state = startOf(cfg);
    const steps = [{ state: state, move: null }];
    codes.forEach((code, k) => {
      const move = parse(code);
      const after = apply(caps, state, move);
      if (!after) {
        console.error("JUGS: хід " + code + " на кроці " + (k + 1) + " нічого не змінює");
        return;
      }
      state = after;
      steps.push({ state: state, move: move });
    });
    if (goal && !goal(state)) console.error("JUGS: розвʼязання не доходить до мети (" + state.join(", ") + ")");
    return steps;
  }

  function table(cfg, codes) {
    const names = namesOf(cfg);
    const source = SOURCES[cfg.source];
    const rows = play(cfg, codes).map((entry, k) => ({
      step: k,
      state: entry.state,
      what: entry.move ? describe(entry.move, names, source) : "початок",
    }));
    const state = rows[rows.length - 1].state;
    const hits = hitCells(cfg, state);
    const last = rows.length - 1;
    return (
      '<div class="pour-wrap"><table class="pour-table"><thead><tr><th>Крок</th>' +
      names.map((name) => "<th>" + name + "</th>").join("") +
      "<th>Що зробили</th></tr></thead><tbody>" +
      rows
        .map(
          (row, r) =>
            "<tr><td>" + row.step + "</td>" +
            row.state.map((amount, i) => (r === last && hits.has(i) ? '<td class="hit">' : "<td>") + amount + "</td>").join("") +
            "<td>" + row.what + "</td></tr>"
        )
        .join("") +
      "</tbody></table></div>"
    );
  }

  /* ---------- більярд: стан — точка, крок — відрізок ---------- */

  /* Дві посудини з джерелом: по горизонталі перша, по вертикалі друга.
     Три посудини без джерела: усього рідини не меншає й не більшає, тож стан задають
     дві менші посудини, а велика (перша) тримає решту. Інших випадків у задачах немає. */
  function planeOf(cfg) {
    const caps = cfg.vessels;
    const open = Boolean(SOURCES[cfg.source]);
    if (caps.length === 2 && open) return { ax: 0, ay: 1, big: -1, total: 0 };
    if (caps.length === 3 && !open) return { ax: 1, ay: 2, big: 0, total: startOf(cfg).reduce((a, b) => a + b, 0) };
    return null;
  }

  /* Повний стан за точкою стола. Точка можлива, якщо жодна посудина не від'ємна й не переповнена;
     на бортику — якщо хоч одна посудина порожня або повна. */
  function stateAt(cfg, plane, x, y) {
    const state = cfg.vessels.map(() => 0);
    state[plane.ax] = x;
    state[plane.ay] = y;
    if (plane.big >= 0) state[plane.big] = plane.total - x - y;
    return state;
  }

  const fits = (cfg, state) => state.every((amount, i) => amount >= 0 && amount <= cfg.vessels[i]);
  const onRail = (cfg, state) => state.some((amount, i) => amount === 0 || amount === cfg.vessels[i]);

  /* Відрізаємо від многокутника півплощину, де f < 0 (f — лінійна). */
  function clip(poly, f) {
    const out = [];
    poly.forEach((p, k) => {
      const q = poly[(k + 1) % poly.length];
      const fp = f(p);
      const fq = f(q);
      if (fp >= 0) out.push(p);
      if ((fp > 0 && fq < 0) || (fp < 0 && fq > 0)) {
        const t = fp / (fp - fq);
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    });
    return out;
  }

  let svgIds = 0;

  /* Малює стіл і шлях кулі. states — усі відомі стани по черзі; ghost — стан під кришкою:
     куди куля покотилася, видно лише напрямком, а де зупинилася — дитина рахує сама. */
  function billiardSVG(cfg, states, ghost) {
    const plane = planeOf(cfg);
    if (!plane) return "";
    const caps = cfg.vessels;
    const names = namesOf(cfg);
    const W = caps[plane.ax];
    const H = caps[plane.ay];
    let poly = [[0, 0], [W, 0], [W, H], [0, H]];
    if (plane.big >= 0) {
      const most = plane.total;
      const least = plane.total - caps[plane.big];
      poly = clip(poly, (p) => most - p[0] - p[1]);
      poly = clip(poly, (p) => p[0] + p[1] - least);
    }

    const u = Math.max(7, Math.min(40, 230 / H, 230 / W));
    const L = 34;
    const T = 10;
    const R = 28;
    const B = 34;
    const X = (x) => +(L + x * u).toFixed(1);
    const Y = (y) => +(T + (H - y) * u).toFixed(1);
    const w = Math.round(L + W * u + R);
    const h = Math.round(T + H * u + B);
    const at = (state) => [X(state[plane.ax]), Y(state[plane.ay])];
    const id = "bil" + ++svgIds;
    const polyPoints = poly.map((p) => X(p[0]) + "," + Y(p[1])).join(" ");
    const out = [];

    out.push('<svg class="billiard" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Більярд: кожна точка — стан, кожен відрізок — крок">');
    out.push('<defs><clipPath id="' + id + '"><polygon points="' + polyPoints + '"/></clipPath></defs>');
    out.push('<polygon class="bil-cloth" points="' + polyPoints + '"/>');

    let grid = "";
    for (let x = 1; x < W; x++) grid += "M" + X(x) + " " + Y(0) + "V" + Y(H);
    for (let y = 1; y < H; y++) grid += "M" + X(0) + " " + Y(y) + "H" + X(W);
    if (grid) out.push('<path class="bil-grid" clip-path="url(#' + id + ')" d="' + grid + '"/>');

    /* Золота лінія — усі стани, де в потрібній посудині потрібне число. */
    if (cfg.target !== undefined && cfg.target !== null && !cfg.exact) {
      const t = cfg.target;
      (cfg.targetIn || caps.map((_, i) => i)).forEach((v) => {
        if (t > caps[v]) return;
        let d = "";
        let label = null;
        if (v === plane.ax) {
          d = "M" + X(t) + " " + Y(0) + "V" + Y(H);
          label = [X(t) + 3, Y(H) + 11, "start"];
        } else if (v === plane.ay) {
          d = "M" + X(0) + " " + Y(t) + "H" + X(W);
          label = [X(W) + 3, Y(t) + 4, "start"];
        } else if (v === plane.big) {
          const c = plane.total - t;
          d = "M" + X(c) + " " + Y(0) + "L" + X(0) + " " + Y(c);
        }
        if (!d) return;
        out.push('<path class="bil-goal" clip-path="url(#' + id + ')" d="' + d + '"/>');
        if (label) out.push('<text class="bil-goal-label" x="' + label[0] + '" y="' + label[1] + '" text-anchor="' + label[2] + '">' + t + "</text>");
      });
    }

    out.push('<polygon class="bil-rail" points="' + polyPoints + '"/>');

    /* Лунки бортика: усі стани, де куля взагалі може зупинитися. */
    let rail = "";
    for (let x = 0; x <= W; x++) {
      for (let y = 0; y <= H; y++) {
        const state = stateAt(cfg, plane, x, y);
        if (fits(cfg, state) && onRail(cfg, state)) rail += '<circle cx="' + X(x) + '" cy="' + Y(y) + '" r="1.8"/>';
      }
    }
    out.push('<g class="bil-hole">' + rail + "</g>");

    if (cfg.exact) {
      const [gx, gy] = at(cfg.exact);
      out.push('<text class="bil-star" x="' + gx + '" y="' + (gy + 5) + '" text-anchor="middle">★</text>');
    }
    (cfg.forbidden || []).forEach((state) => {
      const [fx, fy] = at(state);
      out.push('<path class="bil-forbidden" d="M' + (fx - 5) + " " + (fy - 5) + "L" + (fx + 5) + " " + (fy + 5) + "M" + (fx + 5) + " " + (fy - 5) + "L" + (fx - 5) + " " + (fy + 5) + '"/>');
    });

    const points = states.map(at);
    if (points.length > 1) out.push('<polyline class="bil-path" points="' + points.map((p) => p.join(",")).join(" ") + '"/>');
    points.forEach((p, k) => {
      if (k) out.push('<circle class="bil-step" cx="' + p[0] + '" cy="' + p[1] + '" r="2.6"/>');
    });

    /* Номер кроку біля кожної зупинки — ті самі номери, що в таблиці. Підпис зсунуто до середини стола,
       щоб не налазив на цифри осей; якщо куля стояла тут кілька разів — усі номери через кому. */
    const stops = new Map();
    points.forEach((p, k) => {
      if (!k) return;
      const spot = p.join(",");
      stops.set(spot, (stops.get(spot) || []).concat(k));
    });
    const centerX = X(W / 2);
    const centerY = Y(H / 2);
    stops.forEach((numbers, spot) => {
      const [px, py] = spot.split(",").map(Number);
      const nx = px + Math.sign(centerX - px) * 8;
      const ny = py + Math.sign(centerY - py) * 8 + 3.5;
      out.push('<text class="bil-num" x="' + nx + '" y="' + ny + '" text-anchor="middle">' + numbers.join(",") + "</text>");
    });
    const here = points[points.length - 1];
    if (ghost) {
      const [gx, gy] = at(ghost);
      const len = Math.hypot(gx - here[0], gy - here[1]) || 1;
      const k = Math.min(1, (u * 1.1) / len);
      const tip = [+(here[0] + (gx - here[0]) * k).toFixed(1), +(here[1] + (gy - here[1]) * k).toFixed(1)];
      out.push('<line class="bil-ghost" x1="' + here[0] + '" y1="' + here[1] + '" x2="' + tip[0] + '" y2="' + tip[1] + '"/>');
      out.push('<text class="bil-ghost-label" x="' + (tip[0] + 4) + '" y="' + (tip[1] - 4) + '">?</text>');
    }
    out.push('<circle class="bil-ball" cx="' + here[0] + '" cy="' + here[1] + '" r="6"/>');

    const every = u >= 14 ? 1 : u >= 9 ? 2 : 5;
    let ticks = "";
    for (let x = 0; x <= W; x += every) ticks += '<text x="' + X(x) + '" y="' + (Y(0) + 13) + '" text-anchor="middle">' + x + "</text>";
    for (let y = every; y <= H; y += every) ticks += '<text x="' + (X(0) - 5) + '" y="' + (Y(y) + 4) + '" text-anchor="end">' + y + "</text>";
    out.push('<g class="bil-axis">' + ticks + "</g>");
    out.push('<text class="bil-name" x="' + X(W) + '" y="' + (Y(0) + 28) + '" text-anchor="end">' + names[plane.ax] + " →</text>");
    const midY = (Y(0) + Y(H)) / 2;
    out.push('<text class="bil-name" x="11" y="' + midY + '" text-anchor="middle" transform="rotate(-90 11 ' + midY + ')">' + names[plane.ay] + " →</text>");
    out.push("</svg>");
    return out.join("");
  }

  function billiardCaption(cfg) {
    const plane = planeOf(cfg);
    const names = namesOf(cfg);
    return (
      "По горизонталі — " + names[plane.ax] + ", по вертикалі — " + names[plane.ay] + "." +
      (plane.big >= 0 ? " У посудині на " + names[plane.big] + " — решта." : "") +
      " Точка — стан, відрізок — крок."
    );
  }

  /* Більярд для розвʼязання: ті самі ходи, що й у таблиці. */
  function billiard(cfg, codes) {
    const svg = billiardSVG(cfg, play(cfg, codes).map((entry) => entry.state));
    return '<figure class="bil-figure">' + svg + "<figcaption>" + billiardCaption(cfg) + "</figcaption></figure>";
  }

  /* Карта ходів: ряд N — стани, до яких найшвидше дістатися рівно за N кроків.
     Стрілки — лише в наступний ряд: повернення в уже відомий стан нічого не дає. */
  function stateMap(cfg, depth) {
    const caps = cfg.vessels;
    const moves = allMoves(caps, Boolean(SOURCES[cfg.source]));
    const goal = goalOf(cfg);
    const start = startOf(cfg);
    const key = (state) => state.join(",");
    const layers = [[start]];
    const layerOf = new Map([[key(start), 0]]);
    const parent = new Map();
    const edges = new Set();
    for (let d = 0; d < depth; d++) {
      const next = [];
      layers[d].forEach((state) => {
        moves.forEach((move) => {
          const after = apply(caps, state, move);
          if (!after) return;
          const k = key(after);
          if (!layerOf.has(k)) {
            layerOf.set(k, d + 1);
            parent.set(k, key(state));
            next.push(after);
          }
          if (layerOf.get(k) === d + 1) edges.add(key(state) + ">" + k);
        });
      });
      layers.push(next);
    }

    const route = new Set();
    const found = layers.flat().find((state) => goal && goal(state));
    for (let k = found ? key(found) : null; k; k = parent.get(k)) route.add(k);

    const NW = 56;
    const NH = 24;
    const GAP = 12;
    const ROW = 50;
    const LEFT = 58;
    const widest = Math.max(...layers.map((layer) => layer.length));
    const w = LEFT + widest * NW + (widest - 1) * GAP + 8;
    const h = layers.length * ROW;
    const place = new Map();
    layers.forEach((layer, d) => {
      const span = layer.length * NW + (layer.length - 1) * GAP;
      const left = LEFT + (widest * NW + (widest - 1) * GAP - span) / 2;
      layer.forEach((state, n) => place.set(key(state), [left + n * (NW + GAP) + NW / 2, d * ROW + NH / 2 + 6]));
    });

    const out = ['<svg class="state-map" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Карта ходів">'];
    edges.forEach((edge) => {
      const [a, b] = edge.split(">");
      const [x1, y1] = place.get(a);
      const [x2, y2] = place.get(b);
      out.push('<line class="map-edge' + (route.has(a) && route.has(b) ? " on" : "") + '" x1="' + x1 + '" y1="' + (y1 + NH / 2) + '" x2="' + x2 + '" y2="' + (y2 - NH / 2) + '"/>');
    });
    layers.forEach((layer, d) => {
      out.push('<text class="map-row" x="4" y="' + (d * ROW + NH / 2 + 10) + '">' + (d === 0 ? "старт" : d + " " + stepsWord(d)) + "</text>");
      layer.forEach((state) => {
        const k = key(state);
        const [cx, cy] = place.get(k);
        const cls = "map-node" + (goal && goal(state) ? " goal" : route.has(k) ? " on" : "");
        out.push(
          '<g class="' + cls + '" data-layer="' + d + '"><rect x="' + (cx - NW / 2) + '" y="' + (cy - NH / 2) + '" width="' + NW + '" height="' + NH + '" rx="12"/>' +
            '<text x="' + cx + '" y="' + (cy + 4.5) + '" text-anchor="middle">(' + state.join("; ") + ")</text></g>"
        );
      });
    });
    out.push("</svg>");
    return out.join("");
  }

  /* ---------- граф станів: усі дороги на одній картинці ---------- */

  /* Граф рядами (пошук ушир). Від станів, де вже є відповідь, далі не йдемо: там дорога скінчилася.
     Доріжка — це все, що виросло з першого кроку; стан, куди ведуть обидві доріжки, стоїть посередині. */
  function graphOf(cfg) {
    const caps = cfg.vessels;
    const moves = allMoves(caps, Boolean(SOURCES[cfg.source]));
    const goal = goalOf(cfg);
    const key = (state) => state.join(",");
    const start = startOf(cfg);
    const nodes = new Map([[key(start), { key: key(start), state: start, layer: 0, lane: -1, lanes: new Set(), parent: null, move: null }]]);
    const edges = [];
    let layer = [start];
    for (let d = 0; layer.length; d++) {
      const next = [];
      layer.forEach((state) => {
        const from = nodes.get(key(state));
        if (goal(state)) return;
        moves.forEach((move) => {
          const after = apply(caps, state, move);
          if (!after) return;
          const k = key(after);
          if (!nodes.has(k)) {
            const lane = d === 0 ? next.length : from.lane;
            nodes.set(k, { key: k, state: after, layer: d + 1, lane: lane, lanes: new Set(), parent: from.key, move: move });
            next.push(after);
          }
          const to = nodes.get(k);
          if (to.layer !== d + 1) return;
          to.lanes.add(d === 0 ? to.lane : from.lane);
          edges.push({ from: from.key, to: k, move: move });
        });
      });
      layer = next;
    }
    const all = [...nodes.values()];
    all.forEach((node) => {
      node.shared = node.lanes.size > 1;
      node.goal = goal(node.state);
    });
    const roads = [0, 1].map((lane) => {
      const end = all.filter((node) => node.goal && node.lane === lane && !node.shared).sort((a, b) => a.layer - b.layer)[0];
      const road = [];
      for (let node = end; node; node = node.parent ? nodes.get(node.parent) : null) road.unshift(node);
      return road;
    });
    return { nodes: nodes, edges: edges, roads: roads, depth: Math.max(...all.map((node) => node.layer)) };
  }

  function shortMove(move, caps) {
    if (move.type === "fill") return "набрали " + caps[move.i];
    if (move.type === "empty") return "вилили " + caps[move.i];
    return caps[move.i] + " → " + caps[move.j];
  }

  /* Що сталося на кроці — словами, з тим самим рахунком, який дитина робить сама. */
  function narrate(cfg, before, after, move) {
    const caps = cfg.vessels;
    const jug = (i) => "відро " + caps[i] + "\u00a0л";
    const source = SOURCES[cfg.source];
    if (move.type === "fill") return "Набираємо " + jug(move.i) + " " + source.from + " — тепер у ньому " + caps[move.i] + "\u00a0л.";
    if (move.type === "empty") return "Виливаємо " + jug(move.i) + " " + source.to + " — тепер воно порожнє.";
    const i = move.i;
    const j = move.j;
    const moved = before[i] - after[i];
    if (after[j] === caps[j] && after[i] > 0) {
      return (
        "Переливаємо з " + caps[i] + "\u00a0л у " + caps[j] + "\u00a0л. Там уже було " + before[j] + ", влізло лише " + moved +
        " — у відрі на " + caps[i] + "\u00a0л лишилося " + before[i] + " − " + moved + " = " + after[i] + "\u00a0л."
      );
    }
    return "Переливаємо з " + caps[i] + "\u00a0л у " + caps[j] + "\u00a0л — влізло все: там тепер " + before[j] + " + " + moved + " = " + after[j] + "\u00a0л.";
  }

  function walk(cfg) {
    const caps = cfg.vessels;
    const graph = graphOf(cfg);
    const LANE_X = [70, 250];
    const MID_X = 160;
    const ROW = 84;
    const TOP = 16;
    const NW = 84;
    const NH = 60;
    const w = 320;
    const h = TOP + graph.depth * ROW + NH + 10;
    const unit = 30 / Math.max(...caps);

    const place = (node) => [node.layer === 0 || node.shared ? MID_X : LANE_X[node.lane], TOP + node.layer * ROW + NH / 2];

    let road = 0;
    let step = 0;
    let timer = null;

    const big = caps.map((cap) => {
      const liquid = el("div", { class: "jug-liquid" });
      const jug = el("div", { class: "jug" }, liquid);
      jug.style.setProperty("--h", Math.round(40 + cap * 14) + "px");
      const amount = el("div", { class: "jug-amt" });
      return { liquid: liquid, amount: amount, col: el("div", { class: "jug-col" }, amount, jug, el("div", { class: "jug-cap", text: cap + "\u00a0л" })) };
    });
    const story = el("div", { class: "walk-story" });
    const counter = el("div", { class: "sim-stat" });
    const board = el("div", { class: "walk-board" });

    function nodeSVG(node, cls) {
      const [cx, cy] = place(node);
      const x = cx - NW / 2;
      const y = cy - NH / 2;
      let jugs = "";
      node.state.forEach((amount, i) => {
        const bh = Math.round(caps[i] * unit);
        const bx = cx - 22 + i * 26;
        const by = y + 40 - bh;
        const fill = Math.round((amount / caps[i]) * bh);
        jugs +=
          '<rect class="walk-water" x="' + (bx + 1.5) + '" y="' + (by + bh - fill) + '" width="15" height="' + fill + '"/>' +
          '<path class="walk-jug" d="M' + bx + " " + by + "V" + (by + bh - 3) + "Q" + bx + " " + (by + bh) + " " + (bx + 3) + " " + (by + bh) +
          "H" + (bx + 15) + "Q" + (bx + 18) + " " + (by + bh) + " " + (bx + 18) + " " + (by + bh - 3) + "V" + by + '"/>';
      });
      return (
        '<g class="walk-node ' + cls + '" data-state="' + node.key + '">' +
        '<rect class="walk-box" x="' + x + '" y="' + y + '" width="' + NW + '" height="' + NH + '" rx="14"/>' + jugs +
        '<text class="walk-label" x="' + cx + '" y="' + (y + NH - 7) + '" text-anchor="middle">' + node.state.join(" і ") + "</text>" +
        (node.goal ? '<text class="walk-star" x="' + (x + NW - 4) + '" y="' + (y + 14) + '" text-anchor="end">★</text>' : "") +
        "</g>"
      );
    }

    function draw() {
      const path = graph.roads[road];
      const walked = new Set(path.slice(0, step + 1).map((node) => node.key));
      const here = path[step];
      const out = ['<svg class="walk-graph" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Граф станів">'];
      for (let d = 0; d <= graph.depth; d++) {
        out.push('<text class="walk-row" x="4" y="' + (TOP + d * ROW + NH / 2 + 4) + '">' + d + "</text>");
      }
      graph.edges.forEach((edge) => {
        const a = graph.nodes.get(edge.from);
        const b = graph.nodes.get(edge.to);
        const [x1, y1] = place(a);
        const [x2, y2] = place(b);
        const lane = b.shared ? "shared" : "lane" + b.lane;
        const on = walked.has(a.key) && walked.has(b.key) && path.indexOf(b) === path.indexOf(a) + 1;
        const sy = y1 + NH / 2;
        const ey = y2 - NH / 2;
        const midY = (sy + ey) / 2;
        out.push(
          '<path class="walk-edge ' + lane + (on ? " on" : "") + '" d="M' + x1 + " " + sy + "C" + x1 + " " + midY + " " + x2 + " " + midY + " " + x2 + " " + ey + '"/>'
        );
        if (!b.shared) {
          const lx = (x1 + x2) / 2 + (x1 === x2 ? (b.lane === 0 ? -6 : 6) : 0);
          out.push(
            '<text class="walk-move ' + lane + (on ? " on" : "") + '" x="' + lx + '" y="' + (midY + 4) + '" text-anchor="' + (x1 === x2 ? (b.lane === 0 ? "end" : "start") : "middle") + '">' +
              shortMove(edge.move, caps) + "</text>"
          );
        }
      });
      graph.nodes.forEach((node) => {
        const cls = [
          node.shared ? "shared" : node.layer ? "lane" + node.lane : "start",
          walked.has(node.key) ? "walked" : "",
          node === here ? "here" : "",
          node.goal ? "goal" : "",
        ].join(" ");
        out.push(nodeSVG(node, cls));
      });
      out.push("</svg>");
      board.innerHTML = out.join("");

      here.state.forEach((amount, i) => {
        big[i].liquid.style.height = (amount / caps[i]) * 100 + "%";
        big[i].amount.textContent = amount + "\u00a0л";
      });
      const last = path.length - 1;
      counter.textContent = "Крок " + step + " з " + last;
      if (step === 0) {
        story.innerHTML = "Старт: обидва відра порожні. Тисни «Далі» — і дивись, як іде стан по графу.";
      } else {
        story.innerHTML =
          "<b>Крок " + step + ".</b> " + narrate(cfg, path[step - 1].state, here.state, here.move) +
          (step === last
            ? " <b>Ось вони — " + cfg.target + "\u00a0л! Доріжка на " + last + " " + stepsWord(last) + ".</b>" +
              (road === 0 && graph.roads[1].length > path.length ? " Друга доріжка — на " + (graph.roads[1].length - 1) + "." : "") +
              (road === 1 && graph.roads[0].length < path.length ? " А ліва доріжка — лише " + (graph.roads[0].length - 1) + "." : "")
            : "");
      }
      prevBtn.disabled = step === 0;
      nextBtn.disabled = step === last;
      roadButtons.forEach((button, k) => button.classList.toggle("on", k === road));
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      playBtn.textContent = "▶ Програти";
    }

    function go(delta) {
      const last = graph.roads[road].length - 1;
      step = Math.max(0, Math.min(last, step + delta));
      draw();
    }

    const prevBtn = el("button", { class: "ghost-btn", type: "button", text: "◀ Назад", onclick: () => (stop(), go(-1)) });
    const nextBtn = el("button", { class: "btn", type: "button", text: "Далі ▶", onclick: () => (stop(), go(1)) });
    const playBtn = el("button", {
      class: "ghost-btn",
      type: "button",
      text: "▶ Програти",
      onclick: () => {
        if (timer) {
          stop();
          return;
        }
        if (step === graph.roads[road].length - 1) step = 0;
        draw();
        playBtn.textContent = "⏸ Пауза";
        timer = setInterval(() => {
          if (step >= graph.roads[road].length - 1 || !document.body.contains(root)) {
            stop();
            return;
          }
          go(1);
        }, 1500);
      },
    });

    const roadButtons = graph.roads.map((path, k) =>
      el("button", {
        class: "kind-btn walk-road lane" + k,
        type: "button",
        text: (k === 0 ? "Ліва доріжка: " : "Права доріжка: ") + "спершу набрати " + caps[path[1].move.i] + "\u00a0л",
        onclick: () => {
          stop();
          road = k;
          step = 0;
          draw();
        },
      })
    );

    const root = el(
      "div",
      { class: "sim walk" },
      el("div", { class: "walk-roads" }, roadButtons),
      el("div", { class: "walk-top" }, el("div", { class: "jugs-row" }, big.map((b) => b.col)), el("div", { class: "walk-side" }, counter, story)),
      el("div", { class: "toolbar" }, prevBtn, nextBtn, playBtn),
      board
    );
    draw();
    return root;
  }

  /* ---------- симулятор ---------- */

  function create(cfg, onSolve) {
    const caps = cfg.vessels;
    const names = namesOf(cfg);
    const source = SOURCES[cfg.source] || null;
    const goal = goalOf(cfg);
    const collect = cfg.collect || null;
    const limit = cfg.limit || 0;
    const where = cfg.where || "відрі";
    const best = shortest(cfg);

    let history = []; // [{ state, move }], history[0] — початок
    let pending = null; // { i, answer, why } — чекаємо, доки дитина порахує
    let solved = false;
    let found = new Set();

    const verdict = el("div", { class: "sim-verdict" });
    const ask = el("div", { class: "ask" });
    const counter = el("span", { class: "sim-stat" });
    const logBody = el("tbody");
    const cloth = el("div", { class: "bil-table" });
    const bilBox = planeOf(cfg) ? el("div", { class: "bil-box" }, cloth, el("div", { class: "bil-caption", text: billiardCaption(cfg) })) : null;

    const collectRow = collect ? el("div", { class: "jug-collect" }, el("span", { text: "Уже бачила:" })) : null;
    const chips = (collect || []).map((n) => {
      const chip = el("span", { class: "collect-chip", text: String(n) });
      collectRow.append(chip);
      return chip;
    });

    function button(code, text, title) {
      return el("button", { class: "jug-btn", type: "button", text: text, title: title, "data-act": code, onclick: () => act(code) });
    }

    const unit = Math.min(22, MAX_H / Math.max(...caps));
    const cols = caps.map((cap, i) => {
      const liquid = el("div", { class: "jug-liquid" });
      const jug = el("div", { class: "jug" }, liquid);
      jug.style.setProperty("--h", Math.max(MIN_H, Math.round(cap * unit)) + "px");
      const amount = el("div", { class: "jug-amt" });
      const buttons = [];
      if (source) {
        buttons.push(button("F" + i, "Набрати", "Набрати " + names[i] + " " + source.from));
        buttons.push(button("E" + i, "Вилити", "Вилити " + names[i] + " " + source.to));
      }
      caps.forEach((_, j) => {
        if (j !== i) buttons.push(button("P" + i + j, "→ " + names[j], "Перелити з " + names[i] + " у " + names[j]));
      });
      const col = el(
        "div",
        { class: "jug-col" },
        amount,
        jug,
        el("div", { class: "jug-cap", text: names[i] }),
        el("div", { class: "jug-btns" }, buttons)
      );
      return { col: col, jug: jug, liquid: liquid, amount: amount, buttons: buttons };
    });

    const current = () => history[history.length - 1].state;
    const steps = () => history.length - 1;

    function say(kind, text) {
      verdict.className = "sim-verdict" + (kind ? " " + kind : "");
      verdict.textContent = text;
    }

    /* ---------- кроки ---------- */

    function act(code) {
      if (solved) return;
      if (pending) {
        say("no", "Спершу скажи, скільки літрів тепер у " + where + " на " + caps[pending.i] + " л.");
        return;
      }
      if (limit && steps() >= limit) {
        outOfSteps();
        return;
      }
      const move = parse(code);
      const before = current();
      const after = apply(caps, before, move);
      if (!after) return;
      history.push({ state: after, move: move });
      pending = question(move, before, after);
      say("", "");
      if (pending) {
        showAsk();
        render();
      } else {
        settle("");
      }
    }

    /* Питаємо лише там, де число нове: різниця, коли друге відро наповнилося, або сума,
       коли долили до того, що вже було. Набрати, вилити чи перелити в порожнє — очевидно. */
    function question(move, before, after) {
      if (move.type !== "pour") return null;
      const i = move.i;
      const j = move.j;
      if (after[j] === caps[j] && after[i] > 0) {
        return {
          i: i,
          answer: after[i],
          why: "Було " + before[i] + " л, а у " + where + " на " + caps[j] + " л вільно було лише " + (caps[j] - before[j]) + " л — стільки й перелилося.",
        };
      }
      if (after[i] === 0 && before[j] > 0 && after[j] < caps[j]) {
        return {
          i: j,
          answer: after[j],
          why: "У " + where + " на " + caps[j] + " л уже було " + before[j] + " л, і до них долили " + (before[i] - after[i]) + " л.",
        };
      }
      return null;
    }

    function showAsk() {
      ask.textContent = "";
      ask.append(el("div", { class: "ask-q", text: "Скільки літрів тепер у " + where + " на " + caps[pending.i] + " л?" }));
      const row = el("div", { class: "ask-opts" });
      for (let v = 0; v <= caps[pending.i]; v++) {
        const option = el("button", { class: "ask-opt num", type: "button", text: String(v), "data-v": String(v) });
        option.addEventListener("click", () => answer(v, option));
        row.append(option);
      }
      ask.append(row);
    }

    function answer(v, option) {
      if (!pending) return;
      if (v !== pending.answer) {
        option.classList.add("wrong");
        say("no", "Ні. " + pending.why);
        return;
      }
      const i = pending.i;
      pending = null;
      ask.textContent = "";
      settle("Так: у " + where + " на " + caps[i] + " л — " + v + " л.");
    }

    /* Числа цього кроку відомі: збираємо, перевіряємо мету, повтори й ліміт. */
    function settle(said) {
      const now = current();
      if (collect) now.forEach((amount) => collect.includes(amount) && found.add(amount));
      if ((goal && goal(now)) || (collect && found.size === collect.length)) {
        finish();
        return;
      }
      const key = now.join(",");
      const earlier = history.slice(0, -1).findIndex((entry) => entry.state.join(",") === key);
      if (earlier >= 0) {
        say(
          "no",
          (said ? said + " " : "") +
            (earlier === 0 ? "Але такий стан уже був на самому початку" : "Але такий стан уже був після кроку " + earlier) +
            " — останні кроки нічого не дали."
        );
      } else {
        say(said ? "ok" : "", said);
      }
      if (limit && steps() >= limit) outOfSteps();
      render();
    }

    function outOfSteps() {
      say("no", "Кроки скінчилися: " + steps() + " з " + limit + ". Тисни «Крок назад» або «Спочатку» й спробуй інший бік кола.");
    }

    function goalText(now) {
      if (cfg.exact) {
        return (
          "Розлито як треба: " +
          cfg.exact
            .map((amount, i) => (amount ? amount + " л у " + where + " на " + caps[i] + " л" : null))
            .filter(Boolean)
            .join(", ") +
          "."
        );
      }
      const i = (cfg.targetIn || caps.map((_, k) => k)).find((k) => now[k] === cfg.target);
      return cfg.target + " л у " + where + " на " + caps[i] + " л.";
    }

    function finish() {
      solved = true;
      const n = steps();
      let text = collect ? "Усі числа зібрано за " + n + " " + stepsWord(n) + "." : "Готово! " + goalText(current()) + " Кроків: " + n + ".";
      if (!collect && best > 0) {
        text +=
          n <= best
            ? " Це найкоротший шлях — жодного зайвого кроку."
            : " Найкоротший шлях — " + best + " " + stepsWord(best) + ". Спробуй крутити коло в інший бік.";
      }
      say("ok", text);
      render();
      if (onSolve) onSolve();
    }

    function undo() {
      if (solved || history.length < 2) return;
      history.pop();
      pending = null;
      ask.textContent = "";
      say("", "");
      render();
    }

    function reset() {
      history = [{ state: startOf(cfg), move: null }];
      pending = null;
      solved = false;
      found = new Set();
      ask.textContent = "";
      say("", "");
      render();
    }

    /* ---------- малювання ---------- */

    function render() {
      const now = current();
      const hits = solved && !collect ? hitCells(cfg, now) : new Set();
      const blocked = solved || Boolean(pending) || Boolean(limit && steps() >= limit);
      cols.forEach((col, i) => {
        const hidden = Boolean(pending) && pending.i === i;
        col.jug.classList.toggle("lidded", hidden);
        col.jug.classList.toggle("goal", hits.has(i));
        /* Під кришкою рівень не рухається: коли дитина порахує, вода доллється на очах. */
        if (!hidden) col.liquid.style.height = (now[i] / caps[i]) * 100 + "%";
        col.amount.textContent = hidden ? "?" : now[i] + " л";
        col.amount.classList.toggle("unknown", hidden);
        col.buttons.forEach((b) => {
          b.disabled = blocked || !apply(caps, now, parse(b.getAttribute("data-act")));
        });
      });

      if (bilBox) {
        const known = history.map((entry) => entry.state);
        cloth.innerHTML = pending ? billiardSVG(cfg, known.slice(0, -1), now) : billiardSVG(cfg, known);
      }

      counter.textContent = "Кроків: " + steps() + (limit ? " з " + limit : "");
      chips.forEach((chip, k) => chip.classList.toggle("on", found.has(collect[k])));

      logBody.textContent = "";
      history.forEach((entry, step) => {
        const key = entry.state.join(",");
        const repeat = history.slice(0, step).some((prev) => prev.state.join(",") === key);
        const isLast = step === history.length - 1;
        logBody.append(
          el(
            "tr",
            { class: repeat ? "repeat" : null },
            el("td", { text: String(step) }),
            entry.state.map((amount, i) =>
              el("td", {
                class: isLast && hits.has(i) ? "hit" : null,
                text: isLast && pending && pending.i === i ? "?" : String(amount),
              })
            ),
            el("td", { text: entry.move ? describe(entry.move, names, source) : "початок" })
          )
        );
      });
      undoBtn.disabled = solved || history.length < 2;
    }

    /* ---------- збірка ---------- */

    function autoIntro() {
      let text =
        (source ? "Відра" : "Посудини") + ": " + names.map((name) => "<b>" + name + "</b>").join(names.length === 2 ? " і " : ", ") + ", без поділок.";
      if (source) text += " " + source.place;
      if (collect) text += " Збери всі числа від " + collect[0] + " до " + collect[collect.length - 1] + ".";
      else if (goal) text += " Треба: <b>" + cfg.target + " л</b> в одному з відер.";
      text += limit ? " Кроків — не більше <b>" + limit + "</b>." : " Кроків скільки завгодно.";
      return text;
    }

    const undoBtn = el("button", { class: "ghost-btn", type: "button", text: "Крок назад ↶", onclick: undo });
    const resetBtn = el("button", { class: "ghost-btn", type: "button", text: "Спочатку ↺", onclick: reset });

    const logTable = el(
      "table",
      { class: "pour-table" },
      el("thead", {}, el("tr", {}, el("th", { text: "Крок" }), names.map((name) => el("th", { text: name })), el("th", { text: "Що зробили" }))),
      logBody
    );

    const root = el(
      "div",
      { class: "sim jugs" + (cfg.liquid ? " liquid-" + cfg.liquid : "") },
      el("div", { class: "sim-task", html: cfg.intro || autoIntro() }),
      el("div", {
        class: "sim-hint",
        text: "Тисни кнопки під " + (source ? "відрами" : "посудинами") + ". Після переливання скажи, скільки де стало, — тоді можна лити далі.",
      }),
      el("div", { class: "sim-head" }, counter),
      el("div", { class: "jugs-main" }, el("div", { class: "jugs-row" }, cols.map((col) => col.col)), ask, verdict, collectRow, bilBox),
      el("div", { class: "toolbar" }, undoBtn, resetBtn),
      el("details", { class: "sim-logbox", open: "" }, el("summary", { text: "Таблиця кроків — як у підручнику" }), el("div", { class: "pour-wrap" }, logTable))
    );

    reset();
    return root;
  }

  /* ---------- тренажер: будь-які два відра 1–20 л і озеро ---------- */

  function trainer(cfg, onSolve) {
    let a = cfg.a || 3;
    let b = cfg.b || 7;
    let t = cfg.target || 5;
    let strict = false;

    const clamp = (value) => Math.min(20, Math.max(1, Math.round(Number(value) || 1)));

    function field(label, value) {
      const input = el("input", { class: "trainer-num", type: "number", min: "1", max: "20", value: String(value) });
      input.addEventListener("change", () => {
        read();
        paint();
      });
      return { input: input, node: el("label", { class: "trainer-field" }, el("span", { text: label }), input) };
    }

    const fieldA = field("Відро", a);
    const fieldB = field("Відро", b);
    const fieldT = field("Треба", t);
    const goal = el("div", { class: "trainer-goal" });
    const slot = el("div", { class: "trainer-slot" });

    const strictRow = el("div", { class: "trainer-kinds" });
    const strictButtons = [
      [false, "без ліміту"],
      [true, "рівно найкоротший"],
    ].map(([value, label]) => {
      const button = el("button", { class: "kind-btn", type: "button", text: label, "data-strict": String(value) });
      button.addEventListener("click", () => {
        strict = value;
        paint();
      });
      strictRow.append(button);
      return button;
    });

    function read() {
      a = clamp(fieldA.input.value);
      b = clamp(fieldB.input.value);
      t = clamp(fieldT.input.value);
    }

    const setup = () => ({ vessels: [a, b], source: "lake", target: t });

    function paint() {
      fieldA.input.value = String(a);
      fieldB.input.value = String(b);
      fieldT.input.value = String(t);
      strictButtons.forEach((button) => button.classList.toggle("on", (button.getAttribute("data-strict") === "true") === strict));
      const g = gcd(a, b);
      if (t > Math.max(a, b)) {
        goal.innerHTML = "Неможливо: " + t + " л не влізе в жодне з відер.";
        return;
      }
      if (t % g) {
        goal.innerHTML =
          "Неможливо: НСД(" + a + ", " + b + ") = " + g + ". У відрах завжди число, кратне " + g + ", а " + t + " на " + g + " не ділиться.";
        return;
      }
      const best = shortest(setup());
      const row = circleRow(a, b);
      goal.innerHTML =
        (g === 1
          ? "Можна: НСД(" + a + ", " + b + ") = 1, тож набирається будь-яке число до " + Math.max(a, b) + "."
          : "Можна: НСД(" + a + ", " + b + ") = " + g + ", і " + t + " ділиться на " + g + ".") +
        " Найкоротший шлях — <b>" + best + "</b> " + stepsWord(best) + "." +
        (row.length
          ? '<details class="trainer-row"><summary>Рядок кола</summary>' +
            row.map((x) => (x === t ? "<b>" + x + "</b>" : String(x))).join(", ") +
            "</details>"
          : "");
    }

    function build() {
      read();
      paint();
      const best = shortest(setup());
      slot.textContent = "";
      slot.append(create(Object.assign(setup(), { limit: strict && best > 0 ? best : 0 }), onSolve));
    }

    const startBtn = el("button", { class: "btn", type: "button", text: "Нова задача", onclick: build });

    const root = el(
      "div",
      { class: "trainer" },
      el(
        "div",
        { class: "trainer-controls" },
        fieldA.node,
        fieldB.node,
        fieldT.node,
        el("div", { class: "trainer-field" }, el("span", { text: "Кроків" }), strictRow),
        startBtn
      ),
      goal,
      slot
    );

    build();
    return root;
  }

  return {
    create: create,
    trainer: trainer,
    table: table,
    billiard: billiard,
    stateMap: stateMap,
    walk: walk,
    shortest: shortest,
    circleRow: circleRow,
    gcd: gcd,
  };
})();
