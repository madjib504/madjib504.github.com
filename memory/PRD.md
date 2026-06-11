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
- [2026-02] **Smart-search V2** : interroge `master_profile.ai_matching.symptomes_pris_en_charge` + `ai_specialty_tags`, inclut partner_profiles, tri par `trust.triage_priority`, déduplication par nom.- [2026-02] **DB dedupe permanente** : seed_loader vérifie aussi par name avant insert + endpoint `/api/admin/dedupe-providers`. Plus de doublons après restart.
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
- [2026-02] **Emails Resend automatisés** : welcome (`/structures/add`), claim decision (approve/reject), J+7 profile-completion reminder (cron `services.profile_reminders`).
- [2026-02] **62 nouveaux fournisseurs V2 (Urologie, Dermato, Gynéco, Cardio, Endocrino, Pédiatrie, Neuro, ORL, Beauté)** ingérés via `services.v2_seed_loader.seed_v2_specialties()` → DB partner_profiles passe de 42 à 104, idempotent au démarrage.
- [2026-02] **Géolocalisation GPS curée Google-Maps (offline, sans clé API)** : `services.geocoding` héberge 30 landmarks (CHU Cocody/Treichville/Yopougon, PISAM, Clinique Farah…) + centroïdes précis des communes d'Abidjan (Cocody-Angré, Riviera 1/2/3, Plateau, Yopougon-Sicogi, Marcory Zone 4, Adjamé-Liberté, Abobo, Koumassi…) + autres villes CI (Bouaké, San Pedro, Yamoussoukro, Korhogo). Migration automatique au boot remplace les 100% de placeholders (5.3167, -4.0333). Résultat : 0 placeholder restant, 100% des 182 fiches géocodées (26 landmark + 127 neighborhood + 21 city + 7 country-fallback=Abidjan). Champ `geo.precision` = landmark|neighborhood|city|country.
- [2026-02] **Carte interactive Leaflet/OpenStreetMap** : nouveau composant `/components/ProvidersMap.jsx` (gratuit, sans clé API). Page `/search` propose un toggle **Liste / Mixte / Carte** au-dessus des résultats. Auto-fit des bounds, markers colorés (bleu doctor, vert partner), popups cliquables avec "Voir" + "Rdv".
- [2026-02] **Géolocalisation "Autour de moi"** : bouton flottant sur la carte → `navigator.geolocation` → marker pulsant + cercle 2 km. Distance Haversine calculée pour chaque fournisseur, affichée en pastille bleue (liste, mixte, popup). Toggle "Trier par proximité" (coché par défaut quand l'utilisateur s'est géolocalisé).
- [2026-02] **Système Badges Phase 1 (2-couches)** : nouveau service `services/badge.py` + composant React `ProviderBadge.jsx`.
  - **Trust badge** (toujours visible) : Annuaire (slate) → Revendiqué (amber) → Identité vérifiée (emerald)
  - **Commercial badge** (optionnel Phase 1 placeholder, Phase 2 activé) : Mis en avant (orange) / Partenaire Officiel (purple) / Partenaire Officiel+ (violet)
  - Champ DB `master_profile.commercial.{tier, tier_until}` créé partout (défaut `free`) avec **auto-expiration** quand `tier_until` est passé
  - **Trust score bonus modéré** (+15 verified, +5 pending, +3 premium) — capé à +18 pour garantir que le tri organique reste prioritaire face au paid
  - Badges injectés dans `/api/search/smart`, `/api/providers/search`, `/api/providers/{id}/master` ; champ `is_sponsored` pour transparence patient
  - Nouveau endpoint **GET /api/stats/claims-monthly** (public, social proof : compteurs claims du mois / vérifiés / total)
  - Bannière `<ClaimsSocialProof>` sous résultats `/search` : « 8 fiches revendiquées ce mois · 13 établissements vérifiés sur 182 » + CTA « Revendiquer ma fiche »
  - Tests : 17 cas dédiés + 17 régressions = **34/34 PASS**
- [2026-02] **Page Tarifs publique `/partner/pricing`** : conversion B2B clé en main pour les providers.
  - 3 plans côte-à-côte : Annuaire (Gratuit) / Mis en avant (3 000 XOF / 7 jours) / Partenaire Officiel (15 000 XOF / mois, recommandé)
  - **Calculateur ROI interactif** : sliders vues/jour, taux conversion, prix consultation ; bascule entre les 3 plans ; affiche RDV/jour, revenu/jour, revenu/mois, bénéfice net et ROI en %
  - FAQ (5 questions sur le paiement, transparence du tri, vérification gratuite)
  - Trust strip (Tri transparent / Vérification gratuite / Sans engagement)
  - Lien depuis la bannière Social Proof + route Navigate `/pricing → /partner/pricing`
- [2026-02] **Refonte Home Hero** : remplacement du titre/sous-titre + ajout d'une section « ⚡ Accès rapide » universelle (Trouver un professionnel / Décrire mon besoin / Explorer autour de moi) au-dessus des cartes d'inscription. Message d'accueil orienté patient avec ton clair et apaisant.

## New API Endpoints (V2)
- GET  /api/providers/{id}/master — fetch the V2 nested profile (lazy persist)
- POST /api/admin/migrate-master-model — admin idempotent re-migrate
- POST /api/admin/dedupe-providers — admin idempotent dedupe by name
- GET  /api/admin/master-model/stats — coverage + top categories
- GET  /api/search/smart?q=... — V2 search uses master_profile.ai_matching
- POST /api/admin/run-v2-seed (OWNER) — idempotent V2 specialty seed
- POST /api/admin/geocode/refresh (OWNER) — force=true|false, re-applies curated GPS coords
- GET  /api/admin/geocode/audit — counts by precision per collection

## Pending / In Progress
- Google Maps **live** API (BLOCKED - user has chosen curated offline geocoding for now). Could be plugged in via `services.geocoding.resolve_coordinates` upgrade if user provides a key later.
- WhatsApp CallMeBot automation (BLOCKED - waiting for user key)
- Public Partner profile page
- Surface geocode audit numbers (landmark/neighborhood/city/country counts) on AdminDashboard ("Géo" KPI card)

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
