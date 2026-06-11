"""
V2 specialty seed loader.

Reads /app/backend/data/v2_specialties_seed.json (~62 records, nested V2 shape)
and inserts each record into `partner_profiles` if it doesn't already exist.

Each provider is geocoded on the fly using the curated google_maps coordinate
table from `services.geocoding`.

Idempotency: dedupes by (1) `id` field, (2) lowercase slug, (3) lowercase name.
Safe to re-run on every startup — it's a no-op once everything is in.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from services.geocoding import resolve_coordinates

logger = logging.getLogger(__name__)

V2_SEED_FILE = Path(__file__).parent.parent / "data" / "v2_specialties_seed.json"


def _slug(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "unknown"


def _build_master_profile_v2(rec: dict, coords: dict | None) -> dict:
    """Build a `master_profile` document from a V2 seed record."""
    identity = rec.get("identity") or {}
    classification = rec.get("classification") or {}
    ai_matching = rec.get("ai_matching") or {}
    contact = rec.get("contact") or {}
    booking = rec.get("booking") or {}
    trust = rec.get("trust") or {}

    return {
        "identity": {
            "id": identity.get("id") or str(uuid.uuid4()),
            "name": identity.get("name") or "Sans nom",
            "slug": identity.get("slug") or _slug(identity.get("name") or ""),
        },
        "classification": {
            "secteur": classification.get("secteur") or "Santé",
            "categorie": classification.get("categorie") or "Autre",
            "sous_categories": classification.get("sous_categories") or [],
            "specialites": classification.get("specialites") or [],
            "provider_kind": classification.get("provider_kind") or "partner",
        },
        "ai_matching": {
            "symptomes_pris_en_charge": ai_matching.get("symptomes_pris_en_charge") or [],
            "besoins_pris_en_charge": ai_matching.get("besoins_pris_en_charge") or [],
            "ai_specialty_tags": ai_matching.get("ai_specialty_tags") or [],
            "embedding": None,
        },
        "contact": {
            "telephone": contact.get("telephone") or "",
            "whatsapp_number": contact.get("whatsapp_number") or "",
            "email": contact.get("email") or "",
            "site_web": contact.get("site_web") or "",
            "adresse": contact.get("adresse") or "",
            "ville": contact.get("ville") or "",
            "commune": contact.get("commune") or "",
            "horaires": contact.get("horaires") or {},
            "latitude": (coords or {}).get("latitude"),
            "longitude": (coords or {}).get("longitude"),
        },
        "booking": {
            "accepts_appointments": booking.get("accepts_appointments", True),
            "accepts_whatsapp_booking": booking.get("accepts_whatsapp_booking", False),
            "consultation_domicile": booking.get("consultation_domicile", False),
            "teleconsultation": booking.get("teleconsultation", False),
            "slot_duration_min": booking.get("slot_duration_min", 20),
        },
        "trust": {
            "is_verified": trust.get("is_verified", False),
            "claim_status": trust.get("claim_status") or "seeded",
            "triage_priority": trust.get("triage_priority", 50),
            "emergency_level": trust.get("emergency_level", 0),
        },
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "model_version": 2,
    }


async def seed_v2_specialties(db) -> dict:
    """Seed (idempotent) the V2 specialty providers from JSON."""
    if not V2_SEED_FILE.exists():
        return {"skipped": "no_file"}

    try:
        records = json.loads(V2_SEED_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(f"Could not parse V2 seed: {e}")
        return {"skipped": "parse_error"}

    stats = {
        "total": len(records),
        "inserted": 0,
        "skipped_exists": 0,
        "skipped_no_name": 0,
        "errors": 0,
        "landmark": 0,
        "neighborhood": 0,
        "city": 0,
        "country": 0,
        "no_geo": 0,
    }

    for rec in records:
        try:
            identity = rec.get("identity") or {}
            name = identity.get("name")
            if not name:
                stats["skipped_no_name"] += 1
                continue

            seed_id = identity.get("id") or str(uuid.uuid4())
            slug = identity.get("slug") or _slug(name)
            name_re = f"^{re.escape(name)}$"

            # Dedupe: id, slug, name (case-insensitive) — and across both collections
            dup_query = {
                "$or": [
                    {"id": seed_id},
                    {"master_profile.identity.id": seed_id},
                    {"master_profile.identity.slug": slug},
                    {"name": {"$regex": name_re, "$options": "i"}},
                    {"company_name": {"$regex": name_re, "$options": "i"}},
                ]
            }
            if await db.partner_profiles.find_one(dup_query, {"_id": 0, "id": 1}):
                stats["skipped_exists"] += 1
                continue
            if await db.doctor_profiles.find_one(dup_query, {"_id": 0, "id": 1}):
                stats["skipped_exists"] += 1
                continue

            contact = rec.get("contact") or {}
            classification = rec.get("classification") or {}

            geo_res = resolve_coordinates(
                name=name,
                address=contact.get("adresse") or "",
                commune=contact.get("commune") or "",
                ville=contact.get("ville") or "",
                country="cote d'ivoire",
            )
            if geo_res:
                stats[geo_res["precision"]] += 1
                coords_doc = {
                    "latitude": geo_res["latitude"],
                    "longitude": geo_res["longitude"],
                }
                geo_doc = {
                    "source": geo_res["source"],
                    "precision": geo_res["precision"],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "locked": False,
                }
            else:
                stats["no_geo"] += 1
                coords_doc = None
                geo_doc = None

            master_profile = _build_master_profile_v2(rec, coords_doc)

            profile_doc = {
                "id": seed_id,
                "user_id": seed_id,  # no real user yet — placeholder until claim
                "name": name,
                "company_name": name,
                "email": contact.get("email") or f"{slug}@import.keneyakafisa.local",
                "whatsapp_number": contact.get("whatsapp_number") or contact.get("telephone") or "",
                "activity_type": classification.get("categorie") or "autre",
                "categorie": classification.get("categorie") or "",
                "sous_categorie": (classification.get("sous_categories") or [""])[0],
                "address": contact.get("adresse") or "",
                "city": contact.get("ville") or "",
                "neighborhood": contact.get("commune") or "",
                "country": "Côte d'Ivoire",
                "description": ", ".join(classification.get("specialites") or []),
                "status": "active",
                "claim_status": "seeded",
                "imported": True,
                "v2_seed": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "master_profile": master_profile,
            }
            if coords_doc:
                profile_doc["coordinates"] = coords_doc
            if geo_doc:
                profile_doc["geo"] = geo_doc

            await db.partner_profiles.insert_one(profile_doc)
            stats["inserted"] += 1
        except Exception as ex:
            logger.error(f"V2 seed error for {rec.get('identity', {}).get('name')!r}: {ex}")
            stats["errors"] += 1

    logger.info(f"V2 specialty seed complete: {stats}")
    return stats
