# PRD - keneyakafisa

## Original Problem Statement
Build a comprehensive health application in French named "keneyakafisa". The platform connects patients with modern medicine, African traditional medicine, and wellness specialists.

## User Personas
- **Patients**: Search doctors, book appointments, manage medical records, earn loyalty points; have address/localisation
- **Health Professionals (Doctors)**: Manage schedules, receive bookings, present themselves via video + social links
- **Partners**: Companies, pharmacies, labs, sponsors with dedicated dashboard + video + social links
- **Admin**: Manage users, appointments, payments, advertisements via `/admin` dashboard

## Tech Stack
- Frontend: React.js, TailwindCSS, Shadcn UI
- Backend: FastAPI (Python)
- Database: MongoDB Atlas
- Storage: Emergent Object Storage (uses EMERGENT_LLM_KEY) for presentation videos
- PWA: Service workers, manifest

## What's Been Implemented
- [2025-12] Full authentication system (JWT) - 3 user types
- [2025-12] Doctor search with multi-category filtering
- [2025-12] Appointment booking, Admin dashboard with notifications, Advertising system
- [2025-12] WhatsApp integration (registration / welcome)
- [2025-12] PWA capabilities + SEO tools
- [2025-12] Welcome page for doctors, Documents Importants in side menu
- [2025-12] Partner registration + Partner Dashboard
- [2025-12] Code quality fixes (useCallback, array keys, console removal)
- [2025-12] Service Worker v2 with cache versioning
- [2026-02] Social media links (TikTok/Facebook/Instagram) + presentation video upload for doctors & partners
- [2026-02] Doctor public profile shows social badges + video right under specialty/medical type
- [2026-02] Bug fixes: EMERGENT_LLM_KEY env, lazy storage init, include_router order, `idx` undefined in reviews
- [2026-02] Patient registration now has 'Adresse / Localisation' field (persisted on user document)
- [2026-02] Search keyword alias dictionary FR: "cardiologue"→Cardiologie, dermato, gynéco, pédiatre, kiné, ophtalmo, psychiatre, neurologue, orthopédiste, pneumologue, gastro, endocrinologue, pharmacien, généraliste, kinésithérapeute, ostéopathe, nutritionniste, naturopathe, sophrologue, tradipraticien, herboriste, phytothérapeute, rebouteux, etc.
- [2026-02] Login & Navbar routing fixed for Partner user_type (was wrongly going to /doctor/dashboard)

## Pending / In Progress
- Google Maps Geolocation (BLOCKED - waiting for user API key TEXT)
- Public Partner profile page
- React duplicate-key warning on dashboards (cosmetic; likely duplicate notification IDs from server.py duplicate endpoint registrations)
- Backend refactor (server.py >2600 lines)

## Phase 2 (Upcoming)
- P1: Teleconsultation Video (Twilio Video)
- P1: Notifications SMS/Email (Twilio/SendGrid)
- P1: Paiement par carte bancaire (Stripe)

## Future / Backlog
- Système de Livraison, Marketplace Multi-vendeurs, Abonnements, USSD
- Refactor server.py into routers
- Tighten /api/profile/social-links with Pydantic model

## Key DB Collections
- users: {email, password, user_type, name, whatsapp_number, address}
- doctor_profiles: {user_id, specialties, location, medical_type, tiktok_url, facebook_url, instagram_url, video_url, presentation_video}
- partner_profiles: {user_id, company_name, activity_type, address, whatsapp_number, status, social fields, presentation_video}
- admin_notifications, ads, appointments, payments

## Key API Endpoints
- POST /api/auth/register (now accepts address for all user types)
- GET  /api/doctors/search?keyword=... (alias dictionary for FR practitioner→specialty mapping)
- PUT  /api/profile/social-links (doctor or partner)
- POST /api/upload/video (doctor or partner)
- GET  /api/media/{path:path}

## Admin Credentials
- URL: /admin | Username: MADJIB | Password: 48851132kl
