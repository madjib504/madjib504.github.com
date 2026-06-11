"""
Provider badge system — Phase 1.

Two-layer badge:
  - TRUST badge (always shown)      : Annuaire / Revendiqué / Identité vérifiée
  - COMMERCIAL badge (optional)     : Mis en avant / Partenaire Officiel / Partenaire Officiel+

The trust badge encodes credibility (where the provider sits in the claim
funnel). The commercial badge encodes paid visibility (Phase 2). Showing both
lets a paying provider be flagged "Sponsorisé" without losing the trust signal.

Rules:
  trust_status                  → trust_badge label
    seeded / (missing)          → "Annuaire"          (slate)
    pending                     → "Revendiqué"        (amber)
    rejected                    → "Annuaire"          (slate)
    verified                    → "Identité vérifiée" (emerald)

  commercial.tier               → commercial_badge label
    free / (missing)            → None
    boost                       → "Mis en avant"          (orange)
    premium                     → "Partenaire Officiel"   (purple)
    premium_plus                → "Partenaire Officiel+"  (violet)

Trust score bonus (added to the existing 0-100 trust score in ranking):
  claimed (pending) → +5
  verified < 12 mo  → +15
  verified > 12 mo  → +8     (encourages periodic re-verification)
  premium*          → +3     (modest — patients must trust the platform)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


# --- public labels (FR) ---
TRUST_LABELS = {
    "verified": ("Identité vérifiée", "emerald", 3),
    "pending":  ("Revendiqué",        "amber",   2),
    "seeded":   ("Annuaire",          "slate",   1),
    "rejected": ("Annuaire",          "slate",   1),
}

COMMERCIAL_LABELS = {
    "boost":        ("Mis en avant",          "orange"),
    "premium":      ("Partenaire Officiel",   "purple"),
    "premium_plus": ("Partenaire Officiel+",  "violet"),
}


def _normalize_trust_status(provider: dict) -> str:
    """Extract claim_status from any provider doc shape."""
    mp = provider.get("master_profile") or {}
    trust = mp.get("trust") or {}
    raw = (
        trust.get("claim_status")
        or provider.get("claim_status")
        or "seeded"
    )
    raw = (raw or "").lower().strip()
    if raw in TRUST_LABELS:
        return raw
    # Map known aliases
    if raw in ("approved", "active"):
        return "verified"
    if raw in ("claim_pending", "claim_submitted", "submitted"):
        return "pending"
    return "seeded"


def _is_verified(provider: dict) -> bool:
    mp = provider.get("master_profile") or {}
    trust = mp.get("trust") or {}
    return bool(trust.get("is_verified") or provider.get("is_verified"))


def _commercial_tier(provider: dict) -> tuple[str, Optional[str]]:
    """Return (tier, tier_until_iso). Defaults to ('free', None)."""
    mp = provider.get("master_profile") or {}
    com = mp.get("commercial") or {}
    tier = (com.get("tier") or provider.get("subscription_plan") or "free").lower()
    tier_until = com.get("tier_until")
    # Auto-expire premium if past tier_until
    if tier_until:
        try:
            until = datetime.fromisoformat(tier_until.replace("Z", "+00:00"))
            if until < datetime.now(timezone.utc):
                tier = "free"
        except (ValueError, TypeError):
            pass
    if tier not in COMMERCIAL_LABELS and tier != "free":
        tier = "free"
    return tier, tier_until


def compute_badges(provider: dict) -> dict:
    """Return the 2-layer badge dict for a provider doc.

    Output:
        {
            "trust": {"key": "verified", "label": "Identité vérifiée", "color": "emerald", "level": 3},
            "commercial": {"key": "premium", "label": "Partenaire Officiel", "color": "purple"} | None
        }
    """
    status = _normalize_trust_status(provider)
    if _is_verified(provider):
        status = "verified"
    label, color, level = TRUST_LABELS[status]
    trust_badge = {"key": status, "label": label, "color": color, "level": level}

    tier, _tier_until = _commercial_tier(provider)
    commercial_badge = None
    if tier in COMMERCIAL_LABELS:
        clabel, ccolor = COMMERCIAL_LABELS[tier]
        commercial_badge = {"key": tier, "label": clabel, "color": ccolor}

    return {"trust": trust_badge, "commercial": commercial_badge}


def trust_score_bonus(provider: dict) -> int:
    """Modest bonus added to the base ranking score (max +18)."""
    status = _normalize_trust_status(provider)
    verified = _is_verified(provider)
    tier, _ = _commercial_tier(provider)

    bonus = 0
    if verified:
        # Re-verification bonus: fresher = stronger
        mp = provider.get("master_profile") or {}
        updated_at = (mp.get("trust") or {}).get("updated_at") or mp.get("updated_at")
        try:
            ts = datetime.fromisoformat((updated_at or "").replace("Z", "+00:00"))
            age_days = (datetime.now(timezone.utc) - ts).days
        except (ValueError, TypeError):
            age_days = 0
        bonus += 15 if age_days < 365 else 8
    elif status == "pending":
        bonus += 5

    if tier in ("premium", "premium_plus"):
        bonus += 3
    return bonus


def inject_badges(provider: dict) -> dict:
    """Add `badges` to a provider doc in-place AND return it.

    Safe to call on read-only API responses (operates on the dict you pass in).
    Adds also `is_sponsored` flag so the UI can show a "Sponsorisé" disclaimer.
    """
    if not isinstance(provider, dict):
        return provider
    provider["badges"] = compute_badges(provider)
    tier, _ = _commercial_tier(provider)
    provider["is_sponsored"] = tier in ("boost", "premium", "premium_plus")
    return provider
