"""
Master Model V2 - Restructuration imbriquée des fiches doctor_profiles / partner_profiles.

L'objectif est de produire pour CHAQUE fiche existante un objet `master_profile`
respectant la structure suivante :
{
    "identity":       { id, name, slug },
    "classification": { secteur, categorie, sous_categories, specialites, provider_kind },
    "ai_matching":    { symptomes_pris_en_charge, besoins_pris_en_charge, ai_specialty_tags, embedding },
    "contact":        { telephone, whatsapp_number, email, site_web, adresse, ville, commune, horaires },
    "booking":        { accepts_appointments, accepts_whatsapp_booking, consultation_domicile, teleconsultation },
    "trust":          { is_verified, claim_status, triage_priority, emergency_level }
}

L'objet est ajouté en plus des champs plats existants (rétro-compatibilité).
Le script est idempotent (peut être relancé sans effet de bord).
"""
import logging
import re
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(s: str) -> str:
    if not s:
        return "unknown"
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "unknown"


# Reverse-mapping spécialité → symptômes/besoins courants (français, mots simples).
SPECIALTY_TO_SYMPTOMS = {
    "cardiologie": [
        "douleur poitrine", "essoufflement", "palpitation", "hypertension",
        "tension", "pression artérielle", "rythme cardiaque", "infarctus",
    ],
    "dermatologie": [
        "peau", "bouton", "acné", "eczéma", "psoriasis", "démangeaison",
        "urticaire", "allergie cutanée",
    ],
    "ophtalmologie": [
        "vision", "yeux", "vue", "cataracte", "conjonctivite", "glaucome",
        "lunettes",
    ],
    "gynécologie": [
        "grossesse", "règles", "contraception", "ménopause", "sein", "femme",
    ],
    "pédiatrie": [
        "enfant", "bébé", "nourrisson", "vaccination", "croissance",
    ],
    "orthopédie": [
        "dos", "articulation", "fracture", "entorse", "genou", "cheville",
        "épaule", "lombaire", "cervical",
    ],
    "neurologie": [
        "mal de tête", "migraine", "vertige", "épilepsie", "convulsion",
        "parkinson", "alzheimer", "cerveau", "avc",
    ],
    "psychiatrie": [
        "dépression", "anxiété", "stress", "burn-out", "insomnie", "panique",
        "trouble du sommeil",
    ],
    "psychologie": [
        "anxiété", "stress", "dépression", "burn-out", "thérapie",
        "écoute", "détresse",
    ],
    "gastro-entérologie": [
        "ventre", "estomac", "diarrhée", "constipation", "digestion",
        "nausée", "ulcère",
    ],
    "pneumologie": [
        "toux", "asthme", "bronchite", "respiration", "pneumonie",
        "essoufflement", "poumon",
    ],
    "endocrinologie": [
        "diabète", "thyroïde", "hormone", "poids", "obésité",
    ],
    "dentisterie": [
        "dent", "mal de dent", "carie", "gencive", "orthodontie",
        "implant dentaire", "couronne",
    ],
    "orl": [
        "oreille", "nez", "gorge", "sinusite", "otite", "angine", "amygdale",
    ],
    "urologie": [
        "urine", "rein", "prostate", "vessie", "incontinence",
    ],
    "médecine générale": [
        "fièvre", "grippe", "rhume", "fatigue", "symptôme général",
        "douleur générale",
    ],
    "phytothérapie": [
        "plante", "naturel", "traditionnel", "herbe",
    ],
    "naturopathie": [
        "fatigue", "détox", "équilibre", "naturel",
    ],
    "massage thérapeutique": [
        "tension musculaire", "détente", "relaxation", "courbature",
    ],
    "nutrition": [
        "alimentation", "régime", "perte de poids", "prise de poids", "diabète",
    ],
    "yoga": [
        "stress", "détente", "souplesse", "méditation",
    ],
    "kinésithérapie": [
        "rééducation", "paralysie", "raideur", "mouvement", "physio",
    ],
    "coaching sportif": [
        "perte de poids", "musculation", "condition physique", "remise en forme",
    ],
    "centre d'écoute": [
        "détresse", "harcèlement", "violence", "solitude", "écoute",
    ],
    "humanitaire / ong": [
        "urgence", "secourisme", "aide alimentaire", "catastrophe",
    ],
    # --- Partenaires / Structures ---
    "pharmacie": [
        "médicament", "ordonnance", "vente médicament", "garde",
        "pharmacien", "conseil médicament",
    ],
    "laboratoire": [
        "analyse sang", "prise de sang", "bilan sanguin", "test biologique",
        "examen biologique", "prélèvement", "résultat laboratoire",
    ],
    "imagerie": [
        "radio", "radiographie", "échographie", "scanner", "irm",
        "imagerie médicale", "examen imagerie",
    ],
    "radiologie": [
        "radio", "radiographie", "échographie", "scanner", "irm",
    ],
    "hôpital": [
        "urgence", "hospitalisation", "soins continus", "consultation hospitalière",
    ],
    "clinique": [
        "consultation", "hospitalisation", "soins", "chirurgie",
    ],
    "polyclinique": [
        "consultation", "hospitalisation", "soins", "plusieurs spécialités",
    ],
    "centre médical": [
        "consultation", "soins ambulatoires", "médecine générale",
    ],
    "centre de santé": [
        "consultation", "vaccination", "soins primaires",
    ],
    "infirmier": [
        "soin à domicile", "pansement", "injection", "perfusion",
    ],
    "soins à domicile": [
        "soin à domicile", "infirmier", "pansement", "personne âgée",
    ],
    "spa": [
        "détente", "massage", "relaxation", "soin du corps",
    ],
    "salon de beauté": [
        "esthétique", "beauté", "soin visage", "épilation",
    ],
    "salon de coiffure": [
        "coiffure", "coupe", "tressage", "soin cheveux",
    ],
    "esthétique": [
        "soin visage", "épilation", "manucure", "beauté",
    ],
    "fitness": [
        "musculation", "cardio", "remise en forme", "perte de poids",
    ],
    "sport": [
        "activité physique", "musculation", "remise en forme",
    ],
    "barbier": [
        "barbe", "coupe homme", "rasage",
    ],
    "formation santé": [
        "formation", "secourisme", "premiers soins",
    ],
    "matériel médical": [
        "équipement médical", "fauteuil roulant", "matériel infirmier",
    ],
}

