# Guide d'intégration des APIs marchandes réelles

Ce guide vous accompagne pas-à-pas pour créer les comptes et obtenir les clés API des marchands. **Tant que les clés ne sont pas remplies dans `/app/backend/.env`, l'app utilise automatiquement le catalogue démo actuel (180 produits curés) — aucun code à toucher.**

Vérifier l'état à tout moment : `GET /api/providers/status`

---

## 🟢 1. AliExpress Affiliate (recommandé — le plus rapide)

**Délai d'approbation moyen : 24-72h**
**Catalogue accessible : ~100 millions de produits (mode, tech, gadgets, etc.)**

### Étape 1 : Compte publisher/affilié
1. Aller sur **https://portals.aliexpress.com/**
2. Cliquer **"Register"** en haut à droite
3. Créer un compte AliExpress standard (ou se connecter si vous en avez déjà un)
4. Retourner sur portals.aliexpress.com et cliquer **"Become an Affiliate"**
5. Remplir le formulaire :
   - **Type de trafic** : "Mobile App"
   - **Nom de l'app** : Baraka Mall
   - **URL de l'app** : votre lien preview Emergent
   - **Description** : "Cross-border shopping app for Côte d'Ivoire, delivering AliExpress products in FCFA"
   - **Audience** : Côte d'Ivoire + West Africa
   - **Volume mensuel estimé** : commencer modestement (1000-5000 USD)
6. Accepter les CGU et soumettre
7. Réponse par email sous **24-72h**

### Étape 2 : Créer l'app développeur
1. Une fois approuvé, aller sur **https://openservice.aliexpress.com/**
2. Se connecter avec le même compte AliExpress
3. Cliquer **"Console" > "My Apps" > "Create App"**
4. Type d'app : **"Affiliate"** (AE-Affiliate)
5. Après création, récupérer :
   - `AE_APP_KEY` (ex: `12345678`)
   - `AE_APP_SECRET` (chaîne longue)
6. Dans la section **Authorization**, générer un **Access Token** en autorisant votre app d'accéder à votre compte affilié
   - Récupérer `AE_ACCESS_TOKEN`

### Étape 3 : Récupérer l'Affiliate ID
1. Retourner sur https://portals.aliexpress.com/ > **"Account"**
2. L'**Affiliate ID / Tracking ID** est affiché (ex: `bara_mall_ci`)
3. Récupérer `AE_AFFILIATE_ID`

### Étape 4 : Remplir /app/backend/.env
```env
AE_APP_KEY="votre_app_key_ici"
AE_APP_SECRET="votre_app_secret_ici"
AE_ACCESS_TOKEN="votre_access_token_ici"
AE_AFFILIATE_ID="votre_tracking_id_ici"
```
Puis me demander de redémarrer le backend — les vraies recherches AliExpress s'activent automatiquement.

---

## 🟡 2. Rakuten Advertising (Zalando, Nike, Sephora, etc.)

**Délai d'approbation moyen : 1-2 semaines** (approbation par advertiser, marque par marque)
**Catalogue accessible : Zalando, Nike, Sephora, Fnac, Decathlon, Best Buy, Macy's, et 1000+ marques**

### Étape 1 : Compte publisher Rakuten
1. Aller sur **https://rakutenadvertising.com/**
2. Cliquer **"Become a Publisher"** (en haut à droite)
3. Remplir : email, prénom, nom, mot de passe
4. Vérifier l'email (cliquer le lien reçu)
5. Continuer le formulaire :
   - **Pays** : Côte d'Ivoire (ou France si votre entité est en France)
   - **Type** : Company (si vous êtes enregistrés) ou Individual
   - **Profile Name** : Baraka Mall
   - **Business Model** : "Mobile App / Shopping Aggregator"
   - **Primary Channel URL** : votre URL preview Emergent
   - **Content Categories** : Fashion, Electronics, Beauty, Home
   - **Monthly Traffic** : ce que vous estimez raisonnable (500-5000 visiteurs)
6. Accepter le **Publisher Membership Agreement** + **Affiliate Network Policies**
7. Soumettre — accès au **Publisher Dashboard** immédiat

### Étape 2 : Postuler auprès des marques
Contrairement à AliExpress, **chaque marque approuve individuellement** :
1. Dans le dashboard, aller sur **"Advertisers"**
2. Rechercher : **Zalando**, **Nike**, **Sephora**, **Fnac**, **Decathlon**, **Best Buy**, **Macy's**, etc.
3. Cliquer **"Apply to Program"** pour chaque marque
4. Attendre l'approbation (1 jour à 2 semaines selon la marque)

### Étape 3 : Créer l'application développeur
1. Aller sur **https://developers.rakutenadvertising.com/**
2. Se connecter avec le même compte
3. **"Applications" > "Add Application"**
4. Remplir : nom, description, URL de callback
5. Récupérer :
   - `RAKUTEN_CLIENT_ID`
   - `RAKUTEN_CLIENT_SECRET`

### Étape 4 : Récupérer le Scope ID
1. Retourner sur le **Publisher Dashboard**
2. **"Account" > "Web Services / API Access"**
3. Copier le **Scope ID** (aussi appelé "SID")
4. Récupérer `RAKUTEN_SCOPE_ID`

### Étape 5 : Remplir /app/backend/.env
```env
RAKUTEN_CLIENT_ID="votre_client_id"
RAKUTEN_CLIENT_SECRET="votre_client_secret"
RAKUTEN_SCOPE_ID="votre_scope_id"
```

---

## 📋 État actuel de votre app

| Provider | Status | Action requise |
|---|---|---|
| Catalogue démo | ✅ Actif (180 produits, 24 boutiques) | Aucune — fonctionne déjà |
| AliExpress | ⏳ En attente clés | Suivre section 1 ci-dessus |
| Rakuten | ⏳ En attente clés | Suivre section 2 ci-dessus |

Endpoint de vérification : **`GET /api/providers/status`** → renvoie l'état en temps réel

---

## 💡 Notes importantes

1. **Aucune urgence à tout intégrer d'un coup**. AliExpress d'abord (24h), Rakuten ensuite (2 semaines).
2. **En attendant**, votre app est 100% fonctionnelle avec le catalogue démo actuel — vous pouvez déployer et présenter à vos utilisateurs/investisseurs.
3. **Une fois les clés obtenues**, dites-moi simplement "j'ai les clés AliExpress" et je :
   - Complète l'implémentation `AliExpressService.search_products()` avec la signature MD5/HMAC-SHA256 requise
   - Ajoute les recherches live au search screen (mélange catalogue démo + AliExpress)
   - Génère les liens affiliés pour tracking
4. **Amazon PA API** : non prioritaire (exigences dures : compte Amazon Associate + 3 ventes en 180j). On peut regarder plus tard.
5. **Compliance** : chaque provider a des règles à respecter (pas de traffic incentivized, pas de coupons non autorisés, etc.). Je vous rappellerai ces règles au moment de l'activation.

---

## 🚀 Recommandation

**Commencez par AliExpress ce soir** — le processus prend 15 min à monter et l'approbation arrive sous 48h. C'est le plus grand catalogue accessible depuis la Côte d'Ivoire et le plus adapté au pouvoir d'achat local (produits à petits prix).
