// Урок 9: незалежний раціональний рахунок, відповіді, реальні DOM-вправи й прогрес.
const fs = require("fs");
const vm = require("vm");
const os = require("os");
const path = require("path");

module.exports = async function checkCommonDen({ evaluate, expect, go, call }) {
  const q = (w, n = 0, d = 1) => [BigInt(w) * BigInt(d) + BigInt(n), BigInt(d)];
  const add = (a, b) => [a[0] * b[1] + b[0] * a[1], a[1] * b[1]];
  const sub = (a, b) => [a[0] * b[1] - b[0] * a[1], a[1] * b[1]];
  const read = text => {
    const m = text.match(/^(?:(\d+) )?(\d+)\/(\d+)$/);
    return m ? q(Number(m[1] || 0), Number(m[2]), Number(m[3])) : q(Number(text));
  };
  const expected = {
    "1(1)": add(q(3,7,9), q(5,1,6)), "1(2)": add(q(8,7,16), q(3,3,10)),
    "1(3)": add(q(7,4,35), q(2,5,14)), "1(4)": sub(q(9,4,5), q(5,3,10)),
    "1(5)": sub(q(3,17,27), q(2,13,18)), "1(6)": sub(q(6,7,45), q(4,7,20)),
    "1(7)": sub(q(9,1,21), q(5,16,63)), "1(8)": sub(q(7,3,16), q(1,5,24)),
    "2(1)": sub(q(9,7,12), q(7,8,9)), "2(2)": sub(q(8,3,4), q(3,5,16)),
    "2(3)": add(sub(q(6,5,14), q(5,8,21)), q(9,3,7)),
    "2(4)": sub(add(q(1,5,6), q(2,13,18)), q(0,8,9)),
    "2(5)": sub(add(q(5,8,25), q(9,7,10)), q(7,1,20)),
    "2(6)": add(sub(q(4,3,4), q(3,5,6)), q(2,5,8)),
    "2(7)": sub(sub(q(3,1,6), q(0,1,4)), q(1,1,12)),
    "2(8)": add(sub(q(3,2,9), q(8,1,3)), q(5,2,15)),
    "2(9)": add(sub(q(1,23,24), q(4,625,1000)), q(3,1,12)),
    "2(10)": add(sub(q(3,5,12), q(4,1,6)), q(1,375,1000)),
    "3(1)": sub(add(q(5,5,9), q(3,1,6)), q(6,4,27)),
    "3(2)": add(sub(q(17,2,3), q(6,1,36)), q(4,3,8)),
    "3(3)": sub(sub(q(3,9,10), q(1,5,12)), q(1,11,24)),
    "3(4)": sub(q(10,9,16), add(q(3,11,12), q(4,4,9))),
    "3(5)": sub(q(19), add(q(4,1,6), q(11,3,4))),
    "3(6)": sub(sub(q(31), q(14,7,15)), sub(q(27,2,3), q(19,3,4))),
    "3(7)": sub(sub(q(20), q(7,23,36)), sub(q(14,4,27), q(6,1,18))),
    "3(8)": sub(sub(q(2), sub(q(1,5,10), q(0,2,3))), sub(q(1,2,3), q(0,75,100))),
    "4(2)": sub(add(q(9,3,7), q(2,9,16)), q(5,3,7)),
    "4(3)": sub(q(10,5,14), add(q(3,5,14), q(2,9,34))),
    "5(1)": sub(q(0,8,10), q(0,5,9)), "5(2)": add(q(0,48,100), q(0,3,8)),
    "5(3)": sub(q(9,17,36), q(6,65,100)),
    "5(4)": sub(q(4,875,1000), q(2,5,23)),
    "5(5)": sub(add(q(5,11,50), q(0,78,100)), q(2,7,8)),
    "5(6)": sub(add(q(7,14,25), q(2,14,100)), q(8,4,15)),
    "6(1)": sub(q(7,1,4), add(q(2,5,10), q(2,1,3))),
    "6(2)": sub(q(5,1,6), add(q(1,7,9), q(1,5,10))),
    "6(3)": sub(q(5,1,3), add(q(2,2,15), q(0,1,2))),
    "6(4)": sub(q(6,5,8), sub(q(5,3,4), q(4,7,32))),
    "7": sub(q(1), add(add(q(0,5,24), q(0,5,16)), q(0,11,48))),
    "8": sub(add(q(32,5,10), q(30,1,6)), q(28,1,3)),
    "9": add(q(0,1,15), q(0,1,12)),
  };
  let lesson;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/lessons/l09.js"), "utf8"), { COURSE: { addLesson: value => { lesson = value; } } });
  const problems = lesson.blocks.filter(b => b.type === "problem");
  const bad = problems.filter(b => !expected[b.num] || b.answer.some(text => {
    const actual = read(text), wanted = expected[b.num];
    return actual[0] * wanted[1] !== wanted[0] * actual[1];
  })).map(b => b.num);
  expect("l09: усі 41 відповіді незалежно пораховано з умов фото; №4(1) — розібраний зразок", problems.length === 41 && bad.length === 0, bad.join(", "));
  expect("l09: рівно дев'ять обов'язкових домашніх", JSON.stringify(problems.filter(b => b.homework === true).map(b => b.num)) ===
    JSON.stringify(["1(2)", "1(4)", "1(6)", "1(8)", "2(2)", "2(4)", "2(6)", "2(8)", "2(10)"]));
  expect("l09: усі ID унікальні, останній блок — summary", new Set(lesson.blocks.filter(b => b.id).map(b => b.id)).size === lesson.blocks.filter(b => b.id).length && lesson.blocks.at(-1).type === "summary");

  await go("#/l/l09");
  const saved = await evaluate("localStorage.getItem('chyslomahiya.v1')");
  const arithmetic = await evaluate(`(() => {
    let checked = 0;
    for (let d1 = 2; d1 <= 20; d1++) for (let d2 = 2; d2 <= 20; d2++) {
      let lcm = Math.max(d1, d2);
      while (lcm % d1 || lcm % d2) lcm++;
      for (const op of ['add', 'sub']) for (const n1 of [0, 1, d1 - 1]) for (const n2 of [0, 1, d2 - 1]) {
        const x = COMMONDEN.calculate({ d1, d2, n1, n2, w1: 3, w2: 1, op });
        const raw = (3*d1+n1)*d2 + (op === 'sub' ? -1 : 1)*(d2+n2)*d1;
        if (x.den !== lcm || x.num*d1*d2 !== raw*x.reducedDen || x.borrow !== (op === 'sub' && n1*d2 < n2*d1)) return { checked, fail: { d1,d2,n1,n2,op,x } };
        checked++;
      }
    }
    const zero = COMMONDEN.calculate({ d1: 2, d2: 2, n1: 1, n2: 1, op: 'sub' });
    return { checked, zero: zero.num === 0 && zero.reducedDen === 1 };
  })()`);
  expect("commonden: НСК перебором, значення й позичання для 6498 пар; нуль = 0/1", arithmetic.checked === 6498 && arithmetic.zero, JSON.stringify(arithmetic));

  const ui = await evaluate(`(() => {
    const out = [];
    const block = id => document.querySelector('[data-exercise="' + id + '"]');
    const fill = (root, name, value) => { root.querySelector('[data-field="' + name + '"]').value = value; };
    const submit = root => root.querySelector('.cd-work .btn').click();
    const done = root => root.querySelector('.done-mark').textContent === '✓';
    const lcm = block('lcm-goal');
    submit(lcm); out.push(['empty', !done(lcm)]);
    fill(lcm, 'lcm', '48'); submit(lcm); out.push(['nonleast', !done(lcm) && lcm.textContent.includes('є менше')]);
    fill(lcm, 'lcm', '24'); lcm.querySelector('[data-field="lcm"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    out.push(['lcm', done(lcm)]);
    const bring = block('bring-goal');
    out.push(['before cut', !bring.querySelector('[data-field="first"]') && !done(bring)]);
    const before = [...bring.querySelectorAll('.cd-bar')].map(b => b.querySelectorAll('.filled').length / b.children.length);
    bring.querySelector('[data-act="cut"]').click();
    const after = [...bring.querySelectorAll('.cd-bar')].map(b => b.querySelectorAll('.filled').length / b.children.length);
    out.push(['same quantities', before.every((n,i) => n === after[i])]);
    fill(bring, 'first', '4'); fill(bring, 'second', '3'); submit(bring); out.push(['both needed', !done(bring)]);
    fill(bring, 'second', '9'); submit(bring); out.push(['bring', done(bring)]);
    const add = block('add-goal');
    fill(add, 'whole', '0'); fill(add, 'numerator', '3'); fill(add, 'denominator', '6'); submit(add);
    out.push(['reduce first', !done(add) && add.textContent.includes('скорот')]);
    fill(add, 'denominator', '0'); submit(add); out.push(['denominator zero', !done(add)]);
    fill(add, 'numerator', '1'); fill(add, 'denominator', '2'); submit(add); out.push(['add', done(add)]);
    const borrow = block('borrow-goal');
    out.push(['borrow required', !borrow.querySelector('[data-field="whole"]') && !done(borrow)]);
    const originalCells = borrow.querySelectorAll('.filled').length;
    borrow.querySelector('[data-act="borrow"]').click();
    out.push(['exchange', borrow.textContent.includes('3 3/30 = 2 33/30')]);
    out.push(['conserve pieces', originalCells === borrow.querySelectorAll('.filled').length && borrow.querySelectorAll('.cd-unpacked').length === 1]);
    fill(borrow, 'whole', '1'); fill(borrow, 'numerator', '29'); fill(borrow, 'denominator', '30'); submit(borrow);
    out.push(['borrow', done(borrow) && borrow.querySelectorAll('.cd-cell.removed').length === 34]);
    borrow.querySelector('.cd-reset').click();
    out.push(['reset', !!borrow.querySelector('[data-act="borrow"]') && !borrow.querySelector('[data-field="whole"]')]);
    const play = block('lcm-play');
    play.querySelector('[data-value="30"]').click();
    const inputs = play.querySelectorAll('.cd-controls input'); inputs[0].value = '4'; inputs[1].value = '6'; play.querySelector('.cd-controls button').click();
    out.push(['sandbox changes', play.querySelector('.common').textContent === '12' && !done(play)]);
    const state = JSON.parse(localStorage.getItem('chyslomahiya.v1'));
    out.push(['sandbox not saved', !state.done['l09:lcm-play']]);
    return out;
  })()`);
  for (const [name, ok] of ui) expect("commonden: " + name, ok);

  const extra = await evaluate(`(() => {
    const checks = [];
    for (const [cfg, values, shouldBorrow] of [
      [{ n1:3,d1:4,n2:5,d2:6 }, [1,7,12], false],
      [{ n1:1,d1:2,n2:1,d2:2,op:'sub' }, [0,0,1], false],
      [{ w1:2,n1:1,d1:4,n2:2,d2:3,op:'sub' }, [1,7,12], true],
      [{ n1:3,d1:4,n2:1,d2:6,op:'sub' }, [0,7,12], false]
    ]) {
      let count = 0;
      const node = COMMONDEN.strips({ mode:'addsub', ...cfg }, () => count++);
      document.body.append(node);
      if (shouldBorrow) node.querySelector('[data-act="borrow"]').click();
      for (let twice = 0; twice < 2; twice++) {
        ['whole','numerator','denominator'].forEach((name,i) => { node.querySelector('[data-field="'+name+'"]').value = values[i]; });
        node.querySelector('.cd-work .btn').click();
      }
      checks.push(count === 1 && node.querySelector('.sim-verdict.ok') !== null);
      node.remove();
    }
    for (const id of ['bring-play','add-play']) {
      const node = document.querySelector('[data-exercise="'+id+'"]');
      if (id === 'bring-play') {
        node.querySelector('[data-act="cut"]').click();
        node.querySelector('[data-field="first"]').value = 3; node.querySelector('[data-field="second"]').value = 4;
      }
      node.querySelector('.cd-work .btn').click();
      checks.push(node.querySelector('.done-mark').textContent !== '✓' && !!node.querySelector('.sim-verdict.ok'));
      const select = node.querySelector('select'); select.value = select.options.length - 1; select.dispatchEvent(new Event('change'));
      checks.push(!node.querySelector('.sim-verdict.ok') && !node.querySelector('[data-field="whole"]'));
    }
    return checks;
  })()`);
  expect("commonden: перехід через ціле, нуль, інше позичання, звичайне віднімання, повтори й пісочниці", extra.every(Boolean), JSON.stringify(extra));

  const answers = Object.fromEntries(problems.map(p => [p.num, p.answer]));
  const accepted = await evaluate(`(() => {
    const failed = [];
    for (const [num, answers] of Object.entries(${JSON.stringify(answers)})) {
      const task = document.querySelector('[data-problem="'+num+'"]');
      for (const answer of answers) {
        task.querySelector('.answer-input').value = answer;
        task.querySelector('.answer-box .btn').click();
        if (!task.querySelector('.answer-box .verdict.ok')) failed.push(num+':'+answer);
      }
    }
    return { failed, homework: document.querySelector('.homework-overview').textContent };
  })()`);
  expect("l09: усі правильні форми відповідей приймаються; домашнє 9/9 окремо від додаткового", !accepted.failed.length && accepted.homework.includes("9 з 9"), JSON.stringify(accepted));
  await call("Page.reload");
  await new Promise(resolve => setTimeout(resolve, 600));
  const reloaded = await evaluate("['lcm-goal','bring-goal','add-goal','borrow-goal'].every(id => document.querySelector('[data-exercise=\"'+id+'\"] .done-mark').textContent === '✓') && document.querySelector('.homework-overview').textContent.includes('9 з 9')");
  expect("l09: відповіді й тренажери переживають перезавантаження", reloaded);

  for (const width of [380, 1366]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 980, deviceScaleFactor: 1, mobile: false });
    for (const id of ["bring-goal", "borrow-goal"]) {
      await evaluate(`(() => {
        const block = document.querySelector('[data-exercise="${id}"]');
        block.querySelector('[data-act="cut"], [data-act="borrow"]')?.click();
        block.scrollIntoView({block:'start'}); window.scrollBy(0,-76);
      })()`);
      await new Promise(resolve => setTimeout(resolve, 750));
      const shot = await call("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(os.tmpdir(), "chys-l09-" + id + "-" + width + ".png"), Buffer.from(shot.data, "base64"));
    }
    const overflow = await evaluate("document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('.commonden')].some(n => n.scrollWidth > n.clientWidth)");
    expect("l09: тренажери без обрізання на " + width + " px", !overflow);
    const lengths = await evaluate("[...document.querySelectorAll('[data-exercise=\"borrow-goal\"] .cd-bar')].map(n => n.getBoundingClientRect().width)");
    expect("l09: ціла має однакову довжину до й після позичання на " + width + " px", lengths.every(n => n === lengths[0]));
  }
  await call("Emulation.clearDeviceMetricsOverride");
  await evaluate(saved === null ? "localStorage.removeItem('chyslomahiya.v1')" : "localStorage.setItem('chyslomahiya.v1', " + JSON.stringify(saved) + ")");
  await call("Page.reload");
  await new Promise(resolve => setTimeout(resolve, 600));
};
