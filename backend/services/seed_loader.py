"""
Idempotent seed loader for the keneyakafisa initial dataset.

Runs at backend startup. Reads /app/backend/data/keneya_seed.json (110 records)
and inserts only records that are not yet present in the DB (by email).

Rules (same as the original import_keneya_db.py):
- patients are skipped
- structure / Professeur → classified into doctor or partner by category
- missing email → generated <slug>@import.keneyakafisa.local
- missing id → uuid
- random non-disclosed password
- if a user with the same email already exists → skip

Safe to run on every startup (it's a no-op once the seed is fully loaded).
"""
import json
import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path

from passlib.context import CryptContext

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SEED_FILE = Path(__file__).parent.parent / "data" / "keneya_seed.json"

DOCTOR_CATEGORY_KEYWORDS = [
    "sante", "santé", "medecine", "médecine",
    "endocrinologie", "diabétologie", "diabetologie",
    "cardiologie", "cardio", "orl", "dentaire", "dentiste",
    "ophtalm", "dermato", "pediatr", "pédiatr",
    "chirurgie", "gynécolog", "gynecolog",
    "kine", "kiné", "psychi", "psycholog",
    "nutritionniste", "diététic",
    "soins à domicile", "soins a domicile",
    "naturopath", "phytothérap", "phytotherap",
    "medecine chinoise", "médecine chinoise",
    "humanitaire", "pharma",
    "hopital", "hôpital", "polyclinique", "clinique",
    "centre médical", "centre medical",
    "infirmier", "labo", "imagerie", "radio",
]

PARTNER_CATEGORY_KEYWORDS = [
    "spa", "salon", "coiffure", "esthétique", "esthetique",
    "bien-être", "bien etre", "bien-etre",
    "beauté", "beaute", "maquillage", "maquilleur",
    "ongles", "prothésiste",
    "boutique", "matériel", "equipement", "équipement",
    "formation", "fitness", "sport", "barbier",
]


def _slugify(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s or "unknown"


def _classify(record: dict) -> str:
    blob = " ".join([
        record.get("categorie") or "",
        record.get("sous_categorie") or "",
        record.get("service proposé") or "",
        record.get("name") or "",
    ]).lower()
    for kw in DOCTOR_CATEGORY_KEYWORDS:
        if kw in blob:
            return "doctor"
    for kw in PARTNER_CATEGORY_KEYWORDS:
        if kw in blob:
            return "partner"
    return "partner"


def _norm(v) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    if s.upper() in ("N/D", "ND", "N.D.", "N/A"):
        return ""
    return s


def _norm_phone(raw: str) -> str:
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


def _build_email(record: dict) -> tuple[str, bool]:
    email = _norm(record.get("email"))
    if email and "@" in email:
        return email.lower(), True
    base = _slugify(record.get("name") or "")
    return f"{base}@keneyakafisa.app", False


async def seed_initial_data(db) -> dict:
    """Run the seed. Returns a stats dict. Idempotent."""
    if not SEED_FILE.exists():
        logger.warning(f"Seed file not found at {SEED_FILE}; skipping")
        return {"skipped": "no_file"}

    if os.environ.get("DISABLE_SEED", "").lower() in ("1", "true", "yes"):
        logger.info("DISABLE_SEED is set; skipping seed loader")
        return {"skipped": "disabled"}

    try:
        records = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(f"Could not load seed file: {e}")
        return {"skipped": "parse_error"}

    stats = {
        "skipped_patient": 0,
        "skipped_exists": 0,
        "imported_doctor": 0,
        "imported_partner": 0,
        "skipped_no_name": 0,
        "errors": 0,
    }

    for r in records:
        try:
            raw_type = (r.get("user_type") or "").strip().lower()
            if raw_type == "patient":
                stats["skipped_patient"] += 1
                continue

            name = _norm(r.get("name"))
            if not name:
                stats["skipped_no_name"] += 1
                continue

            if raw_type == "doctor":
                mapped = "doctor"
            else:
                mapped = _classify(r)

            email, is_real_email = _build_email(r)
            existing = await db.users.find_one({"email": email}, {"_id": 0, "id": 1})
            if existing:
                stats["skipped_exists"] += 1
                continue

            user_id = r.get("id") or str(uuid.uuid4())
            if not user_id or len(user_id) < 8:
                user_id = str(uuid.uuid4())

            whatsapp = _norm_phone(r.get("whatsapp_number") or r.get("telephonne") or "")
            latitude = r.get("latitude")
            longitude = r.get("longitude")
            created_at = r.get("created_at") or datetime.now(timezone.utc).isoformat()

            user_doc = {
                "id": user_id,
                "email": email,
                "name": name,
                "user_type": mapped,
                "password": pwd_context.hash(secrets.token_urlsafe(32)),
                "whatsapp_number": whatsapp,
                "verified": False,
                "email_verified": is_real_email,
                "imported": True,
                "created_at": created_at,
            }

            if mapped == "doctor":
                medical_type = (r.get("medical_type") or "").strip().lower()
                user_doc["medical_type"] = medical_type if medical_type in (
                    "moderne", "traditionnel_africain", "bien_etre"
                ) else "moderne"
                user_doc["specialties"] = r.get("specialties") or [
                    s for s in [_norm(r.get("categorie")), _norm(r.get("sous_categorie"))] if s
                ]
                user_doc["address"] = _norm(r.get("adress"))
            else:
                user_doc["company_name"] = name
                user_doc["activity_type"] = _norm(r.get("categorie")) or "autre"
                user_doc["address"] = _norm(r.get("adress"))

            await db.users.insert_one(user_doc)

            # Profile
            common = {
                "user_id": user_id,
                "name": name,
                "email": email,
                "whatsapp_number": whatsapp,
                "country": _norm(r.get("pays")),
                "city": _norm(r.get("ville")),
                "neighborhood": _norm(r.get("commune")),
                "landmark": _norm(r.get("adress")),
                "website": _norm(r.get("site web")),
                "imported": True,
                "created_at": created_at,
            }
            if latitude and longitude:
                try:
                    common["coordinates"] = {
                        "latitude": float(latitude),
                        "longitude": float(longitude),
                    }
                except (TypeError, ValueError):
                    pass

            horaires = _norm(r.get("horaires"))
            services = _norm(r.get("service proposé"))
            bio_parts = []
            if services:
                bio_parts.append(services)
            if horaires:
                bio_parts.append(f"Horaires : {horaires}")
            bio = ". ".join(bio_parts).strip()

            if mapped == "doctor":
                specialties = user_doc["specialties"] if isinstance(user_doc["specialties"], list) else []
                if not specialties:
                    specialties = [_norm(r.get("categorie")) or "Médecine Générale"]
                profile = {
                    "id": str(uuid.uuid4()),
                    **common,
                    "medical_type": user_doc.get("medical_type", "moderne"),
                    "specialties": [s for s in specialties if s],
                    "bio": bio,
                    "location": _norm(r.get("ville")),
                    "rating": 0,
                    "total_reviews": 0,
                }
                await db.doctor_profiles.insert_one(profile)
                stats["imported_doctor"] += 1
            else:
                profile = {
                    "id": str(uuid.uuid4()),
                    **common,
                    "company_name": name,
                    "activity_type": user_doc.get("activity_type", "autre"),
                    "description": bio,
                    "status": "active",
                }
                await db.partner_profiles.insert_one(profile)
                stats["imported_partner"] += 1
        except Exception as ex:
            logger.error(f"Seed error for record {r.get('name')!r}: {ex}")
            stats["errors"] += 1

    logger.info(f"Keneya seed completed: {stats}")
    return stats
