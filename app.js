/* ------------------------------------------------------------------
   Quiz engine. No build step - just Bootstrap's CSS/JS plus this file.
   Reads data/catalog.json for the card list, then loads each test's
   own JSON file on demand (named slug_id.json).
   ------------------------------------------------------------------ */

let tests = [];   // the catalog: one entry per test, from data/catalog.json
let quiz = [];   // the questions for THIS round
let answers = [];   // what was picked for each question, null until answered
let currentTest = null;   // the catalog entry being taken, so it can be retaken
let current = 0;    // which question we are on (0-based)

// Grab the elements once, so we do not query the page over and over.
const el = {
  screenStart: document.getElementById('screen-start'),
  screenQuiz: document.getElementById('screen-quiz'),
  screenResult: document.getElementById('screen-result'),
  quizGrid: document.getElementById('quiz-grid'),
  quizGridResult: document.getElementById('quiz-grid-result'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  btnRetake: document.getElementById('btn-retake'),
  btnReset: document.getElementById('btn-reset'),
  btnQuit: document.getElementById('btn-quit'),
  loadError: document.getElementById('load-error'),
  questionText: document.getElementById('question-text'),
  choices: document.getElementById('choices'),
  feedback: document.getElementById('feedback'),
  fbTitle: document.getElementById('feedback-title'),
  fbRule: document.getElementById('feedback-rule'),
  fbExplain: document.getElementById('feedback-explain'),
  quizTitle: document.getElementById('quiz-title'),
  questionNav: document.getElementById('question-nav'),
  progressText: document.getElementById('progress-text'),
  scoreText: document.getElementById('score-text'),
  finalTitle: document.getElementById('final-title'),
  finalScore: document.getElementById('final-score'),
  finalPercent: document.getElementById('final-percent'),
  finalMessage: document.getElementById('final-message')
};

/* ---------- 1. Load the catalog of tests ---------- */
async function loadTests() {
  try {
    const res = await fetch('data/catalog.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);

    // "published": false keeps a test in the catalog but off the site - a way
    // to park a half-written test without deleting the entry. Only an explicit
    // false hides it, so an entry with no key at all still shows.
    //
    // Filtered here rather than in renderTests because cards address their test
    // by position in this array; dropping entries later would shift every index
    // after the hidden one and open the wrong test.
    tests = (await res.json()).filter(t => t.published !== false);
    renderTests();
  } catch (err) {
    showError('Could not load the list of tests (' + err.message + ').');
  }
}

/* ---------- Which tests have been finished ----------
   Kept in the browser's localStorage, so it survives a refresh but stays
   on this device. Nothing is sent anywhere. Wrapped in try/catch because
   private browsing can refuse storage outright. */
const DONE_KEY = 'quizzes-done';

function readDone() {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY)) || {};
  } catch (err) {
    return {};                 // unavailable or corrupted - just show no badges
  }
}

function markDone(id) {
  try {
    const done = readDone();
    done[id] = true;
    localStorage.setItem(DONE_KEY, JSON.stringify(done));
  } catch (err) {
    /* storage refused - the badge simply will not stick */
  }
}

function clearDone() {
  try {
    localStorage.removeItem(DONE_KEY);
  } catch (err) {
    /* nothing stored to clear */
  }
}

/* ---------- Half-finished runs ----------
   Saved per test so someone can leave 13 questions in, take another test,
   and come back where they were. Answers are keyed by question id, so
   editing the test file later cannot shift them onto the wrong question. */
const PROGRESS_KEY = 'quizzes-progress';

function readProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch (err) {
    return {};
  }
}