# Mots-clés activity_type → catégorie canonique (utilisée pour le matching partner).
PARTNER_CATEGORY_NORMALIZATION = {
    "pharma": "pharmacie",
    "officine": "pharmacie",
    "labo": "laboratoire",
    "analyse": "laboratoire",
    "imagerie": "imagerie",
    "radio": "radiologie",
    "hôpital": "hôpital",
    "hopital": "hôpital",
    "polyclinique": "polyclinique",
    "clinique": "clinique",
    "centre médical": "centre médical",
    "centre medical": "centre médical",
    "centre de santé": "centre de santé",
    "centre de sante": "centre de santé",
    "infirmier": "infirmier",
    "domicile": "soins à domicile",
    "spa": "spa",
    "salon de beauté": "salon de beauté",
    "salon de beaute": "salon de beauté",
    "esthét": "esthétique",
    "esthet": "esthétique",
    "coiffure": "salon de coiffure",
    "coiffeur": "salon de coiffure",
    "fitness": "fitness",
    "sport": "sport",
    "gym": "fitness",
    "barbier": "barbier",
    "formation": "formation santé",
    "matériel": "matériel médical",
    "materiel": "matériel médical",
    "humanitaire": "humanitaire / ong",
    "ong": "humanitaire / ong",
    "association": "humanitaire / ong",
    "tradi": "phytothérapie",
    "phytoth": "phytothérapie",
    "naturo": "naturopathie",
    "yoga": "yoga",
    "massage": "massage thérapeutique",
    "nutrition": "nutrition",
    "diététic": "nutrition",
    "kiné": "kinésithérapie",
    "kine": "kinésithérapie",
    "psy": "psychologie",
    "écoute": "centre d'écoute",
    "ecoute": "centre d'écoute",
}


