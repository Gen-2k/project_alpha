# GILTflow - Full Product Requirements Document (PRD)

### Language Infrastructure for the Internet

**Version:** 1.0 | **Date:** Sep 27, 2026 | **Founder:** Chennai, IST | **Status:** Pre-MVP Validation

> **One-liner:** Spotify's internal i18n linter for every team. GitHub App that finds hardcoded strings, auto-fixes them with t(), generates en.json, and opens a fix PR.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Solution - One Brain, Many Hands](#solution)
4. [Market Research & Sizing](#market-research)
5. [Competitor Analysis - Who Solved What?](#competitor-analysis)
6. [User Personas](#user-personas)
7. [Product Vision - 4 Pillars (GILT)](#product-vision)
8. [Architecture - One Product, Many Hands](#architecture)
9. [MVP Definition - What to Build First](#mvp-definition)
10. [Full Roadmap - Level 0 to Level 4](#roadmap)
11. [PRD - Core Features & User Stories](#prd-features)
12. [Technical Specification](#tech-spec)
13. [Validation & Go-To-Market](#validation-gtm)
14. [Pricing Strategy](#pricing)
15. [Metrics & KPIs](#metrics)
16. [Risks & Mitigations](#risks)
17. [Appendix - Landing Copy & Loom Script](#appendix)

---

## 1. Executive Summary

**Problem:** 70% of React/Next.js teams ship with hardcoded English strings. Fixing them later costs 15% of dev time in manual file management. Existing TMS tools (Lokalise $120/mo, Crowdin $50/mo) assume code is already ready - they don't fix code. Spotify, Netflix built internal linters because nothing existed.

**Solution:** GILTflow is a GitHub App + ESLint plugin + VS Code extension + Figma plugin + Web Dashboard. All connect to ONE backend (app.giltflow.com). It scans code with AST (ts-morph), wraps hardcoded strings with t(), generates en.json with AI-named keys, opens a fix PR automatically.

**Wedge:** I-Scanner (Internationalization) - auto-fix PRs. 80% unsolved in market.

**Market:** TMS market $1.79B (2024) → $10B (2033). AI-powered GILT market $15.6B. SAM for code-first i18n: $2.5B.

**Business Model:** Freemium - Free for public repos, $29/mo private, $99/mo team. Founding members 50% off 6 months.

**Goal:** Week 0-4 validation → 50 waitlist, 20 repos using, 5 paying ($145 MRR). Month 2-4: $1k MRR. Month 4-8: $10k MRR.

---

## 2. Problem Statement

### Core Pains (from GitHub issues, Reddit, interviews)

1. **Hardcoded String Debt:** ` <button>Add to Cart</button>` slips through code reviews. At 500+ strings, refactoring takes 2-3 sprints.
2. **File Management Nightmare:** en.json drifts out of sync. Developers spend 15% time on translation file management, not features.
3. **Text Expansion Breaks UI:** German "Jetzt kaufen" is 40% longer than "Buy now" - breaks buttons. No early warning.
4. **Cultural Blunders:** Cow imagery in India, thumbs-up in Middle East - no tool flags this.
5. **AI-Generated Code is Worse:** Cursor/Claude generate hardcoded English by default, making problem 10x worse in 2026.
6. **Slow Global Releases:** Adding a new language takes 3-6 months because code wasn't ready.

**Who feels pain most:** React/Next.js SaaS teams 2-10 devs, indie hackers expanding globally, AI-native startups shipping fast.

---

## 3. Solution - One Brain, Many Hands

**Concept:** ONE web app (brain) at app.giltflow.com with 4 modules inside. Many hands (plugins) that bring brain to where devs live.

```
ONE BRAIN: app.giltflow.com (Web App)
  ├── G-Planner (Strategy) - Market readiness score
  ├── I-Scanner (Code Fix) - Auto-fix PRs [WEDGE]
  ├── L-Adapter (Design/Culture) - Figma overflow + cultural flags
  └── T-Auto (Translation) - Pseudo-localization + OTA

MANY HANDS (same backend):
  ├── GitHub App - Hand 1 (fixes code) - CORE MVP
  ├── VS Code Extension - Hand 2 (red squiggly warnings)
  ├── Figma Plugin - Hand 3 (design checks)
  ├── CLI Tool (npx giltflow) - Hand 4 (local scan)
  └── Web Dashboard - Home (billing, history, settings)

Same Backend (Cloud API) handles everything.
```

**Tagline:** One brain, many hands → One product.

**Is it a TMS?** NO. TMS = file management after code is ready. GILTflow = fixes code BEFORE it reaches TMS. TMS is part of T-Auto, but wedge is I-Scanner which TMS doesn't do.

---

## 4. Market Research & Sizing

### Market Numbers (Sourced)

- **TMS Market:** $1.79B in 2024 → $3.27B in 2025 → $10.07B by 2033 (CAGR 15.4%)
- **Localization Market:** $6.7B in 2023, expected to double by 2030
- **AI in GILT:** $1.8B (2024) → $11B (2033)
- **GILTflow SAM:** Code-first i18n automation for JS/TS teams = $2.5B (developers using React/Next.js globally)

### Key Trends 2026

1. **AI Code Generation = More Hardcoded Strings:** Cursor/Claude generate English by default.
2. **Shift Left i18n:** Teams want to fix i18n at PR time, not after release (like Spotify internal linter).
3. **Pricing Pressure:** Lokalise $120/mo too expensive for indie hackers. $29/mo wedge opportunity.
4. **No End-to-End Solution:** No product covers G+I+L+T with auto-fix.

### Validation Signals

- GitHub: 1000+ repos with hardcoded i18n issues
- Reddit: 50+ threads "how to fix hardcoded strings" with no good answer
- Waitlist goal: 50 emails = validation (fake-door test)

---

## 5. Competitor Analysis - Who Solved What?

| Product                         | G (Strategy) | I (Code Fix)                      | L (Design/Culture)           | T (Translation) | Pricing     | Weakness                     | Gap for GILTflow         |
| :------------------------------ | :----------- | :-------------------------------- | :--------------------------- | :-------------- | :---------- | :--------------------------- | :----------------------- |
| **Lokalise**                    | ❌           | ⚠️ Warn only                      | ⚠️ Screenshots               | ✅ Full         | $120/mo     | 15% dev time file mgmt       | No auto-fix              |
| **Crowdin**                     | ❌           | ⚠️ Git sync                       | ❌                           | ✅ Full         | $50/mo      | File-based workflow          | No auto-fix              |
| **Phrase**                      | ❌           | ⚠️ Warn                           | ❌                           | ✅ Full         | $50/mo      | Enterprise sales             | No auto-fix              |
| **Smartling**                   | ❌           | ❌                                | ⚠️ Visual context            | ✅ Full         | Custom $99+ | Expensive complex            | No code fix              |
| **General Translation Locadex** | ❌           | ✅ Auto-fix PR                    | ❌                           | ✅ Full         | Usage       | No culture, no Figma, closed | Closest, but missing L+G |
| **Figma Plugins**               | ❌           | ❌                                | ⚠️ Overflow only             | ❌              | Free        | Design only                  | No code                  |
| **GILTflow**                    | ✅ Roadmap   | 🔥 Auto-fix PR + ESLint + VS Code | 🔥 Overflow + Cultural flags | ✅ via DeepL    | $29/mo      | New entrant                  | **One brain many hands** |

**Legend:** ✅ Solved | ⚠️ Partial | ❌ Not Solved | 🔥 Your Edge

**Opportunity Scores:**

- G: 90% unsolved
- I: 80% unsolved - **BIGGEST WEDGE**
- L: 70% unsolved
- T: 20% unsolved - Don't build, use API

**Insight:** T is solved, we don't compete. I is unsolved, we own it as wedge. L+G are moats later.

---

## 6. User Personas

### Persona 1: Indie Hacker (PRIMARY - MVP Focus)

- Name: Arjun, 28, Chennai/Bangalore
- Stack: Next.js, Supabase, Vercel
- Pain: Wants to launch in US + Europe, but has 300 hardcoded strings. No time to fix manually.
- Goal: One-click fix, $29/mo, not $120.
- Where: GitHub, Twitter, Indie Hackers

### Persona 2: Small SaaS Team (SECONDARY - Beta)

- Team: 2-10 devs, Series A, 10k users
- Stack: React, TypeScript, GitHub
- Pain: PRs slip through with hardcoded strings, en.json drift, German UI breaks.
- Goal: GitHub App that blocks PRs, Figma plugin for designers.
- Where: Linear, GitHub, Figma

### Persona 3: AI-Native Startup (FUTURE)

- Team: Using Cursor/Claude heavily
- Pain: AI generates hardcoded English 10x faster than humans can fix.
- Goal: Auto-fix AI-generated code before merge.

**Focus for MVP:** Only Persona 1.

---

## 7. Product Vision - 4 Pillars (GILT)

### I - Internationalization (Engineering) - WEDGE - Build First

**What it does:** Makes code ready for any language.

**Features:**

- AST scanner (ts-morph) finds hardcoded strings in JSX: `<button>`, `placeholder=""`, `aria-label=""`
- Auto-wraps with `t()` and generates key: `add_to_cart`
- Generates `locales/en.json`
- Opens GitHub PR: "GILTflow: Fixed 42 strings in 8 files"
- ESLint rule: `giltflow/no-hardcoded-jsx` - red squiggly in VS Code
- CLI: `npx giltflow scan src/ --fix`

**Who uses:** Developer

**Where lives:** GitHub App + VS Code + CLI

**Example:**
Before: `<button>Add to Cart</button>`
After: `<button>{t("add_to_cart")}</button>` + en.json: `{ "add_to_cart": "Add to Cart" }`

### T - Translation (Language) - Build Month 2

**What it does:** Translates and tests.

**Features:**

- Pseudo-localization: Expand English by 40% to test overflow: "Add to Cart" → "[!!! Àdd tö Çårt !!!]"
- Auto-translation via DeepL API
- OTA (Over-The-Air) updates for web via CDN - update translations without deploy

**Who uses:** Developer + Translator

**Where lives:** Web Dashboard

### L - Localization (Design + Culture) - Build Month 2-3

**What it does:** Adapts design and culture.

**Features:**

- Figma plugin: Checks if German text overflows button, warns
- Cultural flagging: Flags cow image for India, thumbs-up for Middle East, owl for Japan
- RTL mirroring preview for Arabic

**Who uses:** Designer

**Where lives:** Figma Plugin + Web Dashboard

### G - Globalization (Strategy) - Build Month 4+

**What it does:** Business readiness.

**Features:**

- Market Readiness Score: 0-100 for each country
- Checklist: Japan needs Konbini payments, privacy policy, date format YYYY/MM/DD
- Regulatory: GDPR, LGPD, etc.

**Who uses:** Founder / PM

**Where lives:** Web Dashboard (4 tabs)

**Dependency:** I → T → L → G. Must do in order.

---

## 8. Architecture - One Product, Many Hands

### High-Level

```
User Code Repo (GitHub)
  ↓ Push
GitHub App (Octokit Webhook) → Scanner Service (ts-morph + AI)
  ↓ Fix
New Branch + PR + en.json
  ↓
Web Dashboard (Next.js) ← Same Backend API (FastAPI / Next.js API)
  ↑ ↓
VS Code Extension ←→ Figma Plugin ←→ CLI
```

### Tech Stack (Solo Founder Friendly)

- **Frontend:** Next.js 15, Tailwind, shadcn/ui, Vercel
- **Backend:** Next.js API Routes or FastAPI, Supabase (Postgres + Auth), Upstash Redis (queue)
- **Scanner:** TypeScript, ts-morph, Babel parser
- **AI:** OpenAI GPT-4o-mini (key naming), DeepL API (translation)
- **GitHub:** Octokit, GitHub Apps API, Probot framework
- **Figma:** Figma Plugin API
- **VS Code:** VS Code Extension API
- **Billing:** LemonSqueezy or Stripe
- **Infra Cost MVP:** $50/mo (Vercel $20 + Supabase $25 + OpenAI $5)
- **Infra Cost Scale:** $300/mo

### File Structure

```
/apps
  /web - Next.js dashboard (app.giltflow.com)
  /github-app - GitHub App webhook handler
  /cli - npx giltflow
/packages
  /scanner - ts-morph core logic
  /eslint-plugin - eslint-plugin-giltflow
  /vscode-extension
  /figma-plugin
```

---

## 9. MVP Definition - What to Build First

### MVP Scope (Week 3-6) - ONLY I-Scanner

**Must Have:**

- [ ] CLI: `npx giltflow scan src/ --fix` - finds and fixes
- [ ] ESLint Plugin: `giltflow/no-hardcoded-jsx` - warns
- [ ] GitHub App: Installs in 30 sec, on push scans, opens fix PR
- [ ] AI Key Generation: `Add to Cart` → `add_to_cart` (not `key_1`)
- [ ] en.json generation
- [ ] Landing page with waitlist

**Must NOT Have (Skip for MVP):**

- ❌ Web dashboard translation editor
- ❌ Figma plugin
- ❌ Cultural flagging
- ❌ Market score
- ❌ Mobile SDK
- ❌ Own translation engine

**Tech Constraints:**

- Only React/Next.js + TypeScript
- Only JSX text, placeholder, aria-label (not all strings)
- Only English → en.json (not other languages yet)

**Success Criteria:**

- 20 repos installed
- 5 paying $29/mo
- 0 crashes on 1000 files scan

---

## 10. Full Roadmap - Level 0 to Level 4

### LEVEL 0: VALIDATION (Week 0-2) - Complexity: Easy - Cost $0

- [ ] Fake-door landing page (built)
- [ ] 60-sec Loom demo video
- [ ] Outreach 20 repos: Search GitHub `hardcoded string i18n language:javascript` → comment template
- [ ] Post on Reddit r/nextjs, r/reactjs, Indie Hackers
- **Goal:** 50 waitlist emails, 10 user interviews

### LEVEL 1: MVP - THE FIXER (Week 3-6) - Complexity: Medium

- [ ] CLI scanner (ts-morph)
- [ ] ESLint plugin
- [ ] GitHub App with fix PR
- [ ] Prompt engineering for key names
- [ ] Billing with LemonSqueezy
- **Goal:** 20 repos using, 5 paying $29/mo = $145 MRR
- **What to skip:** No translation quality, no cultural check, just code fix

### LEVEL 2: BETA - THE AUTOMATOR (Month 2-4) - Complexity: Medium-Hard

- [ ] en.json key naming v2 + translation memory
- [ ] Pseudo-localization testing (expand 40%)
- [ ] Figma plugin for overflow detection
- [ ] Web Dashboard with scan history, file tree
- [ ] OTA for web (CDN)
- [ ] DeepL integration
- **Goal:** $1k MRR, 30 customers, Product Hunt launch
- **Tech:** Next.js 15, Postgres, Redis, DeepL

### LEVEL 3: PLATFORM - THE OS (Month 4-8) - Complexity: Hard

- [ ] G-Planner: Market readiness score
- [ ] L-Adapter: Cultural flagging (cow, thumbs-up, etc) via LLM + vector DB
- [ ] VS Code extension real-time squiggles
- [ ] Mobile SDK OTA (React Native)
- [ ] GitLab / Bitbucket support
- [ ] Monorepo support
- **Goal:** $10k MRR, SOC2 readiness, 200 customers

### LEVEL 4: SCALE - THE INFRA (Month 8-18) - Complexity: Very Hard

- [ ] Enterprise: SSO, SOC2, custom glossaries, on-prem
- [ ] Marketplace for translators
- [ ] Public API for others to build on
- [ ] Multi-repo org dashboard
- [ ] Translation memory + glossary AI
- **Goal:** $50k MRR → Series A

---

## 11. PRD - Core Features & User Stories

### Feature 1: GitHub App Auto-Fix

**User Story:** As a developer, I want GitHub to auto-fix hardcoded strings so I don't waste time.

**Acceptance Criteria:**

- Given I push code with `<button>Add to Cart</button>`, when GitHub App runs, then it creates new branch `giltflow/fix-2026-09-27`, wraps with `t("add_to_cart")`, generates en.json, opens PR with description "Fixed 1 string".
- PR must pass existing CI.
- Key name must be readable, not random.

**Technical Notes:** Use Octokit, create check run, use ts-morph.

### Feature 2: ESLint Rule

**User Story:** As a developer, I want red squiggly in VS Code if I hardcode string.

**Acceptance Criteria:**

- Given I write `<div>Hello</div>` without t(), then ESLint shows error: "Hardcoded string found, use t('hello')".
- Auto-fix available via `eslint --fix`.

### Feature 3: CLI Scan

**User Story:** As a developer, I want to scan locally before push.

**Acceptance Criteria:**

- `npx giltflow scan src/` lists 42 hardcoded strings with file:line
- `npx giltflow scan src/ --fix` fixes them.

### Feature 4: Web Dashboard (Beta)

**User Story:** As a founder, I want to see all scans in one place.

**Acceptance Criteria:**

- Dashboard shows repo list, last scan, # strings fixed, history graph.

### Future Features (Not MVP)

- Figma overflow check
- Cultural flagging
- Market score

---

## 12. Technical Specification

### Scanner Logic (ts-morph)

```typescript
// Pseudocode
import { Project } from "ts-morph";
const project = new Project({ tsConfigFilePath: "tsconfig.json" });
const files = project.getSourceFiles("src/**/*.{ts,tsx}");
files.forEach((file) => {
  file.getDescendantsOfKind(SyntaxKind.JsxText).forEach((node) => {
    if (!isInsideTFunction(node) && isEnglish(node.getText())) {
      const key = await aiGenerateKey(node.getText()); // GPT-4o-mini
      node.replaceWithText(`{t("${key}")}`);
      addToEnJson(key, node.getText());
    }
  });
});
```

### GitHub App Flow

1. Webhook: `push` event
2. Clone repo (shallow)
3. Run scanner
4. If fixes, create new branch, commit en.json + changed files
5. Open PR via Octokit: `octokit.pulls.create({...})`
6. Create Check Run: success with summary

### AI Prompts

**Key Generation Prompt:**

```
You are i18n key generator. Given text "Add to Cart", generate snake_case key: add_to_cart
Rules: lowercase, snake_case, no prefix, max 3 words, readable.
Text: {{text}}
Key:
```

### File Structure

```
/giltflow
  /apps/web
    /app/dashboard/page.tsx
    /app/api/github/webhook/route.ts
  /packages/scanner
    /src/index.ts
  /packages/eslint-plugin
    /lib/rules/no-hardcoded-jsx.js
```

---

## 13. Validation & Go-To-Market

### Validation Plan (Fake-Door)

- **Landing:** Built - giltflow landing page with waitlist
- **Loom:** 60-sec demo script (in appendix)
- **Outreach Template:**
  > "Hey, saw your repo has hardcoded strings in src/components/Cart.tsx. I built a GitHub App that auto-fixes this like Spotify does internally. Can I run it free on your repo? 2-min Loom: [link]"
- **Channels:** GitHub issues (20 repos), Reddit r/nextjs, Indie Hackers, Twitter, LinkedIn
- **Goal:** 50 waitlist, 10 interviews, 5 paying

### Go-To-Market

- **Month 1:** GitHub, Reddit, Indie Hackers (devs)
- **Month 2:** Product Hunt launch (#1 Product of Day goal)
- **Month 3:** VS Code Marketplace + Figma Community
- **Month 4:** Content: Blog posts "How Spotify does i18n", "AI code needs auto i18n fix"
- **Pricing:** Free public, $29 private, $99 team. Founding 50% off.

---

## 14. Pricing Strategy

| Plan           | Price  | For               | Features                                               |
| :------------- | :----- | :---------------- | :----------------------------------------------------- |
| **Free**       | $0     | Public repos, OSS | CLI + ESLint + GitHub App (public only) + 100 fixes/mo |
| **Pro**        | $29/mo | Indie hackers     | Private repos + unlimited fixes + en.json gen + OTA    |
| **Team**       | $99/mo | Small teams 2-10  | + Figma plugin + cultural flags + 5 seats + Slack      |
| **Enterprise** | Custom | Series A+         | + SSO + SOC2 + on-prem + custom                        |

**Founding Offer:** First 50 users 50% off for 6 months.

**Why $29 not $120?** Lokalise $120 is for translators. We are for developers fixing code - lower price, higher volume.

---

## 15. Metrics & KPIs

### MVP Metrics (Week 3-6)

- # repos installed GitHub App: Goal 20
- # PRs opened: Goal 100
- # strings fixed: Goal 1000
- Conversion free → paid: Goal 25% (5/20)
- MRR: Goal $145
- Churn: <5%

### Beta Metrics (Month 2-4)

- MRR: $1k
- Customers: 30
- Scan success rate: >95%
- Time to fix PR: <2 min

### Platform Metrics (Month 4-8)

- MRR: $10k
- Customers: 200
- NPS: >50
- Figma plugin installs: 500

---

## 16. Risks & Mitigations

| Risk                                   | Impact | Mitigation                                                                            |
| :------------------------------------- | :----- | :------------------------------------------------------------------------------------ |
| GitHub Apps API changes                | High   | Use Octokit, follow changelog, keep scanner decoupled                                 |
| OpenAI cost spikes                     | Medium | Use GPT-4o-mini, cache keys, fallback to rule-based key gen                           |
| Crowdin adds auto-fix                  | High   | Move fast, build community, open source linter part                                   |
| False positives (flags non-UI strings) | Medium | AST filter: only JSXText, not console.log, allow ignore comments `// giltflow-ignore` |
| AI-generated keys bad                  | Medium | Human review in PR, allow rename in dashboard                                         |

---

## 17. Appendix

### Landing Page Copy

**Headline:** Your PRs have hardcoded strings. We fix them automatically.
**Sub:** GitHub App that scans your codebase, wraps hardcoded strings with t(), generates en.json, and opens a fix PR. Like Spotify's internal linter, but for every team.
**CTA:** Get Early Access - Free for public repos
**Social Proof:** Built for teams who ship globally from day one. Inspired by Spotify, Netflix, Cursor.
**How it works:** 1. Install GitHub App (30 sec) 2. We scan on every push 3. Auto-fix PR opened
**Pricing:** Free public, $29/mo private, $99/mo team. Founding 50% off.

### 60-Second Loom Script

0-10s Hook (Show code): "Hey, I'm building GILTflow from Chennai. If you use React/Next.js and ever shipped to 2+ languages, you know this pain — hardcoded strings slipping through PRs, en.json out of sync. I built a GitHub App that fixes it like Spotify does internally."

10-30s Demo (Screen share VS Code + GitHub PR): "Watch — I push code with <button>Add to Cart</button>. GILTflow scans, wraps it with t('add_to_cart'), generates locales/en.json, and opens this PR automatically. 342 strings, 15 files, 2 minutes. No manual file management."

30-50s Why it matters: "Teams told me they waste 15% dev time on translation files. Current tools like Lokalise start at $120/mo and still need manual sync. Mine is $29/mo, free for public repos, and auto-fixes."

50-60s CTA: "I'm validating demand this week — looking for 20 teams to test it free. Link in description to join waitlist. If you have a repo with hardcoded strings, drop it in comments, I'll run it for you."

### Outreach Tracker Sheet Columns

Repo URL | Owner | Stars | # Hardcoded Files | Contacted? | Replied? | Installed? | Paying? | Notes

### File Naming Convention

Keys: snake_case, max 3 words, readable: add_to_cart, not add_to_cart_button_in_header

---

## Final Outcome - Vision

**From:** "Fix my hardcoded strings" tool
**To:** Language infrastructure for internet — Stripe for globalization

Every app that ships globally will run GILTflow in CI. Like Stripe is for payments, GILTflow is for languages.

**Built in Chennai, for global developers.**

---

**End of PRD**

This file is your single source of truth. Start with Level 0 and Level 1. Don't jump.
