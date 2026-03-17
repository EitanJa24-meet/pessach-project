#!/bin/bash
# ============================================================
#  VOLUNTEER DASHBOARD — ONE-COMMAND SETUP
#  Run this once: bash setup.sh
# ============================================================

set -e
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🇮🇱  Volunteer Dashboard Setup          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ---- 1. CHECK GIT ----
if ! command -v git &> /dev/null; then
  echo -e "${RED}✗ Git not found. Install from https://git-scm.com${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Git found${NC}"

# ---- 2. CHECK NODE (optional, for Vercel CLI) ----
if command -v node &> /dev/null; then
  echo -e "${GREEN}✓ Node.js found$(node -v)${NC}"
  HAS_NODE=true
else
  echo -e "${YELLOW}⚠ Node.js not found — Vercel deploy will be skipped${NC}"
  HAS_NODE=false
fi

# ---- 3. ASK FOR GOOGLE SCRIPT URL ----
echo ""
echo -e "${YELLOW}Step 1 of 3 — Google Apps Script URL${NC}"
echo "  1. Open your Google Sheet"
echo "  2. Extensions → Apps Script"
echo "  3. Paste apps-script.gs, click Save"
echo "  4. Deploy → New deployment → Web App"
echo "     Execute as: Me | Who has access: Anyone"
echo "  5. Copy the URL and paste it below"
echo ""
read -p "Paste your Apps Script URL (or press Enter to skip): " SCRIPT_URL

if [ -n "$SCRIPT_URL" ]; then
  # Inject into app.js
  sed -i.bak "s|YOUR_SCRIPT_URL_HERE|$SCRIPT_URL|g" app.js 2>/dev/null || true
  echo -e "${GREEN}✓ Script URL saved${NC}"
else
  echo -e "${YELLOW}⚠ Skipped — dashboard will run in demo mode${NC}"
fi

# ---- 4. GIT INIT + GITHUB PAGES ----
echo ""
echo -e "${YELLOW}Step 2 of 3 — GitHub Pages${NC}"
read -p "Enter your GitHub username: " GH_USER

if [ -z "$GH_USER" ]; then
  echo -e "${YELLOW}⚠ Skipped GitHub setup${NC}"
else
  REPO_NAME="volunteer-dashboard"
  read -p "Repo name (default: $REPO_NAME): " INPUT_REPO
  [ -n "$INPUT_REPO" ] && REPO_NAME=$INPUT_REPO

  # Init git if not already
  if [ ! -d ".git" ]; then
    git init
    git branch -M main
    echo -e "${GREEN}✓ Git initialized${NC}"
  fi

  git add .
  git commit -m "Initial deploy 🚀" 2>/dev/null || git commit --allow-empty -m "Update"

  echo ""
  echo -e "${YELLOW}Now create the repo on GitHub:${NC}"
  echo "  → https://github.com/new"
  echo "  → Name: ${REPO_NAME}"
  echo "  → Keep it PUBLIC (required for free GitHub Pages)"
  echo "  → Do NOT initialize with README"
  echo ""
  read -p "Press Enter when you've created the repo..."

  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/${GH_USER}/${REPO_NAME}.git"
  git push -u origin main

  echo ""
  echo -e "${GREEN}✓ Pushed to GitHub!${NC}"
  echo ""
  echo -e "${YELLOW}Enable GitHub Pages:${NC}"
  echo "  → https://github.com/${GH_USER}/${REPO_NAME}/settings/pages"
  echo "  → Source: Deploy from branch"
  echo "  → Branch: main / (root)"
  echo "  → Click Save"
  echo ""
  echo -e "${GREEN}Your site will be live at:${NC}"
  echo -e "  ${BLUE}https://${GH_USER}.github.io/${REPO_NAME}/${NC}"
  echo ""
  echo "(takes ~1 minute to go live)"
fi

# ---- 5. VERCEL (optional) ----
echo ""
echo -e "${YELLOW}Step 3 of 3 — Vercel Deploy (optional, nicer URL)${NC}"

if [ "$HAS_NODE" = true ]; then
  read -p "Deploy to Vercel too? (y/n): " DO_VERCEL
  if [ "$DO_VERCEL" = "y" ] || [ "$DO_VERCEL" = "Y" ]; then
    if ! command -v vercel &> /dev/null; then
      echo "Installing Vercel CLI..."
      npm install -g vercel
    fi
    vercel --yes
    echo -e "${GREEN}✓ Deployed to Vercel!${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Skipped (Node.js required). Install Node then run: npx vercel${NC}"
fi

# ---- DONE ----
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  Setup complete!                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  • Share the GitHub Pages URL with your volunteers"
echo "  • Each volunteer opens it in their browser — no install needed"
echo "  • To update: edit files, then run: git add . && git commit -m 'update' && git push"
echo ""
