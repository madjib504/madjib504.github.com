# Test Credentials

## Admin / OWNER (Super-Admin)
- **Username**: MADJIB
- **Password**: 48851132kl
- **Login endpoint**: `POST /api/admin/login`  body: `{"username":"MADJIB","password":"48851132kl"}`
- **Role**: `owner` (full access, OWNER-only routes like `/api/admin/owner/admins`, `/api/admin/geocode/refresh`)

## Patient (signup is open)
- Sign up via `POST /api/auth/register` to create a fresh patient on-the-fly.

## Provider (claim flow)
- Existing partner_profiles / doctor_profiles can be searched via `GET /api/providers/search?q=...`
  then claimed via `POST /api/claims` with proof documents.
