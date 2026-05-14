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

## What's Been Implemented
- [2025-12] Full authentication system (JWT)
- [2025-12] Doctor search with multi-category filtering
- [2025-12] "Autre" (Other) category as search bar
- [2025-12] Appointment booking system
- [2025-12] Admin dashboard with user/appointment/payment management
- [2025-12] Advertising system (carousel + /advertise submission)
- [2025-12] WhatsApp number fields for users and doctors
- [2025-12] PWA capabilities (manifest.json, service worker, installable)
- [2025-12] SEO tools (Google Site Verification, sitemap.xml, robots.txt)
- [2025-12] QR code generation
- [2025-12] Side menu with quick actions
- [2025-12] Promotional countdown timer
- [2025-12] Database migrated to MongoDB Atlas
- [2025-12] Database purged for production launch
- [2025-12] Code quality: Fixed hook deps (useCallback), array index keys, removed console statements
- [2025-12] Welcome page for doctors after registration (WhatsApp + brochure link)
- [2025-12] Documents Importants section in side menu (catalogue de partenariat)
- [2025-12] Admin notification system (bell icon + dropdown + WhatsApp forward)
- [2025-12] WhatsApp notification on new registration (patient + doctor)
- [2025-12] Service Worker v2 with cache versioning and auto-update

## Pending / In Progress
- Google Maps Geolocation (BLOCKED - waiting for user API key)
- Backend refactoring (server.py >2400 lines -> modular APIRouter)

## Phase 2 (Upcoming)
- P1: Teleconsultation Video (Twilio Video)
- P1: Notifications SMS/Email (Twilio/SendGrid)
- P1: Paiement par carte bancaire (Stripe)
- P2: Push Notifications (Firebase Cloud Messaging)

## Future / Backlog
- Systeme de Livraison (real-time tracking)
- Marketplace Multi-vendeurs
- Abonnements Bien-etre
- Version USSD (offline/rural access)

## Mocked Features
- Mobile Money payments (mock implementation)
- Geolocation distance calculations (haversine approximation)

## Admin Credentials
- URL: /admin
- Username: MADJIB
- Password: 48851132kl

## Key Files
- /app/frontend/src/pages/WelcomeDoctor.js - Welcome page after doctor registration
- /app/frontend/src/pages/Home.js - Side menu with Documents Importants section
- /app/frontend/src/pages/AdminDashboard.js - Admin dashboard with notification bell
- /app/frontend/src/pages/Register.js - Registration with WhatsApp notification
- /app/frontend/public/pwabuilder-sw.js - Service Worker v2 with cache versioning
- /app/backend/server.py - Main backend (admin_notifications collection)
