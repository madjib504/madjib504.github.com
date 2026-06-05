"""
Importer for the imported keneya JSON records.

Mapping rules (per user decisions):
- 1c) structure / Professeur → doctor OR partner based on category
- 2)  Missing email → generate <slug>@import.keneyakafisa.local
      Missing id → new UUID
- 3)  Skip if a user with the same email already exists in DB
- 4)  Random non-disclosed password (these accounts cannot log in via password)
- 5)  Skip patients

Categories that MUST map to doctor (medical professionals/facilities):
"sante", "santé", "endocrinologie", "cardiologie", "orl", "dentaire",
"nutritionniste", "soins à domicile", "soins a domicile", "diabétologie",
"medecine", "médecine", "pharmacie", "kinesithérapeute", "psychiatrie",
"psychiatre", "psychologue", "gynécologie", "ophtalmologie", "dermatologie",
"pediatrie", "pédiatrie", "chirurgie", "naturopathie", "medecine chinoise",
"médecine chinoise", "humanitaire" (Croix Rouge etc.)

Everything else (Spa, Salon de coiffure, Institut esthétique, Bien-être,
beauté, maquillage, prothésiste ongulaire, etc.) → partner.
"""
import asyncio
import json
import os
import re
import secrets
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# Same hashing context as backend
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Categories that map to doctor
DOCTOR_CATEGORY_KEYWORDS = [
    "sante", "santé",
    "medecine", "médecine",
    "endocrinologie", "diabétologie", "diabetologie",
    "cardiologie", "cardio",
    "orl",
    "dentaire", "dentiste",
    "ophtalm",
    "dermato",
    "pediatr", "pédiatr",
    "chirurgie",
    "gynécolog", "gynecolog",
    "kine", "kiné",
    "psychi",
    "psycholog",
    "nutritionniste",
    "diététic",
    "soins à domicile", "soins a domicile",
    "naturopath",
    "phytothérap", "phytotherap",
    "medecine chinoise", "médecine chinoise",
    "humanitaire",
    "pharma",
    "hopital", "hôpital", "polyclinique", "clinique", "centre médical", "centre medical",
    "infirmier",
    "labo",
    "imagerie", "radio",
]

PARTNER_CATEGORY_KEYWORDS = [
    "spa", "salon", "coiffure", "esthétique", "esthetique",
    "bien-être", "bien etre", "bien-etre",
    "beauté", "beaute",
    "maquillage", "maquilleur",
    "ongles", "prothésiste",
    "boutique", "matériel", "equipement", "équipement",
    "formation",
    "fitness", "sport",
    "barbier",
]


