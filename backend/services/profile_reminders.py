"""
J+7 incomplete-profile reminder service.

Runs in the background (asyncio loop) and sends a one-shot reminder to
provider owners whose profile is still incomplete 7 days after creation.

Idempotent: a `reminder_j7_sent_at` field is written on the user document
so each user only ever receives the reminder once.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from services.email_service import send_j7_reminder_email

logger = logging.getLogger(__name__)

# How long after account creation we trigger the reminder.
REMINDER_DELAY_DAYS = 7
# Re-scan interval (the loop wakes every N hours; cheap operation).
SCAN_INTERVAL_HOURS = 6


def evaluate_profile_completeness(profile: dict, kind: str) -> list:
    """Return the list of missing-field keys that warrant a reminder.

    Keys are matched to REMINDER_ITEM_LABELS in email_service.
    """
    if not profile:
        return ["profile_image", "bio", "specialties", "city", "horaires"]

    missing = []
    if not (profile.get("profile_image") or "").strip():
        missing.append("profile_image")
    if not (profile.get("cover_image") or "").strip():
        missing.append("cover_image")

    bio = profile.get("bio") or profile.get("description") or ""
    if len(bio.strip()) < 30:
        missing.append("bio")

    if not (profile.get("video_url") or "").strip():
        missing.append("video_url")

    horaires = profile.get("horaires") or {}
    if not horaires or (isinstance(horaires, dict) and not any(horaires.values())):
        missing.append("horaires")

    if not (profile.get("city") or "").strip():
        missing.append("city")

    if not (profile.get("whatsapp_number") or "").strip():
        missing.append("whatsapp_number")

    if kind == "doctor":
        specs = profile.get("specialties") or []
        if not specs or (len(specs) == 1 and not specs[0]):
            missing.append("specialties")

    return missing


async def find_and_send_reminders(db) -> dict:
    """Scan partners + doctors created ~7 days ago with incomplete profile.

    Returns a stats dict — useful for the admin manual-trigger endpoint.
    """
    now = datetime.now(timezone.utc)
    threshold_iso = (now - timedelta(days=REMINDER_DELAY_DAYS)).isoformat()

    stats = {"scanned": 0, "sent": 0, "skipped_complete": 0, "skipped_already": 0,
             "skipped_no_email": 0, "failed": 0}

    candidates = db.users.find({
        "user_type": {"$in": ["partner", "doctor"]},
        "created_at": {"$lte": threshold_iso},
        "reminder_j7_sent_at": {"$exists": False},
        "imported": {"$ne": True},  # skip seeded fiches without a real owner
    }, {"_id": 0, "id": 1, "email": 1, "name": 1, "user_type": 1,
        "claim_pending": 1, "verified": 1})

    async for u in candidates:
        stats["scanned"] += 1
        email = (u.get("email") or "").strip()
        if not email or email.endswith("@keneyakafisa.app"):
            stats["skipped_no_email"] += 1
            await db.users.update_one(
                {"id": u["id"]},
                {"$set": {"reminder_j7_sent_at": now.isoformat(),
                          "reminder_j7_skipped": "no_real_email"}}
            )
            continue
        # Skip claim_pending users — they have their own approval flow
        if u.get("claim_pending"):
            stats["skipped_already"] += 1
            continue

        kind = "doctor" if u["user_type"] == "doctor" else "partner"
        collection = db.doctor_profiles if kind == "doctor" else db.partner_profiles
        profile = await collection.find_one(
            {"user_id": u["id"]},
            {"_id": 0, "name": 1, "company_name": 1, "profile_image": 1,
             "cover_image": 1, "bio": 1, "description": 1, "video_url": 1,
             "horaires": 1, "city": 1, "whatsapp_number": 1, "specialties": 1}
        )

        missing = evaluate_profile_completeness(profile, kind)
        if not missing:
            stats["skipped_complete"] += 1
            await db.users.update_one(
                {"id": u["id"]},
                {"$set": {"reminder_j7_sent_at": now.isoformat(),
                          "reminder_j7_skipped": "profile_complete"}}
            )
            continue

        structure_name = (profile or {}).get("name") or (profile or {}).get("company_name") or u.get("name") or "votre fiche"
        ok = await send_j7_reminder_email(
            recipient_email=email,
            user_name=u.get("name") or "",
            structure_name=structure_name,
            missing_items=missing,
        )
        if ok:
            stats["sent"] += 1
            await db.users.update_one(
                {"id": u["id"]},
                {"$set": {"reminder_j7_sent_at": now.isoformat(),
                          "reminder_j7_missing": missing}}
            )
        else:
            stats["failed"] += 1
            # Still mark to avoid retrying on every scan loop
            await db.users.update_one(
                {"id": u["id"]},
                {"$set": {"reminder_j7_sent_at": now.isoformat(),
                          "reminder_j7_skipped": "send_failed"}}
            )

    return stats


_loop_task = None  # module-level handle to prevent double-scheduling


async def start_reminder_loop(db):
    """Schedule the J+7 reminder scan to run every SCAN_INTERVAL_HOURS."""
    global _loop_task

    async def _loop():
        # Initial delay so we don't blast emails on a fresh restart
        await asyncio.sleep(60)
        while True:
            try:
                stats = await find_and_send_reminders(db)
                logger.info(f"J+7 reminder scan complete: {stats}")
            except Exception as e:
                logger.error(f"J+7 reminder scan failed: {e}")
            await asyncio.sleep(SCAN_INTERVAL_HOURS * 3600)

    if _loop_task is None or _loop_task.done():
        _loop_task = asyncio.create_task(_loop())
        logger.info(f"J+7 reminder loop started (interval={SCAN_INTERVAL_HOURS}h)")
