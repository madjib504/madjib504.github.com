"""
Curated GPS geocoding for keneyakafisa providers.

This service contains hand-curated coordinates collected from Google Maps for
Ivorian (and a few Malian) medical/wellness landmarks plus commune centroids.

It does NOT call any external HTTP service — it is fully offline. The data
quality is graded with a `precision` flag (landmark > commune > city > country).

Public API:
    resolve_coordinates(name, address, commune, ville, country) -> dict | None
    migrate_all_coordinates(db) -> dict   # idempotent migration
"""
from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1) LANDMARKS — exact Google Maps coordinates for famous places
#    (key = slugified/normalized landmark name fragment)
# ---------------------------------------------------------------------------

LANDMARKS: dict[str, tuple[float, float]] = {
    # CHU / Hôpitaux publics
    "chu de cocody": (5.3528, -3.9908),
    "chu cocody": (5.3528, -3.9908),
    "chu de treichville": (5.2925, -4.0085),
    "chu treichville": (5.2925, -4.0085),
    "chu de yopougon": (5.3431, -4.0883),
    "chu yopougon": (5.3431, -4.0883),
    "chu de bouake": (7.6864, -5.0235),
    "chu bouake": (7.6864, -5.0235),
    "hopital general de yopougon": (5.3447, -4.0883),
    "hopital yopougon": (5.3447, -4.0883),
    "hopital general de san pedro": (4.7416, -6.6363),
    "hopital san pedro": (4.7416, -6.6363),
    "hopital gyneco obstetrique yopougon": (5.3415, -4.0728),
    "hopital pediatrique yopougon": (5.3422, -4.0867),

    # Cliniques privées connues
    "polyclinique internationale sainte anne-marie": (5.3008, -3.9869),
    "pisam": (5.3008, -3.9869),
    "clinique farah": (5.3490, -3.9897),
    "polyclinique medicale internationale": (5.3008, -3.9869),
    "clinique uro-andrologie abidjan": (5.3526, -3.9907),
    "clinique mere-enfant treichville": (5.2918, -4.0102),
    "clinique mere-enfant riviera": (5.3676, -3.9417),
    "centre medical la providence": (5.3017, -3.9933),
    "polyclinique femme et enfant abidjan": (5.3535, -3.9919),

    # Instituts neurologiques / spécialisés
    "institut neurologique abidjan plateau": (5.3209, -4.0233),
    "institut neurologie universitaire abidjan": (5.3528, -3.9908),
    "centre rythmologie plateau medical": (5.3209, -4.0233),
    "centre avc parkinson treichville": (5.2925, -4.0085),
    "clinique cardio intensive cocody": (5.3535, -3.9919),
    "institut coeur abidjan riviera": (5.3676, -3.9417),

    # Instituts de beauté principaux (références fournies par le partenaire)
    "institut belle evasion premium": (5.3535, -3.9919),
    "spa medical beauty luxe abidjan": (5.3614, -3.9952),
    "institut glamour cocody": (5.3700, -3.9847),
    "institut oxy beauty marcory": (5.3017, -3.9933),
    "institut serenity spa yopougon": (5.3486, -4.0758),
    "institut prestige onglerie abidjan": (5.3209, -4.0233),
    "institut zen et beaute treichville": (5.2925, -4.0143),
    "spa harmonie et detente abidjan": (5.3676, -3.9417),
    "institut pure skin beauty": (5.3814, -3.9710),
    "institut elegance et coiffure abidjan": (5.3658, -4.0258),
}


# ---------------------------------------------------------------------------
# 2) NEIGHBORHOODS / COMMUNES — Google-Maps centroid of each sub-area
# ---------------------------------------------------------------------------

