# Running the practice test site

Static site on GitHub Pages, live at **https://practice.gofoodsafe.com**.

Pushing to `main` **is** deploying. There is no staging — whatever you push is what
students see about a minute later.

---

## Adding a test

### 1. Create the test file

The filename is **`slug` + `_` + `id` + `.json`**, in `data/`. So slug `foodcode`
and id `3` means `data/foodcode_3.json`.

```json
{
  "id": "3",
  "slug": "foodcode",
  "name": "2022 Practice Test",
  "questions": [
    {
      "id": 1,
      "q": "Question text?",
      "choices": {
        "A": "First choice",
        "B": "Second choice",
        "C": "Third choice",
        "D": "Fourth choice"
      },
      "answer": "C",
      "explain": ""
    }
  ]
}
```

Rules the checker enforces:

- **`id` and `slug` must match the catalog entry**, and both are strings — `"3"`, not `3`.
- **`slug` must be unique** across tests, even though the filename also includes the id.
- **Question ids must be unique within this test only.** Every test can start at 1.
  They must exist, though — saved progress is keyed by them, which is what lets you
  edit a test later without shifting a student's answers onto the wrong questions.
- **Choice keys run A, B, C, D** — consecutive letters starting at A. `answer` is one
  of those letters.
- **`explain` may be `""`.** It is only shown once the student answers correctly, so a
  wrong answer never gives the answer away.

### 2. Add it to the catalog

`data/catalog.json`, an array. **Cards appear in array order**, so position matters —
students start with the first one.

```json
{
  "id": "3",
  "slug": "foodcode",
  "title": "2022 Practice Test",
  "published": true
}
```

`title` is what shows on the card. It can differ from the test file's `name`, but
keeping them the same avoids confusion on the results screen.

`published: false` keeps a test in the repo but off the site. Only an explicit `false`
hides it — a missing key still shows.

### 3. Check it

```
node check-questions.js
```

Must end with **All good. Safe to publish.** It also reports:

- `[hidden]` beside any test with `"published": false`, and a summary line naming them —
  so a test left hidden by accident cannot pass silently
- questions with no `explain`, which is allowed and only informational

### 4. Ship it

```
git add -A
git commit -m "Add <name> test"
git push
```

Live in about a minute. Then open the site and take the new test start to finish.

---

## Editing a test that is already live

**Safe any time** — nothing stored depends on these:

- `title` in the catalog, and `name` in the test file
- `published`
- catalog array order
- question text, choices, `answer`, `explain`

**Changes a student's saved progress, silently:**

- **Changing a question's `id`.** Answers are stored per question id, so a renumbered
  question reads as deleted and that answer is dropped.
- **Changing a test's `id`.** This is the big one. The id is a storage key, not a label:

  ```js
  all[testId] = { answers: ..., current: ... }   // half-finished runs
  done[testId]                                    // the green "done" tint
  ```

  Change it and every student's progress for that test orphans. Nothing errors.

  A test id can only move together with its filename and its own `id` field —
  **three edits**, or the checker fails:

  1. rename `data/<slug>_<old>.json` to `data/<slug>_<new>.json`
  2. change `"id"` inside that file
  3. change `"id"` in the catalog entry

Progress lives in `localStorage` under `quizzes-done` and `quizzes-progress`, per
browser. The **Reset** button on the start screen clears both.

---

## How this is wired up

Recorded in case it ever needs changing. None of it is part of a normal day.

| | |
|---|---|
| Repo | `ignacio-gomez/gofoodsafe-quizzes`, public (Pages needs public on the free plan) |
| Pages source | Deploy from a branch — `main`, folder `/` |
| Custom domain | `practice.gofoodsafe.com`, Enforce HTTPS on |
| DNS | GoDaddy CNAME, name `practice`, value `ignacio-gomez.github.io` |
| Certificate | Auto-provisioned by GitHub, renews itself |

The **`CNAME` file in the repo root is load-bearing** — GitHub wrote it when the custom
domain was set, and deleting it drops the domain.

The main site `gofoodsafe.com` is a GoDaddy one-pager on the **bare** domain; `www`
redirects to it. Links out of this site should use `https://gofoodsafe.com` — there is
no `/about` or `/contact` to link to.

### If the site goes down

- **404 everywhere** — check the repo is still public, and that `CNAME` is still in the
  repo root.
- **Certificate warning** — usually a certificate mid-renewal, or a change to the custom
  domain. Wait, then hard-refresh; a browser caches the failed handshake.
- **A test won't open** — the catalog and the filename have drifted apart.
  `node check-questions.js` names the mismatch.
