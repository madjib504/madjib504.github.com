# Quality / Refactor Backlog

User asked to defer the code quality report from 2026-02 (env 94856b7c). To be picked up in a dedicated quality sprint.

## 🔴 Security
- **localStorage → httpOnly cookies** for JWT (31 instances). Requires: backend Set-Cookie on /api/auth/login + /register, axios `withCredentials: true`, CORS allow-credentials, FastAPI `Cookie` dependency. ~1-2 days.
- **Test fixtures use hardcoded test passwords** (`tests/test_social_and_video.py:21`, `tests/test_register_search_routing.py:16`). Move to env var or pytest fixture from `os.environ.get("TEST_PASSWORD")`.

## 🔴 React Hooks - missing dependencies (36 instances)
Stale closures, may cause real bugs:
- `src/pages/Search.js:31, 40` (useCallback + useEffect missing searchDoctors)
- `src/pages/PatientDashboard.js:20`
- `src/pages/PartnerDashboard.js:30`
- `src/pages/DoctorDashboard.js:36`
- `src/pages/WellnessPacks.js:15`
- `src/pages/MobileMoneyPayment.js:28, 41, 57`
- `src/pages/Home.js:41, 116, 170`

## 🟡 Error handling - 48 empty `catch {}` blocks
High-priority files (silent failures hurt UX):
- `Chat.js:32, 116, 129, 169`
- `DoctorDashboard.js:43, 74`
- `PatientDashboard.js:32`
- `Search.js:35, 69`

Pattern to apply: `catch (error) { console.error('<context>:', error); toast.error('<user message>'); }`

## 🟡 Complexity / Long files
- `pages/AdminDashboard.js` 849 lines, complexity 70 → split into UserManagement / DoctorManagement / Analytics / NotificationsAdmin / Settings
- `components/NearbyDoctors.js` 280 lines, complexity 27
- `components/NotificationCenter.js` 193 lines, complexity 27
- `pages/Register.js` 435 lines → wizard per user_type
- `pages/PatientDashboard.js` 434 lines → split per tab
- `pages/DoctorDashboard.js` 539 lines

## 🟡 Backend
- `server.py` 2700+ lines → split into `routers/{auth,doctors,partners,appointments,packs,specialties,reviews,blog,emergency,payments,admin,media,social}.py` + `models.py` + `services/`. User already deferred this twice.
- `register()` complexity 16, length 73 lines → extract per-user-type creation into 3 helpers
- `search_doctors()` 8 args → take a Pydantic `SearchFilters` model
- Mobile money: 3x ~55-line `_initiate_*_payment()` functions → strategy pattern
- Python `is True/False` antipattern → use truthiness (server.py:248, 252, 642; tests:147, 160, 186)

## 🟢 Duplicate-key warning on dashboards
React warns "Encountered two children with the same key" on /doctor/dashboard and /patient/dashboard. Probably due to duplicate `/api/notifications/{id}/read` endpoints registered twice in server.py (lint flagged this: lines 2075, 2085 redefining lines 1846, 1861). Clean up before fixing the FE warning.