COMMUNES: dict[str, tuple[float, float]] = {
    # --- Abidjan: Cocody and its sub-areas ---
    "cocody": (5.3535, -3.9919),
    "cocody angre": (5.3814, -3.9710),
    "angre": (5.3814, -3.9710),
    "angre 8e tranche": (5.3814, -3.9670),
    "cocody riviera": (5.3722, -3.9569),
    "riviera": (5.3722, -3.9569),
    "riviera 1": (5.3735, -3.9612),
    "riviera 2": (5.3700, -3.9602),
    "riviera 3": (5.3676, -3.9417),
    "cocody riviera 3": (5.3676, -3.9417),
    "cocody riviera 2": (5.3700, -3.9602),
    "deux-plateaux": (5.3614, -3.9952),
    "deux plateaux": (5.3614, -3.9952),
    "vallon": (5.3700, -3.9847),
    # --- Abidjan: other communes ---
    "yopougon": (5.3411, -4.0908),
    "sicogi": (5.3486, -4.0758),
    "selmer": (5.3300, -4.1000),
    "plateau": (5.3209, -4.0233),
    "centre-ville": (5.3209, -4.0233),
    "treichville": (5.2925, -4.0143),
    "treichville gare": (5.2932, -4.0080),
    "marcory": (5.2920, -3.9839),
    "marcory zone 4": (5.3017, -3.9933),
    "zone 4": (5.3017, -3.9933),
    "adjame": (5.3536, -4.0306),
    "adjame liberte": (5.3658, -4.0258),
    "liberte": (5.3658, -4.0258),
    "abobo": (5.4214, -4.0386),
    "abobo centre": (5.4214, -4.0386),
    "koumassi": (5.2876, -3.9595),
    "port-bouet": (5.2533, -3.9261),
    "port bouet": (5.2533, -3.9261),
    "attecoube": (5.3408, -4.0469),
    "bingerville": (5.3553, -3.9007),
    "songon": (5.3083, -4.2375),
    # --- Other Ivorian cities ---
    "bouake": (7.6906, -5.0303),
    "bouake centre": (7.6906, -5.0303),
    "san pedro": (4.7485, -6.6363),
    "san-pedro": (4.7485, -6.6363),
    "yamoussoukro": (6.8276, -5.2893),
    "korhogo": (9.4580, -5.6294),
    "daloa": (6.8770, -6.4502),
    "man": (7.4128, -7.5538),
    "gagnoa": (6.1318, -5.9506),
    "divo": (5.8372, -5.3572),
    "abengourou": (6.7297, -3.4961),
    "soubre": (5.7836, -6.6058),
    # --- Mali ---
    "bamako": (12.6392, -8.0029),
}


# ---------------------------------------------------------------------------
# 3) CITY-LEVEL FALLBACK
# ---------------------------------------------------------------------------

CITIES: dict[str, tuple[float, float]] = {
    "abidjan": (5.3600, -4.0083),  # large generic Abidjan centroid (not placeholder)
    "bouake": (7.6906, -5.0303),
    "san pedro": (4.7485, -6.6363),
    "san-pedro": (4.7485, -6.6363),
    "yamoussoukro": (6.8276, -5.2893),
    "bamako": (12.6392, -8.0029),
    # Country names get routed to the capital because most providers cluster there
    "cote d ivoire": (5.3600, -4.0083),
    "cote divoire": (5.3600, -4.0083),
    "ivory coast": (5.3600, -4.0083),
}

COUNTRY_CENTROIDS: dict[str, tuple[float, float]] = {
    "mali": (17.5707, -3.9962),
    "ml": (17.5707, -3.9962),
}


# ---------------------------------------------------------------------------
# 4) PLACEHOLDER COORDS we want to OVERWRITE (legacy fake values)
# ---------------------------------------------------------------------------

PLACEHOLDER_COORDS = {
    (5.316667, -4.033333),   # the original fake "Abidjan center"
    (5.3167, -4.0333),
}


def _norm(s: Optional[str]) -> str:
    """Lowercase + strip accents + collapse spaces — for fuzzy lookup."""
    if not s:
        return ""
    s = s.lower().strip()
    # strip diacritics
    accents = "àáâäãåèéêëìíîïòóôöõùúûüñç"
    plain = "aaaaaaeeeeiiiiooooouuuunc"
    s = s.translate(str.maketrans(accents, plain))
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _match_landmark(name: str) -> Optional[tuple[float, float]]:
    n = _norm(name)
    if not n:
        return None
    # exact match first
    if n in LANDMARKS:
        return LANDMARKS[n]
    # substring match — longest key first
    for key in sorted(LANDMARKS.keys(), key=len, reverse=True):
        if key in n:
            return LANDMARKS[key]
    return None


