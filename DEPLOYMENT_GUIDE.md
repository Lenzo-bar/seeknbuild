# SeekNBuild v3 — Deployment Guide
## Taking it live on the web (free, no credit card)

---

## Option A — Vercel (recommended, easiest)

Vercel is the company behind Vite and React hosting. Takes about 5 minutes.

### Step 1 — Create a free GitHub account
Go to https://github.com and sign up.

### Step 2 — Install Git on your computer
Go to https://git-scm.com/download/win and download the Windows installer.
Run it with all default options. Confirm in a new terminal:
```
git --version
```

### Step 3 — Push your project to GitHub

In your terminal:
```
cd C:\aiProjects\claude\seeknbuild
git init
git add .
git commit -m "SeekNBuild v3 initial"
```

Go to https://github.com/new — create a public repository called `seeknbuild`.
Do NOT check "Add README". Copy the two commands GitHub shows you:
```
git remote add origin https://github.com/YOUR-USERNAME/seeknbuild.git
git branch -M main
git push -u origin main
```

### Step 4 — Deploy to Vercel

1. Go to https://vercel.com → Sign Up → Continue with GitHub
2. Click **Add New Project** → find your `seeknbuild` repository
3. Vercel auto-detects Vite. Leave all settings as-is.
4. Click **Deploy**

In about 60 seconds you will see a live URL like:
```
https://seeknbuild-yourname.vercel.app
```

Every time you push new code to GitHub, Vercel updates it automatically.

---

## Option B — Netlify (alternative)

1. Go to https://netlify.com → Sign up with GitHub
2. Click **Add new site** → Import an existing project → GitHub
3. Pick your `seeknbuild` repo
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Click **Deploy site**

---

## Option C — GitHub Pages

```
cd C:\aiProjects\claude\seeknbuild
npm run build
npm install --save-dev gh-pages
```

Add to `package.json` scripts:
```json
"deploy": "gh-pages -d dist"
```

Then run:
```
npm run deploy
```

Live URL: `https://YOUR-USERNAME.github.io/seeknbuild`

---

## After going live — what works immediately vs what needs API keys

| Feature | Status | Required |
|---|---|---|
| UI, themes, card layout, drag-drop | Works immediately | Nothing |
| File upload → real cards (TXT/MD/CSV/DOCX/PDF) | Works immediately | Nothing |
| Demo search (integral cards) | Works immediately | Nothing |
| Real web search | Needs API key | Brave Search API — https://api.search.brave.com (free: 2,000/month) |
| Real LLM responses | Needs API key | Anthropic API — https://console.anthropic.com |

To connect real search and LLM, the next step is adding a Vercel serverless function —
one small file that holds your API keys securely on the server side.
When you are ready for that step, let me know and I will build it.

---

## Updating the live site after making changes

```
cd C:\aiProjects\claude\seeknbuild
git add .
git commit -m "describe your change"
git push
```
Vercel/Netlify detects the push and redeploys in ~60 seconds.
