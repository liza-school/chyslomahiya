/* Дроби: закляття скорочення (клітинки пирога) і алгоритм Евкліда (прямокутник і квадрати).
   НСД рахує цей самий файл двома шляхами: перебором і алгоритмом Евкліда. Якщо вони розійдуться,
   помилка піде в консоль, і check.js упаде. */

const FRAC = (function () {
  const el = COURSE.el;
  const NS = "http://www.w3.org/2000/svg";
  const HUES = ["#f4cf80", "#8fb3ff", "#7fe39a", "#f3a3c8", "#7fd6d0", "#f0a860"];

  function svg(tag, attrs, ...kids) {
    const node = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null) continue;
      if (name === "text") node.textContent = value;
      else node.setAttribute(name, value);
    }
    for (const kid of kids.flat(Infinity)) if (kid) node.append(kid);
    return node;
  }

  /* НСД двома способами: перебір від меншого числа вниз і Евклід. */
  function gcd(a, b) {
    let x = a, y = b;
    while (y) [x, y] = [y, x % y];
    let slow = Math.min(a, b);
    while (a % slow || b % slow) slow--;
    if (slow !== x) console.error("FRAC.gcd: Евклід дав " + x + ", перебір — " + slow);
    return x;
  }

  /* Рядки алгоритму Евкліда: [більше, менше, скільки разів, остача]. */
  function division(a, b) {
    const rows = [];
    let big = Math.max(a, b), small = Math.min(a, b);
    while (small) {
      const k = Math.floor(big / small);
      const r = big % small;
      rows.push([big, small, k, r]);
      [big, small] = [small, r];
    }
    return rows;
  }

  const cap = (n) => Math.max(1, Math.min(n, 150));

  /* ---------- Закляття скорочення ---------- */

  function cut(cfg, onDone) {
    const start = { n: cfg.num, d: cfg.den };
    const reduceMode = cfg.goal !== "play";
    let n = start.n, d = start.d;
    let k = 2;
    let history = [];
    let did = { down: false, up: false };
    let solved = false;

    const root = el("div", { class: "sim gauss frac-sim" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const stat = el("div", { class: "sim-stat" });
    const bigFrac = el("div", { class: "frac-now", "aria-live": "polite" });
    const grid = el("div", { class: "frac-grid" });
    const trail = el("div", { class: "frac-trail" });
    const verdict = el("div", { class: "sim-verdict" });
    const shown = el("b", { class: "frac-k", text: String(k) });
    const less = el("button", { class: "ghost-btn", type: "button", text: "−", "data-act": "less", "aria-label": "Менший дільник" });
    const more = el("button", { class: "ghost-btn", type: "button", text: "+", "data-act": "more", "aria-label": "Більший дільник" });
    const divBtn = el("button", { class: "btn", type: "button", "data-act": "cut" });
    const mulBtn = el("button", { class: "ghost-btn", type: "button", "data-act": "mul" });
    const reset = el("button", { class: "ghost-btn", type: "button", text: "Спочатку ↺" });

    const say = (text, kind) => {
      verdict.className = "sim-verdict" + (kind ? " " + kind : "");
      verdict.textContent = text;
    };

    /* Скільки клітинок у ряду: дільник знаменника в межах 4–12, інакше за коренем. */
    const columns = (count) => {
      for (let c = 12; c >= 4; c--) if (count % c === 0) return c;
      return Math.min(count, Math.ceil(Math.sqrt(count * 2)));
    };

    const paint = () => {
      bigFrac.textContent = n + "/" + d;
      grid.replaceChildren();
      grid.style.gridTemplateColumns = "repeat(" + columns(d) + ", minmax(0, 1fr))";
      const groupOk = k >= 2 && d % k === 0 && n % k === 0;
      const showGroups = k >= 2 && k <= d && d % k === 0;
      for (let i = 0; i < d; i++) {
        let cls = "frac-cell" + (i < n ? " on" : "");
        if (showGroups && Math.floor(i / k) % 2 === 1) cls += " alt";
        if (showGroups && (i + 1) % k === 0) cls += " grp-end";
        if (showGroups && i % k === 0) cls += " grp-start";
        grid.append(el("i", { class: cls }));
      }
      stat.textContent = "Клітинок: " + d + " · зафарбовано: " + n + " · кроків: " + history.length;
      shown.textContent = String(k);
      divBtn.textContent = "Скоротити на " + k + " ✂";
      mulBtn.textContent = "Помножити на " + k + " ×";
      divBtn.classList.toggle("ready", groupOk);
      trail.textContent = history.length ? history.join("  →  ") : "";
    };

    const done = () => {
      if (solved) return;
      solved = true;
      onDone();
    };

    const irreducible = () => gcd(n, d) === 1;

    const checkDone = () => {
      if (reduceMode) {
        if (irreducible()) {
          say("Нескоротний дріб: " + n + "/" + d + ". Спільного дільника, крім 1, немає — зупиняємось.", "ok");
          done();
        }
      } else if (did.down && did.up) {
        done();
      }
    };

    divBtn.addEventListener("click", () => {
      if (k < 2) return say("Ділити на 1 нічого не змінює — обери більше число.", "no");
      if (n % k && d % k) return say(k + " не ділить ні " + n + ", ні " + d + ". Скорочувати можна лише на спільний дільник.", "no");
      if (n % k) return say(k + " ділить " + d + ", але не " + n + ". Групи по " + k + " розрізали б зафарбований край — такий хід не дозволений.", "no");
      if (d % k) return say(k + " ділить " + n + ", але не " + d + ". Верх і низ треба ділити на одне й те саме.", "no");
      history.push(n + "/" + d + " ÷" + k + " = " + n / k + "/" + d / k);
      n /= k;
      d /= k;
      did.down = true;
      say(
        "Склали клітинки по " + k + ": клітинок " + d + ", зафарбовано " + n + ". Пирога стільки ж.",
        ""
      );
      paint();
      checkDone();
      if (reduceMode && !irreducible()) say("Ще не скорочено до кінця: чи є спільний дільник у " + n + " і " + d + "?", "");
    });

    mulBtn.addEventListener("click", () => {
      if (k < 2) return say("Множити на 1 нічого не змінює — обери більше число.", "no");
      if (d * k > 150) return say("Тоді клітинок буде " + d * k + " — це забагато для малюнка. Обери менший множник.", "no");
      history.push(n + "/" + d + " ×" + k + " = " + n * k + "/" + d * k);
      n *= k;
      d *= k;
      did.up = true;
      say("Розрізали кожну клітинку на " + k + ": клітинок " + d + ", зафарбовано " + n + ". Пирога стільки ж.", "");
      paint();
      checkDone();
    });

    less.addEventListener("click", () => {
      k = Math.max(1, k - 1);
      paint();
    });
    more.addEventListener("click", () => {
      k = Math.min(30, k + 1);
      paint();
    });
    reset.addEventListener("click", () => {
      n = start.n;
      d = start.d;
      history = [];
      say("", "");
      paint();
    });

    root.append(
      task,
      bigFrac,
      grid,
      el("div", { class: "frac-controls" }, el("span", { text: "Число k:" }), less, shown, more, divBtn, reduceMode ? null : mulBtn, reset),
      trail,
      stat,
      verdict
    );
    paint();
    return root;
  }

  /* ---------- Алгоритм Евкліда ---------- */

  function euclid(cfg, onDone) {
    const setup = { a: Math.max(cfg.a, cfg.b), b: Math.min(cfg.a, cfg.b) };
    let rect, squares, rows, finished, solved;

    const root = el("div", { class: "sim gauss euclid-sim" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const stat = el("div", { class: "sim-stat" });
    const stage = el("div", { class: "euclid-stage" });
    const table = el("div", { class: "euclid-table" });
    const verdict = el("div", { class: "sim-verdict" });
    const one = el("button", { class: "btn", type: "button", text: "Відрізати один квадрат ✂", "data-act": "one" });
    const all = el("button", { class: "ghost-btn", type: "button", text: "Відрізати всі такі квадрати", "data-act": "all" });
    const reset = el("button", { class: "ghost-btn", type: "button", text: "Спочатку ↺" });
    const ask = el("div", { class: "pair-sum" });

    const say = (text, kind) => {
      verdict.className = "sim-verdict" + (kind ? " " + kind : "");
      verdict.textContent = text;
    };

    const begin = () => {
      rect = { x: 0, y: 0, w: setup.a, h: setup.b };
      squares = [];
      rows = [];
      finished = false;
      solved = false;
      ask.replaceChildren();
      say("", "");
      draw();
    };

    /* Один квадрат: від довшої сторони відрізаємо квадрат із коротшою стороною.
       Група закінчується, коли наступний квадрат буде іншого розміру. */
    const cutOne = () => {
      if (finished) return;
      const side = Math.min(rect.w, rect.h);
      let row = rows[rows.length - 1];
      if (!row || !row.open) {
        row = { side, count: 0, hue: rows.length % HUES.length, open: true };
        rows.push(row);
      }
      squares.push({ x: rect.x, y: rect.y, s: side, hue: row.hue });
      row.count++;
      rect = rect.w >= rect.h
        ? { x: rect.x + side, y: rect.y, w: rect.w - side, h: rect.h }
        : { x: rect.x, y: rect.y + side, w: rect.w, h: rect.h - side };
      if (rect.w === 0 || rect.h === 0) {
        row.open = false;
        finished = true;
      } else if (Math.min(rect.w, rect.h) !== row.side) {
        row.open = false;
      }
      draw();
    };

    const cutAll = () => {
      if (finished) return;
      do cutOne();
      while (!finished && rows[rows.length - 1].open);
    };

    const draw = () => {
      const width = 600;
      const scale = width / setup.a;
      const height = Math.max(setup.b * scale, 40);
      const canvas = svg("svg", { class: "euclid-svg", viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": "Прямокутник " + setup.a + " на " + setup.b });
      canvas.append(svg("rect", { x: 0, y: 0, width, height: setup.b * scale, class: "euclid-frame" }));
      squares.forEach((sq) => {
        canvas.append(svg("rect", {
          x: sq.x * scale, y: sq.y * scale, width: sq.s * scale, height: sq.s * scale,
          class: "euclid-square", fill: HUES[sq.hue],
        }));
        if (sq.s * scale >= 22) {
          canvas.append(svg("text", {
            x: (sq.x + sq.s / 2) * scale, y: (sq.y + sq.s / 2) * scale + 5, class: "euclid-label", text: String(sq.s),
          }));
        }
      });
      if (!finished) {
        canvas.append(svg("rect", {
          x: rect.x * scale, y: rect.y * scale, width: rect.w * scale, height: rect.h * scale, class: "euclid-rest",
        }));
      }
      stage.replaceChildren(canvas);

      /* Таблиця ділень, як у підручнику. */
      table.replaceChildren();
      const lines = division(setup.a, setup.b);
      rows.forEach((row, i) => {
        const line = lines[i];
        if (!line) return;
        const finishedLine = !row.open;
        table.append(el("div", {
          class: "euclid-line" + (finishedLine ? "" : " pending"),
          html: finishedLine
            ? "<b>" + line[0] + " = " + line[1] + " · " + line[2] + " + " + line[3] + "</b>"
            : "<b>" + line[0] + " = " + line[1] + " · " + row.count + " + …</b>",
          style: "border-color:" + HUES[row.hue],
        }));
      });
      stat.textContent = "Квадратів відрізано: " + squares.length + (finished ? " · залишку немає" : " · залишок " + rect.w + " × " + rect.h);
      one.disabled = finished;
      all.disabled = finished;

      if (finished && !solved && !ask.childElementCount) {
        const input = el("input", { class: "mini-input wide", type: "text", inputmode: "numeric", "aria-label": "Сторона останнього квадрата" });
        const check = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
        check.addEventListener("click", () => {
          const mine = Number(String(input.value).replace(/\s+/g, ""));
          const want = gcd(setup.a, setup.b);
          if (!input.value.trim()) return say("Впиши число.", "no");
          if (mine === want) {
            solved = true;
            input.disabled = true;
            check.disabled = true;
            say(
              "Так: сторона останнього квадрата — " + want + ", це й є НСД(" + setup.a + "; " + setup.b + ") = " + want +
                ". Ділимо верх і низ на " + want + ": " + setup.b / want + " і " + setup.a / want + ".",
              "ok"
            );
            onDone();
          } else {
            say("Ще ні. Подивись на найменший квадрат: яка в нього сторона?", "no");
          }
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") check.click();
        });
        ask.append(el("span", { text: "Сторона останнього квадрата =" }), input, check);
        say("Усе поділено без остачі. Яка сторона останнього квадрата?", "");
      }
    };

    one.addEventListener("click", cutOne);
    all.addEventListener("click", cutAll);
    reset.addEventListener("click", begin);

    let controls = null;
    if (cfg.controls) {
      const fieldA = el("input", { class: "mini-input", type: "number", min: 2, max: 300, value: setup.a, "aria-label": "Довжина" });
      const fieldB = el("input", { class: "mini-input", type: "number", min: 2, max: 300, value: setup.b, "aria-label": "Ширина" });
      const go = el("button", { class: "ghost-btn", type: "button", text: "Новий прямокутник" });
      go.addEventListener("click", () => {
        const a = Number(fieldA.value), b = Number(fieldB.value);
        if (!(a >= 2 && b >= 2 && a <= 300 && b <= 300) || a === b) {
          return say("Візьми два різні числа від 2 до 300.", "no");
        }
        setup.a = Math.max(a, b);
        setup.b = Math.min(a, b);
        begin();
      });
      controls = el("div", { class: "frac-controls" }, el("span", { text: "Сторони:" }), fieldA, el("span", { text: "×" }), fieldB, go);
    }

    root.append(task, controls, stage, el("div", { class: "frac-controls" }, one, all, reset), table, stat, ask, verdict);
    begin();
    return root;
  }

  /* ---------- Евклід: ділить сама дитина ---------- */

  /* Кожен рядок дитина заповнює сама: скільки разів менше влізло й яка остача. Сходинки кратних — підказка за бажанням. */
  function euclidtrain(cfg, onDone) {
    const pairs = cfg.pairs;
    let at = 0, big, small, lines, finishedPair, showLadder, solved = false;
    let draft = ["", ""];

    const root = el("div", { class: "sim gauss euclid-sim" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const head = el("div", { class: "sim-stat" });
    const table = el("div", { class: "euclid-table" });
    const work = el("div", { class: "euclid-work" });
    const verdict = el("div", { class: "sim-verdict" });

    const say = (text, kind) => {
      verdict.className = "sim-verdict" + (kind ? " " + kind : "");
      verdict.textContent = text;
    };

    const load = (i) => {
      at = i;
      big = Math.max(...pairs[i]);
      small = Math.min(...pairs[i]);
      lines = [];
      finishedPair = false;
      showLadder = false;
      draft = ["", ""];
      say("", "");
      draw();
    };

    /* Кратні меншого числа, доки не перелетимо за більше: так ділить людина, коли не знає відповідь одразу. */
    const ladder = () => {
      const steps = [];
      for (let i = 1; i <= 12; i++) {
        const p = small * i;
        steps.push(el("span", {
          class: "euclid-step" + (p > big ? " over" : ""),
          text: small + " · " + i + " = " + p + (p > big ? " — забагато" : ""),
        }));
        if (p > big) break;
      }
      return el("div", { class: "euclid-ladder" }, steps);
    };

    const draw = () => {
      head.textContent = "Задача " + (at + 1) + " з " + pairs.length + ": знайди НСД(" + big_of(at) + "; " + small_of(at) + ")";
      table.replaceChildren();
      lines.forEach((line, i) => {
        table.append(el("div", {
          class: "euclid-line",
          style: "border-color:" + HUES[i % HUES.length],
          html: "<b>" + line[0] + " = " + line[1] + " · " + line[2] + " + " + line[3] + "</b>" +
            ' <span class="euclid-note">(' + line[0] + " − " + line[1] * line[2] + " = " + line[3] + ")</span>",
        }));
      });
      work.replaceChildren();
      if (finishedPair) {
        const last = lines[lines.length - 1];
        say("Остачі немає — стоп! Остання ненульова остача — " + last[1] + ". Тож НСД(" + big_of(at) + "; " + small_of(at) + ") = " + last[1] + ".", "ok");
        if (at + 1 < pairs.length) {
          const next = el("button", { class: "btn", type: "button", text: "Наступна задача →", "data-act": "next" });
          next.addEventListener("click", () => load(at + 1));
          work.append(next);
        }
        return;
      }
      const kIn = el("input", { class: "mini-input", type: "text", inputmode: "numeric", "aria-label": "Скільки разів", "data-field": "k", value: draft[0] });
      const rIn = el("input", { class: "mini-input", type: "text", inputmode: "numeric", "aria-label": "Остача", "data-field": "r", value: draft[1] });
      const check = el("button", { class: "btn", type: "button", text: "Перевірити ✓", "data-act": "check" });
      const help = el("button", { class: "ghost-btn", type: "button", text: showLadder ? "Сховати кратні" : "Підказка: кратні числа " + small, "data-act": "ladder" });
      const run = () => {
        const k = Number(kIn.value), r = Number(rIn.value);
        if (!kIn.value.trim() || !rIn.value.trim() || !Number.isInteger(k) || !Number.isInteger(r) || k < 0 || r < 0) {
          return say("Впиши обидва числа: скільки разів і яка остача.", "no");
        }
        const p = small * k;
        if (p > big) return say(small + " · " + k + " = " + p + " — це більше за " + big + ", не влізло. Візьми менше.", "no");
        if (big - p >= small) return say(small + " · " + k + " = " + p + ", лишається " + (big - p) + " — це ще не менше за " + small + ", влізе ще раз. Візьми більше.", "no");
        if (r !== big - p) return say("Скільки разів — вірно! Тепер остача: " + big + " − " + p + " = ?", "no");
        lines.push([big, small, k, r]);
        if (r === 0) {
          finishedPair = true;
          draw();
          if (at + 1 === pairs.length && !solved) {
            solved = true;
            onDone();
          }
          return;
        }
        big = small;
        small = r;
        showLadder = false;
        draft = ["", ""];
        draw();
        say("Вірно! Тепер ділимо менше число на остачу: " + big + " на " + small + ".", "ok");
      };
      check.addEventListener("click", run);
      help.addEventListener("click", () => {
        draft = [kIn.value, rIn.value];
        showLadder = !showLadder;
        draw();
      });
      [kIn, rIn].forEach((input) => input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") run();
      }));
      work.append(
        el("div", { class: "euclid-line pending euclid-now" },
          el("b", { text: big + " = " + small + " · " }), kIn, el("b", { text: " + " }), rIn),
        el("div", { class: "frac-controls" }, check, help),
        showLadder ? ladder() : null
      );
    };

    /* Заголовок показує початкову пару, а не поточний рядок. */
    const big_of = (i) => Math.max(...pairs[i]);
    const small_of = (i) => Math.min(...pairs[i]);

    root.append(task, head, table, work, verdict);
    load(0);
    return root;
  }

  return { cut, euclid, euclidtrain, gcd, division };
})();