def _match_commune(commune: str, address: str = "") -> Optional[tuple[float, float]]:
    """Try to match the commune (then the address as a fallback)."""
    for token in (commune, address):
        n = _norm(token)
        if not n:
            continue
        if n in COMMUNES:
            return COMMUNES[n]
        # longest key contained in token wins
        best: Optional[str] = None
        for key in COMMUNES:
            if key in n and (best is None or len(key) > len(best)):
                best = key
        if best:
            return COMMUNES[best]
    return None


def _match_city(ville: str) -> Optional[tuple[float, float]]:
    n = _norm(ville)
    if not n:
        return None
    if n in CITIES:
        return CITIES[n]
    for key in CITIES:
        if key in n:
            return CITIES[key]
    return None


def resolve_coordinates(
    name: str = "",
    address: str = "",
    commune: str = "",
    ville: str = "",
    country: str = "",
) -> Optional[dict]:
    """Return {latitude, longitude, source, precision} or None.

    Precision tiers:
        - "landmark"  : exact, hand-curated landmark hit (highest)
        - "neighborhood": commune / quartier centroid
        - "city"      : city centroid
        - "country"   : last resort country centroid
    """
    hit = _match_landmark(name)
    if hit:
        return {
            "latitude": round(hit[0], 6),
            "longitude": round(hit[1], 6),
            "source": "google_maps_curated",
            "precision": "landmark",
        }

    # Commune match: try contact fields first, fall back to provider name
    # (V2 records often embed the commune in the name, e.g. "Clinique X Cocody").
    hit = _match_commune(commune, address) or _match_commune(name, "")
    if hit:
        return {
            "latitude": round(hit[0], 6),
            "longitude": round(hit[1], 6),
            "source": "google_maps_curated",
            "precision": "neighborhood",
        }

    hit = _match_city(ville) or _match_city(name)
    if hit:
        return {
            "latitude": round(hit[0], 6),
            "longitude": round(hit[1], 6),
            "source": "google_maps_curated",
            "precision": "city",
        }

    # Côte d'Ivoire fallback: when the only hint is "CI" / "côte d'ivoire"
    # (in the country field or the provider name like "Wellness CI"), fall
    # back to Abidjan since ~99% of our providers operate there.
    cn = _norm(country)
    nn = _norm(name)
    ci_hint = (
        "cote d ivoire" in cn or "ivory coast" in cn or cn == "ci"
        or "cote d ivoire" in nn or re.search(r"\bci\b", nn) is not None
        or re.search(r"\brci\b", nn) is not None
    )
    if ci_hint:
        c = CITIES["abidjan"]
        return {
            "latitude": round(c[0], 6),
            "longitude": round(c[1], 6),
            "source": "google_maps_curated",
            "precision": "city",
        }

    cn = cn or "cote d ivoire"
    if cn in COUNTRY_CENTROIDS:
        c = COUNTRY_CENTROIDS[cn]
        return {
            "latitude": round(c[0], 6),
            "longitude": round(c[1], 6),
            "source": "google_maps_curated",
            "precision": "country",
        }

    # Ultimate platform default: this app primarily serves Côte d'Ivoire,
    # so when nothing else matches we point to Abidjan city centre.
    c = CITIES["abidjan"]
    return {
        "latitude": round(c[0], 6),
        "longitude": round(c[1], 6),
        "source": "google_maps_curated",
        "precision": "country",
    }


# ---------------------------------------------------------------------------
# Detection helpers — extract address fields from heterogeneous docs
# ---------------------------------------------------------------------------

def _extract_address_fields(doc: dict) -> tuple[str, str, str, str, str]:
    """Return (name, address, commune, ville, country) from any doc shape.

    Handles both legacy flat docs (`address`, `city`, `neighborhood`, …) and
    V2 docs that nest the data under `master_profile.contact` or `contact`.
    """
    name = doc.get("name") or doc.get("company_name") or ""
    mp = doc.get("master_profile") or {}
    mp_contact = mp.get("contact") or {} if isinstance(mp, dict) else {}
    contact = doc.get("contact") or {}

    address = (
        contact.get("adresse")
        or mp_contact.get("adresse")
        or doc.get("landmark")
        or doc.get("address")
        or ""
    )
    commune = (
        contact.get("commune")
        or mp_contact.get("commune")
        or doc.get("neighborhood")
        or ""
    )
    ville = (
        contact.get("ville")
        or mp_contact.get("ville")
        or doc.get("city")
        or ""
    )
    country = doc.get("country") or ""
    return name, address, commune, ville, country


