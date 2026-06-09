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
- [2026-02] **DB dedupe permanente** : seed_loader vérifie aussi par name avant insert + endpoint `/api/admin/dedupe-providers`. Plus de doublons après restart.
- [2026-02] **Urgent symptom routing fixed**: q='urgence' déclenche mode=orientation + emergency_number=185.
- [2026-02] **Espace OWNER (super-admin)** : verify_owner_token, audit log auto, 5 endpoints OWNER, 3 rôles modérateurs, seed OWNER protégé.
- [2026-02] **"Dr." retiré devant les structures** : helper isStructure() + displayName() — pas de "Dr." devant les cliniques/cabinets/pharmacies.
- [2026-02] **Page /register supprimée** : tout passe par la Home avec 3 flows (Patient/Claim/Add Structure), redirect /register → /.
- [2026-02] **Suggestions de symptômes cliquables** : 12 chips populaires (mal de tête, fièvre, diabète, bilan sanguin, etc.) sous le champ de recherche.
- [2026-02] **Login simplifié** : retiré le champ WhatsApp obsolète. Just email + password.
- [2026-02] **Filtres /search supprimés** : interface 100% pilotée par la Smart-Search IA.
- [2026-02] **Système Claim Provider complet (V2)** :
  - 5 claim_types canoniques : owner, manager, doctor, secretary, admin_rep
  - Upload de documents justificatifs (PDF/images, 10 Mo max, 5 fichiers max) via `POST /api/claims/upload` (Emergent Object Storage)
  - Trust score auto-calculé 0-100 (documents, email pro, cohérence nom, phone match, justification)
  - 7 KPIs admin : `GET /api/admin/claims/stats`
  - Détail enrichi `GET /api/admin/claims/{id}` (claim + provider + user + autres claims du demandeur + trust recomputed)
  - Anti-doublon : un même phone/email ne peut pas avoir 2 claims pending sur la même fiche
  - Approve met aussi à jour `master_profile.trust.is_verified=true`
  - UI Admin : nouvel onglet "Revendications" avec KPI cards + filtres + table + modal détail (provider/demandeur/documents/trust/approve-reject)
  - UI Claimant : ClaimFiche.js avec upload drag-and-drop multi-fichiers + claim_type normalisé

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