function saveProgress() {
  if (!currentTest) return;
  try {
    const all = readProgress();
    const picked = {};
    answers.forEach((choice, i) => {
      if (choice !== null) picked[quiz[i].id] = choice;
    });
    all[currentTest.id] = { answers: picked, current: current };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch (err) {
    /* storage refused - the run just will not survive leaving */
  }
}

function clearProgress(id) {
  try {
    const all = readProgress();
    delete all[id];
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch (err) {
    /* nothing stored to clear */
  }
}

// Reattach saved answers to the questions currently in the file. Anything
// pointing at a question or choice that no longer exists is dropped, so an
// edited test file cannot restore a half-wrong run. Assumes quiz is loaded.
function restoreRun(saved) {
  if (!saved || !saved.answers) return false;

  const picked = quiz.map(q => {
    const choice = saved.answers[q.id];
    return (choice && q.choices[choice]) ? choice : null;
  });
  if (picked.every(a => a === null)) return false;    // nothing worth resuming

  answers = picked;
  current = Math.min(Math.max(parseInt(saved.current, 10) || 0, 0), quiz.length - 1);
  return true;
}

// How many answers are stored for a test, for the grid tint.
function answeredCount(id) {
  const saved = readProgress()[id];
  return saved && saved.answers ? Object.keys(saved.answers).length : 0;
}

/* ---------- 2. The test grid ----------
   One cell per test: just the name and an arrow, six across on desktop.
   Cell order follows the order in catalog.json. The same grid appears on
   the start screen and again under the results. */
function renderTests() {
  const done = readDone();

  const html = tests.map((test, i) => {
    // Finished tests are tinted rather than badged, so the label stays just
    // the name. A half-finished run gets its own tint and a tooltip.
    const started = done[test.id] ? 0 : answeredCount(test.id);
    const cls = 'btn btn-outline-primary d-flex justify-content-between align-items-center' +
      (done[test.id] ? ' quiz-grid-done' : (started ? ' quiz-grid-started' : ''));
    const tip = done[test.id]
      ? test.title + ' - done'
      : (started ? test.title + ' - ' + started + ' answered so far' : test.title);
    return '' +
      '<button type="button" data-test="' + i + '" class="' + cls + '"' +
      '        title="' + escapeHtml(tip) + '">' +
      '  <span class="text-truncate">' + escapeHtml(test.title) + '</span>' +
      '  <span class="quiz-grid-arrow ms-1">&rsaquo;</span>' +
      '</button>';
  }).join('');

  el.quizGrid.innerHTML = html;
  el.quizGridResult.innerHTML = html;
}


// One listener on the container, so cells added later still work.
function onTestClick(e) {
  const btn = e.target.closest('button[data-test]');
  if (btn) startQuiz(tests[Number(btn.dataset.test)], btn);
}
el.quizGrid.addEventListener('click', onTestClick);
el.quizGridResult.addEventListener('click', onTestClick);

/* ---------- 3. Start a round ---------- */
async function startQuiz(test, btn, fresh) {
  // Questions are fetched on demand, then kept for retakes.
  // Filename is slug + id: slug "safety", id "1" -> data/safety_1.json
  if (!test.questions) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Loading...';
    }
    try {
      const res = await fetch('data/' + test.slug + '_' + test.id + '.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data.questions)) throw new Error('no "questions" array in the file');
      test.questions = data.questions;
      test.name = data.name;          // the title as stored in the test file
    } catch (err) {
      showError('Could not load "' + test.title + '" (' + err.message + ').');
      return;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Start test';
      }
    }
  }

  currentTest = test;

  // Questions always run in file order.
  quiz = test.questions.slice();

  // Pick up where they left off, unless this is a deliberate retake.
  const saved = fresh ? null : readProgress()[test.id];
  const resumed = restoreRun(saved);
  if (!resumed) {
    answers = quiz.map(() => null);
    current = 0;
    clearProgress(test.id);
  }

  hideError();
  show(el.screenQuiz);
  renderQuestion();
}