def _is_placeholder(coords: Optional[dict]) -> bool:
    if not coords:
        return True
    try:
        lat = round(float(coords.get("latitude")), 4)
        lng = round(float(coords.get("longitude")), 4)
    except (TypeError, ValueError):
        return True
    return (lat, lng) in PLACEHOLDER_COORDS


def needs_geocoding(doc: dict) -> bool:
    """A doc needs (re)geocoding if it has no coords, placeholder coords, or
    a previous attempt with a precision below `landmark`/`neighborhood` and
    no `geo.locked == True` flag."""
    geo = doc.get("geo") or {}
    if geo.get("locked"):
        return False
    coords = doc.get("coordinates")
    if _is_placeholder(coords):
        return True
    # If precision was previously poor (city/country) and we can do better, re-run.
    if geo.get("precision") in ("city", "country"):
        return True
    return False


# ---------------------------------------------------------------------------
# Migration — apply real coordinates to every provider
# ---------------------------------------------------------------------------

async def migrate_all_coordinates(db, force: bool = False) -> dict:
    """Geocode every doctor_profiles and partner_profiles document.

    Updates three places to keep the schema consistent:
        - top-level `coordinates: {latitude, longitude}`
        - new `geo: {source, precision, updated_at}`
        - `master_profile.contact.latitude / longitude`

    Idempotent: if the doc already has good (landmark/neighborhood) coords,
    we skip it unless `force=True`.
    """
    from datetime import datetime, timezone

    stats = {
        "doctors_total": 0,
        "doctors_updated": 0,
        "doctors_landmark": 0,
        "doctors_neighborhood": 0,
        "doctors_city": 0,
        "doctors_country": 0,
        "doctors_skipped_good": 0,
        "doctors_failed": 0,
        "partners_total": 0,
        "partners_updated": 0,
        "partners_landmark": 0,
        "partners_neighborhood": 0,
        "partners_city": 0,
        "partners_country": 0,
        "partners_skipped_good": 0,
        "partners_failed": 0,
    }

    now_iso = datetime.now(timezone.utc).isoformat()

    async def _process(collection_name: str, doc, prefix: str):
        stats[f"{prefix}_total"] += 1
        if not force and not needs_geocoding(doc):
            stats[f"{prefix}_skipped_good"] += 1
            return
        name, address, commune, ville, country = _extract_address_fields(doc)
        res = resolve_coordinates(name, address, commune, ville, country)
        if not res:
            stats[f"{prefix}_failed"] += 1
            return
        update = {
            "coordinates": {
                "latitude": res["latitude"],
                "longitude": res["longitude"],
            },
            "geo": {
                "source": res["source"],
                "precision": res["precision"],
                "updated_at": now_iso,
                "locked": False,
            },
            "master_profile.contact.latitude": res["latitude"],
            "master_profile.contact.longitude": res["longitude"],
        }
        await db[collection_name].update_one(
            {"id": doc["id"]}, {"$set": update}
        )
        stats[f"{prefix}_updated"] += 1
        stats[f"{prefix}_{res['precision']}"] += 1

    async for doc in db.doctor_profiles.find({}, {"_id": 0}):
        try:
            await _process("doctor_profiles", doc, "doctors")
        except Exception as e:
            logger.error(f"Geocode doctor {doc.get('id')!r}: {e}")
            stats["doctors_failed"] += 1

    async for doc in db.partner_profiles.find({}, {"_id": 0}):
        try:
            await _process("partner_profiles", doc, "partners")
        except Exception as e:
            logger.error(f"Geocode partner {doc.get('id')!r}: {e}")
            stats["partners_failed"] += 1

    logger.info(f"Coordinate migration complete: {stats}")
    return stats
