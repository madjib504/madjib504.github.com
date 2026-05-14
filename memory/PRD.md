# PRD - keneyakafisa

## Original Problem Statement
Build a comprehensive health application in French named "keneyakafisa". The platform connects patients with modern medicine, African traditional medicine, and wellness specialists.

## User Personas
- **Patients**: Search doctors, book appointments, manage medical records, earn loyalty points
- **Health Professionals (Doctors)**: Manage schedules, receive bookings, track stats
- **Partners**: Companies, pharmacies, labs, investors, sponsors with dedicated dashboard
- **Admin**: Manage users, appointments, payments, advertisements via `/admin` dashboard

## Tech Stack
- Frontend: React.js, TailwindCSS, Shadcn UI
- Backend: FastAPI (Python)
- Database: MongoDB Atlas
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

## Pending / In Progress
- Google Maps Geolocation (BLOCKED - waiting for user API key)
- Backend refactoring (server.py >2400 lines)

## Phase 2 (Upcoming)
- P1: Teleconsultation Video (Twilio Video)
- P1: Notifications SMS/Email (Twilio/SendGrid)
- P1: Paiement par carte bancaire (Stripe)

## Future / Backlog
- Systeme de Livraison, Marketplace Multi-vendeurs, Abonnements, USSD

## Key DB Collections
- users: {email, password, user_type (patient/doctor/partner), name, whatsapp_number}
- doctor_profiles: {user_id, specialties, location, medical_type}
- partner_profiles: {user_id, company_name, activity_type, address, whatsapp_number, status}
- admin_notifications: {type, user_type, user_name, message, read, created_at}
- ads, appointments, payments

## Admin Credentials
- URL: /admin | Username: MADJIB | Password: 48851132kl