/* ---------- 4. Draw one question ---------- */
function renderQuestion() {
  const q = quiz[current];
  const picked = answers[current];     // null if not answered yet

  el.quizTitle.textContent = currentTest ? currentTest.title : '';

  // Both numbers are array positions, never anything from a test file, so
  // there is nothing here that needs escaping.
  el.progressText.innerHTML = 'Question <span class="quiz-count-now">' +
    (current + 1) + '</span> of ' + quiz.length;
  el.scoreText.textContent = 'Score ' + scoreSoFar();

  el.questionText.textContent = q.q;

  el.choices.innerHTML = '';
  choiceKeys(q).forEach(letter => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'list-group-item list-group-item-action';
    btn.dataset.choice = letter;

    const key = document.createElement('span');
    key.className = 'quiz-key';
    key.textContent = letter;
    btn.appendChild(key);
    btn.appendChild(document.createTextNode(q.choices[letter]));

    btn.addEventListener('click', () => answer(letter));
    el.choices.appendChild(btn);
  });

  // Coming back to a question you already answered shows it as you left it.
  if (picked === null) {
    el.feedback.classList.add('d-none');
  } else {
    markAnswered(picked);
  }

  renderQuestionNav();
  updateNav();
}

// Paint the answered state. A wrong pick goes red and nothing else moves - the
// right answer is deliberately NOT revealed, so they have to think and pick
// again rather than being handed it. Choices stay clickable, and a later pick
// overwrites the earlier one, so getting there on the second try counts.
function markAnswered(picked) {
  const q = quiz[current];
  const correct = (picked === q.answer);

  el.choices.querySelectorAll('button').forEach(b => {
    b.classList.remove('quiz-correct', 'quiz-wrong');   // clear the previous pick
    if (b.dataset.choice !== picked) return;            // only ever mark their own pick
    b.classList.add(correct ? 'quiz-correct' : 'quiz-wrong');
  });

  // The letter is a choice key, validated as a single letter, so it is safe
  // to drop into markup.
  el.fbTitle.innerHTML = correct
    ? '<span class="fw-bold">Correct</span>'
    : '<span class="fw-bold">' + picked + '</span> is incorrect &mdash; try another.';

  // Only shown once they have it right. An explanation on a wrong answer would
  // hand over the thing we just declined to highlight.
  const explain = correct ? (q.explain || '') : '';
  el.fbExplain.textContent = explain;
  el.fbExplain.classList.toggle('d-none', explain === '');
  el.fbRule.classList.toggle('d-none', explain === '');
  el.feedback.classList.remove('d-none');
}

/* ---------- The question strip ----------
   A window of NAV_PAGE cells with a chevron each side, rather than all 80 at
   once. The window is derived from `current`, never stored - so jumping by any
   route (chevron, cell, Next, resuming a saved run) lands on a strip showing
   the question you are actually on. Tinted by how each was answered, redrawn
   whenever an answer changes. State is in the aria-label too - colour alone
   would leave a screen reader with bare numbers. */
const NAV_PAGE = 10;

function navStep(dir, disabled, target) {
  return '<button type="button" class="quiz-qnav-btn quiz-qnav-step"' +
    (disabled ? ' disabled' : ' data-q="' + target + '"') +
    ' aria-label="' + (dir === 'prev' ? 'Previous' : 'Next') + ' ' + NAV_PAGE + ' questions">' +
    (dir === 'prev' ? '&lsaquo;' : '&rsaquo;') +
    '</button>';
}

function renderQuestionNav() {
  const pages = Math.ceil(quiz.length / NAV_PAGE);
  const page = Math.floor(current / NAV_PAGE);
  const start = page * NAV_PAGE;
  const end = Math.min(start + NAV_PAGE, quiz.length);

  let cells = '';

  for (let i = start; i < end; i++) {
    const picked = answers[i];
    const state = picked === null ? 'unanswered'
      : (picked === quiz[i].answer ? 'correct' : 'incorrect');

    let cls = 'quiz-qnav-btn';
    if (state === 'correct') cls += ' is-correct';
    else if (state === 'incorrect') cls += ' is-wrong';
    if (i === current) cls += ' is-current';

    cells += '<button type="button" class="' + cls + '" data-q="' + i + '"' +
      ' aria-label="Question ' + (i + 1) + ', ' + state + '"' +
      (i === current ? ' aria-current="true"' : '') +
      '>' + (i + 1) + '</button>';
  }

  // Three columns: chevron, the wrapping block of cells, chevron. The chevrons
  // sit outside the block that wraps, so neither can ever be carried onto a
  // row of its own however narrow the screen gets.
  el.questionNav.innerHTML =
    '<div class="quiz-qnav-side">' +
      navStep('prev', page === 0, start - NAV_PAGE) +
    '</div>' +
    '<div class="quiz-qnav-cells">' + cells + '</div>' +
    '<div class="quiz-qnav-side">' +
      navStep('next', page >= pages - 1, start + NAV_PAGE) +
    '</div>';
}

