/* Дамблдор шукає фальшиву монету: покрокова анімація для невідомого «важча чи легша».
   plan() сам складає чесний план для будь-якого n і k та проходить його для заданої фальшивої монети:
   check.js перевіряє, що за k зважувань знаходиться кожна монета й у важчому, і в легшому випадку.
   Тут шукаємо лише монету (без еталона на старті), тож межі такі: 1, 4, 13, 40, 121, …  */

const COINWALK = (function () {
  const el = COURSE.el;

  /* Статуси монет: u — може бути фальшивою, важчою чи легшою; h — якщо фальшива, то важча;
     l — якщо фальшива, то легша; g — доведено справжня. */
  function plan(n, k, fake, dir) {
    const status = new Array(n).fill("u");
    const steps = [];
    const weight = (i) => (i === fake ? dir : 0); // +1 важча, −1 легша
    const alive = () => status.map((s, i) => (s === "g" ? -1 : i)).filter((i) => i >= 0);

    let left = k;
    while (alive().length > 1 && left > 0) {
      const cand = alive();
      const U = cand.filter((i) => status[i] === "u");
      const H = cand.filter((i) => status[i] === "h");
      const L = cand.filter((i) => status[i] === "l");
      const gen = status.map((s, i) => (s === "g" ? i : -1)).filter((i) => i >= 0);
      const cap = Math.pow(3, left - 1);
      let leftPan = [];
      let rightPan = [];

      if (!H.length && !L.length) {
        /* Ще нічого не знаємо про напрям: кладемо порівну, скільки влізе в «найгірший» випадок. */
        let s = Math.min(U.length, cap);
        if (!gen.length && s % 2) s -= 1;
        leftPan = U.slice(0, Math.ceil(s / 2));
        rightPan = U.slice(Math.ceil(s / 2), s);
      } else {
        /* Напрям відомий: A — підозри «ліва вниз», B — «права вниз», C — на столі. Підбираємо так,
           щоб чаші були майже рівні й вистачило справжніх монет для різниці. */
        let best = null;
        for (let hA = 0; hA <= Math.min(H.length, cap); hA++) {
          for (let lA = 0; hA + lA <= cap && lA <= L.length; lA++) {
            for (let hB = 0; hA + hB <= H.length && hB <= cap; hB++) {
              const lB = Math.min(L.length - lA, cap - hB);
              const rest = H.length + L.length - hA - lA - hB - lB;
              if (rest > cap) continue;
              const diff = Math.abs(hA + lB - (hB + lA));
              if (diff > gen.length) continue;
              const cost = diff * 100 + (hA + lA + hB + lB === 0 ? 1000 : 0) + (hA + lA + hB + lB);
              if (!best || cost < best.cost) best = { cost, hA, lA, hB, lB };
            }
          }
        }
        if (!best) return { fail: true, steps, found: -1 };
        leftPan = [...H.slice(0, best.hA), ...L.slice(L.length - best.lB)];
        rightPan = [...H.slice(best.hA, best.hA + best.hB), ...L.slice(0, best.lA)];
      }

      let pad = 0;
      const used = new Set([...leftPan, ...rightPan]);
      const spare = gen.filter((i) => !used.has(i));
      const padCoins = [];
      const diff = leftPan.length - rightPan.length;
      pad = Math.abs(diff);
      if (pad > spare.length) return { fail: true, steps, found: -1 };
      for (let j = 0; j < pad; j++) padCoins.push(spare[j]);
      const leftAll = diff < 0 ? [...leftPan, ...padCoins] : leftPan;
      const rightAll = diff > 0 ? [...rightPan, ...padCoins] : rightPan;

      const before = status.slice();
      /* Скільки підозрілих лишиться за кожної з трьох відповідей терезів. */
      const inL = new Set(leftAll);
      const inR = new Set(rightAll);
      const sideCount = (heavyIn, lightIn) =>
        cand.filter((i) => (heavyIn.has(i) && (before[i] === "u" || before[i] === "h")) || (lightIn.has(i) && (before[i] === "u" || before[i] === "l"))).length;
      const outA = sideCount(inL, inR);
      const outB = sideCount(inR, inL);
      const outC = cand.filter((i) => !inL.has(i) && !inR.has(i)).length;
      const outCu = cand.filter((i) => !inL.has(i) && !inR.has(i) && before[i] === "u").length;
      const sum = (pan) => pan.reduce((a, i) => a + weight(i), 0);
      const tilt = Math.sign(sum(leftAll) - sum(rightAll)); // 1 — ліва вниз, −1 — права вниз, 0 — рівновага
      const onScale = new Set([...leftAll, ...rightAll]);
      for (let i = 0; i < n; i++) {
        if (status[i] === "g") continue;
        if (tilt === 0) {
          if (onScale.has(i)) status[i] = "g";
        } else {
          const inLeft = leftAll.includes(i);
          const inRight = rightAll.includes(i);
          const heavySide = tilt > 0 ? inLeft : inRight;
          const lightSide = tilt > 0 ? inRight : inLeft;
          if (heavySide && (before[i] === "u" || before[i] === "h")) status[i] = "h";
          else if (lightSide && (before[i] === "u" || before[i] === "l")) status[i] = "l";
          else status[i] = "g";
        }
      }
      const table = [];
      for (let i = 0; i < n; i++) if (!onScale.has(i)) table.push(i);
      const after = alive();
      steps.push({
        left: leftAll,
        right: rightAll,
        pad,
        table,
        tilt,
        before,
        after: status.slice(),
        weighingsLeft: left,
        outA, outB, outC, outCu, cap,
        suspects: after.length,
        h: after.filter((i) => status[i] === "h").length,
        l: after.filter((i) => status[i] === "l").length,
      });
      left -= 1;
    }
    const rest = alive();
    return { fail: rest.length !== 1, steps, found: rest.length === 1 ? rest[0] : -1 };
  }

  const WORD = { 1: "зважування", 2: "зважування", 3: "зважування", 4: "зважування" };
  const weighWord = (k) => (k >= 5 ? "зважувань" : WORD[k] || "зважування");

  function walk(cfg) {
    const n = cfg.n;
    const k = cfg.k;
    let fake = (cfg.fake || 1) - 1;
    let dir = cfg.dir === "light" ? -1 : 1;
    let result;
    let shown = 0; // скільки зважувань уже показано повністю
    let phase = 0; // 0 — чекаємо «покласти», 1 — монети лежать, чекаємо «що показали терези»

    const root = el("div", { class: "sim walk-sim" });
    const picker = el("div", { class: "walk-picker" });
    const board = el("div", { class: "walk-board" });
    const stage = el("div", { class: "walk-stage" });
    const narr = el("div", { class: "walk-narr", "aria-live": "polite" });
    const controls = el("div", { class: "walk-controls" });

    const numberIn = el("input", { class: "mini-input", type: "number", min: "1", max: String(n), value: String(fake + 1), "aria-label": "Номер фальшивої", "data-field": "fake" });
    const dirSel = el("select", { class: "walk-select", "aria-label": "Фальшива важча чи легша", "data-field": "dir" },
      el("option", { value: "heavy", text: "важча" }), el("option", { value: "light", text: "легша" }));
    dirSel.value = dir > 0 ? "heavy" : "light";
    picker.append(
      el("span", { text: "Фальшива — монета №" }), numberIn, el("span", { text: ", вона " }), dirSel,
      el("span", { class: "walk-note", text: " (Дамблдор цього не знає — знаєш тільки ти, а терези відповідають чесно)" })
    );

    const next = el("button", { class: "btn", type: "button", "data-act": "next" });
    const again = el("button", { class: "ghost-btn", type: "button", text: "↺ Спочатку", "data-act": "again" });
    controls.append(next, again);

    const LEGEND = el("div", { class: "walk-legend", html:
      '<span class="coin-chip u">№</span> може бути і важча, і легша ' +
      '<span class="coin-chip h">№</span> якщо фальшива — то <b>важча</b> ' +
      '<span class="coin-chip l">№</span> якщо фальшива — то <b>легша</b> ' +
      '<span class="coin-chip g">№</span> справжня' });

    const chip = (i, st, extra) => el("span", { class: "coin-chip " + st + (extra ? " " + extra : ""), text: String(i + 1), "data-coin": String(i + 1) });

    const drawCoins = (list, statusOf, mark) => list.map((i) => chip(i, statusOf[i], mark && mark.has(i) ? "fresh" : ""));

    function drawBoard(statusOf) {
      board.replaceChildren(...statusOf.map((st, i) => chip(i, st, i === fake ? "is-fake" : "")));
    }

    function recompute() {
      result = plan(n, k, fake, dir);
      shown = 0;
      phase = 0;
      draw();
    }

    function draw() {
      const base = new Array(n).fill("u");
      const stepsDone = shown;
      const statusNow = stepsDone === 0 ? base : result.steps[stepsDone - 1].after;
      stage.replaceChildren();
      narr.replaceChildren();

      if (phase === 1) {
        const s = result.steps[shown];
        const tilted = s.tilt === 0 ? "" : s.tilt > 0 ? " tilt-left" : " tilt-right";
        drawBoard(s.before);
        stage.append(
          el("div", { class: "walk-pans" },
            el("div", { class: "walk-pan" }, el("b", { text: "Ліва чаша" }), el("div", { class: "walk-coins" }, drawCoins(s.left, s.before))),
            el("div", { class: "walk-pan" }, el("b", { text: "Права чаша" }), el("div", { class: "walk-coins" }, drawCoins(s.right, s.before)))
          ),
          el("div", { class: "walk-table" }, el("b", { text: "На столі (" + s.table.length + ")" }), el("div", { class: "walk-coins" }, drawCoins(s.table, s.before)))
        );
        const left = s.weighingsLeft;
        narr.append(
          el("p", { html: "<b>Зважування " + (shown + 1) + " із " + k + ".</b> Дамблдор кладе <b>" + s.left.length + "</b> монет на ліву чашу й <b>" +
            s.right.length + "</b> на праву" + (s.pad ? " (серед них " + s.pad + " справжніх, щоб чаші були рівні)" : "") + ". На столі лишає <b>" + s.table.length + "</b>." }),
          el("p", { class: "walk-why", html: "<b>Чому саме так?</b> Терези дадуть одну з трьох відповідей. Ліва чаша вниз — лишиться " + s.outA +
            " підозрілих. Права вниз — " + s.outB + ". Рівновага — " + s.outC + ". " +
            (left > 1
              ? "Далі " + (left - 1) + " " + weighWord(left - 1) + ": їх вистачає на " + s.cap + " підозрілих, чий напрям уже відомий" +
                (s.outCu ? ", або на " + (s.cap + 1) / 2 + " зовсім невідомих (якщо є справжні для порівняння)" : "") + ". Усі три числа в межах."
              : "Це останнє зважування: кожна відповідь має вказати рівно одну монету.") })
        );
      } else {
        drawBoard(statusNow);
        if (shown > 0) {
          const s = result.steps[shown - 1];
          narr.append(el("p", { html: "<b>Що показали терези:</b> " +
            (s.tilt === 0
              ? "рівновага. Усі монети на вазі — справжні. Підозрілих лишилось <b>" + s.suspects + "</b>."
              : (s.tilt > 0 ? "ліва чаша опустилась" : "права чаша опустилась") + ". Фальшива або на важчій чаші (і вона важча), або на легшій (і вона легша). Усе, що на столі, — справжнє. Підозрілих лишилось <b>" + s.suspects + "</b>: " + s.h + " «якщо фальшива, то важча» і " + s.l + " «якщо фальшива, то легша».") }));
        } else {
          narr.append(el("p", { html: "Усі <b>" + n + "</b> монет однакові на вигляд. Одна фальшива, і невідомо, важча чи легша. На розв'язок є <b>" + k + " " + weighWord(k) + "</b>. Дамблдор не знає, яка саме, тому діє так, щоб вистачило за будь-якого відгадування." }));
        }
        if (!result.fail && shown === result.steps.length) {
          narr.append(el("p", { class: "walk-end", html: "✨ Лишилась одна підозріла — монета <b>№" + (result.found + 1) + "</b>. Знайдено за <b>" + shown + " " + weighWord(shown) + "</b>." }));
        } else if (result.fail) {
          narr.append(el("p", { class: "walk-end", text: "За " + k + " " + weighWord(k) + " так не вийде." }));
        }
      }

      const finished = !result.fail && shown === result.steps.length && phase === 0;
      next.textContent = finished ? "Готово ✓" : phase === 0 ? "Покласти монети ▶" : "Подивитись, що показали терези ▶";
      next.disabled = finished || result.fail;
    }

    next.addEventListener("click", () => {
      if (phase === 0) {
        if (shown < result.steps.length) phase = 1;
      } else {
        shown += 1;
        phase = 0;
      }
      draw();
    });
    again.addEventListener("click", () => {
      shown = 0;
      phase = 0;
      draw();
    });
    const onPick = () => {
      const v = Math.min(n, Math.max(1, Math.round(Number(numberIn.value) || 1)));
      fake = v - 1;
      dir = dirSel.value === "light" ? -1 : 1;
      recompute();
    };
    numberIn.addEventListener("change", onPick);
    dirSel.addEventListener("change", onPick);

    root.append(picker, LEGEND, board, stage, narr, controls);
    recompute();
    return root;
  }

  return { plan, walk };
})();
