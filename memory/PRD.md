# HealthFusion - PRD (Product Requirements Document)

## Original Problem Statement
Application de santé pour le marché africain avec deux catégories de médecins:
- **Médecine moderne** (toutes spécialités: gynécologues, ophtalmologues, chirurgiens, etc.)
- **Médecine traditionnelle africaine agréée**

La fonctionnalité principale est de connecter les patients avec les spécialistes selon leurs besoins de santé.

## User Personas
1. **Patients** - Cherchent des consultations médicales, achètent des produits bien-être
2. **Professionnels de santé** - Médecins, praticiens traditionnels, pharmaciens
3. **Fournisseurs** - Matériel médical, boutique bien-être

## Core Requirements
- Multi-catégories: Moderne, Traditionnel africain, Bien-être, Service à domicile, Matériel médical, Boutique bien-être
- Recherche de spécialistes par symptômes
- Système de rendez-vous
- Chat et messagerie
- Paiement Mobile Money (Afrique)

---

## What's Been Implemented

### Phase 1 - MVP & Core Features ✅
*Completed December 2024*
- Inscription/Connexion utilisateurs (patients, médecins)
- Recherche multi-catégories avec filtres
- Profils médecins détaillés
- Système de rendez-vous
- Chat en temps réel (Socket.IO)
- Page d'accueil avec catégories
- Packs Bien-être thématiques

### Phase 1.5 - Extended Features ✅
*Completed January 2025*
- Dossier Médical Électronique
- Programme de Fidélité "HealthPoints"
- Blog Santé & Conseils
- Bouton SOS Urgence
- Assistant d'Orientation (symptômes → spécialité)
- Système d'avis amélioré avec réponses médecins
- Dashboard statistiques professionnels

### Phase 2 - Intégrations Tierces 🔄
*In Progress - January 2025*
- ✅ **Mobile Money** (Orange Money, MTN MoMo, Moov) - Mode Sandbox
- ✅ **Historique Paiements** dans le dashboard patient (avec statistiques)
- ✅ **Système de Réservation Amélioré** - Calendrier interactif avec créneaux horaires
- ✅ **Géolocalisation** - Recherche de médecins à proximité
- ✅ **Notifications** - Centre de notifications avec badge
- ⏳ Téléconsultation Vidéo (Twilio)
- ⏳ Notifications SMS/Email (rappels automatiques)
- ⏳ Paiement Carte Bancaire (Stripe)

---

## Prioritized Backlog

### P0 - Critical (Phase 2 continued)
- [ ] Intégration Twilio Video pour téléconsultations
- [ ] Notifications SMS/Email (Twilio/SendGrid)
- [ ] Intégration Stripe pour paiements carte

### P1 - High Priority (Phase 3)
- [ ] Application Mobile Native (React Native)
- [ ] Système de livraison temps réel
- [ ] Version USSD pour zones rurales

### P2 - Medium Priority
- [ ] Marketplace multi-vendeurs
- [ ] Abonnements bien-être (box mensuelle)
- [ ] Assistant Santé IA avancé (chatbot)
- [ ] Intégration assurances santé

### P3 - Future
- [ ] Télémédecine avec IA diagnostic
- [ ] Dossier médical partagé inter-établissements
- [ ] Plateforme formation professionnels santé

---

## Technical Architecture

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB
- **Auth**: JWT tokens
- **Real-time**: Socket.IO

### Frontend
- **Framework**: React.js
- **Styling**: TailwindCSS
- **Components**: Shadcn UI
- **Icons**: Lucide-react

### Key Files
- `/app/backend/server.py` - Main API (~1370 lignes)
- `/app/backend/services/mobile_money.py` - Service paiement
- `/app/frontend/src/App.js` - Router principal
- `/app/frontend/src/pages/` - Toutes les pages

---

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Search & Doctors
- `GET /api/specialties`
- `GET /api/doctors/search`
- `GET /api/doctors/{id}`

### Payments (NEW - Phase 2)
- `GET /api/payments/providers` - Liste des fournisseurs Mobile Money
- `POST /api/payments/initiate` - Initier un paiement
- `GET /api/payments/status/{reference_id}` - Statut paiement
- `POST /api/payments/simulate-confirmation/{id}` - Simulation sandbox
- `POST /api/payments/webhook/{provider}` - Webhooks

### Phase 1 Features
- `GET/POST /api/medical-records`
- `GET/POST /api/loyalty/points`
- `GET /api/blog`
- `GET /api/emergency/contacts`
- `POST /api/assistant/suggest`

---

## Database Collections
- `users` - Patients et professionnels
- `doctor_profiles` - Profils détaillés médecins
- `appointments` - Rendez-vous
- `messages` - Chat
- `reviews` - Avis et évaluations
- `medical_records` - Dossiers médicaux
- `loyalty_points` - Points fidélité
- `blog_posts` - Articles blog
- `payments` - Transactions Mobile Money (NEW)

---

## Notes Importantes

### Mode Sandbox Mobile Money
Les intégrations Mobile Money (Orange, MTN, Moov) fonctionnent en mode **SANDBOX**:
- Aucune transaction réelle
- Simulation via endpoint `/simulate-confirmation`
- Pour production: configurer les vraies clés API des fournisseurs

### Refactoring Recommandé
Le fichier `server.py` est devenu volumineux (~1370 lignes). À refactoriser en modules:
- `/routes/auth.py`
- `/routes/doctors.py`
- `/routes/payments.py`
- `/routes/phase1_features.py`

---

*Dernière mise à jour: 20 Janvier 2025*
