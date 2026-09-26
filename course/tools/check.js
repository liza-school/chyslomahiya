// Наскрізна перевірка курсу у справжньому Chrome через DevTools Protocol.
//
//   node tools/check.js                      (відкриє index.html через file://)
//   node tools/check.js http://127.0.0.1:8000/
//
// Перевіряє: сторінки малюються, усі типи завдань зараховуються, терези зважують
// і знаходять фальшиву монету, прогрес пишеться в localStorage, у консолі чисто.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = 9336;
const TARGET = process.argv[2] || "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
if (!chromePath) {
  console.error("Chrome не знайдено. Вкажи шлях у змінній CHROME_PATH.");
  process.exit(1);
}

const chrome = spawn(chromePath, [
  "--headless=new",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + path.join(os.tmpdir(), "chyslomahiya-check-" + Date.now()),
  "--no-first-run",
  "--disable-gpu",
  "about:blank",
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];

function expect(name, condition, detail) {
  console.log((condition ? "  ok    " : "  ПРОВАЛ") + "  " + name + (detail ? "  " + detail : ""));
  if (!condition) failures.push(name + " " + (detail || ""));
}

async function browserWs() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:" + PORT + "/json/version");
      return (await response.json()).webSocketDebuggerUrl;
    } catch (e) {
      await sleep(250);
    }
  }
  throw new Error("Chrome не піднявся");
}

function connect(url) {
  const ws = new WebSocket(url);
  const waiting = new Map();
  const events = [];
  let seq = 0;
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && waiting.has(message.id)) {
      const slot = waiting.get(message.id);
      waiting.delete(message.id);
      message.error ? slot.reject(new Error(JSON.stringify(message.error))) : slot.resolve(message.result);
    } else if (message.method) {
      events.push(message);
    }
  });
  const open = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  const send = (method, params, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      waiting.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
    });
  return { send, open, events };
}

const LESSONS = ["l01", "l02", "l03"];