def normalize_partner_category(raw: str) -> str:
    """Convertit un activity_type/categorie brut vers une catégorie canonique."""
    if not raw:
        return ""
    txt = raw.lower().strip()
    for kw, canon in PARTNER_CATEGORY_NORMALIZATION.items():
        if kw in txt:
            return canon
    return txt

SECTOR_BY_MEDICAL_TYPE = {
    "moderne": "medical",
    "traditionnel_africain": "medical",
    "bien_etre": "bien_etre",
    "social_humanitaire": "social_humanitaire",
}


def detect_sector(record: dict) -> str:
    """Renvoie le secteur (medical / bien_etre / social_humanitaire / communautaire)."""
    mt = (record.get("medical_type") or "").strip().lower()
    if mt in SECTOR_BY_MEDICAL_TYPE:
        return SECTOR_BY_MEDICAL_TYPE[mt]

    # Pour les partenaires : activity_type / categorie
    blob = " ".join([
        record.get("activity_type") or "",
        record.get("categorie") or "",
        record.get("description") or "",
        record.get("bio") or "",
        record.get("name") or "",
    ]).lower()
    if any(k in blob for k in ("spa", "salon", "coiffure", "esthét", "bien-être", "beauté")):
        return "bien_etre"
    if any(k in blob for k in ("ong", "humanitaire", "croix-rouge", "association", "écoute")):
        return "social_humanitaire"
    if any(k in blob for k in ("yoga", "méditation", "sport", "coach", "fitness")):
        return "bien_etre"
    if any(k in blob for k in ("communautaire", "service public")):
        return "communautaire"
    return "medical"


def derive_symptoms_for_specialties(specialties: list, categorie: str = "") -> list:
    """Réunit tous les symptômes connus pour les spécialités fournies.
    Tient compte aussi de la catégorie principale (utile pour les partenaires)."""
    seen = []
    # Inclure la catégorie principale comme premier élément à matcher (ex: 'pharmacie')
    candidates = list(specialties or [])
    norm_cat = normalize_partner_category(categorie)
    if norm_cat and norm_cat not in [c.lower() for c in candidates]:
        candidates.insert(0, norm_cat)
    elif categorie and categorie not in candidates:
        candidates.insert(0, categorie)

    for sp in candidates:
        key = (sp or "").lower().strip()
        if not key:
            continue
        # Match partial: "Cabinet Dentaire" → contient "dent" → dentisterie
        for spec_key, symptoms in SPECIALTY_TO_SYMPTOMS.items():
            if spec_key in key or any(part in key for part in spec_key.split()):
                for s in symptoms:
                    if s not in seen:
                        seen.append(s)
                break
    return seen[:15]  # cap to 15


def derive_needs(sector: str, specialties: list, categorie: str = "") -> list:
    """Mappe un secteur + spécialités sur des besoins en langage naturel."""
    base_needs = {
        "medical": ["consultation médicale", "diagnostic", "examen"],
        "bien_etre": ["détente", "bien-être", "soins du corps"],
        "social_humanitaire": ["soutien", "écoute", "aide"],
        "communautaire": ["accompagnement communautaire"],
    }.get(sector, ["consultation"])
    needs = list(base_needs)

    # Besoins liés à la catégorie principale (partenaire)
    norm_cat = normalize_partner_category(categorie)
    category_needs_map = {
        "pharmacie": ["achat médicament", "conseil pharmacien", "ordonnance"],
        "laboratoire": ["bilan sanguin", "analyse biologique", "prélèvement"],
        "imagerie": ["échographie", "radio", "scanner"],
        "radiologie": ["radiographie", "scanner", "irm"],
        "hôpital": ["urgence", "hospitalisation", "soins continus"],
        "clinique": ["consultation", "hospitalisation", "chirurgie"],
        "polyclinique": ["consultation pluridisciplinaire", "hospitalisation"],
        "centre médical": ["consultation", "médecine générale"],
        "centre de santé": ["consultation", "vaccination"],
        "infirmier": ["soin à domicile", "pansement", "injection"],
        "soins à domicile": ["soin à domicile", "infirmier"],
        "spa": ["détente", "massage", "soin du corps"],
        "salon de beauté": ["soin esthétique", "beauté"],
        "salon de coiffure": ["coiffure", "soin cheveux"],
        "esthétique": ["soin esthétique", "beauté"],
        "fitness": ["remise en forme", "musculation"],
        "sport": ["activité physique", "remise en forme"],
        "barbier": ["barbe", "coupe homme"],
        "formation santé": ["formation", "premiers soins"],
        "matériel médical": ["équipement médical", "achat matériel"],
        "humanitaire / ong": ["aide", "soutien social"],
    }
    if norm_cat in category_needs_map:
        for n in category_needs_map[norm_cat]:
            if n not in needs:
                needs.append(n)

    for sp in (specialties or [])[:3]:
        key = (sp or "").lower().strip()
        if not key:
            continue
        needs.append(f"prise en charge {key}")
    return needs[:8]


