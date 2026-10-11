/* Рушій курсу: маршрути, відмалювання блоків, перевірка завдань, прогрес. */

const COURSE = (function () {
  const STORE_KEY = "chyslomahiya.v1";
  const OLD_STORE_KEY = "fimli.v1"; // курс звався інакше; прогрес переїжджає сам
  const lessons = [];

  let store = { done: {}, parts: {}, today: {} };
  try {
    const saved = localStorage.getItem(STORE_KEY) || localStorage.getItem(OLD_STORE_KEY) || "{}";
    store = Object.assign(store, JSON.parse(saved));
  } catch (e) {
    /* зіпсоване сховище просто ігноруємо */
  }
  for (const field of ["done", "parts", "today"]) {
    if (!store[field] || typeof store[field] !== "object" || Array.isArray(store[field])) store[field] = {};
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {}
  }

  const isDone = (key) => Boolean(store.done[key]);

  function markDone(key) {
    if (store.done[key]) return;
    store.done[key] = true;
    save();
    refreshProgress();
  }

  /* ---------- дрібні помічники для DOM ---------- */

  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null) continue;
      if (name === "class") node.className = value;
      else if (name === "html") node.innerHTML = value;
      else if (name === "text") node.textContent = value;
      else if (name.startsWith("on")) node.addEventListener(name.slice(2), value);
      else node.setAttribute(name, value);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid) node.append(kid);
    }
    return node;
  }

  function bar(pct) {
    const fill = el("i");
    fill.style.width = pct + "%";
    return el("div", { class: "bar" }, fill);
  }

  const CHEERS = ["Так!", "Точно.", "Саме так.", "Влучно.", "Десять очок Ґрифіндору."];
  const randomOf = (list) => list[Math.floor(Math.random() * list.length)];

  /* Відповідь у полі порівнюємо мʼяко: регістр, апостроф і зайві пробіли не рахуються. */
  function normalize(text) {
    return String(text)
      .toLowerCase()
      .replace(/[’'`ʼ]/g, "'")
      .replace(/\s+/g, " ")
      .replace(/[.,!?;:]+$/, "")
      .trim();
  }

  function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = copy[i];
      copy[i] = copy[j];
      copy[j] = swap;
    }
    return copy;
  }

  const TAGS = {
    quiz: "питання",
    multi: "кілька відповідей",
    order: "по порядку",
    input: "впиши",
    story: "оповідь",
    spell: "заклинання",
    idea: "ідея",
    trap: "пастка",
    steps: "розбір",
    terms: "словник",
    summary: "підсумок",
    life: "з життя",
    game: "з гри",
    python: "з Пайтону",
    problem: "задача",
    scales: "терези",
    trainer: "тренажер",
    jugs: "відра",
    jugtrainer: "тренажер",
    jugwalk: "граф",
    pairs: "пари",
    stairs: "сходи",
    piles: "купки",
    homework: "домашнє",
  };

  /* Драбинка підказок: свічки в ніші, кожна запалена шепоче рівно один крок.
     Підказки лишаються схованими, доки дитина сама не попросить наступну. */
  function hintLadder(list) {
    const lines = el("div", { class: "hint-lines" });
    const button = el("button", { class: "ghost-btn candle", type: "button" });
    let lit = 0;

    function paint() {
      button.textContent = lit < list.length ? "Запалити свічку 🕯 (" + (lit + 1) + " з " + list.length + ")" : "Свічок більше немає";
      button.disabled = lit >= list.length;
    }

    button.addEventListener("click", () => {
      if (lit >= list.length) return;
      lines.append(el("div", { class: "hint-line" }, el("span", { class: "flame", text: "🕯" }), el("span", { html: list[lit] })));
      lit += 1;
      paint();
      if (lit === list.length) {
        lines.append(el("div", { class: "hint-last", text: "Свічки догоріли. Далі — тільки сувій із розвʼязанням." }));
      }
    });

    paint();
    return el(
      "div",
      { class: "hint-box" },
      el("div", { class: "hint-intro", text: "У ніші горять свічки. Кожна, яку запалиш, шепоче одну підказку — і ні слова більше." }),
      lines,
      el("div", { class: "toolbar" }, button)
    );
  }

  /* Відповідь до задачі без симулятора: число або слово, порівнюється мʼяко, пробіли всередині не рахуються. */
  function answerBox(accept, onRight) {
    const squeeze = (text) => normalize(text).replace(/\s+/g, "");
    const wanted = accept.map(squeeze);
    const field = el("input", { class: "answer-input", type: "text", placeholder: "Відповідь", autocomplete: "off" });
    const verdict = el("div", { class: "verdict" });
    const checkBtn = el("button", { class: "btn", type: "button", text: "Перевірити ✓" });
    checkBtn.addEventListener("click", () => {
      const mine = squeeze(field.value);
      if (!mine) {
        verdict.className = "verdict no";
        verdict.textContent = "Впиши відповідь.";
      } else if (wanted.includes(mine)) {
        verdict.className = "verdict ok";
        verdict.textContent = randomOf(CHEERS);
        onRight();
      } else {
        verdict.className = "verdict no";
        verdict.textContent = "Ще ні. Перевір рахунок — або запали свічку.";
      }
    });
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") checkBtn.click();
    });
    return el("div", { class: "answer-box" }, el("div", { class: "toolbar" }, field, checkBtn), verdict);
  }

  /* Симулятори способу Гаусса окремим блоком: пари, сходи, купки гир. */
  function gaussBlock(b, ctx, make, fallback) {
    const doneMark = el("span", { class: "done-mark", text: isDone(ctx.key) ? "✓" : "" });
    const sim = make(b, () => {
      doneMark.textContent = "✓";
      markDone(ctx.key);
    });
    return el(
      "section",
      { class: "block gauss-block", "data-exercise": b.id },
      el("div", { class: "block-head" }, el("span", { class: "tag", text: TAGS[b.type] }), el("span", { text: b.title || fallback }), doneMark),
      el("div", { class: "block-body" }, b.html ? el("div", { html: b.html }) : null, sim, b.after ? el("div", { html: b.after }) : null)
    );
  }

  function card(kind, title, corner, bodyKids) {
    return el(
      "section",
      { class: "block " + kind },
      el("div", { class: "block-head" }, el("span", { class: "tag", text: TAGS[kind] || kind }), el("span", { text: title }), corner),
      el("div", { class: "block-body" }, bodyKids)
    );
  }

  /* ---------- блоки ---------- */

  const BLOCKS = {
    text: (b) => el("section", { class: "block plain", html: b.html }),

    story: (b) => card("story", b.title || "Ґрінґотс, ніч", null, [el("div", { html: b.html })]),

    spell: (b) =>
      card("spell", b.title || "Головне правило", null, [
        el("div", { class: "spell-name", text: b.name }),
        el("div", { html: b.html }),
        b.origin ? el("div", { class: "spell-origin", html: b.origin }) : null,
      ]),

    idea: (b) => card("idea", b.title || "Ідея", null, [el("div", { html: b.html })]),

    trap: (b) => card("trap", b.title || "Пастка, у яку тут падають усі", null, [el("div", { html: b.html })]),

    steps: (b) =>
      card("steps", b.title || "Як це розвʼязують", null, [
        b.intro ? el("div", { html: b.intro }) : null,
        el("ol", { html: b.items.map((item) => "<li>" + item + "</li>").join("") }),
        b.after ? el("div", { html: b.after }) : null,
      ]),

    terms: (b) =>
      card("terms", b.title || "Словник", null, [
        el("table", { class: "terms" }, b.items.map((item) => el("tr", {}, el("td", { html: item.t }), el("td", { html: item.d })))),
      ]),

    summary: (b) => card("summary", b.title || "Головна думка", null, [el("div", { html: b.html })]),

    life: (b) => card("life", b.title || "Перевір сама", null, [el("div", { html: b.html })]),

    game: (b) => card("game", b.title || "А тепер те саме — у грі", null, [el("div", { html: b.html })]),

    python: (b) => card("python", b.title || "А як це в Пайтоні", null, [el("div", { html: b.html })]),

    fold: (b) => el("section", { class: "block plain" }, el("details", {}, el("summary", { text: b.title }), el("div", { html: b.html }))),

    image: (b) =>
      el(
        "figure",
        { class: "figure" },
        el("img", { src: "img/" + b.src, alt: b.alt || b.caption || "" }),
        b.caption ? el("figcaption", { html: b.caption }) : null
      ),

    /* Задача: умова, за потреби симулятор (терези або відра), підказка, розвʼязання, самоперевірка. */
    problem(b, ctx) {
      const doneMark = el("span", { class: "done-mark", text: isDone(ctx.key) ? "✓" : "" });
      const body = [el("div", { html: b.question })];
      const solve = () => {
        doneMark.textContent = "✓";
        markDone(ctx.key);
      };

      if (b.sim) body.push(SCALES.create(b.sim, solve));
      if (b.jugs) body.push(JUGS.create(b.jugs, solve));
      if (b.map) body.push(JUGS.explore(b.map, solve));
      if (b.pairs) body.push(GAUSS.pairs(b.pairs, solve));
      if (b.stairs) body.push(GAUSS.stairs(b.stairs, solve));
      if (b.piles) body.push(GAUSS.piles(b.piles, solve));

      if (b.hints && b.hints.length) {
        body.push(hintLadder(b.hints));
      } else if (b.hint) {
        body.push(el("details", {}, el("summary", { text: "Підказка" }), el("div", { html: b.hint })));
      }
      if (b.answer) body.push(answerBox(b.answer, solve));
      if (b.solution) {
        body.push(el("details", {}, el("summary", { text: "Розвʼязання" }), el("div", { html: b.solution })));
      }

      if (!b.sim && !b.jugs && !b.pairs && !b.stairs && !b.piles && !b.answer) {
        const verdict = el("div", { class: "verdict" });
        const selfBtn = el("button", { class: "btn", text: "Я розвʼязала ✓" });
        selfBtn.addEventListener("click", () => {
          doneMark.textContent = "✓";
          verdict.className = "verdict ok";
          verdict.textContent = randomOf(CHEERS);
          markDone(ctx.key);
        });
        body.push(el("div", { class: "toolbar" }, selfBtn), verdict);
      }

      const head = el("span", { class: "problem-num", text: String(b.num || "?") });
      return el(
        "section",
        { class: "block problem" + (b.homework ? " homework-task" : ""), "data-problem": String(b.num || "") },
        el(
          "div",
          { class: "block-head" },
          head,
          el("span", { text: b.title || "Задача" }),
          b.homework ? el("span", { class: "hw-badge", text: b.homework === true ? "домашнє" : b.homework }) : null,
          doneMark
        ),
        el("div", { class: "block-body" }, body)
      );
    },

    /* Список заданого: чотири задачі, до кожної можна стрибнути одним дотиком. */
    homework(b, ctx) {
      const list = el("div", { class: "hw-list" });
      b.items.forEach((item) => {
        const mark = el("span", { class: "hw-done-mark" });
        const jump = el(
          "button",
          { class: "hw-item", type: "button" },
          el("span", { class: "hw-num", text: String(item.num) }),
          el("span", { class: "hw-title", text: item.title }),
          item.note ? el("span", { class: "hw-note", text: item.note }) : null,
          mark
        );
        jump.addEventListener("click", () => {
          const target = document.querySelector('[data-problem="' + item.num + '"]');
          if (target) target.scrollIntoView({ block: "start", behavior: "smooth" });
        });
        const index = ctx.lesson.blocks.findIndex((block) => block.type === "problem" && String(block.num) === String(item.num));
        const drawItem = () => {
          const done = index >= 0 && isDone(blockKey(ctx.lesson, ctx.lesson.blocks[index], index));
          mark.textContent = done ? "✓" : "";
          jump.classList.toggle("hw-done", done);
          jump.setAttribute("aria-label", "Задача " + item.num + ": " + item.title + (done ? " — виконано" : " — ще не виконано"));
        };
        progressWatchers.push(drawItem);
        drawItem();
        list.append(jump);
      });
      return card("homework", b.title || "Сова принесла завдання", null, [homeworkProgress(ctx.lesson), b.html ? el("div", { html: b.html }) : null, list]);
    },

    /* Тренажер: будь-яка кількість монет і будь-який режим, на вибір дитини. */
    trainer(b, ctx) {
      const doneMark = el("span", { class: "done-mark", text: isDone(ctx.key) ? "✓" : "" });
      const node = SCALES.trainer(b, () => {
        doneMark.textContent = "✓";
        markDone(ctx.key);
      });
      return el(
        "section",
        { class: "block trainer-block" },
        el("div", { class: "block-head" }, el("span", { class: "tag", text: TAGS.trainer }), el("span", { text: b.title || "Тренажер" }), doneMark),
        el("div", { class: "block-body" }, b.html ? el("div", { html: b.html }) : null, node)
      );
    },

    /* Відра без поділок окремим блоком (без задачі). */
    jugs(b, ctx) {
      const doneMark = el("span", { class: "done-mark", text: isDone(ctx.key) ? "✓" : "" });
      const sim = (b.type === "jugmap" ? JUGS.explore : JUGS.create)(b, () => {
        doneMark.textContent = "✓";
        markDone(ctx.key);
      });
      return el(
        "section",
        { class: "block jugs-block", "data-exercise": b.id },
        el("div", { class: "block-head" }, el("span", { class: "tag", text: TAGS.jugs }), el("span", { text: b.title || "Відра без поділок" }), doneMark),
        el("div", { class: "block-body" }, b.html ? el("div", { html: b.html }) : null, sim)
      );
    },

    jugmap(b, ctx) {
      return BLOCKS.jugs(b, ctx);
    },

    pairs: (b, ctx) => gaussBlock(b, ctx, GAUSS.pairs, "Пари з двох кінців"),
    stairs: (b, ctx) => gaussBlock(b, ctx, GAUSS.stairs, "Сходи Джеміно"),
    piles: (b, ctx) => gaussBlock(b, ctx, GAUSS.piles, "Купки рівної маси"),

    /* Граф станів простого прикладу: крок за кроком, обидві доріжки. Нічого не зараховує — це картинка. */
    jugwalk: (b) =>
      el(
        "section",
        { class: "block jugs-block" },
        el("div", { class: "block-head" }, el("span", { class: "tag", text: TAGS.jugwalk }), el("span", { text: b.title || "Граф станів" })),
        el("div", { class: "block-body" }, b.html ? el("div", { html: b.html }) : null, JUGS.walk(b), b.after ? el("div", { html: b.after }) : null)
      ),

    /* Тренажер переливань: будь-які два відра й скільки треба — на вибір дитини. */
    jugtrainer(b, ctx) {
      const doneMark = el("span", { class: "done-mark", text: isDone(ctx.key) ? "✓" : "" });
      const node = JUGS.trainer(b, () => {
        doneMark.textContent = "✓";
        markDone(ctx.key);
      });
      return el(
        "section",
        { class: "block trainer-block" },
        el("div", { class: "block-head" }, el("span", { class: "tag", text: TAGS.jugtrainer }), el("span", { text: b.title || "Тренажер" }), doneMark),
        el("div", { class: "block-body" }, b.html ? el("div", { html: b.html }) : null, node)
      );
    },

    /* Симулятор терезів окремим блоком (без задачі). */
    scales(b, ctx) {
      const doneMark = el("span", { class: "done-mark", text: isDone(ctx.key) ? "✓" : "" });
      const sim = SCALES.create(b, () => {
        doneMark.textContent = "✓";
        markDone(ctx.key);
      });
      return el(
        "section",
        { class: "block scales-block" },
        el("div", { class: "block-head" }, el("span", { class: "tag", text: TAGS.scales }), el("span", { text: b.title || "Терези Ґрінґотса" }), doneMark),
        el("div", { class: "block-body" }, b.html ? el("div", { html: b.html }) : null, sim)
      );
    },

    /* Питання з однією правильною відповіддю. */
    quiz(b, ctx) {
      const verdict = el("div", { class: "verdict" });
      const doneMark = el("span", { class: "done-mark", text: isDone(ctx.key) ? "✓" : "" });
      const letters = "АБВГДЕ";
      const options = el("div", { class: "options" });

      b.options.forEach((textOrHtml, index) => {
        const option = el("button", { class: "option" }, el("span", { class: "letter", text: letters[index] }), el("span", { html: textOrHtml }));
        option.addEventListener("click", () => {
          for (const child of options.children) child.classList.remove("right", "wrong");
          if (index === b.answer) {
            option.classList.add("right");
            verdict.className = "verdict ok";
            verdict.textContent = randomOf(CHEERS) + " " + (b.explain || "");
            doneMark.textContent = "✓";
            markDone(ctx.key);
          } else {
            option.classList.add("wrong");
            verdict.className = "verdict no";
            verdict.textContent = (b.wrong || "Не те.") + " Спробуй інший варіант — за помилку тут нічого не буває.";
          }
        });
        options.append(option);
      });

      return card("quiz", b.title || "Питання", doneMark, [el("div", { html: b.question }), options, verdict]);
    },

    /* Питання, де правильних відповідей кілька. */
    multi(b, ctx) {
      const verdict = el("div", { class: "verdict" });
      const doneMark = el("span", { class: "done-mark", text: isDone(ctx.key) ? "✓" : "" });
      const letters = "АБВГДЕЖЗ";
      const options = el("div", { class: "options" });
      const picked = new Set();

      b.options.forEach((textOrHtml, index) => {
        const option = el("button", { class: "option" }, el("span", { class: "letter", text: letters[index] }), el("span", { html: textOrHtml }));
        option.addEventListener("click", () => {
          if (picked.has(index)) picked.delete(index);
          else picked.add(index);
          option.classList.toggle("picked", picked.has(index));
          option.classList.remove("right", "wrong");
          verdict.className = "verdict";
          verdict.textContent = "";
        });
        options.append(option);
      });

      const checkBtn = el("button", { class: "btn", text: "Перевірити ✓" });
      checkBtn.addEventListener("click", () => {
        if (!picked.size) {
          verdict.className = "verdict no";
          verdict.textContent = "Познач хоча б один варіант.";
          return;
        }
        const right = new Set(b.answers);
        let ok = right.size === picked.size;
        right.forEach((i) => {
          if (!picked.has(i)) ok = false;
        });
        [...options.children].forEach((child, index) => {
          child.classList.remove("picked");
          if (picked.has(index)) child.classList.add(right.has(index) ? "right" : "wrong");
          else if (!ok && right.has(index)) child.classList.add("right");
        });
        if (ok) {
          verdict.className = "verdict ok";
          verdict.textContent = randomOf(CHEERS) + " " + (b.explain || "");
          doneMark.textContent = "✓";
          markDone(ctx.key);
        } else {
          verdict.className = "verdict no";
          verdict.textContent = "Ще ні. Зеленим підсвічено правильні варіанти — прочитай і спробуй ще раз.";
          picked.clear();
        }
      });

      return card("multi", b.title || "Кілька відповідей", doneMark, [
        el("div", { html: b.question }),
        el("div", { html: "<i>Познач усі правильні варіанти, потім натисни «Перевірити».</i>" }),
        options,
        el("div", { class: "toolbar" }, checkBtn),
        verdict,
      ]);
    },

    /* Послідовність: натискати картки в правильному порядку. */
    order(b, ctx) {
      const verdict = el("div", { class: "verdict" });
      const doneMark = el("span", { class: "done-mark", text: isDone(ctx.key) ? "✓" : "" });
      const slots = el("div", { class: "slots" });
      const chips = el("div", { class: "chips" });
      let step = 0;

      function build() {
        step = 0;
        slots.textContent = "";
        chips.textContent = "";
        b.items.forEach((_, index) => slots.append(el("div", { class: "slot", text: index + 1 + ". …" })));
        const deck = shuffled(b.items.map((text, index) => ({ text: text, index: index })));
        deck.forEach((item) => {
          const chip = el("button", { class: "chip", text: item.text });
          chip.addEventListener("click", () => {
            if (item.index !== step) {
              chip.classList.add("wrong");
              setTimeout(() => chip.classList.remove("wrong"), 600);
              verdict.className = "verdict no";
              verdict.textContent = "Не цей — спершу те, що роблять раніше.";
              return;
            }
            chip.classList.add("used");
            const slot = slots.children[step];
            slot.className = "slot filled";
            slot.textContent = step + 1 + ". " + item.text;
            step += 1;
            verdict.className = "verdict";
            verdict.textContent = "";
            if (step === b.items.length) {
              verdict.className = "verdict ok";
              verdict.textContent = randomOf(CHEERS) + " " + (b.explain || "");
              doneMark.textContent = "✓";
              markDone(ctx.key);
            }
          });
          chips.append(chip);
        });
      }

      build();
      const resetBtn = el("button", { class: "ghost-btn", text: "Спочатку ↺" });
      resetBtn.addEventListener("click", () => {
        verdict.className = "verdict";
        verdict.textContent = "";
        build();
      });

      return card("order", b.title || "Постав по порядку", doneMark, [
        el("div", { html: b.question }),
        slots,
        chips,
        el("div", { class: "toolbar" }, resetBtn),
        verdict,
      ]);
    },

    /* Коротка письмова відповідь: число або слово. */
    input(b, ctx) {
      const verdict = el("div", { class: "verdict" });
      const doneMark = el("span", { class: "done-mark", text: isDone(ctx.key) ? "✓" : "" });
      const field = el("input", { class: "answer-input", type: "text", placeholder: b.placeholder || "Відповідь" });
      const accept = b.accept.map(normalize);
      let tries = 0;

      const checkBtn = el("button", { class: "btn", text: "Перевірити ✓" });
      checkBtn.addEventListener("click", () => {
        const mine = normalize(field.value);
        if (!mine) {
          verdict.className = "verdict no";
          verdict.textContent = "Впиши відповідь.";
          return;
        }
        if (accept.includes(mine)) {
          verdict.className = "verdict ok";
          verdict.textContent = randomOf(CHEERS) + " " + (b.explain || "");
          doneMark.textContent = "✓";
          markDone(ctx.key);
        } else {
          tries += 1;
          verdict.className = "verdict no";
          verdict.textContent = tries === 1 ? "Ще ні. Подумай і спробуй знову." : "Не те. Підказка: " + (b.hint || "перечитай правило вище.");
        }
      });
      field.addEventListener("keydown", (e) => {
        if (e.key === "Enter") checkBtn.click();
      });

      return card("input", b.title || "Впиши відповідь", doneMark, [
        el("div", { html: b.question }),
        field,
        el("div", { class: "toolbar" }, checkBtn),
        verdict,
      ]);
    },
  };

  /* ---------- прогрес ---------- */

  const CHECKABLE = new Set(["quiz", "multi", "order", "input", "problem", "scales", "trainer", "jugs", "jugtrainer", "jugmap", "pairs", "stairs", "piles"]);

  function blockKey(lesson, block, index) {
    return lesson.id + ":" + (block.id || block.type + index);
  }

  function lessonStats(lesson, start = 0, end = lesson.blocks.length) {
    let done = 0;
    let total = 0;
    // Індекси беремо з початкового blocks, щоб зберегти старі ключі прогресу.
    for (let index = start; index < end; index++) {
      const block = lesson.blocks[index];
      if (!CHECKABLE.has(block.type)) continue;
      total += 1;
      if (isDone(blockKey(lesson, block, index))) done += 1;
    }
    return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  const isPartDone = (lesson, part) => Boolean(store.parts[blockKey(lesson, part, 0)]);

  function partsStats(lesson) {
    const parts = lesson.parts || [];
    return { done: parts.filter((part) => isPartDone(lesson, part)).length, total: parts.length };
  }

  function todayPart(lesson) {
    const parts = lesson.parts || [];
    return parts.find((part) => part.id === store.today[lesson.id] && !isPartDone(lesson, part)) ||
      parts.find((part) => !isPartDone(lesson, part));
  }

  function homeworkStats(lesson) {
    const stats = { required: { done: 0, total: 0 }, optional: { done: 0, total: 0 } };
    lesson.blocks.forEach((block, index) => {
      if (block.type !== "problem" || !block.homework) return;
      const group = /для бажаючих/i.test(String(block.homework)) ? stats.optional : stats.required;
      group.total += 1;
      if (isDone(blockKey(lesson, block, index))) group.done += 1;
    });
    return stats;
  }

  function homeworkProgress(lesson) {
    const required = el("div", { class: "hw-required" });
    const optional = el("div", { class: "hw-optional" });
    const node = el("div", { class: "homework-progress", "aria-live": "polite" }, required, optional);
    const draw = () => {
      const stats = homeworkStats(lesson);
      const all = stats.required.total > 0 && stats.required.done === stats.required.total;
      const label = stats.optional.total ? "Обовʼязкове домашнє" : "Домашнє";
      required.textContent = stats.required.total ?
        (all ? (stats.optional.total ? label : "Усе домашнє") + " виконано ✓ · " : label + ": ") + stats.required.done + " з " + stats.required.total :
        stats.optional.total ? "Обовʼязкового домашнього немає" : "Домашнє не задано";
      optional.textContent = stats.optional.total ? "Для бажаючих: " + stats.optional.done + " з " + stats.optional.total + (stats.optional.done === stats.optional.total ? " ✓" : "") : "";
      optional.hidden = !stats.optional.total;
      node.classList.toggle("hw-all-done", all);
    };
    progressWatchers.push(draw);
    draw();
    return node;
  }

  function overallStats() {
    let done = 0;
    let total = 0;
    lessons.forEach((lesson) => {
      const stats = lessonStats(lesson);
      done += stats.done;
      total += stats.total;
    });
    return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  const progressWatchers = [];
  function refreshProgress() {
    progressWatchers.forEach((fn) => fn());
  }

  /* ---------- сторінки ---------- */

  function renderIndex(app) {
    const overall = overallStats();
    const hero = el(
      "div",
      { class: "hero" },
      el("div", { class: "crest", text: "⚖️" }),
      el("div", { class: "kicker", text: "математика у Гоґвортсі · 6 клас" }),
      el("h1", { text: "Математика з чарами" }),
      el("p", {
        class: "lead",
        html:
          "Кожного тижня — одне заняття. Спершу історія, далі одне головне правило, " +
          "потім розбір і задачі, які можна крутити руками просто на сторінці. " +
          "Прогрес запамʼятовується сам.",
      }),
      el(
        "div",
        { class: "overall" },
        el("span", { class: "bar-label", text: "Зроблено завдань: " + overall.done + " з " + overall.total }),
        bar(overall.pct)
      )
    );

    const cards = el("div", { class: "cards" });
    lessons.forEach((lesson) => {
      const stats = lessonStats(lesson);
      const parts = partsStats(lesson);
      cards.append(
        el(
          "a",
          { class: "card", href: "#/l/" + lesson.id },
          el("div", { class: "num", text: "Заняття " + lesson.num }),
          el("div", { class: "title", text: lesson.title }),
          el("div", { class: "sub", text: lesson.subtitle || "" }),
          parts.total ? el("div", { class: "stat part-card-stat", text: "Частин пройдено: " + parts.done + " з " + parts.total }) : null,
          el("div", { class: "stat", text: "Завдань: " + stats.done + " / " + stats.total }),
          bar(stats.pct),
          homeworkProgress(lesson)
        )
      );
    });

    const resetBtn = el("button", { class: "ghost-btn", text: "Скинути весь прогрес" });
    resetBtn.addEventListener("click", () => {
      if (!confirm("Стерти позначки про виконані завдання й пройдені частини?")) return;
      store = { done: {}, parts: {}, today: {} };
      save();
      render();
    });

    app.append(hero, cards, el("footer", { class: "page-foot" }, resetBtn));
  }

  function renderParts(app, lesson) {
    const summary = el("div", { class: "parts-summary", "aria-live": "polite" });
    const todayLabel = el("p", { class: "parts-today" });
    const continueBtn = el("button", { class: "btn", type: "button", text: "До частини на сьогодні ↓" });
    const nav = el("nav", { class: "parts-nav", "aria-label": "Частини заняття", style: "--part-count: " + lesson.parts.length });
    const views = [];
    const jump = (part) => document.getElementById("part-" + lesson.id + "-" + part.id).scrollIntoView({ block: "start", behavior: "smooth" });
    continueBtn.addEventListener("click", () => jump(todayPart(lesson)));
    app.append(el("div", { class: "parts-roadmap" },
      el("h2", { text: "Твій шлях у цьому занятті" }),
      summary, todayLabel,
      el("p", { class: "parts-help", text: "Пройшла матеріал — познач частину. Задачі можна доробити пізніше. Наступну частину пропонуємо на сьогодні; можна обрати іншу." }),
      continueBtn, nav
    ));

    lesson.parts.forEach((part, position) => {
      const end = lesson.parts[position + 1]?.start ?? lesson.blocks.length;
      const state = el("span", { class: "part-state" });
      const counter = el("span", { class: "part-counter" });
      const navState = el("span", { class: "part-nav-state" });
      const navCounter = el("span", { class: "part-nav-counter" });
      const navBtn = el("button", { class: "part-link", type: "button", "data-part-link": part.id },
        el("span", { class: "part-number", text: "Частина " + (position + 1) }),
        el("span", { class: "part-nav-title", text: part.title }), navState, navCounter
      );
      navBtn.addEventListener("click", () => jump(part));
      nav.append(navBtn);

      const choose = el("button", { class: "ghost-btn part-today-btn", type: "button", "aria-label": "Обрати на сьогодні: " + part.title });
      choose.addEventListener("click", () => {
        store.today[lesson.id] = part.id;
        save();
        refreshProgress();
      });
      const complete = el("button", { class: "btn part-complete", type: "button" });
      complete.addEventListener("click", () => {
        const key = blockKey(lesson, part, 0);
        if (isPartDone(lesson, part)) delete store.parts[key];
        else {
          store.parts[key] = true;
          if (store.today[lesson.id] === part.id) delete store.today[lesson.id];
        }
        save();
        refreshProgress();
      });
      const section = el("section", { class: "lesson-part", id: "part-" + lesson.id + "-" + part.id, "data-part": part.id },
        el("header", { class: "part-heading" },
          el("div", { class: "kicker", text: "частина " + (position + 1) + " з " + lesson.parts.length }),
          el("h2", { text: part.title }),
          el("div", { class: "part-meta" }, state, counter),
          choose
        )
      );
      for (let index = part.start; index < end; index++) {
        const block = lesson.blocks[index];
        const make = BLOCKS[block.type];
        if (make) section.append(make(block, { key: blockKey(lesson, block, index), lesson }));
      }
      section.append(el("footer", { class: "part-footer" }, complete));
      app.append(section);
      views.push({ part, end, section, state, counter, navBtn, navState, navCounter, choose, complete });
    });

    const drawParts = () => {
      const stats = partsStats(lesson);
      const today = todayPart(lesson);
      summary.textContent = "Частин пройдено: " + stats.done + " з " + stats.total;
      todayLabel.textContent = today ? "На сьогодні: частина " + (lesson.parts.indexOf(today) + 1) + " — " + today.title : "Усі частини пройдено ✓";
      continueBtn.hidden = !today;
      views.forEach((view) => {
        const done = isPartDone(lesson, view.part);
        const current = today === view.part;
        const tasks = lessonStats(lesson, view.part.start, view.end);
        const status = done ? "✓ Пройдено" : current ? "На сьогодні" : tasks.done ? "Розпочато" : "Попереду";
        view.state.textContent = view.navState.textContent = status;
        view.counter.textContent = view.navCounter.textContent = "Задачі: " + tasks.done + " з " + tasks.total;
        for (const node of [view.section, view.navBtn]) {
          node.classList.toggle("part-done", done);
          node.classList.toggle("part-current", current);
        }
        if (current) view.navBtn.setAttribute("aria-current", "step");
        else view.navBtn.removeAttribute("aria-current");
        view.choose.hidden = done;
        view.choose.disabled = current;
        view.choose.textContent = current ? "На сьогодні" : "Обрати на сьогодні";
        view.complete.textContent = done ? "✓ Пройдено · зняти позначку" : "Частину пройдено ✓";
        view.complete.setAttribute("aria-pressed", String(done));
      });
    };
    progressWatchers.push(drawParts);
    drawParts();
  }

  function renderLesson(app, lesson) {
    app.append(
      el("div", { class: "kicker", text: "заняття " + lesson.num + (lesson.date ? " · " + lesson.date : "") }),
      el("h1", { text: lesson.title }),
      lesson.subtitle ? el("p", { class: "lead", text: lesson.subtitle }) : null
    );

    if (lesson.goals && lesson.goals.length) {
      app.append(
        el(
          "div",
          { class: "goals" },
          el("b", { text: "Після цього заняття ти вмієш:" }),
          el("ul", { html: lesson.goals.map((goal) => "<li>" + goal + "</li>").join("") })
        )
      );
    }

    const progressLine = el("div", { class: "score" });
    const drawScore = () => {
      const now = lessonStats(lesson);
      progressLine.textContent = "";
      progressLine.append(el("span", { class: "bar-label", text: "Завдань зроблено: " + now.done + " з " + now.total }), bar(now.pct));
    };
    drawScore();
    progressWatchers.push(drawScore);
    app.append(progressLine);
    app.append(el("div", { class: "homework-overview" }, homeworkProgress(lesson)));

    if (lesson.parts && lesson.parts.length) renderParts(app, lesson);
    else {
      lesson.blocks.forEach((block, index) => {
        const make = BLOCKS[block.type];
        if (make) app.append(make(block, { key: blockKey(lesson, block, index), lesson }));
      });
    }

    const position = lessons.indexOf(lesson);
    const prev = lessons[position - 1];
    const next = lessons[position + 1];
    app.append(
      el(
        "div",
        { class: "navrow" },
        prev ? el("a", { class: "ghost-btn", href: "#/l/" + prev.id, text: "← " + prev.title }) : el("a", { class: "ghost-btn", href: "#/", text: "← На головну" }),
        next ? el("a", { class: "ghost-btn", href: "#/l/" + next.id, text: next.title + " →" }) : el("a", { class: "ghost-btn", href: "#/", text: "На головну →" })
      )
    );
  }

  function updateMini() {
    const mini = document.getElementById("progressMini");
    if (!mini) return;
    const overall = overallStats();
    mini.textContent = overall.done + " / " + overall.total + " завдань";
  }

  function render() {
    const app = document.getElementById("app");
    app.textContent = "";
    progressWatchers.length = 0;
    progressWatchers.push(updateMini);

    const match = (location.hash || "#/").match(/^#\/l\/(.+)$/);
    const lesson = match ? lessons.find((item) => item.id === match[1]) : null;
    if (lesson) renderLesson(app, lesson);
    else renderIndex(app);

    window.scrollTo(0, 0);
    updateMini();
  }

  return {
    el: el,
    addLesson(lesson) {
      lessons.push(lesson);
    },
    start() {
      window.addEventListener("hashchange", render);
      render();
    },
  };
})();