(async () => {
  const cdp = connect(await browserWs());
  await cdp.open;
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params) => cdp.send(method, params, sessionId);

  await call("Runtime.enable");
  await call("Log.enable");
  await call("Page.enable");
  await call("Page.navigate", { url: TARGET });
  await sleep(1500);

  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails.exception));
    return result.result.value;
  };

  const go = (hash) =>
    evaluate(
      "(async () => { location.hash = '" + hash + "'; await new Promise(r => setTimeout(r, 300)); return document.querySelectorAll('.block').length; })()"
    );

  /* ---------- сторінки ---------- */

  const cards = await evaluate("document.querySelectorAll('.card').length");
  expect("головна намалювалась", cards === LESSONS.length, "карток: " + cards);

  for (const id of LESSONS) {
    const blocks = await go("#/l/" + id);
    expect("сторінка " + id + " намалювалась", blocks > 15, "блоків: " + blocks);
  }

  /* ---------- будова заняття ---------- */

  for (const id of LESSONS) {
    await go("#/l/" + id);
    const shape = await evaluate(
      "['spell','trap','idea','life','game','summary'].map(k => document.querySelectorAll('.block.' + k).length).join('/')"
    );
    expect("у " + id + " є заклинання, пастка, ідея, з життя, з гри, підсумок", !shape.split("/").includes("0"), shape);

    const problems = await evaluate("document.querySelectorAll('.block.problem').length");
    expect("у " + id + " є задачі", problems >= 5, "задач: " + problems);

    const solutions = await evaluate(
      "[...document.querySelectorAll('.block.problem')].filter(p => [...p.querySelectorAll('details summary')].some(s => s.textContent.includes('Розв'))).length"
    );
    expect("кожна задача в " + id + " має розвʼязання", solutions === problems, solutions + " з " + problems);

    const sims = await evaluate("document.querySelectorAll('.sim').length");
    expect("у " + id + " є інтерактивні симулятори", sims >= 3, "симуляторів: " + sims);
  }

  /* ---------- обовʼязковий зміст ---------- */

  const coverage = JSON.parse(fs.readFileSync(path.join(__dirname, "coverage.json"), "utf8"));
  for (const id of Object.keys(coverage).filter((key) => !key.startsWith("_"))) {
    await go("#/l/" + id);
    const text = String(await evaluate("document.getElementById('app').textContent")).toLowerCase();
    const missing = coverage[id].filter((needle) => !text.includes(needle));
    expect("у " + id + " присутній увесь обовʼязковий зміст", missing.length === 0, missing.join(", "));
  }

  /* ---------- терези ---------- */

  await go("#/l/l01");

  const weighing = await evaluate(
    "(async () => { const sim = document.querySelector('.block.scales-block .sim');" +
      " const coins = [...sim.querySelectorAll('.coin')];" +
      " coins[0].click(); coins[1].click(); coins[1].click();" +
      " await new Promise(r => setTimeout(r, 30));" +
      " const left = sim.querySelectorAll('.arm.left .coin').length;" +
      " const right = sim.querySelectorAll('.arm.right .coin').length;" +
      " sim.querySelector('.btn').click(); await new Promise(r => setTimeout(r, 60));" +
      " return left + '/' + right + '|' + sim.querySelector('.sim-verdict').textContent; })()"
  );
  expect("монети лягають на чаші, терези відповідають", /^1\/1\|Результат: /.test(weighing), weighing);

  // Перетягування справжньою мишею: натиснути на монеті, протягнути до чаші, відпустити.
  await evaluate(
    "(async () => { const sim = document.querySelector('.block.scales-block .sim');" +
      " sim.querySelectorAll('.ghost-btn')[2].click(); sim.scrollIntoView({ block: 'center' });" +
      " await new Promise(r => setTimeout(r, 250)); })()"
  );
  const spots = JSON.parse(
    await evaluate(
      "(() => { const sim = document.querySelector('.block.scales-block .sim');" +
        " const c = sim.querySelector('.coin').getBoundingClientRect();" +
        " const p = sim.querySelector('.arm.left .pan').getBoundingClientRect();" +
        " return JSON.stringify({ cx: c.left + c.width / 2, cy: c.top + c.height / 2," +
        "   px: p.left + p.width / 2, py: p.top + p.height / 2 }); })()"
    )
  );
  await call("Input.dispatchMouseEvent", { type: "mousePressed", x: spots.cx, y: spots.cy, button: "left", buttons: 1, clickCount: 1 });
  for (let step = 1; step <= 6; step++) {
    await call("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: spots.cx + ((spots.px - spots.cx) * step) / 6,
      y: spots.cy + ((spots.py - spots.cy) * step) / 6,
      button: "left",
      buttons: 1,
    });
  }
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: spots.px, y: spots.py, button: "left", buttons: 0, clickCount: 1 });
  await sleep(150);
  const dragged = await evaluate(
    "(() => { const sim = document.querySelector('.block.scales-block .sim');" +
      " return (sim.querySelector('.arm.left .coin') ? 'на лівій чаші' : 'не доїхала')" +
      "   + '|' + document.querySelectorAll('.drag-ghost').length" +
      "   + '|' + sim.querySelectorAll('.coin.dragging').length; })()"
  );
  expect("монету можна перетягнути мишкою на чашу", dragged === "на лівій чаші|0|0", dragged);

  // Нерівна кількість монет на чашах нічого не доводить — зважування має бути відхилене.
  const uneven = await evaluate(
    "(async () => { const sim = document.querySelector('.block.scales-block .sim');" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " sim.querySelectorAll('.ghost-btn')[2].click(); await pause(30);" +
      " sim.querySelector('.coin').click();" +
      " sim.querySelector('.btn').click(); await pause(40);" +
      " return sim.querySelector('.sim-verdict').textContent; })()"
  );
  expect("нерівна кількість монет на чашах не приймається", uneven.includes("порівну"), uneven.slice(0, 60));

  // Три монети, одна важча: 1 проти 2, а якщо там рівновага — третя проти першої. Нахил гарантовано.
  const tilt = await evaluate(
    "(async () => { const sim = document.querySelector('.block.scales-block .sim');" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " sim.querySelectorAll('.ghost-btn')[2].click(); await pause(30);" +
      " let coins = [...sim.querySelectorAll('.coin')];" +
      " coins[0].click(); coins[1].click(); coins[1].click();" +
      " sim.querySelector('.btn').click(); await pause(60);" +
      " if (sim.querySelector('.sim-verdict').textContent.includes('рівновага')) {" +
      "   for (const option of [...sim.querySelectorAll('.ask-opt')]) {" +
      "     option.click(); await pause(20); if (!sim.querySelector('.ask-opt')) break; }" +
      "   coins = [...sim.querySelectorAll('.coin')];" +
      "   coins[2].click(); coins[0].click(); coins[0].click();" +
      "   sim.querySelector('.btn').click(); await pause(60); }" +
      " return getComputedStyle(sim.querySelector('.beam')).transform; })()"
  );
  expect("коромисло справді нахиляється", tilt !== "none" && tilt !== "matrix(1, 0, 0, 1, 0, 0)", tilt);

  // Режим «назвати фальшиву» вмикається один раз: після промаху він має лишатися ввімкненим.
  const solving = await evaluate(
    "(async () => { const sim = document.querySelector('.block.scales-block .sim');" +
      " const arm = sim.querySelectorAll('.ghost-btn')[0];" +
      " arm.click(); await new Promise(r => setTimeout(r, 20));" +
      " for (const coin of [...sim.querySelectorAll('.coin')]) {" +
      "   coin.click(); await new Promise(r => setTimeout(r, 30));" +
      "   if (sim.querySelector('.sim-verdict').classList.contains('ok')) break; }" +
      " const block = sim.closest('.block');" +
      " return sim.querySelector('.sim-verdict').className + '|' + block.querySelector('.done-mark').textContent; })()"
  );
  expect("знайдена фальшива монета зараховується", solving === "sim-verdict ok|✓", solving);

  // Після зважування терези мають спитати, де тепер фальшива, і не пускати далі без відповіді.
  const asking = await evaluate(
    "(async () => { const sim = [...document.querySelectorAll('.sim')][1];" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " sim.querySelectorAll('.ghost-btn')[2].click(); await pause(30);" +
      " const coins = [...sim.querySelectorAll('.coin')];" +
      " for (let i = 0; i < 3; i++) coins[i].click();" +
      " for (let i = 3; i < 6; i++) { coins[i].click(); coins[i].click(); }" +
      " sim.querySelector('.btn').click(); await pause(60);" +
      " const opts = sim.querySelectorAll('.ask-opt').length;" +
      " sim.querySelector('.btn').click(); await pause(30);" +
      " const blocked = sim.querySelector('.sim-verdict').textContent.includes('Спершу скажи');" +
      " let cleared = false;" +
      " for (const option of [...sim.querySelectorAll('.ask-opt')]) {" +
      "   option.click(); await pause(20);" +
      "   if (!sim.querySelector('.ask-opt')) { cleared = true; break; } }" +
      " return opts + '|' + blocked + '|' + cleared + '|' + sim.querySelectorAll('.coin.out').length; })()"
  );
  expect("терези питають, де тепер фальшива, і чекають відповіді", /^3\|true\|true\|[1-9]/.test(asking), asking);

  /* Колись тут гинули всі монети до одної: keep читав pendingAsk уже після скидання у false,
     тож після правильної відповіді не лишалося жодної підозрюваної і задача ставала нерозвʼязною.
     9 монет, 3 проти 3: хай який результат, підозрюваних має лишитися рівно 3. */
  const narrowing = await evaluate(
    "(async () => { const sim = [...document.querySelectorAll('.sim')][1];" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " sim.querySelectorAll('.ghost-btn')[2].click(); await pause(40);" +
      " const coins = [...sim.querySelectorAll('.coin')];" +
      " for (let i = 0; i < 3; i++) coins[i].click();" +
      " for (let i = 3; i < 6; i++) { coins[i].click(); coins[i].click(); }" +
      " sim.querySelector('.btn').click(); await pause(60);" +
      " for (const option of [...sim.querySelectorAll('.ask-opt')]) {" +
      "   option.click(); await pause(30); if (!sim.querySelector('.ask-opt')) break; }" +
      " const stat = sim.querySelector('.sim-stat').textContent;" +
      " const left = stat.split('підозрюваних: ')[1].split(' ')[0];" +
      " const onTable = sim.querySelectorAll('.tray:not(.spare) .coin').length;" +
      " const onShelf = sim.querySelectorAll('.tray.spare .coin').length;" +
      " return left + '|' + onTable + '|' + onShelf; })()"
  );
  expect("після відповіді підозрювані не зникають", narrowing === "3|3|6", narrowing);

  /* Доведено справжню монету можна зняти з полиці назад на чашу — вона еталон ✓, а не сміття. */
  const weightsUsable = await evaluate(
    "(async () => { const sim = [...document.querySelectorAll('.sim')][1];" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " const spare = sim.querySelector('.tray.spare .coin');" +
      " if (!spare) return 'полиця порожня';" +
      " spare.click(); await pause(30);" +
      " return sim.querySelector('.arm.left .coin') ? 'еталон на чаші' : 'не переїхала'; })()"
  );
  expect("еталон із полиці можна повернути на чашу", weightsUsable === "еталон на чаші", weightsUsable);

  const provenLook = await evaluate(
    "(() => { const c = [...document.querySelectorAll('.sim .coin.out')].find(x => !x.classList.contains('known'));" +
      " if (!c) return 'немає доведених';" +
      " return getComputedStyle(c, '::after').content + '|' + getComputedStyle(c).opacity; })()"
  );
  expect("доведено справжня монета — еталон зі значком ✓ і не тьмяніє", provenLook === '"✓"|1', provenLook);

  /* Класика теми: 12 монет, невідомо в який бік. Перше зважування 1-4 проти 5-8 роздає
     мітки «тільки важча» / «тільки легша», друге переставляє монети між чашами (1,2,5 проти 3,4,6),
     і правильна відповідь виходить лише перетином старої мітки з новим нахилом.
     Саме цей перетин тут і перевіряється — на всіх гілках, які можуть випасти. */
  const classic = await evaluate(
    "(async () => { const t = document.querySelector('.block.trainer-block');" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " const num = t.querySelector('.trainer-num'); num.value = '12';" +
      " num.dispatchEvent(new Event('change'));" +
      " [...t.querySelectorAll('.kind-btn')].find(b => b.textContent === 'невідомо').click();" +
      " t.querySelector('.btn').click(); await pause(180);" +
      " const sim = t.querySelector('.sim');" +
      " const byNum = (k) => [...sim.querySelectorAll('.coin')].find(c => c.textContent === String(k));" +
      " const put = async (nums, times) => { for (const k of nums) { for (let j = 0; j < times; j++) { byNum(k).click(); await pause(8); } } };" +
      " const answer = async () => { for (const o of [...sim.querySelectorAll('.ask-opt')]) { o.click(); await pause(30);" +
      "   if (!sim.querySelector('.ask-opt')) return true; } return false; };" +
      " await put([1,2,3,4], 1); await put([5,6,7,8], 2);" +
      " sim.querySelector('.btn').click(); await pause(70);" +
      " const out1 = sim.querySelector('.sim-verdict').textContent;" +
      " await answer(); const said1 = sim.querySelector('.sim-verdict').textContent;" +
      " if (out1.includes('рівновага')) { await put([9,10], 1); await put([11,12], 2); }" +
      " else { await put([1,2,5], 1); await put([3,4,6], 2); }" +
      " sim.querySelector('.btn').click(); await pause(70);" +
      " const out2 = sim.querySelector('.sim-verdict').textContent;" +
      " await answer(); const said2 = sim.querySelector('.sim-verdict').textContent;" +
      " return JSON.stringify({ out1, said1, out2, said2 }); })()"
  );

  const played = JSON.parse(classic);
  const tiltOf = (text) =>
    text.includes("рівновага") ? "рівно" : text.includes("ліва чаша опустилася") ? "ліва" : "права";
  const suspectsOf = (text) => {
    const at = text.indexOf(": ");
    const end = text.indexOf(". Решта");
    return at < 0 || end < 0 ? text.trim() : text.slice(at + 2, end);
  };
  const AFTER_FIRST = {
    ліва: "№1В, №2В, №3В, №4В, №5Л, №6Л, №7Л, №8Л",
    права: "№1Л, №2Л, №3Л, №4Л, №5В, №6В, №7В, №8В",
    рівно: "№9, №10, №11, №12",
  };
  const AFTER_SECOND = {
    "ліва/ліва": "№1В, №2В, №6Л",
    "ліва/права": "№3В, №4В, №5Л",
    "ліва/рівно": "№7Л, №8Л",
    "права/ліва": "№3Л, №4Л, №5В",
    "права/права": "№1Л, №2Л, №6В",
    "права/рівно": "№7В, №8В",
    "рівно/ліва": "№9В, №10В, №11Л, №12Л",
    "рівно/права": "№9Л, №10Л, №11В, №12В",
  };
  const first = tiltOf(played.out1);
  const second = tiltOf(played.out2);
  const gotFirst = suspectsOf(played.said1);
  const gotSecond = suspectsOf(played.said2);
  expect(
    "мітки В/Л роздані правильно (" + first + ")",
    gotFirst === AFTER_FIRST[first],
    gotFirst + (gotFirst === AFTER_FIRST[first] ? "" : " ≠ " + AFTER_FIRST[first])
  );
  const markLetters = await evaluate(
    "(() => { const t = document.querySelector('.block.trainer-block');" +
      " return [...t.querySelectorAll('.coin.sus-heavy, .coin.sus-light')].map(c => getComputedStyle(c, '::after').content).sort().filter((x, i, a) => a.indexOf(x) === i).join(''); })()"
  );
  expect("підозри позначені буквами В і Л, не стрілками", /^("[ВЛ]")+$/.test(markLetters), markLetters);
  expect(
    "перехресне зважування вирізає монети правильно (" + first + "/" + second + ")",
    gotSecond === AFTER_SECOND[first + "/" + second],
    gotSecond + (gotSecond === AFTER_SECOND[first + "/" + second] ? "" : " ≠ " + AFTER_SECOND[first + "/" + second])
  );

  // Тренажер: будь-яка кількість монет і режим «невідомо».
  const trainerBig = await evaluate(
    "(async () => { const t = document.querySelector('.block.trainer-block');" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " const num = t.querySelector('.trainer-num'); num.value = '100';" +
      " num.dispatchEvent(new Event('change'));" +
      " [...t.querySelectorAll('.kind-btn')].find(b => b.textContent === 'невідомо').click();" +
      " t.querySelector('.btn').click(); await pause(150);" +
      " const sim = t.querySelector('.sim');" +
      " return sim.querySelectorAll('.coin').length + '|' + sim.classList.contains('many')" +
      "   + '|' + t.querySelector('.trainer-goal').textContent.trim().slice(0, 21); })()"
  );
  expect("тренажер бере 100 монет і рахує межу для невідомого напряму", trainerBig === "100|true|Вистачить 5 зважувань", trainerBig);

  // Еталон на старті живе лише в l02: тренажер і монети l01 про нього не знають.
  const l01Untouched = await evaluate(
    "(() => { const t = document.querySelector('.block.trainer-block');" +
      " return t.querySelector('.trainer-goal').textContent.includes('кожна монета дає два варіанти')" +
      "   + '|' + t.querySelectorAll('[data-known]').length + '|' + document.querySelectorAll('.coin.known, .coin[title]').length; })()"
  );
  expect("тренажер і монети l01 не знають про еталон на старті", l01Untouched === "true|0|0", l01Untouched);

  // У режимі «невідомо» після нерівноваги чесна відповідь — «на чашах, поки не знаю, на якій».
  const unknownAsk = await evaluate(
    "(async () => { const t = document.querySelector('.block.trainer-block');" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " const num = t.querySelector('.trainer-num'); num.value = '4';" +
      " num.dispatchEvent(new Event('change'));" +
      " t.querySelector('.btn').click(); await pause(150);" +
      " const sim = t.querySelector('.sim'); const coins = [...sim.querySelectorAll('.coin')];" +
      " coins[0].click(); coins[1].click(); coins[1].click();" +
      " sim.querySelector('.btn').click(); await pause(60);" +
      " const balanced = sim.querySelector('.sim-verdict').textContent.includes('рівновага');" +
      " const labels = [...sim.querySelectorAll('.ask-opt')].map(o => o.textContent);" +
      " const want = balanced ? 'Серед тих, що на столі' : 'Хто внизу — підозра «важча» В, хто вгорі — «легша» Л';" +
      " const button = [...sim.querySelectorAll('.ask-opt')].find(o => o.textContent === want);" +
      " button.click(); await pause(40);" +
      " return labels.length + '|' + (sim.querySelector('.ask-opt') ? 'лишилось' : 'прийнято'); })()"
  );
  expect("у режимі «невідомо» нерівновага питає про напрям підозри", unknownAsk === "3|прийнято", unknownAsk);

  // Другий симулятор — девʼять монет із лімітом на два зважування.
  const limited = await evaluate(
    "(async () => { const sim = [...document.querySelectorAll('.sim')][1];" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " sim.querySelectorAll('.ghost-btn')[2].click(); await pause(30);" +
      " for (let round = 0; round < 3; round++) {" +
      "   sim.querySelectorAll('.ghost-btn')[1].click(); await pause(20);" +
      "   const coins = [...sim.querySelectorAll('.coin')];" +
      "   coins[0].click(); coins[1].click(); coins[1].click();" +
      "   sim.querySelector('.btn').click(); await pause(40);" +
      "   for (const option of [...sim.querySelectorAll('.ask-opt')]) {" +
      "     option.click(); await pause(20);" +
      "     if (!sim.querySelector('.ask-opt')) break; } }" +
      " return sim.querySelector('.sim-verdict').textContent; })()"
  );
  expect("ліміт зважувань спрацьовує", limited.includes("скінчилися"), limited.slice(0, 60));

  // Темна панель терезів стоїть і на пергаментній картці задачі — її кнопки та згортки
  // не мають перефарбовуватись у колір пергаменту й зливатися з тлом.
  const simOnParchment = await evaluate(
    "(() => { const pick = (sel) => { const n = document.querySelector(sel); const s = getComputedStyle(n); return s.color; };" +
      /* Беремо «Зняти з чаш»: кнопка «Назвати фальшиву» перемикається й міняє колір навмисно. */
      " const a = pick('.block.scales-block .sim .toolbar .ghost-btn:nth-of-type(3)');" +
      " const b = pick('.block.problem .sim .toolbar .ghost-btn:nth-of-type(3)');" +
      " const c = pick('.block.problem .sim details summary');" +
      " return (a === b ? 'ok' : a + ' проти ' + b) + '|' + (a === c ? 'ok' : a + ' проти ' + c); })()"
  );
  expect("кнопки терезів читаються й усередині задачі", simOnParchment === "ok|ok", simOnParchment);

  /* ---------- завдання ---------- */

  const quiz = await evaluate(
    "(async () => { const b = document.querySelector('.block.quiz'); b.querySelectorAll('.option')[2].click();" +
      " await new Promise(r => setTimeout(r, 40)); return b.querySelector('.verdict').className + '|' + b.querySelector('.done-mark').textContent; })()"
  );
  expect("quiz зараховує правильну відповідь", quiz === "verdict ok|✓", quiz);

  const quizWrong = await evaluate(
    "(async () => { const b = document.querySelector('.block.quiz'); b.querySelectorAll('.option')[0].click();" +
      " await new Promise(r => setTimeout(r, 40)); return b.querySelector('.verdict').className; })()"
  );
  expect("quiz не зараховує хибну відповідь", quizWrong === "verdict no", quizWrong);

  const input = await evaluate(
    "(async () => { const b = document.querySelector('.block.input'); const f = b.querySelector('.answer-input');" +
      " f.value = '  3 '; b.querySelector('.btn').click(); await new Promise(r => setTimeout(r, 40));" +
      " return b.querySelector('.verdict').className + '|' + b.querySelector('.done-mark').textContent; })()"
  );
  expect("input приймає відповідь із зайвими пробілами", input === "verdict ok|✓", input);

  const multi = await evaluate(
    "(async () => { const b = document.querySelector('.block.multi'); const opts = b.querySelectorAll('.option');" +
      " opts[1].click(); opts[2].click(); b.querySelector('.btn').click(); await new Promise(r => setTimeout(r, 40));" +
      " return b.querySelector('.verdict').className + '|' + b.querySelector('.done-mark').textContent; })()"
  );
  expect("multi зараховує повний набір", multi === "verdict ok|✓", multi);

  const order = await evaluate(
    "(async () => { const b = document.querySelector('.block.order');" +
      " for (let step = 0; step < 4; step++) {" +
      "   const want = ['Поділити','Дві купки','За результатом','Повторити'][step];" +
      "   [...b.querySelectorAll('.chip')].find(c => c.textContent.startsWith(want)).click();" +
      "   await new Promise(r => setTimeout(r, 30)); }" +
      " return b.querySelector('.verdict').className + '|' + b.querySelector('.done-mark').textContent; })()"
  );
  expect("order зараховує правильну послідовність", order === "verdict ok|✓", order);

  // Кнопка самоперевірки потрібна темам без симулятора. Якщо в занятті терези скрізь — пропускаємо.
  const selfCheck = await evaluate(
    "(async () => { const b = [...document.querySelectorAll('.block.problem')].find(p => !p.querySelector('.sim'));" +
      " if (!b) return 'у цьому занятті терези є в кожній задачі';" +
      " b.querySelector('.btn').click(); await new Promise(r => setTimeout(r, 40));" +
      " return b.querySelector('.done-mark').textContent; })()"
  );
  expect("задача без терезів зараховується кнопкою", selfCheck === "✓" || selfCheck.startsWith("у цьому"), selfCheck);

  // Домашнє: список задано, позначки стоять, стрибок працює.
  const homework = await evaluate(
    "(async () => { const card = document.querySelector('.block.homework');" +
      " if (!card) return 'картки домашнього немає';" +
      " const listed = [...card.querySelectorAll('.hw-num')].map(n => n.textContent).join(',');" +
      " const marked = [...document.querySelectorAll('.block.problem.homework-task')]" +
      "   .map(p => p.getAttribute('data-problem')).join(',');" +
      " const badges = document.querySelectorAll('.block.problem .hw-badge').length;" +
      " return listed + '|' + marked + '|' + badges; })()"
  );
  expect("домашнє позначене: 1, 3, 5, 10", homework === "1,3,5,10|1,3,5,10|4", homework);

  // Свічки: кожна запалена відкриває рівно одну підказку, і ні слова більше.
  const candles = await evaluate(
    "(async () => { const task = document.querySelector('[data-problem=\"10\"]');" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " const box = task.querySelector('.hint-box'); if (!box) return 'свічок немає';" +
      " const before = box.querySelectorAll('.hint-line').length;" +
      " const candle = box.querySelector('.candle');" +
      " candle.click(); await pause(20);" +
      " const afterOne = box.querySelectorAll('.hint-line').length;" +
      " while (!candle.disabled) { candle.click(); await pause(15); }" +
      " return before + '|' + afterOne + '|' + box.querySelectorAll('.hint-line').length" +
      "   + '|' + (box.querySelector('.hint-last') ? 'догоріли' : 'нема'); })()"
  );
  expect("підказки-свічки відкриваються по одній", candles === "0|1|4|догоріли", candles);

  // Кожна задача має або терези, або кнопку самоперевірки — інакше її нічим закрити.
  const closable = await evaluate(
    "(() => { const all = [...document.querySelectorAll('.block.problem')];" +
      " const bad = all.filter(p => !p.querySelector('.sim') && !p.querySelector('.btn'));" +
      " return all.length + '|' + bad.length; })()"
  );
  expect("кожну задачу є чим закрити", /\|0$/.test(closable), closable);

  /* ---------- прогрес і верстка ---------- */

  await go("#/l/l02");
  const boundaries = await evaluate(
    "[" +
      "SCALES.minWeighings(4, 'unknown', 0), SCALES.minWeighings(5, 'unknown', 0)," +
      "SCALES.minWeighings(13, 'unknown', 0), SCALES.minWeighings(14, 'unknown', 0)," +
      "SCALES.minWeighings(40, 'unknown', 0), SCALES.minWeighings(41, 'unknown', 0)," +
      "SCALES.minWeighings(5, 'unknown', 1), SCALES.minWeighings(6, 'unknown', 1)," +
      "SCALES.minWeighings(14, 'unknown', 1), SCALES.minWeighings(15, 'unknown', 1)," +
      "SCALES.minWeighings(41, 'unknown', 1), SCALES.minWeighings(42, 'unknown', 1)" +
      "].join(',')"
  );
  expect(
    "межі без еталона й з еталоном перемикаються на правильних числах",
    boundaries === "2,3,3,4,4,5,2,3,3,4,4,5",
    boundaries
  );

  const lesson2Start = await evaluate(
    "(() => { const t = document.querySelector('.block.trainer-block');" +
      " return t.querySelector('.trainer-num').value + '|'" +
      "   + t.querySelector('[data-known=\"1\"]').classList.contains('on') + '|'" +
      "   + t.querySelectorAll('.sim .coin').length + '|'" +
      "   + t.querySelectorAll('.sim .coin.known.out').length + '|'" +
      "   + t.querySelector('.trainer-goal').textContent.trim(); })()"
  );
  expect(
    "l02 починає тренажер із 5 підозрілих та еталона на старті",
    lesson2Start.startsWith("5|true|6|1|Вистачить 2 зважування"),
    lesson2Start
  );

  const trainerToggle = await evaluate(
    "(async () => { const t = document.querySelector('.block.trainer-block');" +
      " const pause = () => new Promise(r => setTimeout(r, 80));" +
      " const start = t.querySelector('.trainer-controls .btn');" +
      " t.querySelector('[data-known=\"0\"]').click(); start.click(); await pause();" +
      " const without = t.querySelectorAll('.sim .coin').length + '/' + t.querySelectorAll('.sim .coin.known').length" +
      "   + '/' + t.querySelector('.trainer-goal').textContent.trim();" +
      " t.querySelector('[data-known=\"1\"]').click(); start.click(); await pause();" +
      " const withCoin = t.querySelectorAll('.sim .coin').length + '/' + t.querySelectorAll('.sim .coin.known').length" +
      "   + '/' + t.querySelector('.trainer-goal').textContent.trim();" +
      " return without + '|' + withCoin; })()"
  );
  expect(
    "перемикач еталона змінює межу 5 монет із 3 зважувань на 2",
    trainerToggle.startsWith("5/0/Вистачить 3 зважування") && trainerToggle.includes("|6/1/Вистачить 2 зважування"),
    trainerToggle
  );

  const lesson2Configs = await evaluate(
    "JSON.stringify([...document.querySelectorAll('.block.problem')].filter(p => p.querySelector('.sim')).map(p => ({" +
      " title: p.querySelector('.block-head span:nth-child(2)').textContent," +
      " coins: p.querySelectorAll('.sim .coin').length," +
      " known: p.querySelectorAll('.sim .coin.known.out').length," +
      " counter: p.querySelector('.sim-stat').textContent" +
      "})))"
  );
  const lesson2SimData = JSON.parse(lesson2Configs);
  expect(
    "симулятори l02 мають 5+еталон/2 і 14+еталон/3",
    lesson2SimData.length === 2 &&
      lesson2SimData[0].coins === 6 && lesson2SimData[0].known === 1 && lesson2SimData[0].counter.includes("0 з 2") &&
      lesson2SimData[1].coins === 15 && lesson2SimData[1].known === 1 && lesson2SimData[1].counter.includes("0 з 3"),
    lesson2Configs
  );

  /* Еталон ✓ — інструмент: на полиці не тьмяніє, назвати його фальшивим не можна, і фальшивим він не буває ніколи. */
  const knownShelf = await evaluate(
    "(() => { const c = document.querySelector('.block.problem .sim .tray.spare .coin.known');" +
      " return c ? getComputedStyle(c).opacity : 'немає на полиці'; })()"
  );
  expect("еталон ✓ на полиці не тьмяніє", knownShelf === "1", knownShelf);

  const knownDeclared = await evaluate(
    "(async () => { const sim = document.querySelector('.block.problem .sim');" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " const arm = sim.querySelectorAll('.ghost-btn')[0];" +
      " arm.click(); await pause(20); sim.querySelector('.coin.known').click(); await pause(20);" +
      " const said = sim.querySelector('.sim-verdict').className + '|' + sim.querySelector('.sim-verdict').textContent;" +
      " arm.click(); await pause(20); return said; })()"
  );
  expect("еталон ✓ не можна назвати фальшивим", /^sim-verdict no\|Монета ✓ — еталон на старті/.test(knownDeclared), knownDeclared.slice(0, 60));

  const fakeNeverKnown = await evaluate(
    "(async () => { const sim = document.querySelector('.block.problem .sim');" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " const [arm, , reset] = sim.querySelectorAll('.ghost-btn'); const found = new Set();" +
      " for (let round = 0; round < 40; round++) {" +
      "   reset.click(); await pause(5); arm.click(); await pause(5);" +
      "   for (const coin of [...sim.querySelectorAll('.coin')]) {" +
      "     coin.click(); await pause(3);" +
      "     if (sim.querySelector('.sim-verdict').classList.contains('ok')) { found.add(coin.textContent); break; } } }" +
      " reset.click(); await pause(20);" +
      " return [...found].sort().join(','); })()"
  );
  expect("фальшивою буває лише підозріла монета, не еталон ✓", fakeNeverKnown.length > 0 && !fakeNeverKnown.includes("✓"), fakeNeverKnown);

  const knownUsable = await evaluate(
    "(async () => { const sim = document.querySelector('.block.problem .sim');" +
      " const coin = sim.querySelector('.coin.known'); coin.click(); await new Promise(r => setTimeout(r, 30));" +
      " return sim.querySelector('.arm.left .coin.known') ? 'еталон на чаші' : 'не переїхала'; })()"
  );
  expect("еталон на старті можна покласти на чашу", knownUsable === "еталон на чаші", knownUsable);

  const lesson2Progress = await evaluate(
    "(async () => { const q = document.querySelector('.block.quiz'); q.querySelectorAll('.option')[1].click();" +
      " await new Promise(r => setTimeout(r, 40)); return localStorage.getItem('chyslomahiya.v1') || ''; })()"
  );

  expect("взаємодія з l02 пише окремий ключ прогресу", lesson2Progress.includes('"l02:q1"'), lesson2Progress.slice(0, 100));
  expect(
    "прогрес l01 лишається після взаємодії з l02",
    lesson2Progress.includes('"l01:') && lesson2Progress.includes('"l02:'),
    lesson2Progress.slice(0, 100)
  );

  const mini = await evaluate("document.getElementById('progressMini').textContent");
  expect("лічильник угорі рахує", /^[1-9]/.test(mini), mini);

  /* ---------- відра без поділок (l03) ---------- */

  await go("#/l/l03");

  // Найкоротші шляхи — пошук ушир. Приклади зі сторінки 11 і домашні задачі мають збігатися з таблицями.
  const pourBest = await evaluate(
    "[" +
      "JUGS.shortest({ vessels: [7, 10], source: 'lake', target: 8 })," +
      "JUGS.shortest({ vessels: [14, 9, 5], start: [14, 0, 0], target: 3, targetIn: [1, 2] })," +
      "JUGS.shortest({ vessels: [5, 3], source: 'tap', target: 4 })," +
      "JUGS.shortest({ vessels: [5, 9], source: 'river', target: 3 })," +
      "JUGS.shortest({ vessels: [4, 9], source: 'river', target: 7 })," +
      "JUGS.shortest({ vessels: [8, 5, 3], start: [8, 0, 0], target: 4 })," +
      "JUGS.shortest({ vessels: [6, 9], source: 'lake', target: 4 })" +
      "].join(',')"
  );
  expect("найкоротші шляхи: 12, 8, 6, 8, 10, 6 і неможливо для 6/9 → 4", pourBest === "12,8,6,8,10,6,-1", pourBest);

  const circleRows = await evaluate("[JUGS.circleRow(3, 7), JUGS.circleRow(9, 5), JUGS.circleRow(6, 9)].map(r => r.join(' ')).join('|')");
  expect("рядок кола рахується правильно", circleRows === "3 6 2 5 1 4|5 1 6 2 7 3 8 4|6 3", circleRows);

  // Таблиці розвʼязань рахує рушій; кожна мусить закінчитися відповіддю, підсвіченою в останньому рядку.
  const pourTables = await evaluate(
    "(() => { const all = [...document.querySelectorAll('.block .pour-table')].filter(t => !t.closest('.sim'));" +
      " return all.length + '|' + all.filter(t => !t.querySelector('tbody tr:last-child td.hit')).length; })()"
  );
  expect("усі 12 таблиць у розвʼязаннях закінчуються відповіддю", pourTables === "12|0", pourTables);

  const homework3 = await evaluate(
    "(() => { const card = document.querySelector('.block.homework');" +
      " const listed = [...card.querySelectorAll('.hw-num')].map(n => n.textContent).join(',');" +
      " const marked = [...document.querySelectorAll('.block.problem.homework-task')].map(p => p.getAttribute('data-problem')).join(',');" +
      " return listed + '|' + marked + '|' + document.querySelectorAll('.block.problem .hw-badge').length; })()"
  );
  expect("домашнє l03 позначене: 2, 6, 7", homework3 === "2,6,7|2,6,7|3", homework3);

  /* Домашня задача 2 руками: після переливання до краю відро накривається кришкою, лити далі не можна,
     хибна відповідь не приймається, правильна — відкриває відро. Шість кроків — найкоротший шлях. */
  const solved2 = JSON.parse(
    await evaluate(
      "(async () => { const task = document.querySelector('[data-problem=\"2\"]'); const sim = task.querySelector('.sim');" +
        " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
        " const act = async (code) => { sim.querySelector('[data-act=\"' + code + '\"]').click(); await pause(20); };" +
        " const say = async (v) => { sim.querySelector('.ask-opt[data-v=\"' + v + '\"]').click(); await pause(20); };" +
        " await act('F0'); await act('P01');" +
        " const asked = sim.querySelector('.ask-q') ? sim.querySelector('.ask-q').textContent : 'не спитали';" +
        " const lidded = sim.querySelector('.jug.lidded');" +
        " const lid = lidded ? getComputedStyle(lidded, '::after').content + ' ' + lidded.closest('.jug-col').querySelector('.jug-amt').textContent : 'без кришки';" +
        " const blocked = sim.querySelector('[data-act=\"E1\"]').disabled;" +
        " await say(3); const wrong = sim.querySelector('.sim-verdict').className;" +
        " await say(2); const taken = sim.querySelector('.ask-q') ? 'ще питає' : 'прийнято';" +
        " await act('E1'); await act('P01'); await act('F0'); await act('P01'); await say(4);" +
        " return JSON.stringify({ asked, lid, blocked, wrong, taken," +
        "   verdict: sim.querySelector('.sim-verdict').textContent, done: task.querySelector('.done-mark').textContent," +
        "   rows: sim.querySelectorAll('.pour-table tbody tr').length, goal: sim.querySelectorAll('.jug.goal').length }); })()"
    )
  );
  expect(
    "переливання до краю питає, скільки лишилося, і ховає рівень під кришку",
    solved2.asked === "Скільки літрів тепер у відрі на 5 л?" && solved2.lid === '"?" ?' && solved2.blocked,
    solved2.asked + " | " + solved2.lid + " | " + solved2.blocked
  );
  expect("хибну відповідь не приймає, правильну — так", solved2.wrong === "sim-verdict no" && solved2.taken === "прийнято", solved2.wrong + " | " + solved2.taken);
  expect(
    "задача 2 розвʼязується за 6 кроків і зараховується",
    solved2.verdict.startsWith("Готово! 4 л у відрі на 5 л. Кроків: 6. Це найкоротший шлях") &&
      solved2.done === "✓" && solved2.rows === 7 && solved2.goal === 1,
    solved2.verdict.slice(0, 70) + " | " + solved2.done + " | рядків " + solved2.rows
  );

  // Рон ллє туди-сюди: стан повторюється, симулятор каже про це й червонить рядки; «Крок назад» працює.
  const ronLoop = JSON.parse(
    await evaluate(
      "(async () => { const sim = document.querySelector('[data-problem=\"1\"] .sim');" +
        " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
        " const act = async (code) => { sim.querySelector('[data-act=\"' + code + '\"]').click(); await pause(20); };" +
        " await act('F0'); await act('P01'); await act('P10'); const first = sim.querySelector('.sim-verdict').textContent;" +
        " await act('E0'); const second = sim.querySelector('.sim-verdict').textContent;" +
        " const red = sim.querySelectorAll('.pour-table tr.repeat').length;" +
        " sim.querySelectorAll('.toolbar .ghost-btn')[0].click(); await pause(20);" +
        " const rows = sim.querySelectorAll('.pour-table tbody tr').length;" +
        " sim.querySelectorAll('.toolbar .ghost-btn')[1].click(); await pause(20);" +
        " return JSON.stringify({ first, second, red, rows }); })()"
    )
  );
  expect(
    "повтор стану помічено, рядки почервоніли, крок назад працює",
    ronLoop.first.includes("після кроку 1") && ronLoop.second.includes("на самому початку") && ronLoop.red === 2 && ronLoop.rows === 4,
    JSON.stringify(ronLoop).slice(0, 160)
  );

  // Задача 11: не той бік кола — і десять кроків закінчуються раніше, ніж зʼявляється шістка.
  const pourLimit = await evaluate(
    "(async () => { const sim = document.querySelector('[data-problem=\"11\"] .sim');" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " const answer = async () => { for (const o of [...sim.querySelectorAll('.ask-opt')]) { o.click(); await pause(8);" +
      "   if (!sim.querySelector('.ask-opt')) return; } };" +
      " for (const code of ['F1','P10','E0','P10','F1','P10','E0','P10','E0','P10']) {" +
      "   sim.querySelector('[data-act=\"' + code + '\"]').click(); await pause(12); await answer(); }" +
      " const live = [...sim.querySelectorAll('.jug-btn')].filter(b => !b.disabled).length;" +
      " return sim.querySelector('.sim-verdict').textContent + '|' + live + '|' + sim.querySelector('.sim-stat').textContent; })()"
  );
  expect("ліміт кроків спрацьовує", pourLimit.startsWith("Кроки скінчилися: 10 з 10") && pourLimit.endsWith("|0|Кроків: 10 з 10"), pourLimit.slice(0, 80));

  // Пісочниця: коло «мале у велике» для 3 і 7 проходить усі числа від 1 до 7.
  const collected = await evaluate(
    "(async () => { const block = document.querySelector('.block.jugs-block'); const sim = block.querySelector('.sim');" +
      " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
      " const answer = async () => { for (const o of [...sim.querySelectorAll('.ask-opt')]) { o.click(); await pause(6);" +
      "   if (!sim.querySelector('.ask-opt')) return; } };" +
      " const amount = (i) => sim.querySelectorAll('.jug-amt')[i].textContent;" +
      " for (let k = 0; k < 40 && !block.querySelector('.done-mark').textContent; k++) {" +
      "   const code = amount(0).startsWith('0') ? 'F0' : amount(1).startsWith('7') ? 'E1' : 'P01';" +
      "   sim.querySelector('[data-act=\"' + code + '\"]').click(); await pause(8); await answer(); }" +
      " return sim.querySelectorAll('.collect-chip.on').length + '|' + block.querySelector('.done-mark').textContent" +
      "   + '|' + sim.querySelector('.sim-verdict').textContent; })()"
  );
  expect("пісочниця збирає всі числа від 1 до 7 і зараховується", collected.startsWith("7|✓|Усі числа зібрано"), collected.slice(0, 60));

  // Тренажер: НСД каже «неможливо», а режим «рівно найкоротший» дає рівно стільки кроків, скільки треба.
  const pourTrainer = JSON.parse(
    await evaluate(
      "(async () => { const t = document.querySelector('.block.trainer-block');" +
        " const pause = (ms) => new Promise(r => setTimeout(r, ms));" +
        " const [a, b, c] = t.querySelectorAll('.trainer-num');" +
        " const set = (input, v) => { input.value = String(v); input.dispatchEvent(new Event('change')); };" +
        " set(a, 6); set(b, 9); set(c, 4); await pause(20);" +
        " const impossible = t.querySelector('.trainer-goal').textContent;" +
        " set(a, 5); set(b, 3); set(c, 4); t.querySelector('[data-strict=\"true\"]').click();" +
        " t.querySelector('.trainer-controls .btn').click(); await pause(80);" +
        " return JSON.stringify({ impossible, possible: t.querySelector('.trainer-goal').textContent," +
        "   counter: t.querySelector('.sim-stat').textContent, jugs: t.querySelectorAll('.jug').length }); })()"
    )
  );
  expect(
    "тренажер відрізняє неможливе за НСД і дає рівно найкоротший ліміт",
    pourTrainer.impossible.startsWith("Неможливо: НСД(6, 9) = 3") &&
      pourTrainer.possible.includes("Найкоротший шлях — 6 кроків") &&
      pourTrainer.counter === "Кроків: 0 з 6" &&
      pourTrainer.jugs === 2,
    JSON.stringify(pourTrainer).slice(0, 200)
  );

  const pourButtons = await evaluate(
    "(() => { const color = (sel) => getComputedStyle(document.querySelector(sel)).color;" +
      " const a = color('.block.jugs-block .jug-btn'); const b = color('.block.problem .jug-btn');" +
      " return a === b ? 'ok' : a + ' проти ' + b; })()"
  );
  expect("кнопки відер читаються й усередині задачі", pourButtons === "ok", pourButtons);

  const lesson3Progress = await evaluate("localStorage.getItem('chyslomahiya.v1') || ''");
  expect(
    "відра пишуть прогрес l03 окремо й не чіпають інших занять",
    lesson3Progress.includes('"l03:p2"') && lesson3Progress.includes('"l03:sand"') && lesson3Progress.includes('"l01:'),
    lesson3Progress.slice(0, 100)
  );

  /* ---------- телефон і планшет ---------- */

  const SCREENS = [
    { name: "вузький телефон 320", width: 320, height: 720 },
    { name: "телефон 360", width: 360, height: 800 },
    { name: "телефон", width: 390, height: 844 },
    { name: "планшет", width: 820, height: 1180 },
  ];

  for (const id of LESSONS) {
    await go("#/l/" + id);
    for (const screen of SCREENS) {
      await call("Emulation.setDeviceMetricsOverride", {
        width: screen.width,
        height: screen.height,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await sleep(300);
      const widths = JSON.parse(
        await evaluate(
          "JSON.stringify({ page: document.documentElement.scrollWidth - document.documentElement.clientWidth," +
            " block: Math.max(0, ...[...document.querySelectorAll('.block')].map(b => b.scrollWidth - b.clientWidth))," +
            " offenders: [...document.querySelectorAll('.block')].filter(b => b.scrollWidth > b.clientWidth)" +
            "   .map(b => (b.querySelector('.block-head span:nth-child(2)')?.textContent || b.className)" +
            "     + ':' + (b.scrollWidth - b.clientWidth)).join(', ') })"
        )
      );
      expect(
        id + " на екрані «" + screen.name + "» не обрізається",
        widths.page <= 0 && widths.block <= 0,
        "сторінка: " + widths.page + ", блок: " + widths.block + (widths.offenders ? ", " + widths.offenders : "")
      );
    }
  }

  // Палець має тягнути монету так само, як миша. Дотики справжні, не підроблені кліки.
  await go("#/l/l01");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await call("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await sleep(300);
  await evaluate(
    "(async () => { const sim = document.querySelector('.block.scales-block .sim');" +
      " sim.querySelectorAll('.ghost-btn')[2].click(); sim.scrollIntoView({ block: 'center' });" +
      " await new Promise(r => setTimeout(r, 350)); })()"
  );
  const finger = JSON.parse(
    await evaluate(
      "(() => { const sim = document.querySelector('.block.scales-block .sim');" +
        " const c = sim.querySelector('.coin').getBoundingClientRect();" +
        " const p = sim.querySelector('.arm.left .pan').getBoundingClientRect();" +
        " return JSON.stringify({ cx: c.left + c.width / 2, cy: c.top + c.height / 2," +
        "   px: p.left + p.width / 2, py: p.top + p.height / 2, size: Math.round(c.width) }); })()"
    )
  );
  await call("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: finger.cx, y: finger.cy, id: 1 }] });
  for (let step = 1; step <= 6; step++) {
    await call("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: finger.cx + ((finger.px - finger.cx) * step) / 6, y: finger.cy + ((finger.py - finger.cy) * step) / 6, id: 1 }],
    });
  }
  await call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(200);
  const touched = await evaluate(
    "(() => { const sim = document.querySelector('.block.scales-block .sim');" +
      " return (sim.querySelector('.arm.left .coin') ? 'на лівій чаші' : 'не доїхала')" +
      "   + '|' + document.querySelectorAll('.drag-ghost').length; })()"
  );
  expect("пальцем монета теж перетягується", touched === "на лівій чаші|0", touched);

  // Дрібна монета — промах пальцем. Міряємо найменшу на сторінці.
  const smallest = await evaluate(
    "Math.round(Math.min(...[...document.querySelectorAll('.table-coins .coin')].map(c => c.getBoundingClientRect().width)))"
  );
  expect("монети на столі достатні під палець (від 32 px)", smallest >= 32, "найменша: " + smallest + " px");

  await call("Emulation.setTouchEmulationEnabled", { enabled: false });
  await call("Emulation.clearDeviceMetricsOverride");

  const errors = cdp.events
    .filter((event) => event.method === "Log.entryAdded" && event.params.entry.level === "error")
    .map((event) => event.params.entry.text);
  expect("у консолі немає помилок", errors.length === 0, errors.join(" | "));

  chrome.kill();
  if (failures.length) {
    console.error("\nПровалів: " + failures.length);
    process.exit(1);
  }
  console.log("\nУсе гаразд.");
  process.exit(0);
})().catch((error) => {
  console.error(error);
  chrome.kill();
  process.exit(1);
});
