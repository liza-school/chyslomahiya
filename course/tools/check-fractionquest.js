const fs = require("fs");
const vm = require("vm");
const os = require("os");
const path = require("path");

module.exports = async function checkFractionQuest({ evaluate, expect, go, call }) {
  let lesson;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/lessons/l09.js"), "utf8"), { COURSE: { addLesson: value => { lesson = value; } } });
  const quests = lesson.blocks.filter(b => b.type === "fractionquest");
  const q = (n, d = 1) => [BigInt(n), BigInt(d)];
  const add = (a, b) => [a[0] * b[1] + b[0] * a[1], a[1] * b[1]];
  const sub = (a, b) => [a[0] * b[1] - b[0] * a[1], a[1] * b[1]];
  const equal = (a, b) => a[0] * b[1] === b[0] * a[1];
  const read = text => {
    const m = text.match(/^(?:(\d+) )?(\d+)\/(\d+)$/);
    if (m) return q(BigInt(m[1] || 0) * BigInt(m[3]) + BigInt(m[2]), m[3]);
    const parts = text.replace(",", ".").split(".");
    return parts.length === 2 ? q(parts.join(""), 10n ** BigInt(parts[1].length)) : q(text);
  };
  const fixed = add(add(q(1,2), q(1,3)), q(1,10));
  const sum3 = add(add(q(1,6), q(1,12)), q(1,20));
  const sum5 = add(add(sum3, q(1,30)), q(1,42));
  const expectedInputs = {
    "thought-pairs": [add(add(q(19,8), q(9,7)), q(37,8)), sub(q(79,12), add(q(31,12), q(8,5)))],
    "thought-bound": [fixed, sub(q(1), fixed), q(16), sub(q(1), add(q(3,4), q(1,8))), q(9)],
    "thought-cancel": [sum3, sum5],
    "thought-all": [q(20), q(12), q(7), q(11), q(42), q(24), q(18), q(15)],
    "thought-proof": [q(2)],
  };
  for (const quest of quests) {
    const inputs = quest.cases.flatMap(c => c.steps).filter(s => s.accept);
    expect(quest.id + ": усі форми числових відповідей точні", inputs.length === expectedInputs[quest.id].length &&
      inputs.every((step, i) => step.accept.every(text => equal(read(text), expectedInputs[quest.id][i]))));
    expect(quest.id + ": кожен крок має підказку, пояснення й зворотний зв'язок", quest.cases.every(c => c.steps.every(s =>
      s.hint && s.explain && (s.terms || (s.choices ? s.choices.every((_,i) => i === s.answer || s.wrong[i]) : s.wrong)))));
  }
  for (const [d, wanted] of [[4, [[5,20],[6,12]]], [6, [[7,42],[8,24],[9,18],[10,15]]]]) {
    const pairs = [];
    for (let a = 1; a <= d * (d + 1); a++) for (let b = a + 1; b <= d * (d + 1); b++) {
      if (a * b === d * (a + b)) pairs.push([a,b]);
    }
    expect("усі різні одиничні розклади 1/" + d, JSON.stringify(pairs) === JSON.stringify(wanted));
  }
  expect("межі строгі: n = 15/8 виключено, всі більші підходять", Array.from({length: 1000}, (_,i) => i + 1).every(n =>
    (28*n + 30 < 30*n) === (n >= 16) && (7*n + 8 < 8*n) === (n >= 9)));
  expect("обидва інваріанти зберігаються при кожному типі ходу", [0,1,2,3,100,10001].every(k =>
    (2 + 9*k) % 3 === 2 && (1 + 6*k) % 2 === 1 && (2 + 9*k)*5 % 3 !== 0 && (1 + 6*k)*3 % 2 !== 0));

  await go("#/l/l09");
  const saved = await evaluate("localStorage.getItem('chyslomahiya.v1')");
  await evaluate(`(() => { const state = JSON.parse(localStorage.getItem('chyslomahiya.v1') || '{}'); state.done ||= {}; for (const q of ${JSON.stringify(quests.map(q=>q.id))}) delete state.done['l09:'+q]; localStorage.setItem('chyslomahiya.v1', JSON.stringify(state)); })()`);
  await call("Page.reload");
  await new Promise(resolve => setTimeout(resolve, 600));
  const result = await evaluate(`(() => {
    const checks = [];
    const configurations = ${JSON.stringify(quests)};
    for (const cfg of configurations) {
      const block = document.querySelector('[data-exercise="'+cfg.id+'"]');
      const root = block.querySelector('.fractionquest');
      const done = () => block.querySelector('.done-mark').textContent === '✓';
      checks.push([cfg.id+': initial', !done()]);
      root.querySelector('.fq-hint').open = true;
      root.querySelector('.fq-explanation').open = true;
      checks.push([cfg.id+': reading is not solving', !done() && root.querySelector('[data-act="next"]').hidden]);
      root.querySelector('[data-case="1"]').click();
      root.querySelector('.fq-explanation').open = true;
      root.querySelector('[data-case="0"]').click();
      checks.push([cfg.id+': switch resets step and hint', root.dataset.step === '0' && !root.querySelector('.fq-explanation').open && !done()]);
      for (let c = 0; c < cfg.cases.length; c++) {
        root.querySelector('[data-case="'+c+'"]').click();
        for (let s = 0; s < cfg.cases[c].steps.length; s++) {
          const step = cfg.cases[c].steps[s];
          const next = () => root.querySelector('[data-act="next"]');
          if (step.choices) {
            const wrong = (step.answer + 1) % step.choices.length;
            root.querySelector('[data-choice="'+wrong+'"]').click();
            checks.push([cfg.id+': wrong choice '+c+'/'+s, next().hidden && root.querySelector('.sim-verdict.no').textContent === step.wrong[wrong]]);
            root.querySelector('[data-choice="'+step.answer+'"]').click();
          } else if (step.terms) {
            const chips = root.querySelectorAll('[data-term]');
            chips[0].click(); chips[0].click();
            checks.push(['unselect term', chips[0].getAttribute('aria-pressed') === 'false']);
            chips[0].click(); chips[1].click();
            checks.push(['wrong pair leaves all terms', root.querySelectorAll('.fq-cancelled').length === 0 && next().hidden]);
            for (let i = 1; i < step.terms.length - 1; i += 2) { chips[i].click(); chips[i+1].click(); }
            checks.push(['only boundaries remain', root.querySelectorAll('.fq-term:not(.fq-cancelled)').length === 2]);
          } else {
            const field = root.querySelector('input');
            root.querySelector('[data-act="check"]').click();
            checks.push(['empty input', next().hidden]);
            field.value = '999999'; root.querySelector('[data-act="check"]').click();
            checks.push(['wrong input', next().hidden && root.querySelector('.sim-verdict.no').textContent === step.wrong]);
            field.value = step.accept.at(-1);
            field.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true}));
          }
          checks.push([cfg.id+': correct step '+c+'/'+s, !next().hidden]);
          next().click();
        }
        checks.push([cfg.id+': completion requires both cases', done() === (c === cfg.cases.length - 1)]);
      }
      root.querySelector(':scope > .ghost-btn').click();
      checks.push([cfg.id+': repeat keeps earned progress and resets attempt', done() && root.dataset.step === '0' && root.querySelector('[data-act="next"]').hidden]);
    }
    let notified = 0;
    const test = FRACTIONQUEST.train({hero:'nami',cases:[{title:'A',scene:'',steps:[{ask:'1?',accept:['1'],wrong:'Ні',hint:'1',explain:'1'}]},{title:'B',scene:'',steps:[{ask:'2?',accept:['2'],wrong:'Ні',hint:'2',explain:'2'}]}]}, () => notified++);
    document.body.append(test);
    for (const c of [1,0,1,0]) {
      test.querySelector('[data-case="'+c+'"]').click();
      test.querySelector('input').value = String(c+1);
      test.querySelector('[data-act="check"]').click();
      test.querySelector('[data-act="next"]').click();
    }
    checks.push(['reverse order and repeats notify once', notified === 1]); test.remove();
    return {failed:checks.filter(c=>!c[1]), count:checks.length};
  })()`);
  expect("fractionquest: правильні й хибні кроки, читання, зміна задач, пари, повтори", !result.failed.length, JSON.stringify(result));
  await call("Page.reload");
  await new Promise(resolve => setTimeout(resolve, 600));
  expect("fractionquest: п'ять завершень переживають reload", await evaluate("[...document.querySelectorAll('.fractionquest')].every(n => n.closest('.block').querySelector('.done-mark').textContent === '✓')"));
  const image = await evaluate(`new Promise(resolve => { const image = new Image(); image.onload = () => resolve({w:image.naturalWidth,h:image.naturalHeight}); image.onerror = () => resolve(null); image.src = 'img/l09-one-piece-crew.png'; })`);
  expect("One Piece: локальний квадратний атлас завантажено", image && image.w > 500 && image.w === image.h, JSON.stringify(image));
  for (const width of [320, 380, 1366]) {
    await call("Emulation.setDeviceMetricsOverride", {width,height:980,deviceScaleFactor:1,mobile:false});
    for (const id of ["thought-pairs", "thought-cancel", "thought-proof"]) {
      await evaluate(`(() => {
        const b = document.querySelector('[data-exercise="${id}"]');
        b.scrollIntoView({block:'start'}); window.scrollBy(0,-76);
        if ('${id}' === 'thought-cancel') { b.querySelector('[data-choice="0"]').click(); b.querySelector('[data-act="next"]').click(); }
      })()`);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(id + ": без обрізання на " + width, await evaluate("document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.fractionquest')].every(n => n.scrollWidth <= n.clientWidth)"));
      if (width !== 320) {
        const shot = await call("Page.captureScreenshot", {format:"png"});
        fs.writeFileSync(path.join(os.tmpdir(), "chys-l09-" + id + "-" + width + ".png"), Buffer.from(shot.data,"base64"));
      }
      await evaluate(`document.querySelector('[data-exercise="${id}"] .fractionquest > .ghost-btn').click()`);
    }
  }
  await call("Emulation.clearDeviceMetricsOverride");
  await evaluate(saved === null ? "localStorage.removeItem('chyslomahiya.v1')" : "localStorage.setItem('chyslomahiya.v1',"+JSON.stringify(saved)+")");
  await call("Page.reload");
  await new Promise(resolve => setTimeout(resolve,600));
};
