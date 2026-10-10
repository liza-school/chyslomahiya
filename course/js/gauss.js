/* Спосіб Гаусса: пари з двох кінців, сходи «Джеміно», купки гир.
   Суми в розвʼязаннях рахує цей самий файл: якщо формула розійдеться з простим додаванням,
   помилка піде в консоль, і check.js упаде. */

const GAUSS = (function () {
  const el = COURSE.el;
  const NS = "http://www.w3.org/2000/svg";
  const HUES = 6;

  function svg(tag, attrs, ...kids) {
    const node = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null) continue;
      if (name === "text") node.textContent = value;
      else if (name.startsWith("on")) node.addEventListener(name.slice(2), value);
      else node.setAttribute(name, value);
    }
    for (const kid of kids.flat(Infinity)) if (kid) node.append(kid);
    return node;
  }

  const total = (list) => list.reduce((a, b) => a + b, 0);
  const listOf = (c) => (c.numbers ? c.numbers.slice() : Array.from({ length: c.count }, (_, i) => c.first + i * c.step));
  const readNum = (text) => Number(String(text).replace(/\s+/g, "").replace(",", "."));

  /* Сума ряду з кроком: формула Гаусса, перевірена звичайним додаванням. */
  function sum(first, step, count) {
    const fast = ((first + first + (count - 1) * step) * count) / 2;
    let slow = 0;
    for (let i = 0; i < count; i++) slow += first + i * step;
    if (fast !== slow) console.error("GAUSS.sum: формула дала " + fast + ", а додавання — " + slow);
    return fast;
  }

  /* Скільки чисел від first до last кроками step: стовпчиків паркану на один більше, ніж прогонів. */
  function count(first, last, step) {
    const n = (last - first) / step + 1;
    if (!Number.isInteger(n) || n < 1) console.error("GAUSS.count: від " + first + " до " + last + " кроком " + step + " не дійти");
    return n;
  }

  /* Різні способи розкласти гирі на k купок рівної маси. Купки між собою не розрізняються. */
  function keyOf(groups) {
    return groups.map((g) => g.slice().sort((a, b) => a - b).join("+")).sort().join(" | ");
  }

  function ways(weights, k, target) {
    const found = new Set();
    const limit = Math.pow(k, weights.length);
    for (let code = 0; code < limit; code++) {
      const groups = Array.from({ length: k }, () => []);
      let rest = code;
      for (const w of weights) {
        groups[rest % k].push(w);
        rest = Math.floor(rest / k);
      }
      if (groups.every((g) => total(g) === target)) found.add(keyOf(groups));
    }
    return found.size;
  }

  /* Невеличка форма «впиши число й перевір» усередині темної панелі. */
  function numberField(wide) {
    return el("input", { class: "mini-input" + (wide ? " wide" : ""), type: "text", inputmode: "numeric", autocomplete: "off" });
  }

  function onEnter(fields, action) {
    fields.forEach((f) => f.addEventListener("keydown", (e) => {
      if (e.key === "Enter") action();
    }));
  }

  /* Відро пари: знизу синя вода — менше число, згори золото — більше. Разом відро повне.
     Число без пари наливає рівно пів відра. */
  function bucket(low, high, capacity, extra) {
    const pct = (v) => (100 * v) / capacity + "%";
    const fill = el("div", { class: "pb-fill" });
    if (high !== null) {
      const top = el("i", { class: "pb-high" });
      top.style.height = pct(high);
      fill.append(top);
    }
    const bottom = el("i", { class: "pb-low" });
    bottom.style.height = pct(low);
    fill.append(bottom);
    return el(
      "div",
      { class: "pbucket" + (extra || "") },
      el("span", { class: "pb-num hi", text: high === null ? "—" : String(high) }),
      el("div", { class: "pb-body" }, fill),
      el("span", { class: "pb-num lo", text: String(low) }),
      el("b", { class: "pb-sum", text: high === null ? "пів відра" : "= " + (low + high) })
    );
  }

  /* ---------- пари з двох кінців ---------- */

  function pairs(cfg, onDone) {
    const round = cfg.rule === "round";
    const manual = cfg.manual === undefined ? 2 : cfg.manual;
    const setup = { first: cfg.first || 1, step: cfg.step || 1, count: cfg.count || 10 };
    let nums, mate, kOf, made, fresh, delays, picked, phase;
    let solved = false;

    const root = el("div", { class: "sim gauss pairs-sim" + (round ? " round" : "") });
    const task = el("div", { class: "sim-task" });
    const stat = el("div", { class: "sim-stat" });
    const stage = el("div", { class: "pair-stage" });
    const shelf = el("div", { class: "pair-shelf" });
    const verdict = el("div", { class: "sim-verdict" });
    const sumBox = el("div", { class: "pair-sum" });
    const magic = el("button", { class: "btn pair-magic", type: "button", text: "Паріа Еквалія ✨" });
    const reset = el("button", { class: "ghost-btn", type: "button", text: "Спочатку ↺" });

    const say = (text, kind) => {
      verdict.className = "sim-verdict" + (kind ? " " + kind : "");
      verdict.textContent = text;
    };
    const need = () => (round ? nums.length / 2 : Math.floor(nums.length / 2));
    const pairSum = () => nums[0] + nums[nums.length - 1];
    const middle = () => (!round && nums.length % 2 ? (nums.length - 1) / 2 : -1);

    let controls = null;
    if (cfg.controls) {
      const shown = el("b", { text: String(setup.count) });
      const range = el("input", { class: "trainer-range", type: "range", min: 2, max: 20, value: setup.count, "aria-label": "Скільки чисел" });
      range.addEventListener("input", () => {
        setup.count = Number(range.value);
        shown.textContent = range.value;
        start();
      });
      const kinds = el("div", { class: "trainer-kinds" });
      [[1, "1, 2, 3, …"], [2, "2, 4, 6, …"], [5, "5, 10, 15, …"]].forEach(([step, label]) => {
        const btn = el("button", { class: "kind-btn" + (step === setup.step ? " on" : ""), type: "button", "data-step": step, text: label });
        btn.addEventListener("click", () => {
          setup.step = step;
          setup.first = step;
          [...kinds.children].forEach((b) => b.classList.toggle("on", b === btn));
          start();
        });
        kinds.append(btn);
      });
      controls = el("div", { class: "trainer-controls" }, el("span", { class: "trainer-field" }, "Чисел: ", shown), range, kinds);
    }

    function autoIntro() {
      const n = nums.length;
      const shown = n <= 5 ? nums.join(", ") : nums[0] + ", " + nums[1] + ", " + nums[2] + ", …, " + nums[n - 1];
      return "Числа <b>" + shown + "</b> — усього " + n + ". Склади їх парами з двох кінців і знайди суму.";
    }

    function start() {
      nums = round ? cfg.numbers.slice() : listOf(setup);
      mate = new Array(nums.length).fill(-1);
      kOf = new Array(nums.length).fill(-1);
      made = [];
      fresh = new Set();
      delays = new Map();
      picked = -1;
      phase = "pair";
      task.innerHTML = cfg.intro || autoIntro();
      magic.hidden = true;
      sumBox.textContent = "";
      say(round ? "Клацни два числа, які разом дають кругле." : "Клацни два числа — над ними виросте арка, а під ними наповниться відро.");
      draw();
    }

    function tokenClass(i) {
      let cls = "";
      if (mate[i] >= 0) cls += " paired p" + (kOf[i] % HUES);
      if (i === picked) cls += " picked";
      if (phase !== "pair" && i === middle()) cls += " lonely";
      return cls;
    }

    function rainbow() {
      const n = nums.length;
      const U = 48;
      const R = 19;
      const H = Math.max(96, Math.min(200, 11 * n));
      const base = 24 + H + R;
      const spanMax = Math.max(1, ((n - 1) * U) / 2);
      const pic = svg("svg", {
        class: "rainbow",
        viewBox: "0 0 " + n * U + " " + (base + R + 6),
        style: "max-width:" + Math.max(n * U, 300) + "px",
        role: "group",
        "aria-label": "Числа в ряд; арки зʼєднують пари",
      });
      made.forEach(([a, b], k) => {
        const x1 = (a + 0.5) * U;
        const x2 = (b + 0.5) * U;
        const rx = (x2 - x1) / 2;
        const ry = Math.max(14, (rx / spanMax) * H);
        const hue = " p" + (k % HUES) + (fresh.has(k) ? " fresh" : "");
        pic.append(svg("path", { class: "arc" + hue, d: "M " + x1 + " " + (base - R) + " A " + rx + " " + ry + " 0 0 1 " + x2 + " " + (base - R), pathLength: 1 }));
        pic.append(svg("text", { class: "arc-sum" + hue, x: (x1 + x2) / 2, y: base - R - ry - 6, text: String(nums[a] + nums[b]) }));
      });
      nums.forEach((value, i) => {
        const token = svg(
          "g",
          { class: "tok" + tokenClass(i), "data-i": i, tabindex: 0, role: "button", "aria-label": String(value) },
          svg("circle", { cx: (i + 0.5) * U, cy: base, r: R }),
          svg("text", { x: (i + 0.5) * U, y: base + 5.5, text: String(value) })
        );
        token.addEventListener("click", () => pick(i));
        token.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick(i);
          }
        });
        pic.append(token);
      });
      return pic;
    }

    function chips() {
      const box = el("div", { class: "pair-chips" });
      nums.forEach((value, i) => {
        const chip = el("button", { class: "pchip" + tokenClass(i), type: "button", "data-i": i, text: String(value) });
        chip.addEventListener("click", () => pick(i));
        box.append(chip);
      });
      return box;
    }

    function draw() {
      stage.textContent = "";
      stage.append(nums.length <= 20 ? rainbow() : chips());
      shelf.textContent = "";
      shelf.classList.toggle("small", nums.length > 20);
      const pause = Math.min(90, 1400 / Math.max(1, delays.size));
      made.forEach(([a, b], k) => {
        const lo = Math.min(nums[a], nums[b]);
        const hi = Math.max(nums[a], nums[b]);
        const cup = bucket(lo, hi, lo + hi, " p" + (k % HUES) + (fresh.has(k) ? " fresh" : ""));
        if (delays.has(k)) cup.style.animationDelay = Math.round(delays.get(k) * pause) + "ms";
        shelf.append(cup);
      });
      const m = middle();
      if (phase !== "pair" && m >= 0) shelf.append(bucket(nums[m], null, pairSum(), " lonely"));
      stat.textContent = "Пар: " + made.length + " з " + need();
      fresh.clear();
      delays.clear();
    }

    function whyNot(a, b) {
      const m = middle();
      if (a === m || b === m) return nums[m] + " стоїть рівно посередині — з другого кінця пари для нього немає.";
      return nums[a] + " + " + nums[b] + " = " + (nums[a] + nums[b]) + ", а пара з двох кінців дає " + pairSum() +
        ". Бери найменше й найбільше з тих чисел, що ще без пари.";
    }

    function join(a, b) {
      mate[a] = b;
      mate[b] = a;
      kOf[a] = made.length;
      kOf[b] = made.length;
      fresh.add(made.length);
      made.push([a, b]);
    }

    function pick(i) {
      if (phase !== "pair") return;
      if (mate[i] >= 0) {
        say("Число " + nums[i] + " уже в парі.", "no");
        return;
      }
      if (picked < 0 || picked === i) {
        picked = picked === i ? -1 : i;
        draw();
        return;
      }
      const a = Math.min(picked, i);
      const b = Math.max(picked, i);
      picked = -1;
      const s = nums[a] + nums[b];
      if (round ? s % 10 !== 0 : a + b !== nums.length - 1) {
        say(round ? nums[a] + " + " + nums[b] + " = " + s + " — не кругле. Шукай число, що доповнить до цілих десятків." : whyNot(a, b), "no");
        draw();
        return;
      }
      join(a, b);
      if (made.length === need()) return finishPairs();
      if (round) say(nums[a] + " + " + nums[b] + " = " + s + " — кругле!", "ok");
      else if (made.length === manual) {
        const step = nums[1] - nums[0];
        magic.hidden = false;
        say("Знову " + s + "! Ліве число щоразу більшає на " + step + ", праве — меншає на " + step +
          ", тож відро наповнюється до того самого краю. Решту пар можна скласти закляттям.", "ok");
      } else if (made.length === 1) say(nums[a] + " + " + nums[b] + " = " + s + ". Тепер наступна пара з двох кінців.", "ok");
      else say("Знову " + s + ".", "ok");
      draw();
    }

    function castMagic() {
      if (phase !== "pair") return;
      const n = nums.length;
      let order = 0;
      for (let a = 0; a < Math.floor(n / 2); a++) {
        if (mate[a] < 0) {
          join(a, n - 1 - a);
          delays.set(made.length - 1, order++);
        }
      }
      picked = -1;
      finishPairs();
    }

    function finishPairs() {
      phase = "sum";
      magic.hidden = true;
      const m = middle();
      const S = pairSum();
      draw();
      if (round) say("Усі числа в парах, і кожне відро — 100. Тепер склади все разом.", "");
      else if (m >= 0) say("Пари скінчилися, а " + nums[m] + " лишилося посередині без пари. Воно наливає рівно пів відра: " + S + " : 2 = " + nums[m] + ".", "");
      else say("Усі числа в парах, і всі відра однакові — по " + S + ".", "");
      buildSumForm();
    }

    function buildSumForm() {
      const m = middle();
      const S = pairSum();
      const totalField = numberField(true);
      const check = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
      let pairsField = null;
      sumBox.textContent = "";
      if (round) {
        sumBox.append(el("span", { text: "Разом:" }), totalField, check);
      } else {
        pairsField = numberField(false);
        sumBox.append(
          el("span", { text: "Відер:" }),
          pairsField,
          el("span", { text: "по " + S + (m >= 0 ? " і ще пів відра (" + nums[m] + ")" : "") + " → разом:" }),
          totalField,
          check
        );
      }

      const verify = () => {
        if (phase === "done") return;
        const answer = readNum(totalField.value);
        const right = total(nums);
        if (pairsField && readNum(pairsField.value) !== need()) {
          say("Повних відер стільки, скільки пар на полиці.", "no");
          return;
        }
        if (answer !== right) {
          let hint = "Склади суми з полиці ще раз.";
          if (!round && m >= 0 && answer === need() * S) hint = "Це лише повні відра. А пів відра — " + nums[m] + "?";
          else if (!round && answer === nums.length * S) hint = "Удвічі забагато: відер не " + nums.length + ", а " + need() + ".";
          else if (!round) hint = need() + " · " + S + (m >= 0 ? " + " + nums[m] : "") + " — порахуй ще раз.";
          say(hint, "no");
          return;
        }
        phase = "done";
        [totalField, pairsField].forEach((f) => f && (f.disabled = true));
        check.disabled = true;
        const formula = round ? made.map(([a, b]) => nums[a] + nums[b]).join(" + ") : need() + " · " + S + (m >= 0 ? " + " + nums[m] : "");
        say("Готово! " + formula + " = " + right + ".", "ok");
        if (!solved) {
          solved = true;
          if (onDone) onDone();
        }
      };
      check.addEventListener("click", verify);
      onEnter([totalField, pairsField].filter(Boolean), verify);
    }

    magic.addEventListener("click", castMagic);
    reset.addEventListener("click", start);
    /* append(null) вставив би слово «null»: повзунок є лише в пісочниці. */
    root.append(...[controls, task, stat, stage, shelf, verdict, sumBox, el("div", { class: "toolbar" }, magic, reset)].filter(Boolean));
    start();
    return root;
  }

  /* ---------- сходи «Джеміно» ---------- */

  const STAIRS = { W: 360, H: 240, gap: 44, L: 58, T: 16, B: 46 };

  function stairsColumns(first, step, n, cls, flipped) {
    const { W, H, L, T } = STAIRS;
    const S = first + first + (n - 1) * step;
    const U = W / n;
    const V = H / S;
    const g = svg("g", { class: "st-stairs " + cls });
    for (let i = 0; i < n; i++) {
      const value = first + (flipped ? n - 1 - i : i) * step;
      const h = value * V;
      const y = flipped ? T : T + H - h;
      g.append(svg("rect", { class: "st-col", x: L + i * U, y: y, width: U, height: h, "data-v": value }));
      if (V >= 7) {
        for (let k = 1; k < value; k++) {
          const yy = flipped ? T + k * V : T + H - k * V;
          g.append(svg("line", { class: "st-cell", x1: L + i * U, x2: L + (i + 1) * U, y1: yy, y2: yy }));
        }
      }
    }
    return g;
  }

  function stairsLabels(first, step, n, pic) {
    const { W, H, L, T } = STAIRS;
    const U = W / n;
    const last = first + (n - 1) * step;
    for (let i = 0; i < n; i++) {
      if (U < 20 && i !== 0 && i !== n - 1) continue;
      pic.append(svg("text", { class: "st-label", x: L + (i + 0.5) * U, y: T + H + 18, text: String(first + i * step) }));
    }
    pic.append(svg("text", { class: "st-label strong", x: L + W / 2, y: T + H + 38, text: n + " " + plural(n, "стовпчик", "стовпчики", "стовпчиків") }));
    const frame = svg("g", { class: "st-frame" });
    frame.append(svg("rect", { x: L, y: T, width: W, height: H }));
    frame.append(svg("text", { class: "st-label strong", x: L - 14, y: T + H / 2, transform: "rotate(-90 " + (L - 14) + " " + (T + H / 2) + ")", text: first + " + " + last + " = " + (first + last) }));
    pic.append(frame);
  }

  function plural(n, one, few, many) {
    const d = n % 10;
    const dd = n % 100;
    if (d === 1 && dd !== 11) return one;
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
    return many;
  }

  function stairs(cfg, onDone) {
    const setup = { first: cfg.first || 1, step: cfg.step || 1, count: cfg.count || 6 };
    let phase = 0;
    let copy = null;
    let solved = false;

    const root = el("div", { class: "sim gauss stairs-sim" });
    const task = el("div", { class: "sim-task" });
    const stat = el("div", { class: "sim-stat" });
    const host = el("div", { class: "stairs-host" });
    const verdict = el("div", { class: "sim-verdict" });
    const ask = el("div", { class: "pair-sum" });
    const gem = el("button", { class: "btn", type: "button", text: "Джеміно ✨" });
    const flip = el("button", { class: "btn", type: "button", text: "Переверни й приклади ↻" });
    const reset = el("button", { class: "ghost-btn", type: "button", text: "Спочатку ↺" });

    const say = (text, kind) => {
      verdict.className = "sim-verdict" + (kind ? " " + kind : "");
      verdict.textContent = text;
    };

    let controls = null;
    if (cfg.controls) {
      const shown = el("b", { text: String(setup.count) });
      const range = el("input", { class: "trainer-range", type: "range", min: 2, max: 20, value: setup.count, "aria-label": "Скільки сходинок" });
      range.addEventListener("input", () => {
        setup.count = Number(range.value);
        shown.textContent = range.value;
        start();
      });
      const kinds = el("div", { class: "trainer-kinds" });
      [[1, "сходинка 1"], [2, "сходинка 2"], [5, "сходинка 5"]].forEach(([step, label]) => {
        const btn = el("button", { class: "kind-btn" + (step === setup.step ? " on" : ""), type: "button", "data-step": step, text: label });
        btn.addEventListener("click", () => {
          setup.step = step;
          setup.first = step;
          [...kinds.children].forEach((b) => b.classList.toggle("on", b === btn));
          start();
        });
        kinds.append(btn);
      });
      controls = el("div", { class: "trainer-controls" }, el("span", { class: "trainer-field" }, "Стовпчиків: ", shown), range, kinds);
    }

    const last = () => setup.first + (setup.count - 1) * setup.step;
    const S = () => setup.first + last();
    const answer = () => sum(setup.first, setup.step, setup.count);

    function start() {
      const { first, step, count: n } = setup;
      const { W, H, gap, L, T, B } = STAIRS;
      phase = 0;
      root.classList.remove("fitted");
      host.textContent = "";
      const pic = svg("svg", { class: "stairs-svg", viewBox: "0 0 " + (L + 2 * W + gap + 8) + " " + (T + H + B), role: "img", "aria-label": "Сходи з кубиків" });
      pic.append(stairsColumns(first, step, n, "gold", false));
      copy = stairsColumns(first, step, n, "st-copy blue hidden", false);
      copy.style.transformOrigin = L + W / 2 + "px " + (T + H / 2) + "px";
      copy.style.transform = "translate(" + (W + gap) + "px, 0px) rotate(0deg)";
      pic.append(copy);
      stairsLabels(first, step, n, pic);
      host.append(pic);
      const shown = n <= 6 ? Array.from({ length: n }, (_, i) => first + i * step).join(" + ") : first + " + " + (first + step) + " + … + " + last();
      task.innerHTML = cfg.intro || "Сходи з кубиків: <b>" + shown + "</b>. Скільки кубиків у сходах — не рахуючи по одному?";
      stat.textContent = "Стовпчиків: " + n + ", найнижчий — " + first + ", найвищий — " + last() + ".";
      gem.disabled = false;
      flip.disabled = true;
      ask.textContent = "";
      say("Натисни «Джеміно» — закляття зробить точну копію сходів.");
    }

    function copyIt() {
      if (phase !== 0) return;
      phase = 1;
      copy.classList.remove("hidden");
      gem.disabled = true;
      flip.disabled = false;
      say("Ось друга, така сама. Переверни її догори дриґом і приклади згори до перших.");
    }

    function fit() {
      if (phase !== 1) return;
      phase = 2;
      copy.style.transform = "translate(0px, 0px) rotate(180deg)";
      root.classList.add("fitted");
      flip.disabled = true;
      const n = setup.count;
      stat.textContent = "Вийшов прямокутник: " + n + " " + plural(n, "стовпчик", "стовпчики", "стовпчиків") +
        ", кожен заввишки " + setup.first + " + " + last() + " = " + S() + ".";
      say(n % 2
        ? "Стовпчиків непарна кількість — а прямокутник однаково склався: середнього без пари тут немає."
        : "Кожен стовпчик — золото знизу й синя копія згори, і всі однакові заввишки.");
      buildAsk();
    }

    function buildAsk() {
      const field = numberField(true);
      const check = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
      ask.textContent = "";
      ask.append(el("span", { text: "Скільки кубиків в одних сходах?" }), field, check);
      const verify = () => {
        if (phase === 3) return;
        const n = setup.count;
        const value = readNum(field.value);
        if (value === n * S()) {
          say("Це весь прямокутник, а в ньому двоє однакових сходів.", "no");
          return;
        }
        if (value !== answer()) {
          say("Порахуй прямокутник: " + n + " · " + S() + ". Скільки в ньому сходів?", "no");
          return;
        }
        phase = 3;
        field.disabled = true;
        check.disabled = true;
        say("Так! Прямокутник " + n + " · " + S() + " = " + n * S() + ", а сходи — рівно половина: " + answer() + ".", "ok");
        if (!solved) {
          solved = true;
          if (onDone) onDone();
        }
      };
      check.addEventListener("click", verify);
      onEnter([field], verify);
    }

    gem.addEventListener("click", copyIt);
    flip.addEventListener("click", fit);
    reset.addEventListener("click", start);
    root.append(...[controls, task, stat, host, verdict, ask, el("div", { class: "toolbar" }, gem, flip, reset)].filter(Boolean));
    start();
    return root;
  }

  /* Той самий прямокутник для розвʼязань: золоті сходи знизу, синя перевернута копія згори. */
  function stairsFigure(first, step, n) {
    const { W, H, L, T, B } = STAIRS;
    const pic = svg("svg", { class: "stairs-svg figure-only fitted", viewBox: "0 0 " + (L + W + 12) + " " + (T + H + B), style: "max-width:" + (L + W + 12) + "px", role: "img", "aria-label": "Двоє сходів складаються в прямокутник" });
    pic.append(stairsColumns(first, step, n, "gold", false));
    pic.append(stairsColumns(first, step, n, "blue", true));
    stairsLabels(first, step, n, pic);
    return pic.outerHTML;
  }

  /* ---------- купки рівної маси ---------- */

  function piles(cfg, onDone) {
    const weights = cfg.weights.slice();
    const k = cfg.piles;
    const unit = cfg.unit === undefined ? " г" : cfg.unit;
    const names = cfg.names || Array.from({ length: k }, (_, i) => "Купка " + (i + 1));
    const all = total(weights);
    const target = all / k;
    const allWays = ways(weights, k, target);
    const found = new Set();
    let where = weights.map(() => -1);
    let active = 0;
    let known = false;
    let solved = false;

    const root = el("div", { class: "sim gauss piles-sim" });
    const task = el("div", { class: "sim-task", html: cfg.intro || "" });
    const goal = el("div", { class: "pair-sum piles-goal" });
    const shelf = el("div", { class: "tray piles-shelf" });
    const bins = el("div", { class: "piles-bins" });
    const verdict = el("div", { class: "sim-verdict" });
    const stat = el("div", { class: "sim-stat" });
    const clear = el("button", { class: "ghost-btn", type: "button", text: "Зняти все ↺" });

    const say = (text, kind) => {
      verdict.className = "sim-verdict" + (kind ? " " + kind : "");
      verdict.textContent = text;
    };

    function buildGoal() {
      const field = numberField(false);
      const check = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
      goal.append(el("span", { text: "Скільки має бути в кожній купці?" }), field, el("span", { text: unit.trim() }), check);
      const verify = () => {
        if (readNum(field.value) !== target) {
          say("Спершу знайди масу всіх гир разом, потім поділи на " + k + ".", "no");
          return;
        }
        known = true;
        goal.textContent = "";
        goal.append(el("span", { class: "piles-target", html: "Мета: по <b>" + target + unit + "</b> у кожній купці (" + all + " : " + k + ")." }));
        say("Тепер розклади гирі.", "");
        draw();
      };
      check.addEventListener("click", verify);
      onEnter([field], verify);
    }

    function weightBtn(i) {
      const btn = el("button", { class: "weight", type: "button", "data-w": weights[i], text: weights[i] + unit });
      btn.style.setProperty("--w", weights[i]);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        where[i] = where[i] < 0 ? active : -1;
        draw();
        judge();
      });
      return btn;
    }

    function sums() {
      const out = new Array(k).fill(0);
      where.forEach((bin, i) => {
        if (bin >= 0) out[bin] += weights[i];
      });
      return out;
    }

    function draw() {
      shelf.textContent = "";
      const row = el("div", { class: "table-coins" });
      weights.forEach((_, i) => {
        if (where[i] < 0) row.append(weightBtn(i));
      });
      shelf.append(el("div", { class: "tray-label", text: "ГИРІ НА СТОЛІ" }), row);
      bins.textContent = "";
      const now = sums();
      names.forEach((name, j) => {
        const inside = el("div", { class: "bin-weights" });
        weights.forEach((_, i) => {
          if (where[i] === j) inside.append(weightBtn(i));
        });
        const state = !known ? "" : now[j] === target ? " ok" : now[j] > target ? " over" : "";
        const bin = el(
          "div",
          { class: "bin" + (j === active ? " active" : ""), "data-bin": j, role: "button", tabindex: 0 },
          el("div", { class: "bin-name", text: name + (j === active ? " ← сюди" : "") }),
          inside,
          el("div", { class: "bin-sum" + state, text: now[j] + unit + (known ? " з " + target + unit : "") })
        );
        bin.addEventListener("click", () => {
          active = j;
          draw();
        });
        bins.append(bin);
      });
      stat.textContent = "Знайдено способів: " + found.size + " з " + allWays;
    }

    function judge() {
      if (where.some((bin) => bin < 0)) {
        say("Клацни купку, щоб вибрати, куди класти. Клацни гирю — вона поїде туди або назад на стіл.", "");
        return;
      }
      const now = sums();
      if (!now.every((s) => s === target)) {
        say("Купки: " + now.join(", ") + unit.trim() + " — не порівну.", "no");
        return;
      }
      const groups = Array.from({ length: k }, () => []);
      where.forEach((bin, i) => groups[bin].push(weights[i]));
      const key = keyOf(groups);
      const isNew = !found.has(key);
      found.add(key);
      draw();
      say(isNew
        ? "Рівно! " + groups.map((g) => g.join(" + ")).join("  |  ") + ". " + (found.size === allWays ? "Ти знайшла всі способи!" : "Це новий спосіб.")
        : "Порівну, але такий спосіб уже був. Спробуй інший!", "ok");
      if (!solved) {
        solved = true;
        if (onDone) onDone();
      }
    }

    clear.addEventListener("click", () => {
      where = weights.map(() => -1);
      draw();
      judge();
    });
    buildGoal();
    root.append(task, goal, shelf, bins, verdict, stat, el("div", { class: "toolbar" }, clear));
    draw();
    judge();
    return root;
  }

  /* ---------- малюнки для тексту ---------- */

  /* Запис Гаусса: ряд уперед, під ним той самий ряд назад, і кожен стовпчик дає одне й те саме. */
  function rows(first, step, n) {
    const list = Array.from({ length: n }, (_, i) => first + i * step);
    const S = list[0] + list[n - 1];
    const cols = n <= 9 ? list.map((_, i) => i) : [0, 1, 2, -1, n - 3, n - 2, n - 1];
    const line = (label, arrow, value, cls) =>
      "<tr" + (cls ? ' class="' + cls + '"' : "") + '><th><span class="w">' + label + '</span><span class="a">' + arrow + "</span></th>" +
      cols.map((i) => (i < 0 ? '<td class="dots">…</td>' : "<td>" + value(i) + "</td>")).join("") + "</tr>";
    return '<table class="gauss-rows">' +
      line("уперед", "→", (i) => list[i]) +
      line("назад", "←", (i) => list[n - 1 - i]) +
      line("разом", "=", () => S, "sum") +
      "</table>";
  }

  /* Паркан: стовпчики — числа ряду, прогони між ними — кроки. Стовпчиків завжди на один більше. */
  function fence(first, last, step) {
    const n = count(first, last, step);
    const gx = 30;
    const L = 22;
    const W = 2 * L + (n - 1) * gx;
    const H = 92;
    const label = (i) => n <= 16 || i === 0 || i === n - 1 || ((first + i * step) % (5 * step) === 0 && i > 2 && i < n - 3);
    let out = '<svg class="gauss-svg fence" viewBox="0 0 ' + W + " " + H + '" style="max-width:' + Math.round(W * 1.25) + 'px" role="img" aria-label="Паркан: ' + n + " стовпчиків, " + (n - 1) + ' прогонів">';
    out += '<line class="rail" x1="' + L + '" y1="34" x2="' + (W - L) + '" y2="34"/><line class="rail" x1="' + L + '" y1="52" x2="' + (W - L) + '" y2="52"/>';
    for (let i = 0; i < n; i++) {
      const x = L + i * gx;
      out += '<polygon class="post" points="' + (x - 5) + ",66 " + (x - 5) + ",22 " + x + ",14 " + (x + 5) + ",22 " + (x + 5) + ',66"/>';
      if (label(i)) out += '<text class="post-num" x="' + x + '" y="84">' + (first + i * step) + "</text>";
    }
    return out + "</svg>";
  }

  /* Квадрат із кутиків: 1, 3, 5, … клітинок — кожен кутик обіймає попередній квадрат. */
  function oddSquare(n) {
    const C = 30;
    const P = 3;
    const size = n * C + 2 * P;
    let out = '<svg class="gauss-svg odd-square" viewBox="0 0 ' + size + " " + size + '" style="max-width:' + size + 'px" role="img" aria-label="Квадрат ' + n + " на " + n + ' з кутиків">';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        out += '<rect class="sq l' + (Math.max(x, y) % 2) + '" x="' + (P + x * C) + '" y="' + (P + y * C) + '" width="' + C + '" height="' + C + '"/>';
      }
    }
    for (let k = 0; k < n; k++) {
      out += '<text class="sq-num" x="' + (P + k * C + C / 2) + '" y="' + (P + k * C + C / 2 + 5) + '">' + (2 * k + 1) + "</text>";
    }
    return out + "</svg>";
  }

  /* Гойдалка-лінійка: числа — позначки на дошці, кульки однакові, опора рівно посередині.
     Пари сидять на однаковій відстані від опори; при непарній кількості середнє — просто на опорі.
     Числа навмисно не ваги: інакше 10 переважило б 1, і рівновага була б неправдою. */
  function seesaw(first, step, n) {
    const U = 52;
    const R = 18;
    const L = 30;
    const H = 90;
    const W = 2 * L + n * U;
    const cx = W / 2;
    const top = 128;
    const cy = top + R;
    const plank = cy + R + 1;
    const x = (i) => L + (i + 0.5) * U;
    const value = (i) => first + i * step;
    const half = Math.floor(n / 2);
    const odd = n % 2 === 1;
    const maxRx = ((n - 1) * U) / 2;
    const comma = (v) => String(v).replace(".", ",");
    let out = '<svg class="gauss-svg seesaw" viewBox="0 0 ' + W + ' 244" style="max-width:' + Math.round(W * 1.15) + 'px" role="img" aria-label="Гойдалка: ' + n + " чисел, " + (odd ? "середнє сидить на опорі" : "опора між двома числами") + '">';
    for (let k = 0; k < half; k++) {
      const x1 = x(k);
      const x2 = x(n - 1 - k);
      const rx = (x2 - x1) / 2;
      const ry = 12 + (rx / maxRx) * H;
      const hue = " p" + (k % HUES);
      out += '<path class="arc' + hue + '" d="M ' + x1 + " " + top + " A " + rx + " " + ry + " 0 0 1 " + x2 + " " + top + '"/>';
      out += '<text class="arc-sum' + hue + '" x="' + cx + '" y="' + (top - ry - 5) + '">' + (value(k) + value(n - 1 - k)) + "</text>";
    }
    out += '<rect class="plank" x="' + (L - 12) + '" y="' + plank + '" width="' + (n * U + 24) + '" height="8" rx="4"/>';
    for (let i = 0; i < n; i++) out += '<line class="tick" x1="' + x(i) + '" y1="' + (plank + 8) + '" x2="' + x(i) + '" y2="' + (plank + 13) + '"/>';
    out += '<polygon class="pivot" points="' + cx + "," + (plank + 8) + " " + (cx - 22) + "," + (plank + 44) + " " + (cx + 22) + "," + (plank + 44) + '"/>';
    out += '<line class="ground" x1="' + (cx - 44) + '" y1="' + (plank + 44) + '" x2="' + (cx + 44) + '" y2="' + (plank + 44) + '"/>';
    /* Від країв до середини: ліве число росте на крок, праве меншає на крок. Біля опори не підписуємо — там тісно. */
    for (let i = 0; i < half - 1; i++) {
      out += '<text class="step" x="' + (L + (i + 1) * U) + '" y="' + (plank + 26) + '">+' + step + " →</text>";
      out += '<text class="step" x="' + (L + (n - 1 - i) * U) + '" y="' + (plank + 26) + '">← −' + step + "</text>";
    }
    for (let i = 0; i < n; i++) {
      const mid = odd && i === half;
      out += '<circle class="ball' + (mid ? " mid" : "") + '" cx="' + x(i) + '" cy="' + cy + '" r="' + R + '"/>';
      out += '<text class="ball-num" x="' + x(i) + '" y="' + (cy + 5.5) + '">' + value(i) + "</text>";
    }
    const centre = (value(0) + value(n - 1)) / 2;
    const note = odd
      ? "опора: (" + value(0) + " + " + value(n - 1) + ") : 2 = " + comma(centre) + " — просто під числом " + value(half)
      : "опора: (" + value(0) + " + " + value(n - 1) + ") : 2 = " + comma(centre) + " — між " + value(half - 1) + " і " + value(half);
    out += '<text class="pivot-note" x="' + cx + '" y="' + (plank + 66) + '">' + note + "</text>";
    return out + "</svg>";
  }

  /* Квадрат росте кутиками: 1 → 2 × 2 → 3 × 3 → …; новий кутик щоразу золотий, старий квадрат синій. */
  function squareGrowth(k) {
    const C = 22;
    const gap = 50;
    const P = 10;
    const W = 2 * P + (C * k * (k + 1)) / 2 + gap * (k - 1);
    const base = P + k * C;
    let out = '<svg class="gauss-svg sq-grow" viewBox="0 0 ' + W + " " + (base + 44) + '" style="max-width:' + Math.round(W * 1.3) + 'px" role="img" aria-label="Квадрат росте кутиками від 1 до ' + k + " на " + k + '">';
    let left = P;
    for (let s = 1; s <= k; s++) {
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const cls = Math.max(x, y) === s - 1 ? "new" : "old";
          out += '<rect class="cell ' + cls + '" x="' + (left + x * C) + '" y="' + (base - s * C + y * C) + '" width="' + C + '" height="' + C + '"/>';
        }
      }
      const mid = left + (s * C) / 2;
      const odds = Array.from({ length: s }, (_, i) => 2 * i + 1).join(" + ");
      out += '<text class="sq-sum" x="' + mid + '" y="' + (base + 18) + '">' + odds + "</text>";
      out += '<text class="sq-side" x="' + mid + '" y="' + (base + 37) + '">' + s + " · " + s + (s > 1 ? " = " + s * s : "") + "</text>";
      if (s < k) {
        const ax = left + s * C + gap / 2;
        out += '<text class="sq-add" x="' + ax + '" y="' + (base - 22) + '">+' + (2 * s + 1) + "</text>";
        out += '<text class="sq-arrow" x="' + ax + '" y="' + (base - 4) + '">→</text>';
      }
      left += s * C + gap;
    }
    return out + "</svg>";
  }

  return { pairs, stairs, piles, rows, fence, oddSquare, squareGrowth, seesaw, stairsFigure, sum, count, ways };
})();
