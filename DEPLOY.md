# Deploy checklist

Static site, GitHub Pages, at **practice.gofoodsafe.com**.
Work through it in order.

---

### 1. Check the links are right

Already done, but confirm before pushing. In `index.html` every link now points at
`https://www.gofoodsafe.com` (navbar brand, Home, About, Contact, "Back to main site",
and two in the footer).

Check three things:

- your site really is `www.gofoodsafe.com` and not the bare `gofoodsafe.com`
- `/about` and `/contact` are the real page paths
- the navbar link that says "Quizzes" — change it if your main menu calls it something else

### 2. Run the checker

```
node check-questions.js
```

Must print **All good. Safe to publish.** Fix anything it lists before going on.

### 3. Commit everything

```
git add -A
git commit -m "Quiz site"
```

### 4. Create the repo on GitHub

New repository, no README, no .gitignore, no licence.

### 5. Push

Use the commands GitHub shows you on the new empty repo page:

```
git remote add origin https://github.com/USERNAME/REPO.git
git branch -M main
git push -u origin main
```

### 6. Turn on Pages

Repo → **Settings** → **Pages**

- Source: **Deploy from a branch**
- Branch: **main**, folder: **/ (root)**
- Save

Wait a minute, then confirm the site loads at `https://USERNAME.github.io/REPO/`.

### 7. Add the DNS record at GoDaddy

Domain → **DNS** → **Add record**

- Type: **CNAME**
- Name: `practice`
- Value: `USERNAME.github.io`
- TTL: default

Save.

### 8. Set the custom domain on GitHub

Repo → **Settings** → **Pages** → **Custom domain**

Enter `practice.gofoodsafe.com`, click Save.

GitHub runs a DNS check. It may say "not yet propagated" for a while — that is normal, check back later.

### 9. Enforce HTTPS

Same page. Once the DNS check passes, the **Enforce HTTPS** tickbox becomes available. Tick it.

The certificate can take up to an hour. If the box is greyed out, come back later.

### 10. Pull the CNAME file

GitHub added a `CNAME` file to the repo in step 8. Get it locally, or your next push will remove your custom domain:

```
git pull
```

### 11. Test the live site

Open `https://practice.gofoodsafe.com` and check:

- the padlock shows (HTTPS working)
- the test grid loads
- take one test start to finish
- refresh the page — the green "done" tint on that test is still there
- open it on a phone

### 12. Link to it from your main site

Add a menu link on the GoDaddy site pointing to `https://practice.gofoodsafe.com`.

---

## Adding a test later

1. Create `data/<slug>_<id>.json` with `id`, `slug`, `name`, `questions`:

```json
{
  "id": "2",
  "slug": "test",
  "name": "Test 2",
  "questions": [
    {
      "id": 201,
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

Choice keys must run A, B, C, D. `answer` is one of those letters.
`explain` may be an empty string. Question ids must be unique across every test.

2. Add `{ "id": "...", "slug": "...", "title": "..." }` to `data/catalog.json`
3. `node check-questions.js`
4. `git add -A && git commit -m "Add <name> test" && git push`

Live in about a minute.
