# Test Credentials - keneyakafisa

## Admin Dashboard
- URL: /admin
- Username: MADJIB
- Password: 48851132kl

## Notes
- Admin credentials are stored in backend/.env (not in the database)
- New users must register via /register
- Testing agent should create its own test doctor / partner / patient accounts via /api/auth/register, then clean them up.

## Required env vars (backend/.env)
- MONGO_URL, DB_NAME, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SECRET
- EMERGENT_LLM_KEY (used by Emergent Object Storage for video uploads)
