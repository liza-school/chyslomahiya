/* Кроки міркування: спроба, підказка, пояснення, друга задача. */
const FRACTIONQUEST = (function () {
  const el = COURSE.el;
  const heroes = { nami: "Намі", robin: "Робін", franky: "Френкі", usopp: "Усопп" };
  const fromHero = { ...heroes, usopp: "Усоппа" };

  function train(cfg, onDone) {
    let at = 0, stepAt = 0, notified = false;
    const completed = new Set();
    const root = el("div", { class: "sim fractionquest" });
    const stage = el("div", { class: "fq-stage" });
    const stat = el("div", { class: "sim-stat", "aria-live": "polite" });
    const tabs = el("div", { class: "fq-tabs", "aria-label": "Задачі тренажера" });
    const restart = el("button", { class: "ghost-btn", text: "Цю задачу спочатку ↺", onclick: () => { stepAt = 0; draw(); } });
    root.append(tabs, stat, stage, restart);

    cfg.cases.forEach((item, i) => tabs.append(el("button", {
      class: "ghost-btn", "data-case": i, text: (i + 1) + ". " + item.title,
      onclick: () => { at = i; stepAt = 0; draw(); },
    })));

    function draw() {
      const item = cfg.cases[at], step = item.steps[stepAt];
      const hero = step.hero || cfg.hero;
      root.dataset.case = at;
      root.dataset.step = stepAt;
      [...tabs.children].forEach((tab, i) => {
        tab.setAttribute("aria-pressed", String(i === at));
        tab.textContent = (completed.has(i) ? "✓ " : "") + (i + 1) + ". " + cfg.cases[i].title;
      });
      stat.textContent = "Задача " + (at + 1) + " з " + cfg.cases.length + " · крок " + (stepAt + 1) + " з " + item.steps.length;
      stage.replaceChildren();
      const title = el("h3", { class: "fq-heading", tabindex: "-1", text: heroes[hero] + ": " + item.title });
      stage.append(el("div", { class: "fq-guide" },
        el("div", { class: "fq-portrait fq-" + hero, role: "img", "aria-label": heroes[hero] + " з One Piece" }),
        el("div", {}, title, el("p", { text: item.scene }))));
      stage.append(el("p", { class: "fq-question", html: step.ask }));
      const controls = el("div", { class: "fq-controls" });
      const feedback = el("div", { class: "sim-verdict", "aria-live": "polite" });
      const next = el("button", { class: "btn", "data-act": "next", text: stepAt + 1 < item.steps.length ? "Наступний крок →" : "Завершити задачу ✓" });
      next.hidden = true;
      let passed = false;

      const hint = el("details", { class: "fq-hint" }, el("summary", { text: "Підказка від " + fromHero[hero] }), el("p", { html: step.hint }));
      const explanation = el("details", { class: "fq-explanation" }, el("summary", { text: "Розібрати цей крок" }), el("p", { html: step.explain }));

      function judge(ok, message) {
        if (passed) return;
        feedback.className = "sim-verdict " + (ok ? "ok" : "no");
        feedback.textContent = ok ? "Так. " + step.explain : message;
        if (ok) {
          passed = true;
          controls.querySelectorAll("button,input").forEach(node => { node.disabled = true; });
          next.hidden = false;
        }
      }

      if (step.terms) {
        const removed = new Set();
        let selected = null;
        const chips = el("div", { class: "fq-terms" });
        step.terms.forEach((den, i) => {
          const chip = el("button", { class: "ghost-btn fq-term", "data-term": i, "aria-pressed": "false", text: (den > 0 ? "+" : "−") + "1/" + Math.abs(den) });
          chip.addEventListener("click", () => {
            if (passed || removed.has(i)) return;
            if (selected === i) { selected = null; chip.setAttribute("aria-pressed", "false"); return; }
            if (selected === null) { selected = i; chip.setAttribute("aria-pressed", "true"); return; }
            const other = chips.children[selected];
            other.setAttribute("aria-pressed", "false");
            if (step.terms[selected] === -den) {
              removed.add(selected); removed.add(i);
              for (const node of [chip, other]) { node.disabled = true; node.classList.add("fq-cancelled"); }
              feedback.className = "sim-verdict";
              feedback.textContent = "Додали й відняли однакову частку: разом 0. Шукай наступну пару.";
              if (removed.size === step.terms.length - 2) judge(true);
            } else {
              judge(false, "Ці частки не дають нуль. Потрібні однакові знаменники й протилежні знаки.");
            }
            selected = null;
          });
          chips.append(chip);
        });
        controls.append(chips);
      } else if (step.choices) {
        step.choices.forEach((text, i) => controls.append(el("button", {
          class: "option", "data-choice": i, text,
          onclick: () => judge(i === step.answer, step.wrong[i]),
        })));
      } else {
        const field = el("input", { class: "answer-input", type: "text", "aria-label": "Відповідь на поточний крок", placeholder: "Наприклад, 3/8 або 2 1/5", autocomplete: "off" });
        const check = el("button", { class: "btn", "data-act": "check", text: "Перевірити ✓", onclick: () => {
          const value = field.value.trim().replace(/\s+/g, "").replace(/,/g, ".");
          judge(step.accept.some(answer => answer.replace(/\s+/g, "").replace(/,/g, ".") === value), value ? step.wrong : "Спершу впиши відповідь.");
        } });
        field.addEventListener("keydown", event => { if (event.key === "Enter") check.click(); });
        controls.append(field, check);
      }
      next.addEventListener("click", () => {
        if (!passed) return;
        if (stepAt + 1 < item.steps.length) {
          stepAt++; draw(); stage.querySelector(".fq-heading").focus({ preventScroll: true });
        } else {
          completed.add(at);
          if (completed.size === cfg.cases.length && !notified) { notified = true; onDone?.(); }
          next.hidden = true;
          feedback.textContent = completed.size === cfg.cases.length
            ? "Обидві задачі розв'язано. Спосіб у твоїй скрині! Можеш повторити будь-яку."
            : "Цю задачу розв'язано. Обери другу вкладку й перевір спосіб на іншій умові.";
          tabs.children[at].textContent = "✓ " + (at + 1) + ". " + item.title;
        }
      });
      stage.append(controls, hint, explanation, feedback, next);
    }
    draw();
    return root;
  }
  return { train };
})();
