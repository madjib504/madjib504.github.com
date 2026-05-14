# PRD - keneyakafisa

## Original Problem Statement
Build a comprehensive health application in French named "keneyakafisa". The platform connects patients with modern medicine, African traditional medicine, and wellness specialists.

## User Personas
- **Patients**: Search doctors, book appointments, manage medical records, earn loyalty points
- **Health Professionals (Doctors)**: Manage schedules, receive bookings, track stats, present themselves via video + social links
- **Partners**: Companies, pharmacies, labs, investors, sponsors with dedicated dashboard + video + social links
- **Admin**: Manage users, appointments, payments, advertisements via `/admin` dashboard

## Tech Stack
- Frontend: React.js, TailwindCSS, Shadcn UI
- Backend: FastAPI (Python)
- Database: MongoDB Atlas
- Storage: Emergent Object Storage (uses EMERGENT_LLM_KEY) for presentation videos
- PWA: Service workers, manifest

## What's Been Implemented
- [2025-12] Full authentication system (JWT) - 3 user types: patient, doctor, partner
- [2025-12] Doctor search with multi-category filtering
- [2025-12] Appointment booking system
- [2025-12] Admin dashboard with notifications (bell icon + WhatsApp forward)
- [2025-12] Advertising system (carousel + /advertise submission)
- [2025-12] WhatsApp integration (registration notifications, welcome messages)
- [2025-12] PWA capabilities + SEO tools
- [2025-12] Welcome page for doctors (brochure + WhatsApp)
- [2025-12] Documents Importants in side menu
- [2025-12] Partner registration with fields: company name, activity type, address
- [2025-12] Partner Dashboard (/partner/dashboard) with profile management
- [2025-12] Code quality fixes (useCallback, array keys, console removal)
- [2025-12] Service Worker v2 with cache versioning
- [2026-02] Social media links (TikTok / Facebook / Instagram) + presentation video for doctors AND partners (upload MP4 to Emergent Object Storage + external URL fallback). Public doctor profile displays social badges + uploaded video. Tested end-to-end (11/11 backend, frontend flow OK).
- [2026-02] Bug fixes: EMERGENT_LLM_KEY env var collision, lazy storage init (read env at call time), include_router order so /api/upload/video / /api/profile/social-links / /api/media/{path} are reachable. Also fixed undefined `idx` variable in review-star rendering on DoctorProfilePage.

## Pending / In Progress
- Google Maps Geolocation (BLOCKED - waiting for user API key text)
- Public Partner profile page (currently only dashboard exists - partners not browseable yet)
- Backend refactoring (server.py >2600 lines)

## Phase 2 (Upcoming)
- P1: Teleconsultation Video (Twilio Video)
- P1: Notifications SMS/Email (Twilio/SendGrid)
- P1: Paiement par carte bancaire (Stripe)

## Future / Backlog
- Système de Livraison, Marketplace Multi-vendeurs, Abonnements, USSD
- Refactor server.py into routers (auth/doctor/partner/media/payments)
- Tighten /api/profile/social-links with Pydantic model (currently raw dict)

## Key DB Collections
- users: {email, password, user_type (patient/doctor/partner), name, whatsapp_number}
- doctor_profiles: {user_id, specialties, location, medical_type, tiktok_url, facebook_url, instagram_url, video_url, presentation_video}
- partner_profiles: {user_id, company_name, activity_type, address, whatsapp_number, status, tiktok_url, facebook_url, instagram_url, video_url, presentation_video}
- admin_notifications: {type, user_type, user_name, message, read, created_at}
- ads, appointments, payments

## Key API Endpoints (new this iteration)
- PUT /api/profile/social-links (doctor or partner) — saves tiktok_url/facebook_url/instagram_url/video_url
- POST /api/upload/video (doctor or partner) — MP4 ≤ 50 MB → Emergent Object Storage, returns video_url
- GET /api/media/{path:path} — streams stored video back

## Admin Credentials
- URL: /admin | Username: MADJIB | Password: 48851132kl
