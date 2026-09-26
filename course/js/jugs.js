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
  function table(cfg, codes) {
    const caps = cfg.vessels;
    const names = namesOf(cfg);
    const source = SOURCES[cfg.source];
    const goal = goalOf(cfg);
    let state = startOf(cfg);
    const rows = [{ step: 0, state: state, what: "початок" }];
    codes.forEach((code, k) => {
      const move = parse(code);
      const after = apply(caps, state, move);
      if (!after) {
        console.error("JUGS.table: хід " + code + " на кроці " + (k + 1) + " нічого не змінює");
        return;
      }
      state = after;
      rows.push({ step: k + 1, state: state, what: describe(move, names, source) });
    });
    if (goal && !goal(state)) console.error("JUGS.table: розвʼязання не доходить до мети (" + state.join(", ") + ")");
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
            : " Найкоротший шлях — " + best + " " + stepsWord(best) + ". Порахуй рядок кола й спробуй інший бік.";
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
      el("div", { class: "jugs-row" }, cols.map((col) => col.col)),
      ask,
      verdict,
      collectRow,
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

  return { create: create, trainer: trainer, table: table, shortest: shortest, circleRow: circleRow, gcd: gcd };
})();
