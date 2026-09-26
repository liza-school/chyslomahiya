module.exports = async function checkTeaching({ evaluate, expect, go }) {
  const teaching = await evaluate(`(() => {
    const block = document.querySelector('[data-exercise="learn-show"]');
    const sim = block.querySelector('.sim.jugs');
    const click = code => sim.querySelector('[data-act="' + code + '"]').click();
    const answer = n => sim.querySelector('.ask-opt[data-v="' + n + '"]').click();
    const first = sim.querySelector('.coach-next').getAttribute('data-act');
    click('F1');
    const rejected = sim.querySelector('.sim-stat').textContent === 'Кроків: 0' && sim.querySelector('.sim-verdict').textContent.includes('Цей хід дозволений');
    for (const code of ['F0', 'P01', 'F0', 'P01']) click(code);
    const firstQuestion = sim.querySelector('.ask-q').textContent;
    answer(3);
    const wrong = sim.querySelector('.ask-q').textContent === firstQuestion && !block.querySelector('.done-mark').textContent;
    answer(1);
    const hidden1 = sim.querySelectorAll('.jug.lidded').length === 1 && sim.querySelectorAll('.bil-ghost').length === 1 && !sim.querySelector('.coach-next');
    answer(1);
    const hidden2 = sim.querySelectorAll('.jug.lidded').length === 1 && !block.querySelector('.done-mark').textContent;
    sim.querySelector('.toolbar .ghost-btn').click();
    const undo = !sim.querySelector('.ask-q') && sim.querySelector('.sim-stat').textContent === 'Кроків: 3';
    click('P01'); answer(1); answer(1); answer(2);
    return { first, rejected, firstQuestion, wrong, hidden1, hidden2, undo,
      done: block.querySelector('.done-mark').textContent,
      final: [...sim.querySelectorAll('.jug-amt')].map(n => n.textContent).join('|') };
  })()`);
  expect("навчання пояснює хід і відхиляє вихід із кола без зміни стану", teaching.first === "F0" && teaching.rejected, JSON.stringify(teaching));
  expect("три запитання не відкривають відро до останньої відповіді; помилка й відкат безпечні",
    teaching.firstQuestion.includes("вільного місця") && teaching.wrong && teaching.hidden1 && teaching.hidden2 && teaching.undo && teaching.done === "✓" && teaching.final === "2 л|4 л");

  const faded = await evaluate(`(() => {
    const block = document.querySelector('[data-exercise="learn-prompt"]');
    const sim = block.querySelector('.sim.jugs');
    const highlight = sim.querySelectorAll('.coach-next, .jug-coach .active').length;
    sim.querySelector('[data-act="F1"]').click();
    const held = sim.querySelector('.sim-stat').textContent === 'Кроків: 0';
    for (const code of ['F0', 'P01', 'F0', 'P01']) sim.querySelector('[data-act="' + code + '"]').click();
    const single = !sim.querySelector('.coach-count');
    sim.querySelector('.ask-opt[data-v="1"]').click();
    return { highlight, held, single, done: block.querySelector('.done-mark').textContent };
  })()`);
  expect("підказки зникають поступово: друга вправа без підсвічування й проміжних відповідей",
    faded.highlight === 0 && faded.held && faded.single && faded.done === "✓", JSON.stringify(faded));

  const solo = await evaluate(`(() => {
    const block = document.querySelector('[data-exercise="learn-solo"]');
    const sim = block.querySelector('.sim.jugs');
    const click = code => sim.querySelector('[data-act="' + code + '"]').click();
    const coach = Boolean(sim.querySelector('.jug-coach'));
    click('F1');
    const free = sim.querySelector('.sim-stat').textContent === 'Кроків: 1';
    sim.querySelectorAll('.toolbar .ghost-btn')[1].click();
    for (const code of ['F0', 'P01', 'F0', 'P01']) click(code);
    sim.querySelector('.ask-opt[data-v="1"]').click();
    for (const code of ['E1', 'P01', 'F0', 'P01']) click(code);
    sim.querySelector('.ask-opt[data-v="5"]').click();
    return { coach, free, done: block.querySelector('.done-mark').textContent, steps: sim.querySelector('.sim-stat').textContent };
  })()`);
  expect("самостійна вправа приймає будь-який дозволений хід і зараховує розвʼязок на нових числах",
    !solo.coach && solo.free && solo.done === "✓" && solo.steps === "Кроків: 8", JSON.stringify(solo));

  const maps = await evaluate(`(() => {
    const results = [];
    for (const selector of ['[data-exercise="learn-map"]', '[data-problem="9"]', '[data-problem="14"]']) {
      const block = document.querySelector(selector), map = block.querySelector('.map-lab');
      const blocked = map.querySelector('.map-next').disabled;
      let wrongHeld = false, checkedWrong = false;
      for (let guard = 0; guard < 200 && map.getAttribute('data-map-ended') !== 'true'; guard++) {
        const action = map.querySelector('[data-map-move]:not(:disabled)');
        if (!action) { map.querySelector('.map-next').click(); continue; }
        action.click();
        const tuple = map.querySelector('.map-question p').textContent.match(/\\(([^)]+)\\)/)[0];
        const exists = [...map.querySelectorAll('.map-node text')].some(n => n.textContent === tuple);
        const size = map.getAttribute('data-map-nodes');
        if (!checkedWrong) {
          map.querySelector('[data-map-new="' + exists + '"]').click();
          wrongHeld = map.getAttribute('data-map-nodes') === size && Boolean(map.querySelector('[data-map-new]'));
          checkedWrong = true;
        }
        map.querySelector('[data-map-new="' + !exists + '"]').click();
      }
      const hasGoal = Boolean(map.querySelector('.map-node.goal'));
      const before = block.querySelector('.done-mark').textContent;
      map.querySelector('[data-map-reachable="' + !hasGoal + '"]').click();
      const wrongConclusion = block.querySelector('.done-mark').textContent === before;
      map.querySelector('[data-map-reachable="' + hasGoal + '"]').click();
      results.push({ selector, blocked, wrongHeld, before, wrongConclusion, done: block.querySelector('.done-mark').textContent,
        nodes: Number(map.getAttribute('data-map-nodes')), verdict: map.querySelector('.sim-verdict').textContent });
    }
    return results;
  })()`);
  expect("карта не пропускає ходи, не додає хибні нові стани й вимагає правильного висновку",
    maps.every(m => m.blocked && m.wrongHeld && m.before === "" && m.wrongConclusion && m.done === "✓"), JSON.stringify(maps));
  expect("карта знаходить мінімум 4 і 6 кроків; неможливість 6/9 → 4 доведена всіма 10 станами",
    maps[0].verdict.includes("4 кроки") && maps[1].nodes === 10 && maps[1].verdict.includes("розвʼязку немає") && maps[2].verdict.includes("6 кроків"));

  const closed = await evaluate(`(() => {
    const host = document.createElement('div'); document.body.append(host);
    const map = JUGS.explore({ vessels: [12, 8, 5], start: [12, 0, 0], exact: [6, 6, 0] }); host.append(map);
    for (let guard = 0; guard < 300 && map.getAttribute('data-map-ended') !== 'true'; guard++) {
      const action = map.querySelector('[data-map-move]:not(:disabled)');
      if (!action) { map.querySelector('.map-next').click(); continue; }
      action.click();
      const tuple = map.querySelector('.map-question p').textContent.match(/\\(([^)]+)\\)/)[0];
      const exists = [...map.querySelectorAll('.map-node text')].some(n => n.textContent === tuple);
      map.querySelector('[data-map-new="' + !exists + '"]').click();
    }
    map.querySelector('[data-map-reachable="true"]').click();
    const text = map.querySelector('.sim-verdict').textContent;
    host.remove(); return text;
  })()`);
  expect("карта підтримує три посудини без джерела й точну мету Пуассона", closed.includes("7 кроків"), closed);

  const petrol = await evaluate(`(() => {
    const block = document.querySelector('[data-exercise="petrol"]'), sim = block.querySelector('.sim.jugs');
    const sequence = [['P01', 5], ['P12', 4], ['P20', 10], ['P12'], ['P01', 1], ['P12', 8], ['P20', 6], ['P12', 3]];
    for (const [code, answer] of sequence) {
      sim.querySelector('[data-act="' + code + '"]').click();
      if (answer !== undefined) sim.querySelector('.ask-opt[data-v="' + answer + '"]').click();
    }
    return { done: block.querySelector('.done-mark').textContent, steps: sim.querySelector('.sim-stat').textContent,
      final: [...sim.querySelectorAll('.jug-amt')].map(n => n.textContent).join('|') };
  })()`);
  expect("памʼятка працює з трьома посудинами, поверненням у запас і лімітом", petrol.done === "✓" && petrol.steps === "Кроків: 8 з 8" && petrol.final === "6 л|3 л|5 л", JSON.stringify(petrol));

  const helper = await evaluate(`(async () => {
    const block = document.querySelector('[data-exercise="learn-solo"]'), detail = block.querySelector('.jug-map-help');
    const absent = !detail.querySelector('.map-lab');
    detail.open = true; await new Promise(r => setTimeout(r, 30));
    const map = detail.querySelector('.map-lab');
    map.querySelector('[data-map-move]:not(:disabled)').click();
    map.querySelector('[data-map-new="true"]').click();
    map.querySelector('.map-reset').click();
    detail.open = false; await new Promise(r => setTimeout(r, 10));
    detail.open = true; await new Promise(r => setTimeout(r, 10));
    return { absent, count: detail.querySelectorAll('.map-lab').length, nodes: map.getAttribute('data-map-nodes'),
      waiting: Boolean(map.querySelector('[data-map-new]')), next: map.querySelector('.map-next').disabled };
  })()`);
  expect("запасна карта створюється при відкритті, не дублюється й починається заново", helper.absent && helper.count === 1 && helper.nodes === "1" && !helper.waiting && helper.next, JSON.stringify(helper));

  await go("#/"); await go("#/l/l03");
  const restored = await evaluate(`['learn-show', 'learn-prompt', 'learn-solo', 'learn-map'].every(id =>
    document.querySelector('[data-exercise="' + id + '"] .done-mark').textContent === '✓')`);
  expect("нове навчання зберігає прогрес після переходу між сторінками", restored);
};
