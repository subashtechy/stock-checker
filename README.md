# Karz & Dolls Stock Dashboard (auto-scraping, GitHub-hosted)

- `index.html` — the dashboard. Reads `data.json` and renders it. Auto-refreshes every 5 minutes. No scraping happens in the browser.
- `scrape.js` — Node script that fetches each category page, pulls product data out of `__NEXT_DATA__`, and writes `data.json`. Runs server-side (in GitHub Actions), so CORS does not apply.
- `categories.json` — the list of category URLs to scrape. Edit this to add/remove categories.
- `data.json` — the scraped product data. Committed automatically by the Action; you don't edit this by hand.
- `.github/workflows/scrape.yml` — runs `scrape.js` every 30 minutes, auto-triggers when `categories.json` changes, and can be triggered manually.

## One-time setup

1. **Create the repo on GitHub**
   - Go to https://github.com/new
   - Repository name: `stock-checker` (or any name you like)
   - Set to **Public** (required for free GitHub Pages)
   - Do **NOT** check "Add a README" (we already have one)
   - Click **Create repository**

2. **Push these files from your local machine**
   Open a terminal/PowerShell in this project folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial dashboard + scraper"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/stock-checker.git
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` with your GitHub username.

3. **Enable GitHub Pages**
   - In your repo on GitHub: **Settings** → **Pages** (left sidebar)
   - Under "Build and deployment", Source = **Deploy from a branch**
   - Branch = `main`, folder = `/ (root)`. Click **Save**
   - Your dashboard will be live at `https://YOUR_USERNAME.github.io/stock-checker/` within ~2 minutes

4. **Grant Actions write permission**
   - In your repo: **Settings** → **Actions** → **General** (left sidebar)
   - Scroll to "Workflow permissions"
   - Select **Read and write permissions**
   - Click **Save**

5. **Run the scraper once manually** (don't wait 30 minutes)
   - In your repo: **Actions** tab → click **"Scrape stock data"** on the left → **"Run workflow"** button → **Run workflow**
   - Wait ~30–60 seconds, then check that `data.json` in the repo has been updated (new commit from `github-actions[bot]`)
   - Reload your GitHub Pages URL — products should now appear!

## Ongoing operation

- The Action re-runs **automatically every 30 minutes** (`cron: '*/30 * * * *'` in `scrape.yml`). It only commits when product data actually changes — no spam commits.
- The dashboard **auto-refreshes every 5 minutes** so you'll see new products without clicking anything.
- To add or remove categories, edit `categories.json`, commit, and push — the scraper will auto-trigger immediately.
- You can always trigger an immediate run from the Actions tab → "Run workflow".
- "NEW" ribbon appears on products first seen less than 24 hours ago.
- "Created" date = first time a product was seen. "Updated" date = last time that product's stock, name, brand, or image actually changed.

## If the scraper starts failing

Open the Actions tab → click the failed run → read the log. Common causes:
- The site changed its page structure and no longer embeds `__NEXT_DATA__` — update the extraction logic in `scrape.js`.
- The site is blocking requests — try adjusting the `User-Agent` header in `scrape.js`, or reduce scrape frequency.
- A category URL changed or was removed — update `categories.json`.

Each category's dashboard header shows a red "last scrape error" pill if that specific category failed.

