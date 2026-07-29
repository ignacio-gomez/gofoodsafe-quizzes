/* Run with:  node check-questions.js
   Catches the mistakes that break a quiz silently when you have 500 questions:
   bad JSON, duplicate ids, missing fields, answer index out of range.
   Walks data/catalog.json and checks every test file it lists. */

const fs = require('fs');
const path = require('path');

const DIR = 'data';
const CATALOG = path.join(DIR, 'catalog.json');
const ID_FORMAT = /^\d+$/;                    // "1", "2" - a number, written as a string
const SLUG_FORMAT = /^[a-z0-9][a-z0-9-]*$/;   // slugs become filenames and URLs
const LETTERS = 'ABCDEFGH'.split('');         // valid choice keys, in order
const problems = [];   // these fail the check
const warnings = [];   // these are only reported

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('BROKEN JSON in ' + file + ':\n  ' + e.message);
    console.error('Usually a missing comma between questions, or a trailing comma after the last one.');
    process.exit(1);
  }
}

const tests = readJson(CATALOG);

if (!Array.isArray(tests)) {
  console.error(CATALOG + ' must contain a JSON array (start with [ and end with ]).');
  process.exit(1);
}

const seenQuestionIds = new Set();   // question ids must be unique across ALL tests
const seenTestIds = new Set();
const seenSlugs = new Set();
const expectedFiles = new Set();
let total = 0;

tests.forEach((test, t) => {
  const entry = 'catalog.json entry ' + (t + 1);

  if (!test.title) problems.push(entry + ' has no "title".');

  if (test.id === undefined) {
    problems.push(entry + ' has no "id".');
  } else if (typeof test.id !== 'string') {
    problems.push(entry + ' has "id": ' + JSON.stringify(test.id) +
      '. Ids are numbers written as strings, so use "' + test.id + '" with quotes.');
  } else if (!ID_FORMAT.test(test.id)) {
    problems.push(entry + ' has id "' + test.id + '". Ids must be digits only, e.g. "1".');
  } else if (seenTestIds.has(test.id)) {
    problems.push(entry + ' reuses the id "' + test.id + '".');
  } else {
    seenTestIds.add(test.id);
  }

  if (!test.slug) {
    problems.push(entry + ' has no "slug".');
    return;
  }
  if (!SLUG_FORMAT.test(test.slug)) {
    problems.push(entry + ' has slug "' + test.slug + '". Use lowercase letters, numbers and dashes ' +
      'only - the slug is the filename.');
    return;
  }
  if (seenSlugs.has(test.slug)) problems.push(entry + ' reuses the slug "' + test.slug + '".');
  seenSlugs.add(test.slug);

  // Filename is slug + id, e.g. safety_1.json
  const file = test.slug + '_' + test.id + '.json';
  expectedFiles.add(file);
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) {
    problems.push(entry + ' is slug "' + test.slug + '" + id "' + test.id + '", so it needs ' +
      full + ', which does not exist.');
    return;
  }

  const data = readJson(full);
  if (Array.isArray(data) || typeof data !== 'object' || data === null) {
    problems.push(full + ' must be an object with "id", "slug", "name" and "questions".');
    return;
  }

  // These drift apart the moment someone renames a file by hand.
  if (data.id !== test.id) {
    problems.push(full + ' has "id": ' + JSON.stringify(data.id) +
      ' but the catalog calls it ' + JSON.stringify(test.id) + '.');
  }
  if (data.slug !== test.slug) {
    problems.push(full + ' has "slug": ' + JSON.stringify(data.slug) +
      ' but the catalog calls it ' + JSON.stringify(test.slug) + '.');
  }
  if (!data.name) problems.push(full + ' has no "name".');

  if (!Array.isArray(data.questions)) {
    problems.push(full + ' has no "questions" array.');
    return;
  }

  total += data.questions.length;
  console.log('  ' + (test.title + ':').padEnd(24) + data.questions.length + ' questions  (' + file + ')');

  data.questions.forEach((q, i) => {
    const where = file + ' question ' + (i + 1) + ' (id: ' + q.id + ')';

    if (q.id === undefined) problems.push(where + ' has no "id".');
    else if (seenQuestionIds.has(q.id)) problems.push(where + ' has a DUPLICATE id (ids must be unique across all tests).');
    else seenQuestionIds.add(q.id);

    if (!q.q) problems.push(where + ' has no "q" (question text).');

    // "choices" is an object keyed A, B, C, D and "answer" is one of those keys.
    if (Array.isArray(q.choices) || typeof q.choices !== 'object' || q.choices === null) {
      problems.push(where + ' needs a "choices" object keyed "A", "B", "C", "D".');
    } else {
      const keys = Object.keys(q.choices);
      if (keys.length < 2) {
        problems.push(where + ' needs at least 2 choices.');
      }
      const expected = keys.map((_, i) => LETTERS[i]);
      if (keys.slice().sort().join('') !== expected.join('')) {
        problems.push(where + ' has choice keys ' + JSON.stringify(keys) +
          '. They must be ' + JSON.stringify(expected) + ' - consecutive letters starting at A.');
      } else if (!keys.includes(q.answer)) {
        problems.push(where + ' has "answer": ' + JSON.stringify(q.answer) +
          ', which is not one of its choices (' + keys.join(', ') + ').');
      }
      keys.forEach(k => {
        if (typeof q.choices[k] !== 'string' || !q.choices[k].trim()) {
          problems.push(where + ' choice "' + k + '" is empty.');
        }
      });
    }

    if (!q.explain) warnings.push(where + ' has no "explain".');
  });
});

// A test file sitting in data/ that nobody lists will never show up as a card.
fs.readdirSync(DIR)
  .filter(f => f.endsWith('.json') && f !== 'catalog.json' && !expectedFiles.has(f))
  .forEach(f => problems.push(DIR + '/' + f + ' is not listed in catalog.json, so it has no card.'));

console.log('\nChecked ' + tests.length + ' tests, ' + total + ' questions.');

// Missing explanations are fine - some source material has none.
if (warnings.length) {
  console.log(warnings.length + ' question(s) have no explanation. That is allowed.');
}

if (problems.length === 0) {
  console.log('All good. Safe to publish.');
} else {
  console.log('\n' + problems.length + ' problem(s) found:');
  problems.forEach(p => console.log('  - ' + p));
  process.exit(1);
}
