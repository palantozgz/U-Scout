RESPUESTA A APPLE — Guideline 2.1, envío de U Core v1.0
(pegar tal cual, tanto en la respuesta de App Review como en el campo "Notes" de App Review Information)

---

1. Screen recording

Attached: https://u-scout-production.up.railway.app/apple-review-demo.mp4

Recorded on a physical iPhone running the latest iOS, showing app launch, login, and the typical coach workflow across all five modules (Home, Schedule, Scout, Stats, Playbook). Note: account deletion (added in this same build, per Guideline 5.1.1(v) below) may not appear in this specific recording — it is available at Settings → Delete Account, and is described in section 2.

---

2. App purpose and target audience

U Core is a team-management platform for basketball coaching staffs, currently in active development and testing. The developer (also a professional basketball coach) is the first user, running it with his own club's data to validate and refine the product before wider release. The app's architecture is multi-tenant by design: each head coach's account owns an independent "club" workspace, to which they invite their own staff and players. Public self-service sign-up is intentionally gated while the billing/subscription flow is still being built (see note in section 3) — it is not built for one specific organization, but it is not yet open to the general public either.

The app solves four operational problems for a basketball coaching staff:
- Scouting: building and collaboratively reviewing individual defensive scouting reports on opposing players before each game.
- Statistics: tracking league standings, team and player efficiency metrics for informed game planning.
- Playbook: maintaining a digital reference of the team's defensive systems and tactics.
- Schedule & Wellness: managing training/game schedules and collecting simple daily wellness check-ins from players.

Account deletion (Guideline 5.1.1(v)): since the app supports account creation, users can permanently delete their own account and personal data at any time from Settings → Delete Account. This removes their login (Supabase auth user), club membership, and wellness entries. Content they contributed and shared with their club (scouting reports, playbook plans, schedule events) is not deleted, since it is shared club data rather than the deleting user's personal data — this mirrors how, e.g., a shared document survives one collaborator leaving.

Target audience: basketball coaching staffs (head coaches, assistant coaches) and their players. Access to a given club's workspace is invite-only, issued by that club's head coach; there is no public browsing of other clubs' data.

---

3. Setup and access instructions

For your own testing, please use the demo account below:

Email: ucore.qa.headcoach@test.com
Password: 12345678
Role: Head Coach (full access to all modules)

Upon login, the app shows a brief onboarding flow (language selection, theme selection, feature tour) before reaching the main dashboard. This demo account currently holds only minimal placeholder data, since it exists for review/QA access rather than day-to-day use.

The attached screen recording was captured using the developer's own production account instead, which holds the real data he has entered while using the app operationally as a coach this season (opponent scouting reports, training schedule, tactical playbook) — this gives a more representative view of the app in actual use than the demo account's placeholder data.

Note: new-account self-registration as Head Coach is currently gated behind an allowlist while the paid-subscription flow is still in development (this prevents unpaid club creation before billing exists). Please use the demo account above for your own review rather than the in-app "Create account" option.

---

4. External services, tools, and platforms used

- Supabase (supabase.com): authentication (email/password) and PostgreSQL database hosting for all user, club, and scouting-report data.
- Railway (railway.com): hosting for the application's backend/web server. The app itself is a Capacitor (WKWebView) wrapper that loads this web app over HTTPS.
- No third-party payment processor is integrated (no in-app purchases in this version).
- No third-party AI/ML service is called by the app.
- The Statistics module displays historical league data (scores, standings, box scores) that the developer collects separately, outside of this app, and stores in the app's own database. The app itself only ever communicates with the developer's own backend (Railway) and Supabase — it does not call any third-party sports-data API directly.

---

5. Regional differences

The app functions identically in all regions/countries. The only regional variation is language: the app is available in English, Spanish, and Chinese, selectable by the user at first launch and changeable anytime in Settings. There is no feature, content, or functionality gating by region.

---

6. Regulated industry / third-party material

U Core does not operate in a regulated industry (e.g., finance, healthcare, telehealth) and does not include copyrighted media, licensed characters, or proprietary third-party software.

The Statistics module presents the developer's own statistical analysis (efficiency ratings, pace, shooting splits, etc.) derived from publicly available game data for a professional sports league. The app does not reproduce or redistribute any of that league's original published content — it presents original, derived analytical work for the coaching staff's internal tactical use.

---