// One listener on the strip, so cells redrawn later still work.
el.questionNav.addEventListener('click', e => {
  const btn = e.target.closest('button[data-q]');
  if (!btn) return;
  current = Number(btn.dataset.q);
  saveProgress();
  renderQuestion();
});

function updateNav() {
  el.btnPrev.disabled = (current === 0);
  el.btnNext.innerHTML = (current === quiz.length - 1)
    ? 'Finish &rsaquo;' : 'Next &rsaquo;';
}

// Always A, B, C, D order, whatever order the keys happen to sit in the file.
function choiceKeys(q) {
  return Object.keys(q.choices).sort();
}

// Derived, never incremented - so revisiting a question cannot double-count it.
function scoreSoFar() {
  return answers.reduce((n, picked, i) =>
    n + (picked !== null && picked === quiz[i].answer ? 1 : 0), 0);
}

/* ---------- 5. Handle an answer ---------- */
function answer(picked) {
  answers[current] = picked;      // overwrites any earlier pick
  markAnswered(picked);
  renderQuestionNav();            // the cell turns green or red straight away
  el.scoreText.textContent = 'Score ' + scoreSoFar();
  saveProgress();
}

/* ---------- 6. Move on ---------- */
function nextQuestion() {   // skipping is allowed; unanswered just scores nothing
  current++;
  if (current < quiz.length) {
    saveProgress();
    renderQuestion();
  } else {
    showResults();
  }
}

function prevQuestion() {
  if (current === 0) return;
  current--;
  saveProgress();
  renderQuestion();
}

function showResults() {
  if (currentTest) {
    markDone(currentTest.id);
    clearProgress(currentTest.id);   // finished, so nothing left to resume
  }
  renderTests();          // redraw first, so the test just finished shows as done

  // Name the test they just finished. Falls back to the old wording if this is
  // somehow reached without a test, and textContent keeps a title from a JSON
  // file out of the markup.
  el.finalTitle.textContent = currentTest ? currentTest.title : 'Test complete';

  const score = scoreSoFar();
  const pct = Math.round((score / quiz.length) * 100);
  el.finalScore.textContent = score + ' / ' + quiz.length;
  el.finalPercent.textContent = pct + '% correct';
  const message =
    pct >= 80 ? 'Strong result. Try another test.' :
      pct >= 50 ? 'Decent. Run it again to lock it in.' : '';
  el.finalMessage.textContent = message;
  el.finalMessage.classList.toggle('d-none', message === '');   // no empty gap
  show(el.screenResult);
}

/* ---------- helpers ---------- */

// Rebuild the grid on the way back, so a finished test shows as done.
function goToStart() {
  renderTests();
  show(el.screenStart);
}

function show(screen) {
  [el.screenStart, el.screenQuiz, el.screenResult]
    .forEach(s => s.classList.add('d-none'));
  screen.classList.remove('d-none');
  window.scrollTo(0, 0);
}

function showError(message) {
  el.loadError.textContent = message;
  el.loadError.classList.remove('d-none');
}

function hideError() {
  el.loadError.classList.add('d-none');
}

// Titles come from the JSON files, so keep them safe to drop into markup.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ---------- wire up the buttons ---------- */
el.btnPrev.addEventListener('click', prevQuestion);
el.btnNext.addEventListener('click', nextQuestion);
el.btnRetake.addEventListener('click', () => startQuiz(currentTest, null, true));
el.btnReset.addEventListener('click', () => {
  clearDone();
  try {
    localStorage.removeItem(PROGRESS_KEY);   // half-finished runs go too
  } catch (err) {
    /* nothing stored to clear */
  }
  renderTests();
});
el.btnQuit.addEventListener('click', goToStart);

loadTests();
