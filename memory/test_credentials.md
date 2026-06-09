# Test Credentials - keneyakafisa

## Admin Dashboard (Super-Admin OWNER)
- URL: /admin
- Username: MADJIB
- Password: 48851132kl
- admin_role: super_admin_owner
- display_name: N'guessan Armandine
- is_seed_owner: true (cannot be disabled/deleted)

## OWNER-Only Endpoints
- GET /api/admin/owner/admins
- POST /api/admin/owner/admins (create moderator)
- PATCH /api/admin/owner/admins/{id}
- DELETE /api/admin/owner/admins/{id}
- GET /api/admin/owner/audit-log
- DELETE /api/admin/delete-all

## Moderator Roles (created by OWNER via POST /admin/owner/admins)
- moderator | support | manager — all have read access to /admin/stats, /admin/users, /admin/payments, /admin/appointments, /admin/claims, /admin/notifications, /admin/maintenance
- They CANNOT access /admin/owner/* endpoints (403)
- They CANNOT call DELETE /admin/delete-all (403)

## Notes
- Admin credentials are stored in DB (collection `admins`); env vars (ADMIN_USERNAME/PASSWORD) are only used to seed the initial OWNER
- The seed OWNER (is_seed_owner=true) is protected: cannot be deactivated, role-changed, or deleted
- Disabled admins (is_active=false) get a 403 on POST /admin/login and on every authenticated request

## Required env vars (backend/.env)
- MONGO_URL, DB_NAME, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SECRET
- EMERGENT_LLM_KEY (used by Emergent Object Storage for video uploads)
- RESEND_API_KEY (email verification)

## Testing agent
- Testing agent should NOT use the seed OWNER MADJIB for creating moderators in test runs (use the OWNER token but create TEST_* moderators that are cleaned up at the end).
- Audit log entries persist across tests — use filters (`?action=...&actor_admin_id=...`) to isolate fresh entries.
