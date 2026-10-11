// Заняття 4: спосіб Гаусса. Пари з двох кінців, відра пар, сходи «Джеміно», купки гир,
// поля відповіді й незалежна арифметика всіх задач сторінки 21.
module.exports = async function checkGauss({ evaluate, expect, go, call }) {
  const fs = require("fs"), path = require("path"), os = require("os");
  /* Задача 13 — без браузера: перебором переконуємось, що розвʼязок єдиний. */
  const T = (n) => (n * (n + 1)) / 2;
  const missed = [];
  for (let n = 1; n < 1000; n++) for (let m = 1; m <= n; m++) if (T(n) - m === 100) missed.push(n + "/" + m);
  expect("задача 13 має єдиний розвʼязок: від 1 до 14, пропущено 5", missed.join(",") === "14/5", missed.join(","));

  await go("#/l/l04");

  const math = await evaluate(`[
    GAUSS.sum(1, 1, 30), GAUSS.sum(1, 1, 50), GAUSS.sum(11, 1, 30), GAUSS.sum(2, 2, 49), GAUSS.sum(1, 1, 17), GAUSS.sum(5, 5, 10),
    GAUSS.sum(2, 2, 24), GAUSS.sum(5, 5, 12), 840 / GAUSS.sum(1, 1, 20), 1640 / GAUSS.sum(1, 1, 40),
    550 / GAUSS.sum(10, 10, 10) / 2, 4200 / GAUSS.sum(5, 5, 20) / 2,
    GAUSS.sum(1, 1, 2024) % 2025, GAUSS.sum(1, 1, 2026) % 2027, GAUSS.sum(1, 1, 2025) % 2026,
    GAUSS.sum(1, 2, 50), 2 * GAUSS.sum(1, 1, 12), GAUSS.sum(1, 1, 7), GAUSS.sum(1, 1, 10) % 2,
    GAUSS.count(11, 40, 1), GAUSS.count(2, 98, 2), GAUSS.count(5, 50, 5), GAUSS.count(21, 60, 1), GAUSS.count(3, 30, 3), GAUSS.count(4, 40, 4),
    GAUSS.ways([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 15), GAUSS.ways([1, 2, 3, 4, 5, 6, 7, 8], 2, 18),
    GAUSS.sum(3, 3, 11), GAUSS.sum(4, 4, 9), GAUSS.sum(1, 1, 21), GAUSS.sum(21, 1, 40), GAUSS.sum(1, 1, 15)
  ].join(",")`);
  expect(
    "відповіді сторінки 21 і понад підручник збігаються з простим додаванням",
    math === "465,1275,765,2450,153,275,600,390,4,2,0.5,2,0,0,1013,2500,156,28,1,30,49,10,40,10,10,9,7,198,180,231,1620,120",
    math
  );

  // Поле відповіді: хибне число не зараховує, правильне — так.
  const ANSWERS = { "1в": "765", "1г": "2450", "1є": "600", "1ж": "390", 2: "4", 3: "2", 4: "0,5", 5: "2", 9: "2500", 10: "156", 11: "28", 13: "5" };
  const answered = await evaluate(`(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    for (const [num, value] of Object.entries(${JSON.stringify(ANSWERS)})) {
      const task = document.querySelector('[data-problem="' + num + '"]');
      const box = task && task.querySelector('.answer-box');
      if (!box) { out.push(num + ':немає поля'); continue; }
      const field = box.querySelector('.answer-input');
      field.value = '1'; box.querySelector('.btn').click(); await pause(5);
      const wrong = box.querySelector('.verdict').className === 'verdict no' && !task.querySelector('.done-mark').textContent;
      field.value = value; box.querySelector('.btn').click(); await pause(5);
      const right = box.querySelector('.verdict').className === 'verdict ok' && task.querySelector('.done-mark').textContent === '✓';
      out.push(num + ':' + (wrong && right ? 'ok' : 'НІ'));
    }
    return out.join(' ');
  })()`);
  expect("поля відповіді приймають правильне число й не приймають хибне", !answered.includes("НІ") && !answered.includes("немає"), answered);

  // Підказка для № 8 відкривається першою свічкою, не розкриваючи готового розподілу.
  const apples = await evaluate(`(() => {
    const task = document.querySelector('[data-problem="8"]');
    task.querySelector('.candle').click();
    return task.querySelector('.hint-box').textContent.toLowerCase();
  })()`);
  expect("№ 8: перша підказка пояснює рівну вагу яблук для Сємі, Моніки й Ванільки",
    ["сємі", "моніки", "ванільки", "однакову загальну вагу", "кількість яблук може відрізнятися"].every(text => apples.includes(text)) && !apples.includes('45 г'), apples);

  // Будівництво використовує ті самі пари: нічого не дублюється, висоти доданків і сума зберігаються.
  const building = await evaluate(`(() => {
    const block = document.querySelector('[data-exercise="rainbow"]');
    const sim = block.querySelector('.pairs-sim');
    const range = sim.querySelector('.trainer-range');
    const click = (i, key) => sim.querySelector('.build-token[data-i="' + i + '"]').dispatchEvent(
      key ? new KeyboardEvent('keydown', { key, bubbles: true }) : new MouseEvent('click', { bubbles: true }));
    sim.querySelector('[data-building="true"]').click();
    const samples = [];
    for (const step of [1, 2, 5]) {
      range.value = '6'; range.dispatchEvent(new Event('input'));
      sim.querySelector('.kind-btn[data-step="' + step + '"]').click();
      click(0); click(1);
      const rejected = sim.querySelector('.sim-verdict').classList.contains('no') && !sim.querySelector('.build-tower');
      click(0, 'Enter'); click(5, ' '); click(1); click(4);
      sim.querySelector('.pair-magic').click();
      const towers = [...sim.querySelectorAll('.build-tower')].map((tower) => {
        const pieces = [...tower.querySelectorAll('.build-piece')];
        const values = pieces.map(piece => Number(piece.dataset.v));
        const heights = pieces.map(piece => Number(piece.querySelector('rect').getAttribute('height')));
        return { values, height: heights.reduce((a, b) => a + b, 0), unit: heights[0] / values[0] };
      });
      const moved = [...sim.querySelectorAll('.build-token.moved')].every(token => getComputedStyle(token.querySelector('.build-piece rect')).fill === 'none');
      samples.push({ step, rejected, towers, moved, remaining: sim.querySelectorAll('.build-token:not(.moved)').length });
    }
    range.value = '5'; range.dispatchEvent(new Event('input'));
    sim.querySelector('.kind-btn[data-step="2"]').click();
    const reset = !sim.querySelector('.build-tower') && !sim.querySelector('.pair-sum input');
    click(0); click(4); click(1); click(3);
    const lone = sim.querySelector('.build-tower.lonely .build-piece');
    const fields = sim.querySelectorAll('.pair-sum input');
    fields[0].value = '2'; fields[1].value = '24'; sim.querySelector('.pair-sum .btn').click();
    const forgot = sim.querySelector('.sim-verdict').textContent;
    fields[1].value = '30';
    sim.querySelector('[data-building="false"]').click();
    const preserved = [...sim.querySelectorAll('.pair-sum input')].map(f => f.value).join(',') === '2,30' && sim.querySelectorAll('.pbucket').length === 3;
    sim.querySelector('[data-building="true"]').click();
    const back = [...sim.querySelectorAll('.pair-sum input')].map(f => f.value).join(',') === '2,30' && sim.querySelectorAll('.build-tower').length === 3 && sim.querySelector('[data-building="true"]').getAttribute('aria-pressed') === 'true';
    return { samples, reset, middle: lone.dataset.v, halfHeight: Number(lone.querySelector('rect').getAttribute('height')), forgot, preserved, back, done: block.querySelector('.done-mark').textContent };
  })()`);
  expect("будівництво: кроки 1/2/5, клавіатура, лише крайні пари, три рівні вежі без зайвих кубиків",
    building.samples.every(sample => sample.rejected && sample.moved && sample.remaining === 0 && sample.towers.length === 3 &&
      sample.towers.every(tower => tower.values[0] + tower.values[1] === 7 * sample.step && Math.abs(tower.height - 140) < 0.001 && Math.abs(tower.unit - 20 / sample.step) < 0.001)), JSON.stringify(building.samples));
  expect("будівництво: середнє без пари, скидання, перемикання зі збереженням відповіді; перегляд не зараховується",
    building.reset && building.middle === '6' && building.halfHeight === 70 && building.forgot.includes('число без пари — 6') && building.preserved && building.back && building.done === '', JSON.stringify(building));

  await evaluate(`(() => {
    const sim = document.querySelector('[data-exercise="rainbow"] .pairs-sim');
    const range = sim.querySelector('.trainer-range'); range.value = '10'; range.dispatchEvent(new Event('input'));
    sim.querySelector('.kind-btn[data-step="1"]').click();
    for (const i of [0, 9, 1, 8]) sim.querySelector('.build-token[data-i="' + i + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  })()`);
  for (const [name, width] of [["partial", 1366], ["desktop", 1366], ["tablet", 820], ["phone", 390]]) {
    if (name === "desktop") await evaluate("document.querySelector('[data-exercise=\"rainbow\"] .pair-magic').click()");
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1600, deviceScaleFactor: 1, mobile: false });
    await evaluate(name === "phone" ?
      "document.querySelector('[data-exercise=\"rainbow\"] .pair-views').scrollIntoView({ block: 'start' }); window.scrollBy(0, -120)" :
      "document.querySelector('[data-exercise=\"rainbow\"]').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70)");
    const layout = await evaluate(`({ page: document.documentElement.scrollWidth, width: document.documentElement.clientWidth,
      towers: [...document.querySelectorAll('[data-exercise="rainbow"] .build-tower')].map(t => t.querySelector('.build-label.strong').textContent).join(',') })`);
    expect("вежі Гаусса читаються без виходу за сторінку, " + name + " " + width + " px", layout.page <= layout.width + 1 && layout.towers === (name === "partial" ? "11,11" : "11,11,11,11,11"), JSON.stringify(layout));
    const shot = await call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(os.tmpdir(), "chys-building-" + name + ".png"), Buffer.from(shot.data, "base64"));
  }
  await call("Emulation.clearDeviceMetricsOverride");
  await evaluate(`(() => {
    const sim = document.querySelector('[data-exercise="rainbow"] .pairs-sim');
    sim.querySelector('[data-building="false"]').click();
    sim.querySelector('.ghost-btn').click();
  })()`);

  // Пісочниця пар: не дзеркальна пара відхиляється, дзеркальна дає арку й відро, закляття складає решту.
  const rainbow = JSON.parse(await evaluate(`(async () => {
    const block = document.querySelector('[data-exercise="rainbow"]');
    const sim = block.querySelector('.pairs-sim');
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const click = async (i) => { sim.querySelector('.tok[data-i="' + i + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); await pause(5); };
    await click(0); await click(1);
    const rejected = sim.querySelector('.sim-verdict').classList.contains('no') && sim.querySelectorAll('.arc').length === 0;
    await click(0); await click(9);
    const first = [...sim.querySelectorAll('.arc-sum')].map((t) => t.textContent).join(',') + '|' + sim.querySelectorAll('.pbucket').length;
    const magicBefore = sim.querySelector('.pair-magic').hidden;
    await click(8); await click(1);
    const magicAfter = !sim.querySelector('.pair-magic').hidden;
    sim.querySelector('.pair-magic').click(); await pause(10);
    const sums = [...sim.querySelectorAll('.arc-sum')].map((t) => t.textContent).join(',');
    const buckets = [...sim.querySelectorAll('.pbucket')].map((b) => b.querySelector('.pb-num.lo').textContent + '+' + b.querySelector('.pb-num.hi').textContent).join(' ');
    const fields = sim.querySelectorAll('.pair-sum .mini-input');
    fields[0].value = '5'; fields[1].value = '50'; sim.querySelector('.pair-sum .btn').click(); await pause(5);
    const wrong = sim.querySelector('.sim-verdict').className;
    fields[1].value = '55'; sim.querySelector('.pair-sum .btn').click(); await pause(5);
    return JSON.stringify({ rejected, first, magicBefore, magicAfter, sums, buckets, wrong,
      verdict: sim.querySelector('.sim-verdict').textContent, done: block.querySelector('.done-mark').textContent });
  })()`));
  expect(
    "веселка пар: чужа пара відхиляється, крайня дає арку 11 і відро, після двох пар зʼявляється закляття",
    rainbow.rejected && rainbow.first === "11|1" && rainbow.magicBefore && rainbow.magicAfter,
    JSON.stringify(rainbow).slice(0, 200)
  );
  expect(
    "закляття складає решту пар, а сума 5 · 11 = 55 зараховується лише правильна",
    rainbow.sums === "11,11,11,11,11" && rainbow.buckets === "1+10 2+9 3+8 4+7 5+6" && rainbow.wrong.includes("no") &&
      rainbow.verdict.startsWith("Готово! 5 · 11 = 55") && rainbow.done === "✓",
    JSON.stringify(rainbow).slice(0, 260)
  );

  // Повзунок і крок перебудовують ряд.
  const controls = await evaluate(`(async () => {
    const sim = document.querySelector('[data-exercise="rainbow"] .pairs-sim');
    const range = sim.querySelector('.trainer-range'); range.value = '7'; range.dispatchEvent(new Event('input'));
    sim.querySelector('.kind-btn[data-step="5"]').click(); await new Promise((r) => setTimeout(r, 10));
    return [...sim.querySelectorAll('.tok text')].map((t) => t.textContent).join(',') + '|' + sim.querySelectorAll('.pbucket').length;
  })()`);
  expect("повзунок і крок перебудовують ряд: 5, 10, …, 35", controls === "5,10,15,20,25,30,35|0", controls);

  // Домашня 1д: 17 чисел, 9 лишається без пари й наливає пів відра; 144 — це лише повні відра.
  const odd = JSON.parse(await evaluate(`(async () => {
    const task = document.querySelector('[data-problem="1д"]');
    const sim = task.querySelector('.pairs-sim');
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const click = async (i) => { sim.querySelector('.tok[data-i="' + i + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); await pause(5); };
    await click(8); await click(3);
    const middle = sim.querySelector('.sim-verdict').textContent;
    await click(0); await click(16); await click(1); await click(15);
    sim.querySelector('.pair-magic').click(); await pause(10);
    const lonely = [...sim.querySelectorAll('.tok.lonely text')].map((t) => t.textContent).join(',');
    const half = sim.querySelector('.pbucket.lonely');
    const halfFill = half ? half.querySelector('.pb-low').style.height : '';
    const fields = sim.querySelectorAll('.pair-sum .mini-input');
    fields[0].value = '8'; fields[1].value = '144'; sim.querySelector('.pair-sum .btn').click(); await pause(5);
    const forgot = sim.querySelector('.sim-verdict').textContent;
    fields[1].value = '153'; sim.querySelector('.pair-sum .btn').click(); await pause(5);
    return JSON.stringify({ middle, lonely, halfFill, forgot, verdict: sim.querySelector('.sim-verdict').textContent,
      buckets: sim.querySelectorAll('.pbucket:not(.lonely)').length, done: task.querySelector('.done-mark').textContent });
  })()`));
  expect(
    "1д: середнє 9 без пари світиться й наливає пів відра, 144 не приймається, 153 — так",
    odd.middle.includes("посередині") && odd.lonely === "9" && odd.halfFill === "50%" && odd.forgot.includes("пів відра") &&
      odd.verdict.startsWith("Готово! 8 · 18 + 9 = 153") && odd.buckets === 8 && odd.done === "✓",
    JSON.stringify(odd).slice(0, 260)
  );

  // Сто чисел: довгий ряд кнопками, 50 однакових відер по 101.
  const hundred = JSON.parse(await evaluate(`(async () => {
    const block = document.querySelector('[data-exercise="hundred"]');
    const sim = block.querySelector('.pairs-sim');
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const click = async (i) => { sim.querySelector('.pchip[data-i="' + i + '"]').click(); await pause(5); };
    const chips = sim.querySelectorAll('.pchip').length;
    await click(0); await click(99); await click(98); await click(1);
    sim.querySelector('.pair-magic').click(); await pause(10);
    const sums = new Set([...sim.querySelectorAll('.pb-sum')].map((s) => s.textContent));
    const fields = sim.querySelectorAll('.pair-sum .mini-input');
    fields[0].value = '50'; fields[1].value = '5050'; sim.querySelector('.pair-sum .btn').click(); await pause(5);
    return JSON.stringify({ chips, buckets: sim.querySelectorAll('.pbucket').length, sums: [...sums].join(','),
      small: sim.querySelector('.pair-shelf').classList.contains('small'), done: block.querySelector('.done-mark').textContent });
  })()`));
  expect(
    "сто чисел: 100 кнопок, 50 відер по 101, сума 5050 зараховується",
    hundred.chips === 100 && hundred.buckets === 50 && hundred.sums === "= 101" && hundred.small && hundred.done === "✓",
    JSON.stringify(hundred)
  );

  // Розминка «Зручні пари»: лише круглі суми, закляття немає, разом 300.
  const round = JSON.parse(await evaluate(`(async () => {
    const block = document.querySelector('[data-exercise="round"]');
    const sim = block.querySelector('.pairs-sim');
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const click = async (i) => { sim.querySelector('.tok[data-i="' + i + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); await pause(5); };
    await click(0); await click(2);
    const bad = sim.querySelector('.sim-verdict').textContent;
    await click(0); await click(4); await click(1); await click(3);
    const magic = sim.querySelector('.pair-magic').hidden;
    await click(2); await click(5);
    const field = sim.querySelector('.pair-sum .mini-input');
    field.value = '300'; sim.querySelector('.pair-sum .btn').click(); await pause(5);
    return JSON.stringify({ bad, magic, lows: [...sim.querySelectorAll('.pb-num.lo')].map((n) => n.textContent).join(','),
      verdict: sim.querySelector('.sim-verdict').textContent, done: block.querySelector('.done-mark').textContent });
  })()`));
  expect(
    "зручні пари: 27 + 46 не кругле, три пари по 100, разом 300",
    round.bad.startsWith("27 + 46 = 73 — не кругле") && round.magic && round.lows === "27,25,46" &&
      round.verdict.startsWith("Готово! 100 + 100 + 100 = 300") && round.done === "✓",
    JSON.stringify(round)
  );

  // Ряд → стовпчики: крок додає відповідну кількість кубиків у висоту, перегляд нічого не зараховує.
  const growth = await evaluate(`(() => {
    const block = document.querySelector('[data-exercise="stairs"]');
    const sim = block.querySelector('.stairs-sim');
    const samples = [];
    for (const step of [1, 2, 5]) {
      sim.querySelector('.kind-btn[data-step="' + step + '"]').click();
      const range = sim.querySelector('.trainer-range');
      range.value = '4'; range.dispatchEvent(new Event('input'));
      const columns = [...sim.querySelectorAll('.gold .st-col')];
      columns[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const unit = Number(columns[0].getAttribute('height')) / step;
      samples.push({ step, numbers: columns.map(c => Number(c.dataset.v)),
        added: Number(sim.querySelector('.st-rise').getAttribute('height')) / unit,
        text: sim.querySelector('.stairs-height-text').textContent,
        selected: columns[2].getAttribute('aria-pressed') });
    }
    const first = sim.querySelector('.gold .st-col');
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const keyboard = first.getAttribute('aria-pressed') === 'true' && sim.querySelector('.stairs-height-text').textContent.includes('Перший стовпчик має 5');
    const done = block.querySelector('.done-mark').textContent;
    return { samples, keyboard, done };
  })()`);
  expect("кроки +1/+2/+5 змінюють числа, пояснення й кількість підсвічених кубиків",
    growth.samples.every(s => s.numbers.join(',') === [s.step, 2*s.step, 3*s.step, 4*s.step].join(',') &&
      Math.abs(s.added - s.step) < 0.0001 && s.text.includes('Крок: ' + 3*s.step + ' − ' + 2*s.step + ' = ' + s.step) && s.selected === 'true'), JSON.stringify(growth));
  expect("висоту можна обрати клавіатурою; перегляд не зараховує сходи", growth.keyboard && growth.done === "", JSON.stringify(growth));

  await evaluate(`(() => {
    const sim = document.querySelector('[data-exercise="stairs"] .stairs-sim');
    sim.querySelector('.kind-btn[data-step="2"]').click();
    sim.querySelectorAll('.gold .st-col')[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  })()`);
  await call("Emulation.setDeviceMetricsOverride", { width: 1366, height: 1400, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('[data-exercise=\"stairs\"]').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80)");
  for (const [name, fitted, width] of [["growth", false, 1366], ["rectangle", true, 1366], ["tablet", true, 820]]) {
    if (fitted && name === "rectangle") {
      await evaluate(`(() => {
        const sim = document.querySelector('[data-exercise="stairs"] .stairs-sim');
        sim.querySelectorAll('.toolbar .btn')[0].click();
        sim.querySelectorAll('.toolbar .btn')[1].click();
      })()`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1400, deviceScaleFactor: 1, mobile: false });
    await evaluate("document.querySelector('[data-exercise=\"stairs\"]').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80)");
    const shot = await call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(os.tmpdir(), "chys-stairs-" + name + ".png"), Buffer.from(shot.data, "base64"));
  }
  await call("Emulation.clearDeviceMetricsOverride");
  const fittedGrowth = await evaluate(`(() => {
    const sim = document.querySelector('[data-exercise="stairs"] .stairs-sim');
    return { text: sim.querySelector('.stairs-height-text').textContent,
      tip: sim.querySelector('.stairs-height-tip').textContent,
      viewBox: sim.querySelector('.stairs-svg').getAttribute('viewBox'),
      outline: Number(sim.querySelector('.st-height-outline').getAttribute('height')) };
  })()`);
  expect("після перевороту вибрані висоти 6 і 4 дають 10, приріст +2 компенсується зменшенням на 2",
    fittedGrowth.text.includes("6 + 4 = 10") && fittedGrowth.tip.includes("росте на 2") && fittedGrowth.tip.includes("меншає на 2") &&
      fittedGrowth.viewBox === "0 0 430 302" && fittedGrowth.outline === 240, JSON.stringify(fittedGrowth));
  await evaluate(`(() => {
    const sim = document.querySelector('[data-exercise="stairs"] .stairs-sim');
    sim.querySelector('.kind-btn[data-step="1"]').click();
    const range = sim.querySelector('.trainer-range'); range.value = '6'; range.dispatchEvent(new Event('input'));
  })()`);

  // Сходи «Джеміно»: копія, переворот, прямокутник; кожен стовпчик разом із перевернутою копією — повна висота.
  const stairs = JSON.parse(await evaluate(`(async () => {
    const block = document.querySelector('[data-exercise="stairs"]');
    const sim = block.querySelector('.stairs-sim');
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const [gem, flip] = sim.querySelectorAll('.toolbar .btn');
    const flipLocked = flip.disabled;
    gem.click(); await pause(10);
    const copyShown = !sim.querySelector('.st-copy').classList.contains('hidden');
    flip.click(); await pause(10);
    const gold = [...sim.querySelectorAll('.st-stairs.gold .st-col')].map((r) => Number(r.getAttribute('height')));
    const blue = [...sim.querySelectorAll('.st-copy .st-col')].map((r) => Number(r.getAttribute('height')));
    const columns = gold.map((h, i) => Math.round(h + blue[blue.length - 1 - i])).join(',');
    const field = sim.querySelector('.pair-sum .mini-input');
    field.value = '42'; sim.querySelector('.pair-sum .btn').click(); await pause(5);
    const whole = sim.querySelector('.sim-verdict').textContent;
    field.value = '21'; sim.querySelector('.pair-sum .btn').click(); await pause(5);
    const result = { flipLocked, copyShown, fitted: sim.classList.contains('fitted'), turn: sim.querySelector('.st-copy').style.transform,
      columns, whole, verdict: sim.querySelector('.sim-verdict').textContent, done: block.querySelector('.done-mark').textContent };
    const range = sim.querySelector('.trainer-range'); range.value = '7'; range.dispatchEvent(new Event('input')); await pause(5);
    sim.querySelectorAll('.toolbar .btn')[0].click(); sim.querySelectorAll('.toolbar .btn')[1].click(); await pause(5);
    result.odd = sim.querySelector('.sim-verdict').textContent;
    return JSON.stringify(result);
  })()`));
  expect(
    "сходи: Джеміно копіює, переворот складає прямокутник, де кожен стовпчик однаково високий",
    stairs.flipLocked && stairs.copyShown && stairs.fitted && stairs.turn.includes("rotate(180deg)") &&
      stairs.columns === "240,240,240,240,240,240",
    JSON.stringify(stairs).slice(0, 240)
  );
  expect(
    "сходи: увесь прямокутник 42 не приймається, половина 21 — так; непарна кількість теж складається",
    stairs.whole.includes("весь прямокутник") && stairs.verdict.startsWith("Так! Прямокутник 6 · 7 = 42") &&
      stairs.done === "✓" && stairs.odd.includes("непарна"),
    JSON.stringify(stairs).slice(200, 520)
  );

  const norbert = await evaluate(`(async () => {
    const task = document.querySelector('[data-problem="1е"]'); const sim = task.querySelector('.stairs-sim');
    const [gem, flip] = sim.querySelectorAll('.toolbar .btn'); gem.click(); flip.click();
    const field = sim.querySelector('.pair-sum .mini-input'); field.value = '275';
    sim.querySelector('.pair-sum .btn').click(); await new Promise((r) => setTimeout(r, 5));
    return sim.querySelector('.sim-verdict').textContent + '|' + task.querySelector('.done-mark').textContent;
  })()`);
  expect("1е: сходи 5, 10, …, 50 складаються в прямокутник 10 · 55, половина 275", norbert.startsWith("Так! Прямокутник 10 · 55 = 550, а сходи — рівно половина: 275.") && norbert.endsWith("|✓"), norbert);

  // Купки гир: мета 15 г, один спосіб зараховується, повтор помічено; для восьми гир — 7 способів.
  const piles = JSON.parse(await evaluate(`(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const play = async (num, groups) => {
      const task = document.querySelector('[data-problem="' + num + '"]'); const sim = task.querySelector('.piles-sim');
      for (let j = 0; j < groups.length; j++) {
        sim.querySelector('.bin[data-bin="' + j + '"]').click(); await pause(3);
        for (const w of groups[j]) { sim.querySelector('.piles-shelf .weight[data-w="' + w + '"]').click(); await pause(3); }
      }
      return { task, sim };
    };
    const { task, sim } = await play(8, [[1, 2, 3, 4, 5], [6, 9], [7, 8]]);
    const first = sim.querySelector('.sim-verdict').textContent + '|' + sim.querySelector('.sim-stat').textContent + '|' + task.querySelector('.done-mark').textContent;
    sim.querySelector('.toolbar .ghost-btn').click(); await pause(3);
    await play(8, [[7, 8], [1, 2, 3, 4, 5], [6, 9]]);
    const again = sim.querySelector('.sim-verdict').textContent;
    const goal = sim.querySelector('.piles-goal');
    goal.querySelector('.mini-input').value = '14'; goal.querySelector('.btn').click(); await pause(3);
    const goalWrong = sim.querySelector('.sim-verdict').className;
    goal.querySelector('.mini-input').value = '15'; goal.querySelector('.btn').click(); await pause(3);
    const goalText = sim.querySelector('.piles-goal').textContent;
    const scales = await play(12, [[1, 8, 2, 7], [3, 6, 4, 5]]);
    return JSON.stringify({ first, again, goalWrong, goalText,
      scales: scales.sim.querySelector('.sim-stat').textContent + '|' + scales.task.querySelector('.done-mark').textContent });
  })()`));
  expect(
    "купки гир: 1+2+3+4+5 | 6+9 | 7+8 зараховується як 1 з 9, повтор упізнається",
    piles.first.startsWith("Рівно!") && piles.first.includes("|Знайдено способів: 1 з 9|✓") && piles.again.includes("уже був"),
    JSON.stringify(piles).slice(0, 220)
  );
  expect(
    "купки гир: мету 15 г треба порахувати; восьма гиря на двох шальках — 1 з 7",
    piles.goalWrong.includes("no") && piles.goalText.includes("по 15 г") && piles.scales === "Знайдено способів: 1 з 7|✓",
    JSON.stringify(piles).slice(150, 420)
  );

  // Домашнє, друкарські помилки, малюнки.
  const shape = JSON.parse(await evaluate(`JSON.stringify({
    listed: [...document.querySelectorAll('.block.homework .hw-num')].map((n) => n.textContent).join(','),
    marked: [...document.querySelectorAll('.block.problem.homework-task')].map((p) => p.getAttribute('data-problem')).join(','),
    badges: [...document.querySelectorAll('.block.problem .hw-badge')].map((b) => b.textContent).join(','),
    typos: ['2', '3'].map((n) => document.querySelector('[data-problem="' + n + '"]').textContent.includes('друкарська помилка')).join(','),
    rows: document.querySelectorAll('.gauss-rows').length,
    fences: [...document.querySelectorAll('.fence')].map((f) => f.querySelectorAll('.post').length).join(','),
    square: document.querySelectorAll('.odd-square .sq').length,
    figure: document.querySelectorAll('.stairs-svg.figure-only').length,
    seesaws: [...document.querySelectorAll('.seesaw')].map((g) => g.querySelectorAll('.ball').length + ':' + [...g.querySelectorAll('.arc-sum')].map((t) => t.textContent).join('/') + ':' + [...g.querySelectorAll('.ball.mid')].map((b) => b.nextElementSibling.textContent).join('')).join(' '),
    grow: [...document.querySelectorAll('.sq-grow')].map((g) => g.querySelectorAll('.cell').length + '/' + g.querySelectorAll('.cell.new').length).join(','),
    sums: [GAUSS.sum(1, 1, 10), GAUSS.sum(1, 1, 9), GAUSS.sum(1, 2, 4)].join(','),
    problems: [...document.querySelectorAll('.block.problem')].map((p) => p.getAttribute('data-problem')).join(','),
    strayText: [...document.querySelectorAll('.sim.gauss')].filter((sim) => [...sim.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).length,
  })`));
  expect("у симуляторах немає зайвого тексту на кшталт «null»", shape.strayText === 0, String(shape.strayText));
  expect(
    "домашнє l04: 1б, 1д, 1е, 3, 7 і 8 для бажаючих",
    shape.listed === "1б,1д,1е,3,7,8" && shape.marked === "1б,1д,1е,3,7,8" && shape.badges === "домашнє,домашнє,домашнє,домашнє,домашнє,для бажаючих",
    shape.listed + " | " + shape.marked + " | " + shape.badges
  );
  expect("у задачах 2 і 3 сказано про друкарську помилку підручника", shape.typos === "true,true", shape.typos);
  expect(
    "нумерація підручника збережена: 1а–1ж, 2–8, понад підручник 9–13",
    shape.problems === "1а,1б,1в,1г,1д,1е,1є,1ж,2,3,4,5,6,7,8,9,10,11,12,13",
    shape.problems
  );
  expect(
    "малюнки на місці: два рядки Гаусса, паркани на 6 і 10 стовпчиків, квадрат 8 × 8, прямокутник зі сходів",
    shape.rows === 7 && shape.fences === "6,10" && shape.square === 64 && shape.figure === 1,
    JSON.stringify(shape).slice(0, 200)
  );

  // Міст до курсу Пайтону: блок із кодом і питання про індекс з нуля (10 — пастка, 9 — правильно).
  const python = await evaluate(`(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const bridge = document.querySelector('.block.python');
    const code = bridge && bridge.querySelector('pre.py');
    const box = [...document.querySelectorAll('.block')].find((b) => b.textContent.includes('індекс') && b.textContent.includes('у числа 40'));
    if (!code || !box) return 'немає';
    const field = box.querySelector('.answer-input');
    field.value = '10'; box.querySelector('.btn').click(); await pause(5);
    const wrong = box.querySelector('.verdict').className;
    field.value = 'nums[-1]'; box.querySelector('.btn').click(); await pause(5);
    return [bridge.querySelector('.tag').textContent, code.textContent.includes('nums[9]'), wrong, box.querySelector('.verdict').className].join('|');
  })()`);
  expect(
    "міст до Пайтону: список з нуля, індекс 40 — 9 (або -1), а не 10",
    python === "з Пайтону|true|verdict no|verdict ok",
    python
  );

  expect(
    "гойдалки на початку: 10 чисел — пʼять пар по 11; 9 чисел — чотири пари по 10, а 5 на опорі",
    shape.seesaws === "10:11/11/11/11/11: 9:10/10/10/10:5" && shape.sums === "55,45,16",
    shape.seesaws + " | " + shape.sums
  );
  expect("квадрат росте кутиками: 1 + 4 + 9 + 16 клітинок, нових 1 + 3 + 5 + 7", shape.grow === "30/16", shape.grow);

  const progress = await evaluate("localStorage.getItem('chyslomahiya.v1') || ''");
  expect(
    "заняття 4 пише власний прогрес і не чіпає інших",
    ["l04:rainbow", "l04:hundred", "l04:round", "l04:stairs", "l04:p1d", "l04:p8", "l04:p12"].every((k) => progress.includes('"' + k + '"')) && progress.includes('"l03:'),
    progress.slice(0, 120)
  );
};
