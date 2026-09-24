/* Терези Ґрінґотса: інтерактивний симулятор зважувань.
   Монету можна перетягнути мишкою або пальцем зі столу на чашу, з чаші на другу чашу
   й назад на стіл. Короткий клац теж працює — переставляє монету по колу.
   Терези відповідають чесно: ліворуч важче, праворуч важче або рівновага. */

const SCALES = (function () {
  const el = COURSE.el;

  const KIND_TEXT = {
    light: " Одна з них — леприконське золото, вона <b>легша за інші</b>.",
    heavy: " Одна з них — леприконське золото, вона <b>важча за інші</b>.",
    unknown: " Одна з них — леприконське золото, і <b>невідомо, легша вона чи важча</b>.",
  };

  const GHOST = 38; // розмір монети під курсором
  const PAN_PAD = 34; // наскільки щедро розширюємо чашу як ціль для кидка

  function create(cfg, onSolve) {
    const n = cfg.n;
    const known = Math.max(0, Math.round(Number(cfg.known) || 0));
    const total = n + known;
    const limit = cfg.limit || 0;
    const declared = cfg.fake || "light";

    let fakeIndex = 0;
    let actualKind = "light";
    let used = 0;
    let solved = false;
    let declaring = false;
    let drag = null;
    let suppressClick = false;
    let pendingAsk = false;
    let candidates = [];
    /* Стан кожної монети — це вся памʼять симулятора про міркування дитини:
       "?"     — може бути фальшивою, і легшою, і важчою (тільки при невідомому напрямі);
       "heavy" — якщо фальшива, то лише важча;
       "light" — якщо фальшива, то лише легша;
       "out"   — доведено справжня.
       Задача з відомим напрямом — окремий випадок: там усі монети стартують уже з міткою. */
    let state = new Array(total).fill("?");
    const zones = new Array(total).fill("table");
    const ask = el("div", { class: "ask" });

    /* ---------- каркас ---------- */

    const leftCoins = el("div", { class: "pan-coins" });
    const rightCoins = el("div", { class: "pan-coins" });
    const leftPan = el("div", { class: "pan" }, leftCoins);
    const rightPan = el("div", { class: "pan" }, rightCoins);
    const leftArm = el("div", { class: "arm left" }, el("div", { class: "rope" }), leftPan);
    const rightArm = el("div", { class: "arm right" }, el("div", { class: "rope" }), rightPan);

    const beam = el("div", { class: "beam" }, leftArm, rightArm);
    const scales = el(
      "div",
      { class: "scales" },
      el("div", { class: "base" }),
      el("div", { class: "pillar" }),
      el("div", { class: "beam-wrap" }, beam)
    );

    const tableCoins = el("div", { class: "table-coins" });
    const tray = el("div", { class: "tray" }, el("div", { class: "tray-label", text: "Стіл" }), tableCoins);

    /* Полиця для доведено справжніх монет. Вони не зникають — це еталони ✓, ними далі важать,
       але на робочому столі їм не місце: дитина має бачити тільки підозрюваних. */
    const spareCoins = el("div", { class: "table-coins" });
    const spare = el(
      "div",
      { class: "tray spare" },
      el("div", { class: "tray-label", text: "Еталони ✓ · точно справжні, можна класти на чашу" }),
      spareCoins
    );
    const verdict = el("div", { class: "sim-verdict" });
    const log = el("ol", { class: "sim-log" });
    const counter = el("span", { class: "sim-stat" });

    const coins = [];
    for (let i = 0; i < total; i++) {
      const isKnown = i >= n;
      const coin = el("button", {
        class: "coin" + (isKnown ? " known" : ""),
        text: isKnown ? "✓" : String(i + 1),
        title: isKnown ? "Еталон на старті — точно справжня монета" : undefined,
        type: "button",
      });
      coin.addEventListener("pointerdown", (event) => onPointerDown(i, coin, event));
      coin.addEventListener("pointermove", onPointerMove);
      coin.addEventListener("pointerup", onPointerUp);
      coin.addEventListener("pointercancel", onPointerCancel);
      coin.addEventListener("click", () => onCoinClick(i));
      coins.push(coin);
    }

    /* ---------- переміщення монет ---------- */

    function setTilt(deg) {
      scales.style.setProperty("--tilt", deg + "deg");
    }

    function clearVerdict() {
      verdict.className = "sim-verdict";
      verdict.textContent = "";
    }

    function layout() {
      let spareCount = 0;
      coins.forEach((coin, i) => {
        const proven = state[i] === "out";
        coin.classList.toggle("out", proven);
        /* Значки В і Л мають сенс лише там, де напрям невідомий: в інших задачах
           він однаковий для всіх монет і намальований у самій умові. */
        coin.classList.toggle("sus-heavy", declared === "unknown" && state[i] === "heavy");
        coin.classList.toggle("sus-light", declared === "unknown" && state[i] === "light");
        if (zones[i] === "table" && proven) spareCount += 1;
        const target =
          zones[i] === "left" ? leftCoins
            : zones[i] === "right" ? rightCoins
            : proven ? spareCoins
            : tableCoins;
        if (coin.parentNode !== target) target.append(coin);
      });
      spare.classList.toggle("empty", spareCount === 0);
      const left = zones.filter((z) => z === "left").length;
      const right = zones.filter((z) => z === "right").length;
      const heavy = state.filter((s) => s === "heavy").length;
      const light = state.filter((s) => s === "light").length;
      const marks = declared === "unknown" && heavy + light ? " (В: " + heavy + ", Л: " + light + ")" : "";
      counter.textContent =
        "Зважувань: " + used + (limit ? " з " + limit : "") +
        " · підозрюваних: " + candidates.length + marks +
        " · на чашах " + left + " і " + right;
      declareBtn.classList.toggle("hot", Boolean(limit) && used >= limit && !solved);
    }

    /* Монета переїхала — попередній результат уже не про цей розклад. */
    function afterMove() {
      setTilt(0);
      clearVerdict();
      layout();
    }

    function moveCoin(i, zone) {
      if (zones[i] === zone) return;
      zones[i] = zone;
      afterMove();
    }

    function onCoinClick(i) {
      if (suppressClick || solved) return;
      if (pendingAsk && !declaring) return;
      if (declaring) {
        declare(i);
        return;
      }
      moveCoin(i, zones[i] === "table" ? "left" : zones[i] === "left" ? "right" : "table");
    }

    /* ---------- перетягування ---------- */

    function hit(rect, x, y, pad) {
      return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
    }

    function zoneAt(x, y) {
      if (hit(leftPan.getBoundingClientRect(), x, y, PAN_PAD)) return "left";
      if (hit(rightPan.getBoundingClientRect(), x, y, PAN_PAD)) return "right";
      if (hit(tray.getBoundingClientRect(), x, y, 10)) return "table";
      /* Полиця еталонів — теж «стіл»: монета, скинута туди, просто йде з чаші. */
      if (hit(spare.getBoundingClientRect(), x, y, 10)) return "table";
      return null;
    }

    function highlight(zone) {
      leftArm.classList.toggle("drop-hot", zone === "left");
      rightArm.classList.toggle("drop-hot", zone === "right");
      tray.classList.toggle("drop-hot", zone === "table");
      spare.classList.toggle("drop-hot", zone === "table");
    }

    function onPointerDown(i, coin, event) {
      if (solved || declaring || pendingAsk) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      drag = { index: i, coin: coin, id: event.pointerId, x0: event.clientX, y0: event.clientY, ghost: null };
      try {
        coin.setPointerCapture(event.pointerId);
      } catch (e) {
        /* захоплення не вийшло — перетягування просто не почнеться */
      }
    }

    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x0;
      const dy = event.clientY - drag.y0;
      if (!drag.ghost && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      if (!drag.ghost) {
        const ghost = drag.coin.cloneNode(true);
        ghost.className = "coin drag-ghost";
        document.body.append(ghost);
        drag.ghost = ghost;
        drag.coin.classList.add("dragging");
      }
      drag.ghost.style.left = event.clientX - GHOST / 2 + "px";
      drag.ghost.style.top = event.clientY - GHOST / 2 + "px";
      highlight(zoneAt(event.clientX, event.clientY));
      event.preventDefault();
    }

    function finishDrag(event, drop) {
      const state = drag;
      drag = null;
      try {
        state.coin.releasePointerCapture(state.id);
      } catch (e) {}
      if (!state.ghost) return false; // це був звичайний клац
      state.ghost.remove();
      state.coin.classList.remove("dragging");
      highlight(null);
      if (drop) {
        const zone = zoneAt(event.clientX, event.clientY);
        if (zone) moveCoin(state.index, zone);
      }
      return true;
    }

    function onPointerUp(event) {
      if (!drag || event.pointerId !== drag.id) return;
      if (!finishDrag(event, true)) return;
      /* Після перетягування браузер ще надішле click — його треба проковтнути,
         інакше монета поїде далі по колу. */
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    }

    function onPointerCancel(event) {
      if (!drag || event.pointerId !== drag.id) return;
      finishDrag(event, false);
    }

    /* ---------- зважування ---------- */

    function weight(i) {
      if (i !== fakeIndex) return 1;
      return actualKind === "light" ? 0.9 : 1.1;
    }

    function weigh() {
      if (solved) return;
      if (pendingAsk) {
        verdict.className = "sim-verdict no";
        verdict.textContent = "Спершу скажи, де тепер фальшива.";
        return;
      }
      const leftIds = [];
      const rightIds = [];
      let leftMass = 0;
      let rightMass = 0;
      zones.forEach((zone, i) => {
        if (zone === "left") {
          leftIds.push(i < n ? String(i + 1) : "✓");
          leftMass += weight(i);
        } else if (zone === "right") {
          rightIds.push(i < n ? String(i + 1) : "✓");
          rightMass += weight(i);
        }
      });

      if (!leftIds.length && !rightIds.length) {
        verdict.className = "sim-verdict no";
        verdict.textContent = "Спершу поклади монети на чаші — перетягни їх зі столу.";
        return;
      }
      /* Нерівна кількість монет перетягне чашу сама по собі, і результат нічого не скаже. */
      if (leftIds.length !== rightIds.length) {
        verdict.className = "sim-verdict no";
        verdict.textContent =
          "На чашах має бути порівну монет (" + leftIds.length + " проти " + rightIds.length +
          "). Інакше важча чаша нічого не доводить — вона просто повніша.";
        return;
      }
      if (limit && used >= limit) {
        verdict.className = "sim-verdict no";
        verdict.textContent = "Зважування скінчилися. Тисни «Назвати фальшиву», якщо знаєш, або «Спочатку», щоб спробувати ще раз.";
        return;
      }

      used += 1;
      const diff = leftMass - rightMass;
      const outcome = Math.abs(diff) < 0.001 ? "рівновага" : diff > 0 ? "ліва чаша опустилася" : "права чаша опустилася";
      setTilt(Math.abs(diff) < 0.001 ? 0 : diff > 0 ? -9 : 9);

      verdict.className = "sim-verdict";
      verdict.textContent = "Результат: " + outcome + ".";
      log.append(
        el(
          "li",
          {},
          el("b", { text: "[" + (leftIds.join(", ") || "порожньо") + "] проти [" + (rightIds.join(", ") || "порожньо") + "] — " }),
          el("span", { text: outcome })
        )
      );

      if (limit && used >= limit) {
        verdict.textContent += " Це було останнє зважування — тепер називай монету.";
      }
      layout();
      askGroup(Math.abs(diff) < 0.001 ? 0 : diff > 0 ? 1 : -1);
    }

    /* ---------- «яку групу беремо далі» ---------- */

    const ZONE_NAME = {
      left: "На лівій чаші",
      right: "На правій чаші",
      table: "Серед тих, що на столі",
      tilt: "Хто внизу — підозра «важча» В, хто вгорі — «легша» Л",
      swap: "Хто внизу — «легша» Л, хто вгорі — «важча» В",
      none: "Усі, хто на чашах, справжні",
    };

    /* Оскільки на чашах завжди порівну монет, відповідь однозначно випливає з результату.
       При невідомому напрямі нерівновага питається інакше — не «де вона», а «що це означає». */
    function correctZone(outcome) {
      if (outcome === 0) return "table";
      const down = outcome > 0 ? "left" : "right";
      const up = outcome > 0 ? "right" : "left";
      return declared === "heavy" ? down : up;
    }

    /* Один крок міркування, застосований до кожної монети.
       Нерівновага: на опущеній чаші фальшива могла б бути тільки важчою, на піднятій —
       тільки легшою, а на столі її немає взагалі, бо монет на чашах було порівну.
       Стара мітка перетинається з новою: «тільки важча», що опинилася на піднятій чаші,
       доведено справжня — саме цей перетин і вирізає монети в класичній схемі 12 за 3.
       Рівновага: усі, хто на чашах, справжні; тим, хто на столі, нічого не змінилося. */
    function applyOutcome(outcome) {
      const down = outcome > 0 ? "left" : "right";
      state = state.map((s, i) => {
        if (s === "out") return "out";
        if (outcome === 0) return zones[i] === "table" ? s : "out";
        if (zones[i] === "table") return "out";
        const only = zones[i] === down ? "heavy" : "light";
        return s === "?" || s === only ? only : "out";
      });
      candidates = state.map((s, i) => (s === "out" ? -1 : i)).filter((i) => i >= 0);
    }

    /* Питаємо лише тоді, коли є з чого вибирати: підозрювані лежать більш ніж в одному місці. */
    function askGroup(outcome) {
      const spread = new Set(candidates.map((i) => zones[i]));
      if (candidates.length < 2 || spread.size < 2) return;

      const tilted = outcome !== 0 && declared === "unknown";
      pendingAsk = tilted ? "tilt" : correctZone(outcome);
      ask.textContent = "";
      ask.append(
        el("div", { class: "ask-q", text: tilted ? "Що це означає для монет на чашах?" : "Де тепер фальшива?" })
      );
      const row = el("div", { class: "ask-opts" });
      const options = tilted ? ["tilt", "swap", "none"] : ["left", "right", "table"];
      options.forEach((zone) => {
        const button = el("button", { class: "ask-opt", type: "button", text: ZONE_NAME[zone] });
        button.addEventListener("click", () => answerGroup(zone, button, outcome));
        row.append(button);
      });
      ask.append(row);
    }

    function whyNot(zone, outcome) {
      if (zone === "swap") return "Ні, навпаки. Чаша опускається від важчого — отже внизу підозра «важча», а вгорі «легша».";
      if (zone === "none") return "Ні. Монет на чашах було порівну, а рівноваги немає — отже фальшива саме там.";
      if (outcome === 0) return "Ні. Чаші зрівноважилися — отже монети на них однакові, тобто справжні.";
      if (zone === "table") return "Ні. Монет на чашах було порівну, а рівноваги немає — різниця саме на чашах.";
      const shouldGo = declared === "heavy" ? "опуститися" : "піднятися";
      return "Ні. Фальшива " + (declared === "heavy" ? "важча" : "легша") + ", отже її чаша мала " + shouldGo + ".";
    }

    function answerGroup(zone, button, outcome) {
      if (!pendingAsk) return;
      if (zone !== pendingAsk) {
        button.classList.add("wrong");
        verdict.className = "sim-verdict no";
        verdict.textContent = whyNot(zone, outcome);
        return;
      }

      /* Вгадала: застосовуємо крок міркування й звільняємо чаші під наступне зважування.
         Доведено справжні монети лишаються в грі — це еталони ✓, ними далі зручно важити. */
      pendingAsk = false;
      ask.textContent = "";
      applyOutcome(outcome);
      zones.fill("table");
      setTilt(0);
      layout();
      verdict.className = "sim-verdict ok";
      verdict.textContent =
        candidates.length === 1
          ? "Так. Лишилася одна підозрювана монета — № " + (candidates[0] + 1) + ". Тисни «Назвати фальшиву»."
          : "Так. Підозрюваних лишилося " + candidates.length + suspectList() + ". Решта — еталони ✓.";
    }

    /* При невідомому напрямі важливо не тільки скільки монет лишилося, а й з якою міткою:
       саме цей список дитина тримає на папері, і він має збігатися з екраном. */
    function suspectList() {
      if (declared !== "unknown") return "";
      const named = candidates.map((i) => "№" + (i + 1) + (state[i] === "heavy" ? "В" : state[i] === "light" ? "Л" : ""));
      return ": " + named.join(", ");
    }

    /* ---------- рішення ---------- */

    function setDeclaring(on) {
      declaring = on && !solved;
      declareBtn.classList.toggle("armed", declaring);
      root.classList.toggle("declaring", declaring);
      if (declaring) {
        clearVerdict();
        verdict.textContent = "Клацни по монеті, яку вважаєш фальшивою.";
      }
    }

    /* Режим вимикається лише тоді, коли монету вгадано. Після промаху він лишається ввімкненим,
       щоб можна було одразу тицьнути іншу монету, а не тиснути кнопку щоразу. */
    function declare(i) {
      if (state[i] === "out") {
        verdict.className = "sim-verdict no";
        verdict.textContent =
          i < n
            ? "Монета № " + (i + 1) + " — уже еталон ✓: ти сама довела, що вона справжня. Обери іншу."
            : "Монета ✓ — еталон на старті, вона справжня з самого початку. Обери іншу.";
        return;
      }
      if (i === fakeIndex) {
        setDeclaring(false);
        solved = true;
        coins[i].classList.add("fake");
        verdict.className = "sim-verdict ok";
        verdict.textContent =
          "Так! Монета № " + (i + 1) + " — леприконське золото (" + (actualKind === "light" ? "легша" : "важча") + "). Зважувань витрачено: " + used + ".";
        weighBtn.disabled = true;
        declareBtn.disabled = true;
        declareBtn.classList.remove("hot");
        if (onSolve) onSolve();
      } else {
        coins[i].classList.add("cleared");
        setTimeout(() => coins[i].classList.remove("cleared"), 700);
        verdict.className = "sim-verdict no";
        verdict.textContent = "Ні, монета № " + (i + 1) + " справжня. Тицяй наступну.";
      }
    }

    function reset() {
      fakeIndex = Math.floor(Math.random() * n);
      actualKind = declared === "unknown" ? (Math.random() < 0.5 ? "light" : "heavy") : declared;
      used = 0;
      solved = false;
      drag = null;
      pendingAsk = false;
      candidates = Array.from({ length: n }, (_, i) => i);
      /* У задачі з відомим напрямом підозра в усіх однакова з самого початку —
         тоді перетин робить рівно те саме, що робив старий зонний фільтр. */
      state = new Array(n)
        .fill(declared === "unknown" ? "?" : declared)
        .concat(new Array(known).fill("out"));
      ask.textContent = "";
      zones.fill("table");
      coins.forEach((coin) => {
        coin.classList.remove("fake", "cleared", "dragging", "out", "sus-heavy", "sus-light");
        coin.disabled = false;
      });
      log.textContent = "";
      setTilt(0);
      clearVerdict();
      highlight(null);
      weighBtn.disabled = false;
      declareBtn.disabled = false;
      setDeclaring(false);
      layout();
    }

    /* ---------- кнопки ---------- */

    const weighBtn = el("button", { class: "btn", text: "Зважити ⚖", type: "button" });
    weighBtn.addEventListener("click", weigh);

    const declareBtn = el("button", { class: "ghost-btn", text: "Назвати фальшиву", type: "button" });
    declareBtn.addEventListener("click", () => {
      if (solved) return;
      setDeclaring(!declaring);
      if (!declaring) clearVerdict();
    });

    const clearBtn = el("button", { class: "ghost-btn", text: "Зняти з чаш", type: "button" });
    clearBtn.addEventListener("click", () => {
      if (solved || pendingAsk) return;
      zones.fill("table");
      afterMove();
    });

    const resetBtn = el("button", { class: "ghost-btn", text: "Спочатку ↺", type: "button" });
    resetBtn.addEventListener("click", reset);

    /* ---------- збірка ---------- */

    const task = el("div", {
      class: "sim-task",
      html:
        cfg.intro ||
        (cfg.noun || "Монет") +
          ": <b>" +
          n +
          "</b>." +
          KIND_TEXT[declared] +
          (known ? " Є еталон на старті ✓ — точно справжня монета." : "") +
          (limit ? " Ґоблін дозволяє <b>" + limit + "</b> " + weighWord(limit) + "." : " Зважуй скільки хочеш — це тренування."),
    });

    const root = el(
      "div",
      { class: "sim" + (total > 36 ? " many" : "") },
      task,
      el("div", { class: "sim-hint", text: "Перетягни монету на чашу — мишкою або пальцем. Короткий клац теж переставляє." }),
      el("div", { class: "sim-head" }, counter),
      scales,
      verdict,
      ask,
      tray,
      spare,
      el("div", { class: "toolbar" }, weighBtn, declareBtn, clearBtn, resetBtn),
      el("details", { class: "sim-logbox" }, el("summary", { text: "Журнал зважувань" }), log)
    );

    reset();
    return root;
  }

  function weighWord(k) {
    return k >= 5 ? "зважувань" : "зважування";
  }

  /* Скільки зважувань треба напевно, якщо треба назвати монету, але не обовʼязково її напрям.
     Напрям відомий: вистачає 3^k ≥ n.
     Напрям невідомий, еталона на старті немає: межа (3^k − 1) / 2.
     Еталон на старті додає ще одну монету: межа (3^k + 1) / 2. */
  function minWeighings(n, kind, known) {
    if (n < 2) return 0;
    let k = 1;
    while (kind === "unknown" ? (Math.pow(3, k) + (known ? 1 : -1)) / 2 < n : Math.pow(3, k) < n) k += 1;
    return k;
  }

  /* ---------- тренажер: будь-яка кількість монет 1–100 ---------- */

  const KINDS = [
    ["light", "легша"],
    ["heavy", "важча"],
    ["unknown", "невідомо"],
  ];

  function trainer(cfg, onSolve) {
    let n = cfg.n || 12;
    let kind = cfg.fake || "light";
    let known = cfg.known ? 1 : 0;

    const number = el("input", { class: "trainer-num", type: "number", min: "1", max: "100", value: String(n) });
    const range = el("input", { class: "trainer-range", type: "range", min: "1", max: "100", value: String(n) });
    const goal = el("div", { class: "trainer-goal" });
    const slot = el("div", { class: "trainer-slot" });

    const kindRow = el("div", { class: "trainer-kinds" });
    const kindButtons = KINDS.map(([value, label]) => {
      const button = el("button", { class: "kind-btn", type: "button", text: label, "data-kind": value });
      button.addEventListener("click", () => {
        kind = value;
        paint();
      });
      kindRow.append(button);
      return button;
    });

    const knownRow = el("div", { class: "trainer-kinds" });
    const knownButtons = [
      [0, "без еталона"],
      [1, "є еталон ✓"],
    ].map(([value, label]) => {
      const button = el("button", { class: "kind-btn", type: "button", text: label, "data-known": String(value) });
      button.addEventListener("click", () => {
        known = value;
        paint();
      });
      knownRow.append(button);
      return button;
    });

    const clamp = (value) => Math.min(100, Math.max(1, Math.round(Number(value) || 1)));

    function paint() {
      number.value = String(n);
      range.value = String(n);
      kindButtons.forEach((button) => button.classList.toggle("on", button.getAttribute("data-kind") === kind));
      knownButtons.forEach((button) => button.classList.toggle("on", Number(button.getAttribute("data-known")) === known));
      const k = minWeighings(n, kind, known);
      const capacity = kind === "unknown" ? (Math.pow(3, k) + (known ? 1 : -1)) / 2 : Math.pow(3, k);
      goal.innerHTML = k
        ? "Вистачить <b>" + k + "</b> " + weighWord(k) + "." +
          (kind !== "unknown"
            ? " Бо 3<sup>" + k + "</sup> = " + Math.pow(3, k) + ", а це не менше за " + n + "."
            : !cfg.chooseKnown
              /* Тренажер без перемикача еталона говорить так само, як до його появи. */
              ? " Напрям невідомий, тому кожна монета дає два варіанти — і межа вже не 3<sup>k</sup>, а (3<sup>k</sup>&nbsp;−&nbsp;1)&nbsp;/&nbsp;2."
              : known
                ? " Є еталон на старті: межа (3<sup>k</sup>&nbsp;+&nbsp;1)&nbsp;/&nbsp;2 = <b>" + capacity + "</b>."
                : " Еталона на старті немає: межа (3<sup>k</sup>&nbsp;−&nbsp;1)&nbsp;/&nbsp;2 = <b>" + capacity + "</b>.")
        : "Монета одна — вона ж і фальшива, зважувати нема чого.";
    }

    function build() {
      slot.textContent = "";
      slot.append(create({ n: n, known: known, fake: kind, limit: minWeighings(n, kind, known) }, onSolve));
    }

    number.addEventListener("change", () => {
      n = clamp(number.value);
      paint();
    });
    range.addEventListener("input", () => {
      n = clamp(range.value);
      paint();
    });

    const startBtn = el("button", { class: "btn", type: "button", text: "Нова задача" });
    startBtn.addEventListener("click", () => {
      n = clamp(number.value);
      paint();
      build();
    });

    const root = el(
      "div",
      { class: "trainer" },
      el(
        "div",
        { class: "trainer-controls" },
        el("label", { class: "trainer-field" }, el("span", { text: "Монет" }), number),
        range,
        el("div", { class: "trainer-field" }, el("span", { text: "Фальшива" }), kindRow),
        cfg.chooseKnown ? el("div", { class: "trainer-field" }, el("span", { text: "Еталон на старті" }), knownRow) : null,
        startBtn
      ),
      goal,
      slot
    );

    paint();
    build();
    return root;
  }

  return { create: create, trainer: trainer, minWeighings: minWeighings };
})();
