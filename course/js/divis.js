/* Подільність: три симулятори до заняття 7.
   1) check  — «хвіст чи сума?»: число й дільник, підсвічуємо потрібну частину, дитина каже «ділиться / ні».
   2) star   — «встав зірочку»: число з *, дитина збирає всі цифри, що дають подільність.
   3) cycle  — «хвіст степеня»: цикл останньої цифри будується по одному степеню, потім передбачаємо base^exp.
   Відповіді рахує сам файл (остача від ділення). Якщо правило розійшлося з остачею — помилка в консоль, check.js падає. */

const DIVIS = (function () {
  const el = COURSE.el;

  /* Куди дивиться кожна ознака: у хвіст (останні k цифр) чи в суму цифр. Для 6 і 15 — у двоє. */
  const RULE = {
    2: { kind: "tail", k: 1, word: "остання цифра" },
    5: { kind: "tail", k: 1, word: "остання цифра" },
    10: { kind: "tail", k: 1, word: "остання цифра" },
    4: { kind: "tail", k: 2, word: "останні дві цифри" },
    25: { kind: "tail", k: 2, word: "останні дві цифри" },
    8: { kind: "tail", k: 3, word: "останні три цифри" },
    125: { kind: "tail", k: 3, word: "останні три цифри" },
    3: { kind: "sum", word: "сума цифр" },
    9: { kind: "sum", word: "сума цифр" },
    6: { kind: "both", a: 2, b: 3, word: "парне І сума цифр ділиться на 3" },
    15: { kind: "both", a: 5, b: 3, word: "остання 0 або 5 І сума цифр ділиться на 3" },
  };

  const digits = (n) => String(n).split("").map(Number);
  const digitSum = (n) => digits(n).reduce((a, d) => a + d, 0);
  const tail = (n, k) => String(n).slice(-k);

  /* Число з підсвіченим хвостом: останні k цифр золотом. */
  function numberWithTail(n, k) {
    const s = String(n);
    const head = s.slice(0, s.length - k);
    const end = s.slice(s.length - k);
    return el("span", { class: "div-num" },
      head ? el("span", { text: head }) : null,
      el("span", { class: "div-focus", text: end })
    );
  }

  /* Число, де кожну цифру видно окремо (для суми). */
  function numberSpread(n) {
    return el("span", { class: "div-num" }, digits(n).map((d) => el("span", { class: "div-dig", text: String(d) })));
  }

  /* ---------- 1. «Хвіст чи сума?» ---------- */

  function check(cfg, onDone) {
    const cases = cfg.cases;
    let at = 0, solved = false;
    const root = el("div", { class: "sim divis div-check" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const stat = el("div", { class: "sim-stat" });
    const scene = el("div", { class: "div-scene" });
    const look = el("div", { class: "div-look" });
    const buttons = el("div", { class: "div-row" });
    const verdict = el("div", { class: "sim-verdict" });
    const say = (text, kind) => { verdict.className = "sim-verdict" + (kind ? " " + kind : ""); verdict.innerHTML = text; };

    function load(i) {
      at = i;
      const c = cases[i];
      const by = c.by;
      const rule = RULE[by];
      const ok = c.n % by === 0;
      stat.textContent = "Приклад " + (i + 1) + " з " + cases.length;
      scene.replaceChildren(
        el("div", { class: "div-ask", html: "Чи ділиться <b>" + c.n + "</b> на <b>" + by + "</b>?" })
      );
      /* Показуємо, куди дивитись, але відповідь лишаємо дитині. */
      if (rule.kind === "tail") {
        look.replaceChildren(
          el("div", { html: "Дивись на <b>" + rule.word + "</b>:" }),
          numberWithTail(c.n, rule.k)
        );
      } else if (rule.kind === "sum") {
        look.replaceChildren(
          el("div", { html: "Дивись на <b>" + rule.word + "</b>:" }),
          numberSpread(c.n),
          el("div", { class: "div-sumline", html: "сума цифр = <b>" + digitSum(c.n) + "</b>" })
        );
      } else {
        look.replaceChildren(
          el("div", { html: "Тут <b>дві</b> умови: " + rule.word + "." }),
          numberSpread(c.n),
          el("div", { class: "div-sumline", html: "остання цифра = <b>" + tail(c.n, 1) + "</b>, сума цифр = <b>" + digitSum(c.n) + "</b>" })
        );
      }
      buttons.replaceChildren();
      const yes = el("button", { class: "btn", type: "button", text: "Ділиться ✓" });
      const no = el("button", { class: "btn ghost-btn", type: "button", text: "Не ділиться ✗" });
      const explain = () => {
        if (rule.kind === "tail") {
          const t = Number(tail(c.n, rule.k));
          return "Беремо " + rule.word + " — <b>" + tail(c.n, rule.k) + "</b>. " + t + " : " + by +
            (ok ? " = " + t / by + " без остачі." : " — з остачею.");
        }
        if (rule.kind === "sum") {
          const S = digitSum(c.n);
          return "Сума цифр <b>" + S + "</b>. " + S + " : " + by + (ok ? " ділиться." : " не ділиться.");
        }
        const even = c.n % rule.a === 0, s3 = digitSum(c.n) % rule.b === 0;
        return "Перша умова " + (even ? "✓" : "✗") + ", друга " + (s3 ? "✓" : "✗") + ". Обидві потрібні разом.";
      };
      const answer = (guess) => {
        yes.disabled = no.disabled = true;
        if (guess === ok) {
          say((ok ? "Так, ділиться. " : "Правильно, не ділиться. ") + explain(), "ok");
          if (i + 1 < cases.length) {
            const next = el("button", { class: "btn", type: "button", text: "Наступне →" });
            next.addEventListener("click", () => { say("", ""); load(i + 1); });
            buttons.replaceChildren(next);
          } else if (!solved) { solved = true; onDone(); }
        } else {
          say("Ще раз подивись. " + explain(), "no");
          const retry = el("button", { class: "ghost-btn", type: "button", text: "Спробувати знову ↺" });
          retry.addEventListener("click", () => { say("", ""); load(i); });
          buttons.replaceChildren(retry);
        }
      };
      yes.addEventListener("click", () => answer(true));
      no.addEventListener("click", () => answer(false));
      buttons.replaceChildren(yes, no);
    }

    root.append(task, stat, scene, look, buttons, verdict);
    load(0);
    return root;
  }

  /* ---------- 2. «Встав зірочку» ---------- */

  function star(cfg, onDone) {
    const cases = cfg.cases;
    let at = 0, solved = false;
    const root = el("div", { class: "sim divis div-star" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const stat = el("div", { class: "sim-stat" });
    const scene = el("div", { class: "div-scene" });
    const chips = el("div", { class: "div-row digits" });
    const preview = el("div", { class: "div-sumline" });
    const bar = el("div", { class: "div-row" });
    const verdict = el("div", { class: "sim-verdict" });
    const say = (text, kind) => { verdict.className = "sim-verdict" + (kind ? " " + kind : ""); verdict.innerHTML = text; };

    function winners(tmpl, by) {
      const out = [];
      for (let d = 0; d <= 9; d++) {
        const num = Number(tmpl.replace("*", String(d)));
        if (num % by === 0) out.push(d);
      }
      return out;
    }

    function load(i) {
      at = i;
      const c = cases[i];
      const win = winners(c.template, c.by);
      const picked = new Set();
      stat.textContent = "Приклад " + (i + 1) + " з " + cases.length + " · ділиться на " + c.by;
      const shown = c.template.replace("*", "<span class='div-focus'>✶</span>");
      scene.innerHTML = "Постав замість зірочки <b>всі</b> цифри, щоб <b>" + shown + "</b> ділилося на <b>" + c.by + "</b>:";
      preview.innerHTML = "Натисни цифру — побачиш число й суму його цифр.";
      chips.replaceChildren();
      for (let d = 0; d <= 9; d++) {
        const chip = el("button", { class: "div-chip", type: "button", text: String(d) });
        chip.addEventListener("click", () => {
          const num = Number(c.template.replace("*", String(d)));
          const good = num % c.by === 0;
          preview.innerHTML = c.template.replace("*", "<b>" + d + "</b>") + " = " + num +
            " · сума цифр " + digitSum(num) + (good ? " — ділиться ✓" : " — не ділиться ✗");
          if (picked.has(d)) picked.delete(d); else picked.add(d);
          chip.classList.toggle("on", picked.has(d));
          say("", "");
        });
        chips.append(chip);
      }
      const check = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
      check.addEventListener("click", () => {
        const mine = [...picked].sort((a, b) => a - b);
        const same = mine.length === win.length && mine.every((d, j) => d === win[j]);
        if (same) {
          say("Усі випадки: " + win.join(", ") + ". " + (c.why || ""), "ok");
          [...chips.children].forEach((ch, d) => ch.classList.toggle("good", win.includes(d)));
          check.disabled = true;
          if (i + 1 < cases.length) {
            const next = el("button", { class: "btn", type: "button", text: "Наступне →" });
            next.addEventListener("click", () => { say("", ""); load(i + 1); });
            bar.replaceChildren(next);
          } else if (!solved) { solved = true; onDone(); }
        } else {
          say("Ще не всі. Підказка: " + (c.hint || "перевір кожну цифру по черзі — дивись на суму.") , "no");
        }
      });
      bar.replaceChildren(check);
      say("", "");
    }

    root.append(task, stat, scene, chips, preview, bar, verdict);
    load(0);
    return root;
  }

  /* ---------- 3. «Хвіст степеня»: будуємо цикл, потім передбачаємо ---------- */

  function lastDigit(base, exp) {
    let d = 1;
    const b = base % 10;
    for (let i = 0; i < exp; i++) d = (d * b) % 10;
    return d;
  }
  /* Довжина циклу останньої цифри (1, 2 або 4). */
  function cycleOf(base) {
    const first = base % 10;
    const seq = [first];
    let d = first;
    for (let i = 2; i <= 4; i++) { d = (d * first) % 10; if (d === first) break; seq.push(d); }
    return seq;
  }

  /* Типові показники для режиму пікера — ті самі, що в задачі 21, щоб тренажер і задача збігались. */
  const PICKER_EXPS = { 2: 40, 3: 61, 4: 81, 5: 2025, 6: 2026, 7: 2024, 8: 2024, 9: 1000 };

  function cycle(cfg, onDone) {
    const picker = Boolean(cfg.picker);
    const bases = picker ? (cfg.bases || [2, 3, 4, 5, 6, 7, 8, 9]) : null;
    const cases = picker
      ? bases.map((b) => ({ base: b, exp: (cfg.exps && cfg.exps[b]) || PICKER_EXPS[b] || 100 }))
      : cfg.cases;
    let at = -1, solved = false;
    const done = new Set();
    const root = el("div", { class: "sim divis div-cycle" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const picks = el("div", { class: "div-row picks" });
    const stat = el("div", { class: "sim-stat" });
    const scene = el("div", { class: "div-scene" });
    const strip = el("div", { class: "div-row cyc" });
    const step = el("div", { class: "div-row" });
    const quiz = el("div", { class: "div-quiz" });
    const verdict = el("div", { class: "sim-verdict" });
    const say = (text, kind) => { verdict.className = "sim-verdict" + (kind ? " " + kind : ""); verdict.innerHTML = text; };

    const pickBtns = [];
    const paintPicks = () => {
      pickBtns.forEach((btn, i) => {
        btn.classList.toggle("active", i === at);
        btn.classList.toggle("solved", done.has(i));
        btn.textContent = String(cases[i].base) + (done.has(i) ? " ✓" : "");
      });
    };
    if (picker) {
      cases.forEach((c, i) => {
        const btn = el("button", { class: "pick", type: "button", text: String(c.base) });
        btn.addEventListener("click", () => { say("", ""); load(i); });
        pickBtns.push(btn);
        picks.append(btn);
      });
    }

    function load(i) {
      at = i;
      const c = cases[i];
      const base = c.base;
      const cyc = cycleOf(base);
      let shownPow = 0; /* скільки степенів уже відкрито */
      stat.textContent = picker ? "Основа " + base : "Приклад " + (i + 1) + " з " + cases.length + " · основа " + base;
      scene.innerHTML = "Множимо по одному: дивись, як <b>остання цифра</b> " + base + "ⁿ починає повторюватись.";
      strip.replaceChildren();
      quiz.replaceChildren();
      if (picker) paintPicks();

      const next = el("button", { class: "btn", type: "button" });
      const paintBtn = () => {
        next.textContent = shownPow < 8 ? "× " + base + " (степінь " + (shownPow + 1) + ")" : "далі циклу немає — він повторюється";
        next.disabled = shownPow >= 8;
      };
      next.addEventListener("click", () => {
        if (shownPow >= 8) return;
        shownPow++;
        const d = lastDigit(base, shownPow);
        const chip = el("span", { class: "cyc-chip" + (shownPow > cyc.length ? " repeat" : "") },
          el("b", { text: base + (["¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸"][shownPow - 1]) }),
          el("span", { class: "cyc-end", text: "…" + d })
        );
        strip.append(chip);
        if (shownPow === cyc.length + 1) say("Бачиш? Остання цифра повернулась до <b>" + cyc[0] + "</b>. Цикл має довжину <b>" + cyc.length + "</b>: " + cyc.join(", ") + ".", "ok");
        paintBtn();
        if (shownPow >= cyc.length + 1) askQuiz();
      });
      paintBtn();
      step.replaceChildren(next);

      let asked = false;
      function askQuiz() {
        if (asked) return;
        asked = true;
        const want = lastDigit(base, c.exp);
        const field = el("input", { class: "mini-input", type: "text", inputmode: "numeric", "aria-label": "остання цифра" });
        const go = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
        const run = () => {
          const v = field.value.trim();
          if (v === "") return say("Впиши цифру.", "no");
          if (Number(v) === want) {
            say("Так! " + base + "<sup>" + c.exp + "</sup> закінчується на <b>" + want + "</b>. " +
              "Показник " + c.exp + " : " + cyc.length + " = остача " + (c.exp % cyc.length || cyc.length) +
              " → " + (c.exp % cyc.length === 0 ? "останнє число циклу" : (c.exp % cyc.length) + "-те число циклу") + ".", "ok");
            field.disabled = go.disabled = true;
            if (picker) {
              done.add(i);
              paintPicks();
              if (!solved) { solved = true; onDone(); }
              quiz.append(el("div", { class: "div-ask", html: done.size >= cases.length
                ? "Усі основи 2–9 пройдено! Можеш переграти будь-яку вгорі."
                : "Готово. Обери вгорі <b>іншу основу</b> — або ту саму ще раз." }));
            } else if (i + 1 < cases.length) {
              const nx = el("button", { class: "btn", type: "button", text: "Інша основа →" });
              nx.addEventListener("click", () => { say("", ""); load(i + 1); });
              quiz.append(nx);
            } else if (!solved) { solved = true; onDone(); }
          } else {
            say("Ще ні. Порахуй остачу " + c.exp + " : " + cyc.length + " і візьми це число з циклу " + cyc.join(", ") + " (остача 0 — останнє).", "no");
          }
        };
        go.addEventListener("click", run);
        field.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
        quiz.replaceChildren(
          el("div", { class: "div-ask", html: "Тепер сама: якою цифрою закінчується <b>" + base + "<sup>" + c.exp + "</sup></b>?" }),
          el("div", { class: "div-row" }, field, go)
        );
      }

      say("", "");
    }

    if (picker) {
      root.append(task, picks, stat, scene, strip, step, quiz, verdict);
      stat.textContent = "Обери основу 2–9 — і побудуй її цикл.";
      scene.innerHTML = "Тисни цифру вгорі: 2, 3, 4, 5, 6, 7, 8 чи 9.";
      paintPicks();
    } else {
      root.append(task, stat, scene, strip, step, quiz, verdict);
      load(0);
    }
    return root;
  }

  /* ---------- 4. «Сортувалка»: познач, у яких колонках число ділиться ---------- */

  function sort(cfg, onDone) {
    const nums = cfg.nums;
    const bins = cfg.bins;
    let solved = false;
    const root = el("div", { class: "sim divis div-sort" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const stat = el("div", { class: "sim-stat", text: "Познач кожну клітинку, де число ділиться націло. Тисни число ліворуч — підкаже, куди дивитись." });
    const grid = el("div", { class: "div-grid" });
    const help = el("div", { class: "div-sumline", html: "Натисни число ліворуч — побачиш його хвіст і суму цифр." });
    const bar = el("div", { class: "div-row" });
    const verdict = el("div", { class: "sim-verdict" });
    const say = (text, kind) => { verdict.className = "sim-verdict" + (kind ? " " + kind : ""); verdict.innerHTML = text; };

    const picked = new Set();      /* ключі "рядок:колонка" */
    const cells = [];              /* cells[r][c] = кнопка */

    const header = el("div", { class: "div-grid-row head" });
    header.append(el("div", { class: "div-cell num head", text: "число" }));
    bins.forEach((by) => header.append(el("div", { class: "div-cell bin head", text: "÷" + by })));
    grid.append(header);

    nums.forEach((n, r) => {
      const row = el("div", { class: "div-grid-row" });
      const numBtn = el("button", { class: "div-cell num", type: "button", text: String(n) });
      numBtn.addEventListener("click", () => {
        help.innerHTML = "<b>" + n + "</b> · остання цифра <b>" + (n % 10) + "</b> · сума цифр <b>" + digitSum(n) + "</b>";
        [...grid.querySelectorAll(".div-grid-row")].forEach((x) => x.classList.remove("focus"));
        row.classList.add("focus");
      });
      row.append(numBtn);
      cells[r] = [];
      bins.forEach((by, c) => {
        const cell = el("button", { class: "div-cell bin", type: "button", "aria-label": n + " ділиться на " + by + "?" });
        cell.addEventListener("click", () => {
          const key = r + ":" + c;
          if (picked.has(key)) { picked.delete(key); cell.classList.remove("on"); cell.textContent = ""; }
          else { picked.add(key); cell.classList.add("on"); cell.textContent = "✓"; }
          cell.classList.remove("good", "bad", "miss");
          say("", "");
        });
        cells[r][c] = cell;
        row.append(cell);
      });
      grid.append(row);
    });

    const check = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
    check.addEventListener("click", () => {
      let wrong = 0, missed = 0;
      nums.forEach((n, r) => bins.forEach((by, c) => {
        const cell = cells[r][c];
        const should = n % by === 0;
        const has = picked.has(r + ":" + c);
        cell.classList.remove("good", "bad", "miss");
        if (has && should) cell.classList.add("good");
        else if (has && !should) { cell.classList.add("bad"); wrong++; }
        else if (!has && should) { cell.classList.add("miss"); missed++; }
      }));
      if (wrong === 0 && missed === 0) {
        say("Усе правильно! Кожне число стоїть лише в тих колонках, де справді ділиться.", "ok");
        check.disabled = true;
        cells.forEach((rowCells) => rowCells.forEach((cell) => { cell.disabled = true; }));
        if (!solved) { solved = true; onDone(); }
      } else {
        const parts = [];
        if (wrong) parts.push("<b>" + wrong + "</b> зайвих (червоні)");
        if (missed) parts.push("<b>" + missed + "</b> пропущено (обведені)");
        say("Ще ні: " + parts.join(", ") + ". Виправ і перевір знову.", "no");
      }
    });
    bar.append(check);

    root.append(task, stat, grid, help, bar, verdict);
    return root;
  }

  return { check, star, cycle, sort, lastDigit, cycleOf, digitSum };
})();
