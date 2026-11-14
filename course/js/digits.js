/* Натуральні числа й цифри: тренажери до заняття 8.
   1) floors    — «Поверхи чисел»: на поверсі k живе 9·10^(k-1) чисел, кожному треба k цифр.
   2) pages     — «Нумерація: туди й назад»: порахувати цифри для книги в N сторінок і навпаки.
   3) arrange   — «Скільки чисел можна скласти»: правило множення, позиція за позицією, перша ≠ 0.
   4) crossout  — «Викресли зайве»: прибрати k цифр так, щоб число лишилось найбільшим.
   5) digitpos  — «Яка цифра на N-му місці» у ряду 1234567891011…: йдемо поверхами.
   Усі відповіді файл рахує сам (перебором/прямим підрахунком). Якщо показане правило
   розійдеться з підрахунком — помилка в консоль, і check.js падає. */

const DIGITS = (function () {
  const el = COURSE.el;

  /* ---------- спільна арифметика ---------- */

  const floorCount = (k) => 9 * Math.pow(10, k - 1);        /* скільки k-цифрових чисел */
  const floorLow = (k) => Math.pow(10, k - 1);              /* найменше k-цифрове (для k=1 → 1) */
  const floorHigh = (k) => Math.pow(10, k) - 1;             /* найбільше k-цифрове */

  /* Скільки цифр треба, щоб пронумерувати сторінки 1..N. */
  function digitsUpto(N) {
    let total = 0, k = 1;
    while (floorLow(k) <= N) {
      const high = Math.min(N, floorHigh(k));
      total += (high - floorLow(k) + 1) * k;
      k++;
    }
    return total;
  }

  /* Поверхи, потрібні для книги в N сторінок: [{k, pages, digits}], з частковим верхнім. */
  function floorsUpto(N) {
    const rows = [];
    let k = 1;
    while (floorLow(k) <= N) {
      const high = Math.min(N, floorHigh(k));
      const pages = high - floorLow(k) + 1;
      rows.push({ k, pages, digits: pages * k, full: high === floorHigh(k) });
      k++;
    }
    return rows;
  }

  /* Скільки сторінок у книзі, якщо на нумерацію пішло D цифр.
     Повертає {pages, floor, below, inFloor, exact, extra}. */
  function pagesFromDigits(D) {
    let k = 1, below = 0;
    while (true) {
      const block = floorCount(k) * k;
      if (below + block >= D) {
        const rem = D - below;               /* цифри всередині поверху k */
        const inFloor = Math.floor(rem / k); /* повних k-цифрових сторінок */
        const extra = rem - inFloor * k;     /* зайві цифри, якщо не ділиться */
        return { floor: k, below, inFloor, extra, exact: extra === 0,
          pages: (floorLow(k) - 1) + inFloor };
      }
      below += block;
      k++;
      if (k > 12) return { floor: k, below, inFloor: 0, extra: 0, exact: false, pages: 0 };
    }
  }

  /* Яка цифра стоїть на pos-му місці ряду 1234567891011… і з якого вона числа. */
  function digitAt(pos) {
    let k = 1, below = 0;
    while (true) {
      const block = floorCount(k) * k;
      if (pos <= below + block) {
        const R = pos - below;               /* місце всередині поверху k */
        const idx = R - 1;
        const num = floorLow(k) + Math.floor(idx / k);
        const which = idx % k;               /* 0 — перша цифра числа */
        return { digit: String(num)[which], num, floor: k, below, R, which };
      }
      below += block;
      k++;
      if (k > 12) return { digit: "?", num: 0, floor: k, below, R: 0, which: 0 };
    }
  }

  /* Найбільше число, що лишається, якщо з рядка s викреслити rem цифр (порядок зберігаємо). */
  function maxAfterRemove(s, rem) {
    const keep = s.length - rem;
    const stack = [];
    let drop = rem;
    for (const ch of s) {
      while (stack.length && drop > 0 && stack[stack.length - 1] < ch) { stack.pop(); drop--; }
      stack.push(ch);
    }
    return stack.slice(0, keep).join("");
  }

  /* ---------- дрібні будівельні блоки ---------- */

  const mkVerdict = () => {
    const v = el("div", { class: "sim-verdict" });
    const say = (text, kind) => { v.className = "sim-verdict" + (kind ? " " + kind : ""); v.innerHTML = text; };
    return { node: v, say };
  };

  /* Поле для числа + обробник Enter. */
  function numField(width, onEnter, aria) {
    const f = el("input", { class: "mini-input", type: "text", inputmode: "numeric", "aria-label": aria || "число" });
    if (width) f.style.width = width;
    if (onEnter) f.addEventListener("keydown", (e) => { if (e.key === "Enter") onEnter(); });
    return f;
  }

  const intOf = (f) => {
    const t = f.value.trim().replace(/\s+/g, "");
    return /^-?\d+$/.test(t) ? Number(t) : NaN;
  };

  /* ---------- 1. Поверхи чисел ---------- */

  function floors(cfg, onDone) {
    const F = cfg.floors || 4;
    let solved = false;
    const root = el("div", { class: "sim digits dig-floors" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const stat = el("div", { class: "sim-stat", text: "Тисни поверх — побачиш, хто там живе. Потім заповни таблицю праворуч." });
    const wrap = el("div", { class: "dig-tower-wrap" });
    const tower = el("div", { class: "dig-tower" });
    const panel = el("div", { class: "dig-panel", html: "Який поверх відкрити?" });
    const fields = [];
    const grid = el("div", { class: "dig-fill" });
    const verdict = mkVerdict();

    /* Вежа: поверхи згори вниз (найглибший номер — найдовший). */
    for (let k = F; k >= 1; k--) {
      const btn = el("button", { class: "dig-floor", type: "button" },
        el("span", { class: "dig-floor-k", text: "поверх " + k }),
        el("span", { class: "dig-floor-d", text: "◾".repeat(k) })
      );
      btn.addEventListener("click", () => {
        [...tower.children].forEach((c) => c.classList.remove("on"));
        btn.classList.add("on");
        panel.innerHTML =
          "<b>Поверх " + k + "</b> — тут живуть <b>" + k + "-цифрові</b> числа.<br>" +
          "Найменше: <b>" + floorLow(k).toLocaleString("uk") + "</b>, найбільше: <b>" + floorHigh(k).toLocaleString("uk") + "</b>.<br>" +
          "Скільки їх? Від " + floorLow(k) + " до " + floorHigh(k) + " — це <b>" + floorCount(k).toLocaleString("uk") + "</b> чисел " +
          "(9·" + (k > 1 ? "10" + sup(k - 1) : "1") + ").<br>" +
          "Кожному треба <b>" + k + "</b> " + plural(k, "цифра", "цифри", "цифр") + ".";
      });
      tower.append(btn);
    }
    wrap.append(tower, panel);

    /* Таблиця: дитина вписує кількість чисел на кожному поверсі. */
    grid.append(
      el("div", { class: "dig-fill-row head" },
        el("span", { text: "поверх" }), el("span", { text: "скільки чисел?" }), el("span", { class: "dig-dig-col", text: "цифр" }))
    );
    for (let k = 1; k <= F; k++) {
      const f = numField("92px", () => check(), k + "-цифрових чисел");
      const digCell = el("span", { class: "dig-dig-col", text: "" });
      fields.push({ k, f, digCell });
      grid.append(el("div", { class: "dig-fill-row" },
        el("span", { text: k + "-цифрові" }), f, digCell));
    }
    const totalCell = el("span", { class: "dig-total", text: "" });
    grid.append(el("div", { class: "dig-fill-row total" },
      el("span", { text: "усього цифр" }), el("span", { text: "" }), el("span", {}, totalCell)));

    const check = () => {
      let allGood = true, total = 0;
      fields.forEach(({ k, f, digCell }) => {
        const want = floorCount(k);
        const got = intOf(f);
        const ok = got === want;
        f.classList.toggle("bad", !ok);
        f.classList.toggle("good", ok);
        if (ok) { digCell.textContent = want.toLocaleString("uk") + " · " + k + " = " + (want * k).toLocaleString("uk"); total += want * k; }
        else { digCell.textContent = ""; allGood = false; }
      });
      if (allGood) {
        totalCell.textContent = total.toLocaleString("uk");
        verdict.say("Точно! Одноцифрових 9, далі щоразу вдесятеро більше. Щоб пронумерувати всі числа до поверху " + F + ", треба <b>" + total.toLocaleString("uk") + "</b> цифр.", "ok");
        fields.forEach(({ f }) => (f.disabled = true));
        btnRow.querySelector(".btn").disabled = true;
        if (!solved) { solved = true; onDone(); }
      } else {
        verdict.say("Не всі збіглися (червоні). Підказка: одноцифрових <b>9</b>, двоцифрових <b>90</b>, трицифрових <b>900</b> — щоразу ×10.", "no");
      }
    };
    const checkBtn = el("button", { class: "btn", type: "button", text: "Перевірити таблицю ✓" });
    checkBtn.addEventListener("click", check);
    const btnRow = el("div", { class: "dig-row" }, checkBtn);

    root.append(task, stat, wrap, grid, btnRow, verdict.node);
    return root;
  }

  /* ---------- 2. Нумерація: туди й назад ---------- */

  function pages(cfg, onDone) {
    let solved = false;
    const root = el("div", { class: "sim digits dig-pages" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const tabs = el("div", { class: "dig-tabs" });
    const fwdTab = el("button", { class: "dig-tab on", type: "button", text: "Порахувати цифри →" });
    const revTab = el("button", { class: "dig-tab", type: "button", text: "← Знайти сторінки" });
    tabs.append(fwdTab, revTab);
    const body = el("div", { class: "dig-pages-body" });
    const verdict = mkVerdict();
    const finish = () => { if (!solved) { solved = true; onDone(); } };

    function showForward() {
      fwdTab.classList.add("on"); revTab.classList.remove("on");
      verdict.say("", "");
      body.replaceChildren(forwardPane());
    }
    function showReverse() {
      revTab.classList.add("on"); fwdTab.classList.remove("on");
      verdict.say("", "");
      body.replaceChildren(reversePane());
    }
    fwdTab.addEventListener("click", showForward);
    revTab.addEventListener("click", showReverse);

    /* ---- вперед: N сторінок → скільки цифр ---- */
    function forwardPane() {
      const pane = el("div", { class: "dig-pane" });
      const chips = el("div", { class: "dig-row chips" });
      const field = numField("110px", () => run(), "остання сторінка");
      field.setAttribute("placeholder", "№ сторінки");
      const go = el("button", { class: "btn", type: "button", text: "Порахувати" });
      const work = el("div", { class: "dig-work" });
      (cfg.forward || [287]).forEach((n) => {
        const c = el("button", { class: "dig-chip", type: "button", text: "1…" + n });
        c.addEventListener("click", () => { field.value = String(n); run(); });
        chips.append(c);
      });
      pane.append(el("div", { class: "dig-ask", html: "Книгу пронумеровано з 1-ї по сторінку N. Скільки цифр надрукували? Обери приклад або впиши N:" }),
        chips, el("div", { class: "dig-row" }, field, go), work);

      function run() {
        const N = intOf(field);
        work.replaceChildren();
        if (!(N >= 1) || N > 999999) { verdict.say("Впиши номер сторінки від 1 до 999999.", "no"); return; }
        const rows = floorsUpto(N);
        const top = rows[rows.length - 1];
        const table = el("div", { class: "dig-steps" });
        rows.forEach((r) => {
          if (r.full) {
            table.append(el("div", { class: "dig-step" },
              el("span", { html: r.k + "-цифрові (" + floorLow(r.k) + "–" + floorHigh(r.k) + ")" }),
              el("span", { class: "muted", html: r.pages.toLocaleString("uk") + " × " + r.k + " = <b>" + r.digits.toLocaleString("uk") + "</b>" })));
          }
        });
        /* частковий верхній поверх — його рахує дитина */
        const partPages = top.pages;
        const pageField = numField("96px", () => checkFwd(), "скільки сторінок на верхньому поверсі");
        const totalField = numField("120px", () => checkFwd(), "усього цифр");
        if (!top.full) {
          table.append(el("div", { class: "dig-step live" },
            el("span", { html: top.k + "-цифрові (від " + floorLow(top.k) + " до " + N + "): скільки сторінок?" }),
            el("span", {}, pageField, el("span", { class: "muted", html: " × " + top.k }))));
        } else {
          pageField.value = String(partPages); /* повний поверх — нічого рахувати */
        }
        table.append(el("div", { class: "dig-step total" },
          el("span", { text: "усього цифр:" }), el("span", {}, totalField)));
        const btn = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
        btn.addEventListener("click", checkFwd);
        work.append(table, el("div", { class: "dig-row" }, btn));

        function checkFwd() {
          const wantTotal = digitsUpto(N);
          if (!top.full) {
            const gotPages = intOf(pageField);
            if (gotPages !== partPages) {
              verdict.say("Скільки сторінок від " + floorLow(top.k) + " до " + N + "? Це " + N + " − " + (floorLow(top.k) - 1) + " = <b>" + partPages + "</b>.", "no");
              pageField.classList.add("bad"); return;
            }
            pageField.classList.remove("bad"); pageField.classList.add("good");
          }
          const gotTotal = intOf(totalField);
          if (gotTotal === wantTotal) {
            totalField.classList.remove("bad"); totalField.classList.add("good");
            verdict.say("Так! На книгу з " + N + " сторінок пішло <b>" + wantTotal.toLocaleString("uk") + "</b> цифр. Додали всі поверхи.", "ok");
            totalField.disabled = pageField.disabled = btn.disabled = true;
            finish();
          } else {
            totalField.classList.add("bad");
            verdict.say("Додай усі поверхи стовпчика. Перевір суму ще раз.", "no");
          }
        }
      }
      return pane;
    }

    /* ---- назад: D цифр → скільки сторінок ---- */
    function reversePane() {
      const pane = el("div", { class: "dig-pane" });
      const chips = el("div", { class: "dig-row chips" });
      const field = numField("120px", () => run(), "скільки цифр");
      field.setAttribute("placeholder", "усього цифр");
      const go = el("button", { class: "btn", type: "button", text: "Знайти" });
      const work = el("div", { class: "dig-work" });
      (cfg.reverse || [2893]).forEach((d) => {
        const c = el("button", { class: "dig-chip", type: "button", text: d + " цифр" });
        c.addEventListener("click", () => { field.value = String(d); run(); });
        chips.append(c);
      });
      pane.append(el("div", { class: "dig-ask", html: "На нумерацію книги пішло D цифр. Скільки в ній сторінок? Обери приклад або впиши D:" }),
        chips, el("div", { class: "dig-row" }, field, go), work);

      function run() {
        const D = intOf(field);
        work.replaceChildren();
        if (!(D >= 1) || D > 5999999) { verdict.say("Впиши кількість цифр від 1 до майже 6 мільйонів.", "no"); return; }
        const res = pagesFromDigits(D);
        const L = res.floor;
        const table = el("div", { class: "dig-steps" });
        /* показуємо, що з'їли нижні поверхи */
        let below = 0;
        for (let k = 1; k < L; k++) {
          const block = floorCount(k) * k;
          below += block;
          table.append(el("div", { class: "dig-step" },
            el("span", { html: k + "-цифрові з'їли " + floorCount(k).toLocaleString("uk") + " × " + k }),
            el("span", { class: "muted", html: "= " + block.toLocaleString("uk") + " (разом " + below.toLocaleString("uk") + ")" })));
        }
        const rem = D - res.below;
        const inField = numField("96px", () => checkRev(), "скільки трицифрових сторінок");
        const totalField = numField("110px", () => checkRev(), "усього сторінок");
        table.append(el("div", { class: "dig-step live" },
          el("span", { html: "лишилось <b>" + rem.toLocaleString("uk") + "</b> цифр на " + L + "-цифрові. Скільки таких сторінок? (÷ " + L + ")" }),
          el("span", {}, inField)));
        table.append(el("div", { class: "dig-step total" },
          el("span", { html: "сторінок усього: " + (floorLow(L) - 1) + " + ?" }), el("span", {}, totalField)));
        const btn = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
        btn.addEventListener("click", checkRev);
        work.append(table, el("div", { class: "dig-row" }, btn));

        function checkRev() {
          if (!res.exact) {
            verdict.say(rem + " не ділиться на " + L + " націло: " + res.inFloor + " повних сторінок і ще " + res.extra + " цифр. Для книги це дивне число — візьми приклад зі списку.", "no");
            return;
          }
          const gotIn = intOf(inField);
          if (gotIn !== res.inFloor) {
            verdict.say("Поділи: " + rem.toLocaleString("uk") + " ÷ " + L + " = <b>" + res.inFloor + "</b> сторінок.", "no");
            inField.classList.add("bad"); return;
          }
          inField.classList.remove("bad"); inField.classList.add("good");
          const gotTotal = intOf(totalField);
          if (gotTotal === res.pages) {
            totalField.classList.remove("bad"); totalField.classList.add("good");
            verdict.say("Так! У книзі <b>" + res.pages.toLocaleString("uk") + "</b> сторінок: " + (floorLow(L) - 1) + " коротших і ще " + res.inFloor + ".", "ok");
            inField.disabled = totalField.disabled = btn.disabled = true;
            finish();
          } else {
            totalField.classList.add("bad");
            verdict.say("Додай короткі сторінки й знайдені: " + (floorLow(L) - 1) + " + " + res.inFloor + ".", "no");
          }
        }
      }
      return pane;
    }

    root.append(task, tabs, body, verdict.node);
    showForward();
    return root;
  }

  /* ---------- 3. Скільки чисел можна скласти ---------- */

  function arrange(cfg, onDone) {
    const cases = cfg.cases;
    let at = 0, solved = false;
    const root = el("div", { class: "sim digits dig-arrange" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const stat = el("div", { class: "sim-stat" });
    const scene = el("div", { class: "dig-ask" });
    const slotsRow = el("div", { class: "dig-slots" });
    const mult = el("div", { class: "dig-row mult" });
    const bar = el("div", { class: "dig-row" });
    const verdict = mkVerdict();

    /* самоперевірка: добуток позицій має дорівнювати оголошеному total */
    cases.forEach((c) => {
      const prod = c.slots.reduce((a, b) => a * b, 1);
      if (prod !== c.total) console.error("arrange: добуток " + c.slots.join("·") + " = " + prod + " ≠ total " + c.total + " (" + c.title + ")");
    });

    function load(i) {
      at = i;
      const c = cases[i];
      stat.textContent = "Приклад " + (i + 1) + " з " + cases.length;
      scene.innerHTML = c.title;
      slotsRow.replaceChildren();
      mult.replaceChildren();
      bar.replaceChildren();
      const slotFields = c.slots.map((want, j) => {
        const f = numField("64px", () => check(), "варіантів на позицію " + (j + 1));
        slotsRow.append(el("div", { class: "dig-slot" },
          el("span", { class: "dig-slot-k", text: "поз. " + (j + 1) }), f));
        return f;
      });
      const totalField = numField("90px", () => check(), "усього чисел");
      mult.append(el("span", { html: "Перемнож усі позиції:&nbsp;" }), totalField);
      const btn = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
      btn.addEventListener("click", check);
      bar.append(btn);
      verdict.say("", "");

      function check() {
        let slotsOk = true;
        slotFields.forEach((f, j) => {
          const ok = intOf(f) === c.slots[j];
          f.classList.toggle("bad", !ok); f.classList.toggle("good", ok);
          if (!ok) slotsOk = false;
        });
        if (!slotsOk) { verdict.say("Полічи варіанти для кожної позиції окремо. " + (c.why || ""), "no"); return; }
        const total = intOf(totalField);
        if (total === c.total) {
          totalField.classList.remove("bad"); totalField.classList.add("good");
          verdict.say("Так! " + c.slots.join(" · ") + " = <b>" + c.total + "</b>. " + (c.why || "") + (c.list ? "<br>Усі: " + c.list : ""), "ok");
          slotFields.forEach((f) => (f.disabled = true));
          totalField.disabled = btn.disabled = true;
          if (i + 1 < cases.length) {
            const nx = el("button", { class: "btn", type: "button", text: "Наступне →" });
            nx.addEventListener("click", () => load(i + 1));
            bar.replaceChildren(nx);
          } else if (!solved) { solved = true; onDone(); }
        } else {
          totalField.classList.add("bad");
          verdict.say("Позиції правильні — тепер перемнож їх: " + c.slots.join(" · ") + ".", "no");
        }
      }
    }

    root.append(task, stat, scene, slotsRow, mult, bar, verdict.node);
    load(0);
    return root;
  }

  /* ---------- 4. Викресли зайве ---------- */

  function crossout(cfg, onDone) {
    const cases = cfg.cases;
    let at = 0, solved = false;
    const root = el("div", { class: "sim digits dig-cross" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const stat = el("div", { class: "sim-stat" });
    const scene = el("div", { class: "dig-ask" });
    const strip = el("div", { class: "dig-strip" });
    const live = el("div", { class: "dig-result" });
    const bar = el("div", { class: "dig-row" });
    const verdict = mkVerdict();

    cases.forEach((c) => {
      if (maxAfterRemove(c.s, c.remove).length !== c.s.length - c.remove)
        console.error("crossout: довжина відповіді не збіглась для " + c.s);
    });

    function load(i) {
      at = i;
      const c = cases[i];
      const removed = new Set();
      const best = maxAfterRemove(c.s, c.remove);
      stat.textContent = "Приклад " + (i + 1) + " з " + cases.length;
      scene.innerHTML = "Викресли рівно <b>" + c.remove + "</b> " + plural(c.remove, "цифру", "цифри", "цифр") +
        ", щоб число, яке лишиться (" + (c.s.length - c.remove) + " цифр), було <b>найбільшим</b>.";
      strip.replaceChildren();
      const chips = [...c.s].map((ch, j) => {
        const chip = el("button", { class: "dig-cell-x", type: "button", text: ch });
        chip.addEventListener("click", () => {
          if (removed.has(j)) removed.delete(j); else {
            if (removed.size >= c.remove) { verdict.say("Уже викреслено " + c.remove + ". Поверни якусь, щоб прибрати іншу.", "no"); return; }
            removed.add(j);
          }
          chip.classList.toggle("out", removed.has(j));
          paint();
        });
        return chip;
      });
      chips.forEach((ch) => strip.append(ch));
      const btn = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
      btn.addEventListener("click", check);
      bar.replaceChildren(btn);
      verdict.say("", "");
      paint();

      function current() { return [...c.s].filter((_, j) => !removed.has(j)).join(""); }
      function paint() {
        const cur = current();
        live.innerHTML = "Викреслено <b>" + removed.size + "</b> з " + c.remove + " · лишилось: <b class='dig-big'>" + (cur || "—") + "</b>";
      }
      function check() {
        if (removed.size !== c.remove) { verdict.say("Треба викреслити рівно " + c.remove + " (зараз " + removed.size + ").", "no"); return; }
        const cur = current();
        if (cur === best) {
          verdict.say("Найбільше можливе: <b>" + best + "</b>! Правило: йдучи зліва, прибирай цифру, якщо наступна більша за неї.", "ok");
          chips.forEach((ch) => (ch.disabled = true)); btn.disabled = true;
          if (i + 1 < cases.length) {
            const nx = el("button", { class: "btn", type: "button", text: "Наступне →" });
            nx.addEventListener("click", () => load(i + 1));
            bar.replaceChildren(nx);
          } else if (!solved) { solved = true; onDone(); }
        } else {
          verdict.say("Можна більше, ніж " + cur + ". Підказка: шукай зліва цифру, за якою стоїть <b>більша</b> — саме її вигідно викреслити (велика цифра зсунеться вперед).", "no");
        }
      }
    }

    root.append(task, stat, scene, strip, live, bar, verdict.node);
    load(0);
    return root;
  }

  /* ---------- 5. Яка цифра на N-му місці ---------- */

  function digitpos(cfg, onDone) {
    const cases = cfg.cases;
    let at = 0, solved = false;
    const root = el("div", { class: "sim digits dig-pos" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const chips = el("div", { class: "dig-row chips" });
    const stat = el("div", { class: "sim-stat" });
    const scene = el("div", { class: "dig-ask" });
    const work = el("div", { class: "dig-work" });
    const bar = el("div", { class: "dig-row" });
    const verdict = mkVerdict();

    const field = numField("110px", () => run(), "номер місця");
    field.setAttribute("placeholder", "№ місця");
    const go = el("button", { class: "btn", type: "button", text: "Розібрати" });
    go.addEventListener("click", () => run());
    cases.forEach((c) => {
      const chip = el("button", { class: "dig-chip", type: "button", text: "місце " + c.pos });
      chip.addEventListener("click", () => { field.value = String(c.pos); run(); });
      chips.append(chip);
    });

    function run() {
      const pos = intOf(field);
      work.replaceChildren();
      verdict.say("", "");
      if (!(pos >= 1) || pos > 5999999) { verdict.say("Впиши номер місця від 1 до майже 6 мільйонів.", "no"); return; }
      const ans = digitAt(pos);
      const L = ans.floor;
      scene.innerHTML = "Ряд: 1&nbsp;2&nbsp;3&nbsp;…&nbsp;9&nbsp;10&nbsp;11&nbsp;12&nbsp;… Яка цифра стоїть на <b>" + pos + "-му</b> місці?";
      const steps = el("div", { class: "dig-steps" });
      let below = 0;
      for (let k = 1; k < L; k++) {
        const block = floorCount(k) * k;
        below += block;
        steps.append(el("div", { class: "dig-step" },
          el("span", { html: k + "-цифрові зайняли місця" }),
          el("span", { class: "muted", html: floorCount(k).toLocaleString("uk") + " × " + k + " = " + block.toLocaleString("uk") + " (разом " + below.toLocaleString("uk") + ")" })));
      }
      const R = pos - ans.below;
      const rField = numField("90px", () => checkR(), "місце всередині поверху");
      steps.append(el("div", { class: "dig-step live" },
        el("span", { html: "місце всередині " + L + "-цифрових: " + pos + " − " + ans.below.toLocaleString("uk") + " = ?" }),
        el("span", {}, rField)));
      const digField = numField("64px", () => checkDigit(), "цифра");
      const reveal = el("div", { class: "dig-reveal" });
      const btn = el("button", { class: "btn", type: "button", text: "Далі →" });
      btn.addEventListener("click", checkR);
      work.append(steps, el("div", { class: "dig-row" }, btn), reveal);

      function checkR() {
        if (intOf(rField) !== R) { verdict.say("Відніми всі нижні поверхи: " + pos + " − " + ans.below.toLocaleString("uk") + " = <b>" + R + "</b>.", "no"); rField.classList.add("bad"); return; }
        rField.classList.remove("bad"); rField.classList.add("good"); rField.disabled = true;
        const ordinal = Math.ceil(R / L); /* порядковий номер числа серед L-цифрових, 1-based */
        reveal.innerHTML = "Кожне " + L + "-цифрове число займає " + L + " місця. " + R + " ÷ " + L + " = <b>" + Math.floor(R / L) + "</b>, остача <b>" + (R % L) + "</b>.<br>" +
          "Отже, це " + posWord(ans.which + 1) + " цифра числа <b>" + ans.num + "</b> (" + ordinal + "-го " + L + "-цифрового).";
        verdict.say("", "");
        btn.replaceWith(digRow);
      }

      const digRow = el("div", { class: "dig-row" },
        el("span", { html: "Яка це цифра?&nbsp;" }), digField,
        (() => { const b = el("button", { class: "btn", type: "button", text: "Перевірити ✓" }); b.addEventListener("click", checkDigit); return b; })());

      function checkDigit() {
        if (digField.value.trim() === "") { verdict.say("Впиши цифру.", "no"); return; }
        const want = Number(ans.digit);
        if (intOf(digField) === want) {
          digField.classList.remove("bad"); digField.classList.add("good"); digField.disabled = true;
          verdict.say("Так! На " + pos + "-му місці стоїть <b>" + ans.digit + "</b> — це " + posWord(ans.which + 1) + " цифра числа " + ans.num + ".", "ok");
          if (!solved) { solved = true; onDone(); }
        } else {
          digField.classList.add("bad");
          verdict.say("Подивись на число " + ans.num + " і візьми його " + (ans.which + 1) + "-ту цифру.", "no");
        }
      }
    }

    root.append(task, chips, el("div", { class: "dig-row" }, field, go), stat, scene, work, verdict.node);
    stat.textContent = "Обери місце або впиши своє — і пройди поверхами.";
    return root;
  }

  /* ---------- дрібнички ---------- */

  function sup(n) {
    const map = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
    return String(n).split("").map((d) => map[d]).join("");
  }
  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }
  /* Порядкова форма жіночого роду для «цифра»: 1-ша, 2-га, 3-тя, далі -та. */
  function posWord(w) {
    return w === 1 ? "1-ша" : w === 2 ? "2-га" : w === 3 ? "3-тя" : w + "-та";
  }

  return { floors, pages, arrange, crossout, digitpos,
    digitsUpto, pagesFromDigits, digitAt, maxAfterRemove, floorCount };
})();
