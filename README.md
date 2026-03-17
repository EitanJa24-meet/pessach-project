# 🇮🇱 מערכת תיאום מתנדבים

**3 steps. No coding. Copy-paste only.**

---

## STEP 1 — Set up Google Sheet (2 min)

1. Create a new Google Sheet at [sheets.new](https://sheets.new)
2. Open **Extensions → Apps Script**
3. Delete all existing code
4. Paste the entire contents of **`apps-script.gs`**
5. Click **Save** (💾)
6. Click **Run → Run function → setupSheet**
   - Accept the permissions popup
   - The sheet will be built automatically with headers + sample data
7. Click **Deploy → New deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** → **Authorize** → copy the URL

---

## STEP 2 — Deploy the dashboard (1 min)

Run this in Terminal (Mac/Linux) or Git Bash (Windows):

```bash
bash setup.sh
```

It will ask you for:
- Your Apps Script URL (from Step 1)
- Your GitHub username
- Repo name (default: `volunteer-dashboard`)

Then it pushes everything to GitHub automatically.

---

## STEP 3 — Enable GitHub Pages (30 sec)

1. Go to `https://github.com/YOUR_USERNAME/volunteer-dashboard/settings/pages`
2. Source: **Deploy from branch**
3. Branch: **main** / **(root)**
4. Click **Save**

Your dashboard is live at:
```
https://YOUR_USERNAME.github.io/volunteer-dashboard/
```

**Share this URL with your volunteers. Done.**

---

## Optional: Also deploy to Vercel (nicer URL)

```bash
npx vercel
```

Follow the prompts. You'll get a URL like `https://volunteer-dashboard.vercel.app`

---

## Updating data

Data comes live from Google Sheets — no redeploy needed.
The dashboard auto-refreshes every 60 seconds.

To update the dashboard code:
```bash
git add .
git commit -m "update"
git push
```

---

## Files

| File | What it does |
|------|-------------|
| `index.html` | The whole UI |
| `style.css` | Styling |
| `app.js` | All logic |
| `apps-script.gs` | Paste into Google Apps Script |
| `setup.sh` | Runs everything automatically |
| `vercel.json` | Vercel config (auto-used) |
