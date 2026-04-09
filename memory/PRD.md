# PRD - keneyakafisa

## Original Problem Statement
Build a comprehensive health application in French named "keneyakafisa". The platform connects patients with modern medicine, African traditional medicine, and wellness specialists.

## User Personas
- **Patients**: Search doctors, book appointments, manage medical records, earn loyalty points
- **Health Professionals (Doctors)**: Manage schedules, receive bookings, track stats
- **Admin**: Manage users, appointments, payments, advertisements via `/admin` dashboard

## Core Requirements
- User registration (Patient/Health Professional) with WhatsApp field
- Multi-category doctor search (specialties, location, traditional medicine)
- Electronic medical records
- Booking calendar with availability management
- Loyalty program
- Advertising system (Carousel on homepage + submission form)
- PWA capabilities (installable app)
- SEO optimization (sitemap, robots.txt, meta tags)

## Tech Stack
- Frontend: React.js, TailwindCSS, Shadcn UI
- Backend: FastAPI (Python)
- Database: MongoDB Atlas
- PWA: Service workers, manifest

## What's Been Implemented ✅
- [2025-12] Full authentication system (JWT)
- [2025-12] Doctor search with multi-category filtering
- [2025-12] "Autre" (Other) category as search bar
- [2025-12] Appointment booking system
- [2025-12] Admin dashboard (`/admin`) with user/appointment/payment management
- [2025-12] Advertising system (carousel display + `/advertise` submission page)
- [2025-12] WhatsApp number fields for users and doctors
- [2025-12] PWA capabilities (manifest.json, service worker, installable)
- [2025-12] SEO tools (Google Site Verification, sitemap.xml, robots.txt)
- [2025-12] QR code generation
- [2025-12] Side menu with quick actions (Inviter un ami, Appel, WhatsApp, Code promo)
- [2025-12] Promotional countdown timer (14 days)
- [2025-12] Database migrated from local MongoDB to MongoDB Atlas
- [2025-12] Database purged of all test data for production launch
- [2025-12] Admin account verified working (credentials in .env)

## Pending / In Progress
- 🟡 Google Maps Geolocation (BLOCKED - waiting for user API key)
- 🟠 Backend refactoring (server.py >2300 lines → modular APIRouter)

## Phase 2 (Upcoming)
- P1: Téléconsultation Vidéo (Twilio Video)
- P1: Notifications SMS/Email (Twilio/SendGrid)
- P1: Paiement par carte bancaire (Stripe)
- P2: Push Notifications (Firebase Cloud Messaging)

## Future / Backlog
- Système de Livraison (real-time tracking)
- Marketplace Multi-vendeurs
- Abonnements Bien-être
- Version USSD (offline/rural access)

## Mocked Features
- Mobile Money payments (mock implementation)
- Geolocation distance calculations (haversine approximation, awaiting Google Maps API)

## Admin Credentials
- URL: /admin
- Username: MADJIB (from ADMIN_USERNAME env var)
- Password: 48851132kl (from ADMIN_PASSWORD env var)

## Key API Endpoints
- `/health` - Readiness probe
- `/api/auth/register`, `/api/auth/login` - Authentication
- `/api/doctors/search` - Doctor search
- `/api/appointments` - Booking management
- `/api/ads` - Advertisement system
- `/api/admin/*` - Admin dashboard APIs

## Architecture Note
- `server.py` is a monolith (>2300 lines) that needs to be refactored into modular FastAPI APIRouter files
