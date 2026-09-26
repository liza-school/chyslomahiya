/* Рушій курсу: маршрути, відмалювання блоків, перевірка завдань, прогрес. */

const COURSE = (function () {
  const STORE_KEY = "chyslomahiya.v1";
  const OLD_STORE_KEY = "fimli.v1"; // курс звався інакше; прогрес переїжджає сам
  const lessons = [];

  let store = { done: {} };
  try {
    const saved = localStorage.getItem(STORE_KEY) || localStorage.getItem(OLD_STORE_KEY) || "{}";
    store = Object.assign(store, JSON.parse(saved));
  } catch (e) {
    /* зіпсоване сховище просто ігноруємо */
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
    problem: "задача",
    scales: "терези",
    trainer: "тренажер",
    jugs: "відра",
    jugtrainer: "тренажер",
    jugwalk: "граф",
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

      if (b.hints && b.hints.length) {
        body.push(hintLadder(b.hints));
      } else if (b.hint) {
        body.push(el("details", {}, el("summary", { text: "Підказка" }), el("div", { html: b.hint })));
      }
      if (b.solution) {
        body.push(el("details", {}, el("summary", { text: "Розвʼязання" }), el("div", { html: b.solution })));
      }

      if (!b.sim && !b.jugs) {
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
          b.homework ? el("span", { class: "hw-badge", text: "домашнє" }) : null,
          doneMark
        ),
        el("div", { class: "block-body" }, body)
      );
    },

    /* Список заданого: чотири задачі, до кожної можна стрибнути одним дотиком. */
    homework(b) {
      const list = el("div", { class: "hw-list" });
      b.items.forEach((item) => {
        const jump = el(
          "button",
          { class: "hw-item", type: "button" },
          el("span", { class: "hw-num", text: String(item.num) }),
          el("span", { class: "hw-title", text: item.title }),
          item.note ? el("span", { class: "hw-note", text: item.note }) : null
        );
        jump.addEventListener("click", () => {
          const target = document.querySelector('[data-problem="' + item.num + '"]');
          if (target) target.scrollIntoView({ block: "start", behavior: "smooth" });
        });
        list.append(jump);
      });
      return card("homework", b.title || "Сова принесла завдання", null, [b.html ? el("div", { html: b.html }) : null, list]);
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
      const sim = JUGS.create(b, () => {
        doneMark.textContent = "✓";
        markDone(ctx.key);
      });
      return el(
        "section",
        { class: "block jugs-block" },
        el("div", { class: "block-head" }, el("span", { class: "tag", text: TAGS.jugs }), el("span", { text: b.title || "Відра без поділок" }), doneMark),
        el("div", { class: "block-body" }, b.html ? el("div", { html: b.html }) : null, sim)
      );
    },

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

  const CHECKABLE = new Set(["quiz", "multi", "order", "input", "problem", "scales", "trainer", "jugs", "jugtrainer"]);

  function blockKey(lesson, block, index) {
    return lesson.id + ":" + (block.id || block.type + index);
  }

  function lessonStats(lesson) {
    let done = 0;
    let total = 0;
    lesson.blocks.forEach((block, index) => {
      if (!CHECKABLE.has(block.type)) return;
      total += 1;
      if (isDone(blockKey(lesson, block, index))) done += 1;
    });
    return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0 };
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
      cards.append(
        el(
          "a",
          { class: "card", href: "#/l/" + lesson.id },
          el("div", { class: "num", text: "Заняття " + lesson.num }),
          el("div", { class: "title", text: lesson.title }),
          el("div", { class: "sub", text: lesson.subtitle || "" }),
          el("div", { class: "stat", text: "Завдань: " + stats.done + " / " + stats.total }),
          bar(stats.pct)
        )
      );
    });

    const resetBtn = el("button", { class: "ghost-btn", text: "Скинути весь прогрес" });
    resetBtn.addEventListener("click", () => {
      if (!confirm("Стерти позначки про виконані завдання?")) return;
      store = { done: {} };
      save();
      render();
    });

    app.append(hero, cards, el("footer", { class: "page-foot" }, resetBtn));
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

    lesson.blocks.forEach((block, index) => {
      const make = BLOCKS[block.type];
      if (!make) return;
      app.append(make(block, { key: blockKey(lesson, block, index) }));
    });

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
