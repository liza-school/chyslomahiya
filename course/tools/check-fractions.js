// Заняття 5: скорочення, факторіал, Евклід. Відповіді задач рахуємо тут окремо, без жодних формул із уроку.
module.exports = async function checkFractions({ evaluate, expect, go }) {
  const gcdB = (a, b) => (b ? gcdB(b, a % b) : a);
  const fact = (n) => (n <= 1n ? 1n : n * fact(n - 1n));
  const red = (n, d) => {
    const g = gcdB(BigInt(n), BigInt(d));
    return BigInt(n) / g + "/" + BigInt(d) / g;
  };
  const add = (first, step, count) => {
    let sum = 0;
    for (let i = 0; i < count; i++) sum += first + i * step;
    return sum;
  };
  const prod = (list) => list.reduce((a, b) => a * BigInt(b), 1n);

  /* Те, що задано в підручнику, переписане «сирими» числами. */
  const EXPECT = {
    "1.2": red(4, 8), "1.4": red(9, 72), "1.6": red(14, 35), "1.8": red(20, 50), "1.10": red(13, 65),
    "1.12": red(56, 72), "1.14": red(24, 72), "1.16": red(65, 143),
    "2.2": red(prod([8, 27]), prod([9, 24])), "2.4": red(prod([64, 72]), prod([36, 108])),
    "2.6": red(prod([18, 36]), prod([12, 27])), "2.8": red(prod([49, 81]), prod([18, 21])),
    "3.2": red(12, 60), "4.2": red(18, 60), "5.2": red(15, 90), "6.2": red(45, 180),
    "7.2": red(11 + 1, 24), "7.4": red(17 - 7, 20),
    "8.2": red(fact(4n), fact(7n)), "8.6": red(fact(4n) * fact(9n), fact(5n) * fact(8n)),
    "п1": red(add(1, 1, 10), add(1, 1, 20)), "п2": red(18, 30), "п3": red(9, 27), "п4": red(add(1, 1, 10), add(3, 3, 10)),
    "9.1": red(559, 767), "9.2": red(1757, 1799), "9.3": red(2159, 4471), "9.4": red(3401, 4237), "9.5": red(3379, 4619), "9.6": red(737, 803),
  };

  /* Дві задачі понад підручник: перебір. */
  let twelfths = 0;
  for (let n = 1; n < 12; n++) if (gcdB(n, 12) === 1) twelfths++;
  let nVal = 0;
  for (let n = 2; n < 40; n++) if (fact(BigInt(n)) / fact(BigInt(n - 2)) === 90n) nVal = n;
  expect("задачі понад підручник: 4 нескоротні дванадцяті, n = 10", twelfths === 4 && nVal === 10, twelfths + "/" + nVal);

  await go("#/l/l05");

  const result = await evaluate(`(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const expected = ${JSON.stringify(EXPECT)};
    const out = [];
    for (const [num, raw] of Object.entries(expected)) {
      const task = document.querySelector('[data-problem="' + num + '"]');
      const box = task && task.querySelector('.answer-box');
      if (!box) { out.push(num + ':немає поля'); continue; }
      const field = box.querySelector('.answer-input');
      field.value = '999'; box.querySelector('.btn').click(); await pause(5);
      if (task.querySelector('.done-mark').textContent) out.push(num + ':хибна відповідь зарахована');
      field.value = raw.endsWith('/1') ? raw.slice(0, -2) : raw; box.querySelector('.btn').click(); await pause(5);
      if (!task.querySelector('.done-mark').textContent) out.push(num + ':' + raw + ' не прийнято');
    }
    return out.join(' | ');
  })()`);
  expect("усі " + Object.keys(EXPECT).length + " відповідей збігаються з незалежним підрахунком", result === "", result);

  const extras = await evaluate(`(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    for (const [num, value] of [["10", "4"], ["11", "10"]]) {
      const task = document.querySelector('[data-problem="' + num + '"]');
      const box = task && task.querySelector('.answer-box');
      if (!box) { out.push(num + ':немає поля'); continue; }
      box.querySelector('.answer-input').value = value; box.querySelector('.btn').click(); await pause(5);
      if (!task.querySelector('.done-mark').textContent) out.push(num + ' не прийнято');
    }
    return out.join(' | ');
  })()`);
  expect("задачі 10 і 11 приймають правильні відповіді", extras === "", extras);

  /* Закляття скорочення: пісочниця. */
  /* Пісочниця: дільник 3 зі свіжого стану дає 4/6. */
  const by3 = await evaluate(`(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const block = document.querySelector('[data-exercise="sim-play"]');
    const k = () => Number(block.querySelector('.frac-k').textContent);
    while (k() < 3) block.querySelector('[data-act="more"]').click();
    block.querySelector('[data-act="cut"]').click(); await pause(5);
    const out = block.querySelector('.frac-now').textContent + '/' + block.querySelectorAll('.frac-cell').length + '/' + block.querySelectorAll('.frac-cell.on').length;
    block.querySelector('.frac-controls > .ghost-btn:last-child').click(); await pause(5);
    while (k() > 2) block.querySelector('[data-act="less"]').click();
    return out + '|' + block.querySelector('.frac-now').textContent;
  })()`);
  expect("пісочниця: 12/18 ÷ 3 = 4/6, а «Спочатку» повертає 12/18", by3 === "4/6/6/4|12/18", by3);

  const play = await evaluate(`(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const block = document.querySelector('[data-exercise="sim-play"]');
    const act = (a) => block.querySelector('[data-act="' + a + '"]').click();
    const now = () => block.querySelector('.frac-now').textContent;
    const cells = () => block.querySelectorAll('.frac-cell').length;
    const start = now() + '/' + cells();
    for (let i = 0; i < 4; i++) act('more');
    act('cut'); await pause(5);
    const afterCut = now() + '/' + cells();
    const doneEarly = block.querySelector('.done-mark').textContent;
    for (let i = 0; i < 4; i++) act('less');
    act('mul'); await pause(5);
    return { start, afterCut, doneEarly, afterMul: now() + '/' + cells(), done: block.querySelector('.done-mark').textContent };
  })()`);
  expect("пісочниця: 12/18 ÷ 6 = 2/3, × 2 = 4/6, зараховано лише після обох дій",
    play.start === "12/18/18" && play.afterCut === "2/3/3" && play.doneEarly === "" && play.afterMul === "4/6/6" && play.done === "✓", JSON.stringify(play));

  /* Скорочення до кінця. */
  const cutBlock = await evaluate(`(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const block = document.querySelector('[data-exercise="sim-cut"]');
    const act = (a) => block.querySelector('[data-act="' + a + '"]').click();
    const say = () => block.querySelector('.sim-verdict').textContent;
    const now = () => block.querySelector('.frac-now').textContent;
    const k = () => Number(block.querySelector('.frac-k').textContent);
    const to = (want) => { while (k() < want) act('more'); while (k() > want) act('less'); };
    const log = [];
    to(7); act('cut'); log.push(now());
    to(5); act('cut'); log.push(now());
    to(6); act('cut'); const mid = now(); const doneMid = block.querySelector('.done-mark').textContent;
    to(2); act('cut'); const last = now() + '|' + block.querySelector('.done-mark').textContent;
    to(1); act('cut'); const one = say();
    return { log, mid, doneMid, last, one };
  })()`);
  expect("36/60: ÷7 і ÷5 відхилені без зміни, ÷6 дає 6/10, зараховано ще не одразу",
    cutBlock.log.join(",") === "36/60,36/60" && cutBlock.mid === "6/10" && cutBlock.doneMid === "", JSON.stringify(cutBlock));
  expect("36/60: 6/10 ÷ 2 = 3/5, нескоротний дріб зараховується; ÷1 нічого не змінює",
    cutBlock.last === "3/5|✓" && cutBlock.one.includes("1"), JSON.stringify(cutBlock));

  /* Евклід 48 × 18. */
  const eu = await evaluate(`(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const block = document.querySelector('[data-exercise="sim-euclid"]');
    const act = (a) => block.querySelector('[data-act="' + a + '"]').click();
    const lines = () => [...block.querySelectorAll('.euclid-line')].map((l) => l.textContent);
    act('one'); await pause(5);
    const first = lines().join('|');
    act('all'); act('all'); act('all'); await pause(5);
    const full = lines().join('|');
    const input = block.querySelector('.mini-input.wide');
    const asked = Boolean(input);
    input.value = '3'; block.querySelector('.pair-sum .btn').click(); await pause(5);
    const wrong = !block.querySelector('.done-mark').textContent;
    input.value = '6'; block.querySelector('.pair-sum .btn').click(); await pause(5);
    return { first, full, asked, wrong, done: block.querySelector('.done-mark').textContent };
  })()`);
  expect("Евклід 48 × 18: 48 = 18·2+12, 18 = 12·1+6, 12 = 6·2+0; відповідь 6 після помилки 3",
    eu.first === "48 = 18 · 1 + …" && eu.full === "48 = 18 · 2 + 12|18 = 12 · 1 + 6|12 = 6 · 2 + 0" && eu.asked && eu.wrong && eu.done === "✓", JSON.stringify(eu));

  /* Приклад 6 із підручника. */
  const book = await evaluate("FRAC.division(2147, 1577).map(r => r.join(',')).join(' ')");
  const g = await evaluate("FRAC.gcd(2147, 1577)");
  expect("приклад 6: шість рядків ділень збігаються з підручником (НСД 19)",
    book === "2147,1577,1,570 1577,570,2,437 570,437,1,133 437,133,3,38 133,38,3,19 38,19,2,0" && g === 19, book);
};
