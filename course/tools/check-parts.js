// Частини уроків і домашнє: реальні кліки, старе сховище, перезавантаження й скидання.
const fs = require("fs");
const os = require("os");
const path = require("path");

module.exports = async function checkParts({ evaluate, expect, go, call }) {
  const saved = await evaluate("({ current: localStorage.getItem('chyslomahiya.v1'), old: localStorage.getItem('fimli.v1') })");
  const reload = async () => {
    await call("Page.reload");
    await new Promise((resolve) => setTimeout(resolve, 600));
  };

  for (const [id, count, blocks, tasks] of [["l01", 5, 38, 24], ["l02", 4, 23, 13], ["l03", 5, 43, 26], ["l04", 5, 53, 31], ["l05", 8, 75, 50]]) {
    await go("#/l/" + id);
    const shape = await evaluate(`(() => {
      const parts = [...document.querySelectorAll('.lesson-part')];
      return { count: parts.length, blocks: document.querySelectorAll('.lesson-part .block').length,
        unique: new Set(parts.map(p => p.id)).size,
        tasks: parts.reduce((sum, p) => sum + Number(p.querySelector('.part-counter').textContent.match(/з ([0-9]+)/)[1]), 0) };
    })()`);
    expect(id + ": 4–5 частин охоплюють усі блоки й задачі без повторів",
      shape.count === count && shape.unique === count && shape.blocks === blocks && shape.tasks === tasks, JSON.stringify(shape));
  }

  const legacyDone = { "l01:q1": true, "l01:p1": true, "l02:q1": true, "l03:p2": true, "l04:p1b": true };
  await evaluate(`localStorage.removeItem('chyslomahiya.v1'); localStorage.setItem('fimli.v1', ${JSON.stringify(JSON.stringify({ done: legacyDone }))});`);
  await go("#/l/l01");
  await reload();
  const legacy = await evaluate(`({ score: document.querySelector('.score').textContent,
    homework: document.querySelector('.homework-overview').textContent,
    marks: document.querySelectorAll('.hw-item.hw-done').length,
    parts: document.querySelector('.parts-summary').textContent })`);
  expect("старий fimli.v1 відновлює задачі й домашнє; частини ще не позначені",
    legacy.score.includes("2 з 24") && legacy.homework.includes("1 з 4") && legacy.marks === 1 && legacy.parts.includes("0 з 5"), JSON.stringify(legacy));

  const navOnly = await evaluate(`(() => {
    document.querySelectorAll('.part-link')[2].click();
    return !localStorage.getItem('chyslomahiya.v1') && document.querySelector('.parts-summary').textContent.includes('0 з 5');
  })()`);
  expect("перехід до частини не позначає матеріал чи задачі пройденими", navOnly);

  const selected = await evaluate(`(() => {
    const sim = document.querySelector('.block.scales-block .sim');
    sim.querySelector('.coin').click();
    const parts = document.querySelectorAll('.lesson-part');
    parts[0].querySelector('.part-complete').click();
    parts[2].querySelector('.part-today-btn').click();
    const saved = JSON.parse(localStorage.getItem('chyslomahiya.v1'));
    return { saved, summary: document.querySelector('.parts-summary').textContent,
      current: document.querySelector('.lesson-part.part-current').dataset.part,
      sameSim: sim === document.querySelector('.block.scales-block .sim'),
      coins: sim.querySelectorAll('.arm.left .coin').length,
      homework: document.querySelector('.homework-overview').textContent,
      activeLinks: document.querySelectorAll('.part-link[aria-current="step"]').length };
  })()`);
  expect("частина й вибір на сьогодні зберігаються окремо від старих задач",
    JSON.stringify(selected.saved.done) === JSON.stringify(legacyDone) && selected.saved.parts["l01:first-scales"] === true &&
    selected.saved.today.l01 === "harder-coins" && selected.summary.includes("1 з 5") && selected.current === "harder-coins" && selected.activeLinks === 1,
    JSON.stringify(selected));
  expect("позначки не скидають ходи симулятора й не завершують домашнє",
    selected.sameSim && selected.coins === 1 && selected.homework.includes("1 з 4"));

  await go("#/l/l02");
  await go("#/l/l01");
  await reload();
  const restored = await evaluate(`({ current: document.querySelector('.lesson-part.part-current').dataset.part,
    done: document.querySelectorAll('.lesson-part.part-done').length,
    homework: document.querySelector('.homework-overview').textContent })`);
  expect("зміна уроку й перезавантаження зберігають частини, вибір і домашнє",
    restored.current === "harder-coins" && restored.done === 1 && restored.homework.includes("1 з 4"), JSON.stringify(restored));

  const toggled = await evaluate(`(() => {
    const part = document.querySelectorAll('.lesson-part')[2];
    part.querySelector('.part-complete').click();
    const next = document.querySelector('.lesson-part.part-current').dataset.part;
    part.querySelector('.part-complete').click();
    return { next, pressed: part.querySelector('.part-complete').getAttribute('aria-pressed'),
      saved: JSON.parse(localStorage.getItem('chyslomahiya.v1')), count: document.querySelectorAll('.lesson-part.part-done').length };
  })()`);
  expect("завершення пропонує наступну непройдену; скасування не чіпає задачі",
    toggled.next === "split-and-practice" && toggled.pressed === "false" && toggled.count === 1 &&
    JSON.stringify(toggled.saved.done) === JSON.stringify(legacyDone) && !toggled.saved.today.l01, JSON.stringify(toggled));

  await go("#/l/l04");
  const homework = await evaluate(`(() => {
    const task = document.querySelector('[data-problem="3"]');
    task.querySelector('.answer-input').value = '2';
    task.querySelector('.answer-box .btn').click();
    return { top: document.querySelector('.homework-overview').textContent,
      list: document.querySelector('.block.homework .homework-progress').textContent,
      marks: document.querySelectorAll('.hw-item.hw-done').length,
      parts: document.querySelector('.parts-summary').textContent };
  })()`);
  expect("правильна відповідь одразу оновлює домашнє в шапці й списку, без завершення частини",
    homework.top.includes("2 з 5") && homework.list.includes("2 з 5") && homework.marks === 2 && homework.parts.includes("0 з 5"), JSON.stringify(homework));

  await evaluate(`(() => {
    const saved = JSON.parse(localStorage.getItem('chyslomahiya.v1'));
    for (const id of ['p1b','p1d','p1e','p3','p7']) saved.done['l04:' + id] = true;
    localStorage.setItem('chyslomahiya.v1', JSON.stringify(saved));
  })()`);
  await reload();
  const allHomework = await evaluate("document.querySelector('.homework-overview').textContent");
  expect("усе обовʼязкове домашнє завершене незалежно від задачі для бажаючих",
    allHomework.includes("Обовʼязкове домашнє виконано ✓") && allHomework.includes("5 з 5") && allHomework.includes("Для бажаючих: 0 з 1"), allHomework);
  await call("Emulation.setDeviceMetricsOverride", { width: 1366, height: 1050, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('.block.homework').scrollIntoView({ block: 'start' }); window.scrollBy(0, -90)");
  const homeworkShot = await call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(os.tmpdir(), "chys-homework.png"), Buffer.from(homeworkShot.data, "base64"));
  await call("Emulation.clearDeviceMetricsOverride");
  await evaluate(`(() => {
    const saved = JSON.parse(localStorage.getItem('chyslomahiya.v1'));
    saved.done['l04:p8'] = true;
    localStorage.setItem('chyslomahiya.v1', JSON.stringify(saved));
  })()`);
  await reload();
  const optionalHomework = await evaluate("document.querySelector('.homework-overview').textContent");
  expect("додаткове домашнє має власний стан завершення й не змінює обовʼязковий лічильник",
    optionalHomework.includes("5 з 5") && optionalHomework.includes("Для бажаючих: 1 з 1 ✓"), optionalHomework);
  await go("#/");
  const cards = await evaluate(`({ one: document.querySelector('.card[href="#/l/l01"]').textContent,
    four: document.querySelector('.card[href="#/l/l04"]').textContent })`);
  expect("головна окремо показує частини й домашнє", cards.one.includes("Частин пройдено: 1 з 5") && cards.four.includes("Обовʼязкове домашнє виконано ✓"), JSON.stringify(cards));

  await go("#/l/l02");
  const allParts = await evaluate(`(() => {
    for (const button of document.querySelectorAll('.part-complete')) button.click();
    const finished = document.querySelector('.parts-today').textContent.includes('Усі частини пройдено') &&
      document.querySelector('.parts-roadmap .btn').hidden && !document.querySelector('.lesson-part.part-current');
    document.querySelectorAll('.part-complete')[3].click();
    return { finished, next: document.querySelector('.lesson-part.part-current').dataset.part,
      homework: document.querySelector('.homework-overview').textContent };
  })()`);
  expect("усі частини завершуються; скасування відкриває останню; незадане домашнє позначене явно",
    allParts.finished && allParts.next === "next-limit" && allParts.homework === "Домашнє не задано", JSON.stringify(allParts));

  await go("#/l/l01");
  await evaluate("window.scrollTo(0, document.querySelector('.parts-roadmap').offsetTop - 90)");
  for (const [name, width, height] of [["desktop", 1366, 1050], ["tablet", 820, 1180]]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const shot = await call("Page.captureScreenshot", { format: "png" });
    const file = path.join(os.tmpdir(), "chys-parts-" + name + ".png");
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log("  Знімок: " + file);
  }
  await call("Emulation.clearDeviceMetricsOverride");

  await go("#/");
  const reset = await evaluate(`(() => {
    const confirmBefore = window.confirm;
    const before = localStorage.getItem('chyslomahiya.v1');
    const button = document.querySelector('.page-foot .ghost-btn');
    window.confirm = () => false;
    button.click();
    const cancelled = localStorage.getItem('chyslomahiya.v1') === before;
    window.confirm = () => true;
    button.click();
    window.confirm = confirmBefore;
    const saved = JSON.parse(localStorage.getItem('chyslomahiya.v1'));
    return cancelled && ['done','parts','today'].every(k => Object.keys(saved[k]).length === 0);
  })()`);
  expect("скасування скидання зберігає все; підтвердження стирає задачі, частини й вибір", reset);

  // Наступні перевірки отримують свій початковий прогрес.
  await evaluate(`(() => {
    const saved = ${JSON.stringify(saved)};
    for (const [key, value] of [['chyslomahiya.v1', saved.current], ['fimli.v1', saved.old]]) {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    }
  })()`);
  await reload();
};