def derive_ai_tags(record: dict, specialties: list) -> list:
    """Tags IA : combine nom + spécialités + mots-clés saillants pour le matching."""
    tags = []
    # Spécialités telles quelles
    for sp in (specialties or []):
        sp_clean = (sp or "").strip()
        if sp_clean and sp_clean.lower() not in [t.lower() for t in tags]:
            tags.append(sp_clean)

    # Catégorie principale normalisée
    categorie = record.get("activity_type") or record.get("categorie") or ""
    norm_cat = normalize_partner_category(categorie)
    if norm_cat and norm_cat.lower() not in [t.lower() for t in tags]:
        tags.append(norm_cat)

    # Mots-clés du nom et de la bio
    text_blob = " ".join([
        record.get("name") or "",
        record.get("bio") or "",
        record.get("description") or "",
        record.get("activity_type") or "",
        record.get("categorie") or "",
    ]).lower()

    common_kw = [
        "cardio", "dentaire", "dermato", "gynéco", "pédiatr", "ophtalmo",
        "kiné", "psy", "ortho", "pneum", "endocrin", "nutrition", "spa",
        "yoga", "ong", "humanitaire", "coach", "naturo", "phyto", "tradi",
        "pharma", "labo", "radio", "imagerie", "hopital", "hôpital",
        "clinique", "polyclinique", "infirmier", "esthét", "coiffure",
        "fitness", "domicile",
    ]
    for kw in common_kw:
        if kw in text_blob and kw not in [t.lower() for t in tags]:
            tags.append(kw)

    # Ajoute symptômes courants pour ces spécialités + catégorie
    syms = derive_symptoms_for_specialties(specialties, categorie)
    for s in syms[:5]:
        if s not in [t.lower() for t in tags]:
            tags.append(s)
    return tags[:20]


def compute_emergency_level(record: dict) -> int:
    """0 = standard, 1 = urgence partielle, 2 = service d'urgence."""
    blob = " ".join([
        record.get("name") or "",
        record.get("activity_type") or "",
        record.get("categorie") or "",
        record.get("description") or "",
        " ".join(record.get("specialties") or []),
    ]).lower()
    if "urgence" in blob or "croix-rouge" in blob or "samu" in blob or "secours" in blob:
        return 2
    if "hopital" in blob or "hôpital" in blob or "clinique" in blob or "polyclinique" in blob:
        return 1
    return 0


def compute_triage_priority(record: dict, emergency_level: int) -> int:
    """Score 0–100 utilisé pour le tri des résultats. 100 = en haut."""
    score = 50
    if (record.get("claim_status") or "") == "verified":
        score += 20
    score += emergency_level * 10
    rating = record.get("rating") or 0
    try:
        score += int(min(20, float(rating) * 4))
    except (TypeError, ValueError):
        pass
    return max(0, min(100, score))


def is_real_email(email: str) -> bool:
    return bool(email) and "@import.keneyakafisa" not in email and "@phone.keneyakafisa" not in email and "@keneyakafisa.app" not in email


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------

