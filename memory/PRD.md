# PRD - keneyakafisa

## Original Problem Statement
Build a comprehensive health application in French named "keneyakafisa". The platform connects patients with modern medicine, African traditional medicine, and wellness specialists.

## User Personas
- **Patients**: Search doctors, book appointments, manage medical records, earn loyalty points
- **Health Professionals (Doctors)**: Manage schedules, receive bookings, present themselves via video + social links
- **Partners**: Companies, pharmacies, labs, sponsors with dedicated dashboard + video + social links
- **Admin**: Manage users, appointments, payments, advertisements via `/admin` dashboard

## Tech Stack
- Frontend: React.js, TailwindCSS, Shadcn UI
- Backend: FastAPI (Python)
- Database: MongoDB Atlas
- Storage: Emergent Object Storage (uses EMERGENT_LLM_KEY) for presentation videos
- Emails: Resend
- PWA: Service workers, manifest

## What's Been Implemented
- [2025-12] Full auth (JWT) - 3 user types, doctor search, booking, admin dashboard, ads, WhatsApp redirect, PWA, partner registration.
- [2026-02] Social links + video for doctors/partners, location fields, Resend email verification, Maintenance mode, Smart-Search AI orientation, Restructured Home with 3 flows (Patient/Claim/Add Structure), seed_loader for 103 providers.
- [2026-02] **Master Model V2 nested schema deployed** : `{ identity, classification, ai_matching, contact, booking, trust }` on every doctor & partner fiche.
- [2026-02] **Smart-search V2** : interroge `master_profile.ai_matching.symptomes_pris_en_charge` + `ai_specialty_tags`, inclut partner_profiles, tri par `trust.triage_priority`, déduplication par nom.
- [2026-02] **DB dedupe**: passage de 147/67 doctors/partners à 78/37 (99 doublons supprimés).
- [2026-02] **Urgent symptom routing fixed**: q='urgence' déclenche mode=orientation + emergency_number=185.
- [2026-02] **Espace OWNER (super-admin)** :
  - Backend: `verify_owner_token` decorator, `log_admin_action()` helper, collection `admin_audit_log`
  - Endpoints OWNER-only : GET/POST/PATCH/DELETE `/api/admin/owner/admins`, GET `/api/admin/owner/audit-log`
  - 3 rôles : moderator, support, manager (créables par OWNER). Seed OWNER protégé (cannot disable/delete)
  - Disabled admin blocked at login + on every authenticated request
  - Audit log auto sur : admin_created/updated/deleted, maintenance_toggled, user_deleted, delete_all_data, claim_approved/rejected
  - `DELETE /api/admin/delete-all` désormais réservé OWNER
  - Frontend: `OwnerAdminPanel.js` (table modérateurs + journal audit), onglet "OWNER" (couronne dorée) visible uniquement si admin_role==='super_admin_owner'
  - Validation Master Model V2 : claim approval met aussi à jour `master_profile.trust.is_verified`

## New API Endpoints (V2)
- GET  /api/providers/{id}/master — fetch the V2 nested profile (lazy persist)
- POST /api/admin/migrate-master-model — admin idempotent re-migrate
- POST /api/admin/dedupe-providers — admin idempotent dedupe by name
- GET  /api/admin/master-model/stats — coverage + top categories
- GET  /api/search/smart?q=... — V2 search uses master_profile.ai_matching

## Pending / In Progress
- Google Maps Geolocation (BLOCKED - waiting for user API key)
- WhatsApp CallMeBot automation (BLOCKED - waiting for user key)
- Public Partner profile page

## Phase 2 (Upcoming)
- P1: Teleconsultation Video (Twilio Video)
- P1: SMS/Email Notifications (Twilio/SendGrid)
- P1: Card Payment (Stripe)

## Future / Backlog
- Refactor server.py (>3700 lines) into FastAPI routers
- Refactor AdminDashboard.js + DoctorDashboard.js (>500 lines each)
- AI embeddings (currently null in ai_matching.embedding) for semantic search
- Marketplace multi-vendeurs, Abonnements, USSD

## Key DB Collections
- users: {email, password, user_type, name, whatsapp_number, address, partner_role}
- doctor_profiles: { ..flat fields, master_profile: { identity, classification, ai_matching, contact, booking, trust } }
- partner_profiles: { ..flat fields, master_profile: {...} }
- claims (NEW), admin_notifications, ads, appointments, payments

## Key API Endpoints
- POST /api/auth/register
- POST /api/structures/add (auto-builds master_profile)
- POST /api/claims (claim an existing fiche)
- GET  /api/search/smart?q=... (V2 nested matching)
- GET  /api/providers/{id}/master (V2 profile)
- POST /api/admin/migrate-master-model | dedupe-providers | master-model/stats

## Admin Credentials
- URL: /admin | Username: MADJIB | Password: 48851132kl
