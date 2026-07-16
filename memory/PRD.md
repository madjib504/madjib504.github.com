# Baraka Mall — Product Requirements Document

## Vision
Application mobile qui permet aux Ivoiriens d'acheter dans les meilleures boutiques du monde (France, USA, Chine) avec paiement en FCFA et livraison à domicile en Côte d'Ivoire. À l'arrivée du colis à Abidjan, un livreur appelle le client pour confirmer sa localisation avant remise.

## Users
Résidents de Côte d'Ivoire (Abidjan et environs) souhaitant importer des articles de mode, tech, beauté, sport, etc. sans gérer la logistique internationale.

## Core Features (MVP)
1. **Authentification par téléphone/OTP** (mock, code `1234`)
2. **Catalogue de boutiques** groupées par pays (France, USA, Chine) — 24 boutiques seedées (Shein, Amazon, Zara, H&M, Zalando, Fnac, Sephora, Decathlon, Nike, Apple, Best Buy, Walmart, Target, eBay, Macy's, AliExpress, Temu, Taobao, JD, DHgate, Banggood, Miniso, Cdiscount, La Redoute)
3. **Fee calculator** en temps réel : prix devise étrangère (EUR/USD/CNY) → conversion FCFA + frais d'importation (15%) + frais de service (8%) + expédition internationale (par pays) + livraison locale (3000 FCFA)
4. **Ouverture de la vraie boutique** dans le navigateur intégré (WebBrowser)
5. **Panier** : ajout manuel de produit (nom, URL, prix, taille, quantité) après le calcul
6. **Checkout Mobile Money (MOCKED)** : Orange Money, MTN, Moov, Wave — validation immédiate simulée
7. **Suivi de commande** : stepper 6 étapes (Achat → Expédié → En transit → Arrivé à Abidjan → Livreur en route → Livré)
8. **Appel du livreur** : quand statut = "livreur_route", bouton d'appel direct (`tel:` link) affiché
9. **Profil utilisateur** : nom, adresse de livraison, déconnexion

## Backend Stack
- FastAPI + Motor (MongoDB async)
- Routes `/api/*` : auth, shops, quote, cart, orders
- Mock OTP stored in MongoDB, bearer token per user

## Frontend Stack
- Expo Router (file-based routing)
- React Native, lucide-react-native icons, expo-web-browser
- Storage via `@/src/utils/storage` (SecureStore for token)

## Design
Palette : Orange vibrant (#FF6B00) primary + Slate navy (#0F172A) — inspiré du drapeau ivoirien mais moderne/premium.

## Business Enhancement
Marge intégrée dans les frais de service (8%) + frais d'importation forfaitaires (15%) permettent une monétisation transparente à chaque commande.

## MOCKED Components (⚠️)
- **OTP** : code `1234` retourné pour tout numéro (à remplacer par Twilio/SMS en prod)
- **Mobile Money paiement** : validation immédiate simulée, pas d'intégration réelle (Wave/OM/MTN à intégrer en prod)
- **Advance status** : bouton "Simuler prochaine étape" pour démo — en prod, ce sera piloté par les backoffices logistiques

## Next Steps
- Intégration Twilio SMS pour vrai OTP
- Intégration Wave/Orange Money/MTN pour vrais paiements
- Backoffice admin pour gérer les commandes et statuts
- Notifications (à demander explicitement)