def slugify(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s or "unknown"


def classify(record: dict) -> str:
    """Return 'doctor' or 'partner' or 'skip' for a structure/Professeur record."""
    blob = " ".join([
        (record.get("categorie") or ""),
        (record.get("sous_categorie") or ""),
        (record.get("service proposé") or ""),
        (record.get("name") or ""),
    ]).lower()
    for kw in DOCTOR_CATEGORY_KEYWORDS:
        if kw in blob:
            return "doctor"
    for kw in PARTNER_CATEGORY_KEYWORDS:
        if kw in blob:
            return "partner"
    # Default: partner (less risky than mis-classifying a non-medical entity as doctor)
    return "partner"


def normalize_text(v) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    if s.upper() in ("N/D", "ND", "N.D.", "N/A"):
        return ""
    return s


def normalize_phone(raw: str) -> str:
    if not raw:
        return ""
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    if len(digits) <= 10:
        if digits.startswith("0"):
            digits = digits[1:]
        return f"225{digits}"
    return digits


def build_email(record: dict, mapped_type: str) -> tuple[str, bool]:
    """Return (email, is_real). If no email, generate a deterministic placeholder."""
    email = normalize_text(record.get("email"))
    if email and "@" in email:
        return email.lower(), True
    base = slugify(record.get("name") or "")
    return f"{base}@import.keneyakafisa.local", False


async def import_records(json_path: str, dry_run: bool = False):
    raw = Path(json_path).read_text(encoding="utf-8")
    records = json.loads(raw)
    print(f"Loaded {len(records)} records from {json_path}")

    load_dotenv("/app/backend/.env")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    stats = {
        "skipped_patient": 0,
        "skipped_exists": 0,
        "imported_doctor": 0,
        "imported_partner": 0,
        "skipped_no_name": 0,
    }

    for r in records:
        raw_type = (r.get("user_type") or "").strip().lower()
        if raw_type == "patient":
            stats["skipped_patient"] += 1
            continue

        name = normalize_text(r.get("name"))
        if not name:
            stats["skipped_no_name"] += 1
            continue

        # Map original type → keneyakafisa type
        if raw_type in ("doctor",):
            mapped = "doctor"
        elif raw_type in ("structure", "professeur"):
            mapped = classify(r)
        else:
            mapped = classify(r)

        email, is_real_email = build_email(r, mapped)
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if existing:
            stats["skipped_exists"] += 1
            continue

        # Build user document
        user_id = r.get("id") or str(uuid.uuid4())
        if not user_id or len(user_id) < 8:
            user_id = str(uuid.uuid4())

        whatsapp = normalize_phone(r.get("whatsapp_number") or r.get("telephonne") or "")
        latitude = r.get("latitude")
        longitude = r.get("longitude")
        created_at = r.get("created_at") or datetime.now(timezone.utc).isoformat()

        user_doc = {
            "id": user_id,
            "email": email,
            "name": name,
            "user_type": mapped,
            "password": pwd_context.hash(secrets.token_urlsafe(32)),  # Random, no-one knows
            "whatsapp_number": whatsapp,
            "verified": False,
            "email_verified": is_real_email,  # Real emails marked verified (they are external)
            "imported": True,  # Marker
            "created_at": created_at,
        }

        if mapped == "doctor":
            medical_type = (r.get("medical_type") or "").strip()
            if medical_type and medical_type.lower() not in ("moderne", "traditionnel_africain", "bien_etre"):
                # Custom medical type → keep "moderne" by default, store original on the profile
                user_doc["medical_type"] = "moderne"
                user_doc["custom_medical_type_original"] = medical_type
            elif medical_type:
                user_doc["medical_type"] = medical_type.lower()
            else:
                user_doc["medical_type"] = "moderne"
            user_doc["specialties"] = r.get("specialties") or [
                s for s in [normalize_text(r.get("categorie")), normalize_text(r.get("sous_categorie"))] if s
            ]
            user_doc["address"] = normalize_text(r.get("adress"))
        else:
            user_doc["company_name"] = name
            user_doc["activity_type"] = normalize_text(r.get("categorie")) or "autre"
            user_doc["address"] = normalize_text(r.get("adress"))

        if dry_run:
            print(f"DRYRUN [{mapped}] {name} ({email})")
            if mapped == "doctor":
                stats["imported_doctor"] += 1
            else:
                stats["imported_partner"] += 1
            continue

        await db.users.insert_one(user_doc)

        # Now create the profile
        common_profile_fields = {
            "user_id": user_id,
            "name": name,
            "email": email,
            "whatsapp_number": whatsapp,
            "country": normalize_text(r.get("pays")),
            "city": normalize_text(r.get("ville")),
            "neighborhood": normalize_text(r.get("commune")),
            "landmark": normalize_text(r.get("adress")),
            "website": normalize_text(r.get("site web")),
            "imported": True,
            "created_at": created_at,
        }
        if latitude and longitude:
            try:
                common_profile_fields["coordinates"] = {
                    "latitude": float(latitude),
                    "longitude": float(longitude),
                }
            except (TypeError, ValueError):
                pass

        horaires = normalize_text(r.get("horaires"))
        services = normalize_text(r.get("service proposé"))
        bio_parts = []
        if services:
            bio_parts.append(services)
        if horaires:
            bio_parts.append(f"Horaires : {horaires}")
        bio = ". ".join(bio_parts).strip()

        if mapped == "doctor":
            specialties = user_doc["specialties"] if isinstance(user_doc["specialties"], list) else []
            if not specialties:
                specialties = [normalize_text(r.get("categorie")) or "Médecine Générale"]
            profile = {
                "id": str(uuid.uuid4()),
                **common_profile_fields,
                "medical_type": user_doc.get("medical_type", "moderne"),
                "specialties": [s for s in specialties if s],
                "bio": bio,
                "location": normalize_text(r.get("ville")),
                "rating": 0,
                "total_reviews": 0,
            }
            if user_doc.get("custom_medical_type_original"):
                profile["custom_medical_type"] = user_doc["custom_medical_type_original"]
            await db.doctor_profiles.insert_one(profile)
            stats["imported_doctor"] += 1
        else:
            profile = {
                "id": str(uuid.uuid4()),
                **common_profile_fields,
                "company_name": name,
                "activity_type": user_doc.get("activity_type", "autre"),
                "description": bio,
                "status": "active",
            }
            await db.partner_profiles.insert_one(profile)
            stats["imported_partner"] += 1

    print()
    print("=== IMPORT STATS ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/keneya_import_fixed.json"
    dry = "--dry-run" in sys.argv
    asyncio.run(import_records(src, dry_run=dry))