def build_master_profile(record: dict, provider_kind: str) -> dict:
    """Convertit une fiche existante en master_profile imbriqué."""
    specialties = record.get("specialties") or []
    if isinstance(specialties, str):
        specialties = [specialties]
    specialties = [s for s in specialties if s]

    name = record.get("name") or record.get("company_name") or "Sans nom"
    sector = detect_sector(record)

    # Catégorie principale = première spécialité (ou activity_type pour partner)
    if provider_kind == "doctor":
        categorie = specialties[0] if specialties else "Médecine Générale"
        sous_categories = specialties[1:] if len(specialties) > 1 else []
    else:
        categorie = (record.get("activity_type") or "Autre").strip().title()
        sous_categories = [s for s in specialties if s.lower() != categorie.lower()]

    emergency_level = compute_emergency_level(record)
    triage_priority = compute_triage_priority(record, emergency_level)
    email = record.get("email") or ""

    coords = record.get("coordinates") or {}

    # Booking defaults plus crédibles
    booking_defaults = {
        "doctor": {
            "accepts_appointments": True,
            "slot_duration_min": 30,
            "consultation_domicile": False,
            "teleconsultation": False,
        },
        "partner": {
            "accepts_appointments": True,
            "slot_duration_min": 20,
            "consultation_domicile": False,
            "teleconsultation": False,
        },
    }
    booking = booking_defaults.get(provider_kind, booking_defaults["doctor"]).copy()
    booking["accepts_whatsapp_booking"] = bool(record.get("whatsapp_number"))
    if record.get("home_service"):
        booking["consultation_domicile"] = True
    if record.get("teleconsultation"):
        booking["teleconsultation"] = True

    return {
        "identity": {
            "id": record.get("id") or "",
            "name": name,
            "slug": slugify(name),
        },
        "classification": {
            "secteur": sector,
            "categorie": categorie,
            "sous_categories": list(dict.fromkeys(sous_categories)),
            "specialites": list(dict.fromkeys(specialties)),
            "provider_kind": provider_kind,
        },
        "ai_matching": {
            "symptomes_pris_en_charge": derive_symptoms_for_specialties(specialties, categorie),
            "besoins_pris_en_charge": derive_needs(sector, specialties, categorie),
            "ai_specialty_tags": derive_ai_tags(record, specialties),
            "embedding": None,  # rempli plus tard si on ajoute un vector store
        },
        "contact": {
            "telephone": record.get("telephone") or record.get("whatsapp_number") or "",
            "whatsapp_number": record.get("whatsapp_number") or "",
            "email": email if is_real_email(email) else "",
            "site_web": record.get("website") or record.get("site_web") or "",
            "adresse": record.get("landmark") or record.get("address") or "",
            "ville": record.get("city") or "",
            "commune": record.get("neighborhood") or "",
            "horaires": record.get("horaires") or {},
            "latitude": coords.get("latitude"),
            "longitude": coords.get("longitude"),
        },
        "booking": booking,
        "trust": {
            "is_verified": bool(record.get("is_verified") or record.get("claim_status") == "verified"),
            "claim_status": record.get("claim_status") or ("seeded" if record.get("imported") else "verified"),
            "triage_priority": triage_priority,
            "emergency_level": emergency_level,
        },
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "model_version": 2,
    }


async def migrate_all_providers(db) -> dict:
    """Boucle sur tous les doctor_profiles + partner_profiles.
    Ajoute (ou met à jour) le champ `master_profile` sur chaque document.
    Préserve les anciens champs plats : rétro-compatibilité 100%.
    """
    stats = {"doctors_migrated": 0, "partners_migrated": 0, "errors": 0}

    async for doc in db.doctor_profiles.find({}, {"_id": 0}):
        try:
            mp = build_master_profile(doc, "doctor")
            await db.doctor_profiles.update_one(
                {"id": doc["id"]}, {"$set": {"master_profile": mp}}
            )
            stats["doctors_migrated"] += 1
        except Exception as e:
            logger.error(f"Migration doctor {doc.get('id')!r}: {e}")
            stats["errors"] += 1

    async for doc in db.partner_profiles.find({}, {"_id": 0}):
        try:
            mp = build_master_profile(doc, "partner")
            await db.partner_profiles.update_one(
                {"id": doc["id"]}, {"$set": {"master_profile": mp}}
            )
            stats["partners_migrated"] += 1
        except Exception as e:
            logger.error(f"Migration partner {doc.get('id')!r}: {e}")
            stats["errors"] += 1

    logger.info(f"Master-model migration complete: {stats}")
    return stats
