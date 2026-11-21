/* Спільна мірка: НСК → рівні частинки → додавання й віднімання. */
const COMMONDEN = (function () {
  const el = COURSE.el;

  function calculate(cfg) {
    const { d1, d2, n1 = 1, n2 = 1, w1 = 0, w2 = 0, op = "add" } = cfg;
    if (![d1, d2].every(d => Number.isInteger(d) && d >= 1 && d <= 60) ||
        ![n1, n2, w1, w2].every(n => Number.isInteger(n) && n >= 0) ||
        n1 >= d1 || n2 >= d2 || w1 > 9 || w2 > 9 || !["add", "sub"].includes(op)) {
      throw new Error("COMMONDEN: некоректна пара дробів");
    }
    const den = d1 / FRAC.gcd(d1, d2) * d2;
    const a = n1 * (den / d1), b = n2 * (den / d2);
    const left = w1 * den + a, right = w2 * den + b;
    const total = op === "sub" ? left - right : left + right;
    if (total < 0) throw new Error("COMMONDEN: від'ємний результат поза темою уроку");
    const g = total ? FRAC.gcd(total, den) : den;
    return { den, a, b, left, right, total, num: total / g, reducedDen: den / g,
      borrow: op === "sub" && a < b };
  }

  function strip(count, den, label, secondFrom, removedFrom) {
    const root = el("div", { class: "cd-strip", role: "img", "aria-label": label });
    root.append(el("div", { class: "cd-label", text: label }));
    for (let unit = 0; unit < Math.max(1, Math.ceil(count / den)); unit++) {
      const bar = el("div", { class: "cd-bar", "aria-hidden": "true" });
      bar.style.gridTemplateColumns = "repeat(" + den + ", minmax(0, 1fr))";
      for (let j = 0; j < den; j++) {
        const i = unit * den + j;
        bar.append(el("i", { class: "cd-cell" + (i < count ? " filled" : "") +
          (i < count && secondFrom !== undefined && i >= secondFrom ? " second" : "") +
          (i < count && removedFrom !== undefined && i >= removedFrom ? " removed" : "") }));
      }
      root.append(bar);
    }
    return root;
  }

  function strips(cfg, onDone) {
    const play = cfg.goal === "play", mode = cfg.mode || "lcm";
    let pair = { n1: 1, n2: 1, w1: 0, w2: 0, op: "add", ...cfg };
    let data = calculate(pair), cut = false, borrowed = false, revealed = false, solved = false;
    const root = el("div", { class: "sim commonden", "data-mode": mode });
    const controls = el("div", { class: "cd-controls" });
    const picture = el("div", { class: "cd-picture" });
    const work = el("div", { class: "cd-work" });
    const verdict = el("div", { class: "sim-verdict", role: "status", "aria-live": "polite" });

    const say = (text, ok = false) => {
      verdict.textContent = text;
      verdict.className = "sim-verdict " + (ok ? "ok" : "no");
    };
    const finish = () => {
      if (!play && !solved) { solved = true; onDone(); }
    };
    const integer = field => /^\d+$/.test(field.value.trim()) ? Number(field.value.trim()) : NaN;
    const field = (label, key, submit) => {
      const input = el("input", { class: "mini-input", type: "text", inputmode: "numeric", "data-field": key });
      input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
      work.append(el("label", { class: "cd-field" }, el("span", { text: label }), input));
      return input;
    };
    const reset = () => {
      data = calculate(pair); cut = borrowed = revealed = false;
      verdict.textContent = ""; verdict.className = "sim-verdict";
      render();
    };

    if (play && mode === "lcm") {
      const inputs = ["Перший знаменник", "Другий знаменник"].map((name, i) => {
        const input = el("input", { class: "mini-input", type: "number", min: 2, max: 15, value: pair["d" + (i + 1)], "aria-label": name });
        controls.append(el("label", { class: "cd-field" }, el("span", { text: name + " (2–15)" }), input));
        return input;
      });
      controls.append(el("button", { class: "ghost-btn", text: "Показати кратні", type: "button", onclick: () => {
        const [d1, d2] = inputs.map(integer);
        if (![d1, d2].every(d => d >= 2 && d <= 15)) return say("Впиши два цілі знаменники від 2 до 15.");
        pair = { ...pair, d1, d2 }; reset();
      } }));
    } else if (play) {
      const presets = mode === "bring" ? [
        { n1: 1, d1: 10, n2: 2, d2: 15 }, { n1: 1, d1: 2, n2: 1, d2: 3 }, { n1: 3, d1: 4, n2: 1, d2: 6 }
      ] : [
        { n1: 1, d1: 2, n2: 1, d2: 3, op: "add" },
        { n1: 3, d1: 4, n2: 5, d2: 6, op: "add" },
        { n1: 3, d1: 4, n2: 1, d2: 6, op: "sub" },
        { w1: 3, n1: 1, d1: 10, w2: 1, n2: 2, d2: 15, op: "sub" }
      ];
      const select = el("select", { "aria-label": "Приклад для досліду", class: "cd-select" });
      presets.forEach((p, i) => select.append(el("option", { value: i,
        text: (p.w1 ? p.w1 + " " : "") + p.n1 + "/" + p.d1 +
          (mode === "bring" ? " і " : p.op === "sub" ? " − " : " + ") +
          (p.w2 ? p.w2 + " " : "") + p.n2 + "/" + p.d2 })));
      pair = { ...pair, w1: 0, w2: 0, ...presets[0] }; data = calculate(pair);
      select.addEventListener("change", () => { pair = { ...pair, w1: 0, w2: 0, ...presets[Number(select.value)] }; reset(); });
      controls.append(select);
    }

    function render() {
      picture.replaceChildren(); work.replaceChildren();
      const { den, a, b } = data;
      if (mode === "lcm") {
        let answer;
        const check = () => {
          const value = integer(answer);
          if (value !== den) return say(value > 0 && value % pair.d1 === 0 && value % pair.d2 === 0 ?
            value + " — спільне кратне, але є менше. Знайди перший збіг." : "Потрібне число, що ділиться на обидва знаменники.");
          revealed = true; render(); say("НСК = " + den + ". " + (2 * den) + " теж спільне кратне, але не найменше.", true); finish();
        };
        for (const d of [pair.d1, pair.d2]) {
          const row = el("div", { class: "cd-multiples", role: "group", "aria-label": "Кратні " + d, tabindex: "0" });
          for (let value = d; value <= den * 2; value += d) {
            row.append(el("button", { type: "button", class: "ghost-btn cd-multiple" + ((play || revealed) && value === den ? " common" : ""),
              text: value, "data-value": value, onclick: () => { answer.value = value; check(); } }));
          }
          picture.append(el("p", { text: "Кратні " + d + ":" }), row);
        }
        answer = field("Найменше спільне кратне", "lcm", check);
        if (revealed) answer.value = den;
        work.append(el("button", { class: "btn", type: "button", text: "Перевірити", onclick: check }));
        return;
      }

      picture.append(el("p", { text: "Спільний знаменник: " + den + ". Кожна повна смужка — одне ціле." }));
      if (mode === "bring") {
        picture.append(strip(cut ? a : pair.n1, cut ? den : pair.d1, pair.n1 + "/" + pair.d1),
          strip(cut ? b : pair.n2, cut ? den : pair.d2, pair.n2 + "/" + pair.d2));
        if (!cut) {
          work.append(el("button", { class: "btn", type: "button", text: "Перерізати на " + den, "data-act": "cut", onclick: () => { cut = true; render(); } }));
          return;
        }
        picture.append(el("p", { class: "cd-equation", text:
          pair.n1 + "/" + pair.d1 + " = (" + pair.n1 + " · " + den / pair.d1 + ")/" + den + "; " +
          pair.n2 + "/" + pair.d2 + " = (" + pair.n2 + " · " + den / pair.d2 + ")/" + den }));
        let first, second;
        const check = () => {
          if (integer(first) !== a || integer(second) !== b) return say("Домнож верх і низ кожного дробу на його множник. Перевір обидва чисельники.");
          say(pair.n1 + "/" + pair.d1 + " = " + a + "/" + den + "; " + pair.n2 + "/" + pair.d2 + " = " + b + "/" + den + ". Кількість не змінилася!", true); finish();
        };
        first = field("Перший чисельник / " + den, "first", check);
        second = field("Другий чисельник / " + den, "second", check);
        work.append(el("button", { class: "btn", type: "button", text: "Перевірити", onclick: check }));
        return;
      }

      picture.append(el("p", { class: "cd-equation", text:
        pair.w1 + " " + a + "/" + den + (pair.op === "sub" ? " − " : " + ") + pair.w2 + " " + b + "/" + den }));
      const firstStrip = strip(data.left, den, "Перше число: " + pair.w1 + " " + a + "/" + den);
      [...firstStrip.querySelectorAll('.cd-bar')].forEach((bar, i) => {
        if (i < pair.w1) bar.classList.add(borrowed && i === pair.w1 - 1 ? "cd-unpacked" : "cd-whole");
      });
      picture.append(firstStrip, strip(data.right, den, "Друге число: " + pair.w2 + " " + b + "/" + den, 0));
      if (data.borrow) {
        if (!borrowed) {
          picture.append(el("p", { text: a + " частинок замало, щоб забрати " + b + ". Обміняй одну цілу на " + den + " частинок." }));
          work.append(el("button", { class: "btn", type: "button", text: "Позичити цілу", "data-act": "borrow", onclick: () => { borrowed = true; render(); } }));
          return;
        }
        const exchange = el("div", { class: "cd-borrow" },
          el("p", { text: pair.w1 + " " + a + "/" + den + " = " + (pair.w1 - 1) + " " + (den + a) + "/" + den }),
          el("p", { text: "Підсвічена ціла розділилася на " + den + " частинок; разом із " + a + " маємо " + (den + a) + ". Решта цілих: " + (pair.w1 - 1) + "." }));
        picture.append(exchange);
      }
      if (revealed) {
        picture.append(strip(pair.op === "sub" ? data.left : data.total, den,
          "Результат: " + data.num + "/" + data.reducedDen,
          pair.op === "add" ? data.left : undefined, pair.op === "sub" ? data.total : undefined));
      }
      if (play) {
        work.append(el("button", { class: "btn", type: "button", text: "Показати результат", onclick: () => {
          revealed = true; render(); say("Результат: " + data.num + "/" + data.reducedDen + ". Золоті частинки — перше число, сині — додані, закреслені — відняті.", true);
        } }));
        return;
      }
      let whole, numerator, denominator;
      const check = () => {
        const w = integer(whole), n = integer(numerator), d = integer(denominator);
        if (![w, n, d].every(Number.isSafeInteger) || w > 100 || n > 10000 || d < 1 || d > 10000) return say("Заповни всі три поля цілими числами. Для нуля: 0 цілих, 0/1.");
        if ((w * d + n) * data.reducedDen !== data.num * d) return say("Перевір цілу частину й чисельники. Спільний знаменник не додаємо й не віднімаємо.");
        if ((n === 0 && d !== 1) || (n > 0 && FRAC.gcd(n, d) !== 1)) return say("Значення правильне. Тепер скороти дріб до кінця.");
        revealed = true; render(); say("Готово: " + w + " " + n + "/" + d + ". Дії виконано, дріб скорочено.", true); finish();
      };
      whole = field("Цілих (або 0)", "whole", check);
      numerator = field("Чисельник", "numerator", check);
      denominator = field("Знаменник", "denominator", check);
      work.append(el("button", { class: "btn", type: "button", text: "Перевірити", onclick: check }));
    }

    root.append(el("div", { class: "sim-task", html: cfg.intro || "" }),
      el("div", { class: "sim-stat", text: play ? "Пісочниця · досліджуй без зарахування" : "Вправа · зараховується правильна відповідь" }),
      controls, picture, work, verdict,
      el("button", { class: "ghost-btn cd-reset", text: "Спробувати знову ↺", type: "button", onclick: reset }));
    render();
    return root;
  }

  return { calculate, strips };
})();
