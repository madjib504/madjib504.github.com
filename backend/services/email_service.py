"""
Resend email service for keneyakafisa.
Sends transactional emails non-blocking.
"""
import asyncio
import logging
import os

import resend

logger = logging.getLogger(__name__)


def _build_verification_html(user_name: str, verification_url: str) -> str:
    """HTML template for email verification (inline CSS, table-based for email clients)."""
    return f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Vérification de votre email - keneyakafisa</title>
    </head>
    <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f4;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f4;padding:32px 0;">
        <tr>
          <td align="center">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
              <tr>
                <td style="background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%);padding:40px 32px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:bold;letter-spacing:-0.5px;">keneyakafisa</h1>
                  <p style="margin:8px 0 0 0;color:#bfdbfe;font-size:14px;">Votre plateforme santé</p>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 32px;">
                  <h2 style="margin:0 0 16px 0;color:#1c1917;font-size:22px;font-weight:bold;">Bienvenue, {user_name} !</h2>
                  <p style="margin:0 0 24px 0;color:#44403c;font-size:16px;line-height:1.6;">
                    Merci de vous être inscrit(e) sur <strong>keneyakafisa</strong>. Pour finaliser votre inscription et sécuriser votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :
                  </p>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:16px 0 32px 0;">
                        <a href="{verification_url}" style="display:inline-block;background-color:#1e3a8a;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:9999px;font-size:16px;font-weight:bold;">
                          Vérifier mon email
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 16px 0;color:#78716c;font-size:14px;line-height:1.6;">
                    Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
                  </p>
                  <p style="margin:0 0 24px 0;color:#1e40af;font-size:13px;word-break:break-all;background-color:#eff6ff;padding:12px;border-radius:6px;">
                    {verification_url}
                  </p>
                  <p style="margin:24px 0 0 0;color:#a8a29e;font-size:13px;line-height:1.6;">
                    Ce lien est valable 7 jours. Si vous n'avez pas créé de compte sur keneyakafisa, vous pouvez ignorer cet email en toute sécurité.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#fafaf9;padding:24px 32px;text-align:center;border-top:1px solid #e7e5e4;">
                  <p style="margin:0;color:#78716c;font-size:13px;">
                    © {os.environ.get('CURRENT_YEAR', '2026')} keneyakafisa — Votre santé, notre priorité.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """


async def send_verification_email(recipient_email: str, user_name: str, verification_token: str) -> bool:
    """Send a verification email with magic link. Fire-and-forget; returns True if sent."""
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        logger.warning("RESEND_API_KEY not configured; skipping verification email")
        return False
    resend.api_key = api_key

    frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    verification_url = f"{frontend_url}/verify-email?token={verification_token}"

    params = {
        "from": f"keneyakafisa <{sender}>",
        "to": [recipient_email],
        "subject": "Vérifiez votre email — keneyakafisa",
        "html": _build_verification_html(user_name, verification_url),
    }

    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Verification email sent to {recipient_email}: id={result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send verification email to {recipient_email}: {e}")
        return False


# ============ CLAIM DECISION EMAILS ============

def _trust_meta(score: int):
    """Convert a 0-100 score into a human label + color."""
    if score >= 70:
        return ("Élevée", "#059669", "#d1fae5")  # emerald
    if score >= 40:
        return ("Moyenne", "#d97706", "#fef3c7")  # amber
    return ("Faible", "#dc2626", "#fee2e2")  # red


def _build_claim_approved_html(
    user_name: str, provider_name: str, trust_score: int,
    role_label: str, dashboard_url: str
) -> str:
    label, color, bg = _trust_meta(trust_score)
    return f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f4;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f4;padding:32px 0;">
        <tr><td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:40px 32px;text-align:center;">
                <div style="display:inline-block;background:rgba(255,255,255,0.2);width:64px;height:64px;border-radius:50%;text-align:center;line-height:64px;font-size:32px;margin-bottom:12px;">✓</div>
                <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:bold;">Revendication approuvée</h1>
                <p style="margin:8px 0 0 0;color:#d1fae5;font-size:14px;">Bienvenue dans la famille keneyakafisa</p>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 32px;">
                <h2 style="margin:0 0 12px 0;color:#1c1917;font-size:20px;">Félicitations {user_name} 🎉</h2>
                <p style="margin:0 0 20px 0;color:#44403c;font-size:16px;line-height:1.6;">
                  Votre demande de revendication pour <strong>{provider_name}</strong> en tant que <strong>{role_label}</strong> vient d'être <strong style="color:#059669;">approuvée</strong> par notre équipe d'administration.
                </p>

                <div style="background-color:#f0fdf4;border-left:4px solid #059669;border-radius:6px;padding:16px;margin:20px 0;">
                  <p style="margin:0 0 8px 0;color:#065f46;font-size:14px;font-weight:bold;">Ce que cela signifie pour vous :</p>
                  <ul style="margin:0;padding-left:20px;color:#065f46;font-size:14px;line-height:1.8;">
                    <li>Votre fiche est désormais marquée comme <strong>vérifiée ✓</strong></li>
                    <li>Vous pouvez la mettre à jour : photos, vidéo, horaires, services, équipe</li>
                    <li>Vous recevez les demandes de rendez-vous dans votre dashboard</li>
                    <li>Vous gérez vos rendez-vous, vos réponses WhatsApp et vos publicités</li>
                  </ul>
                </div>

                <div style="background-color:{bg};border-radius:6px;padding:14px 16px;margin:20px 0;text-align:center;">
                  <p style="margin:0;color:{color};font-size:13px;">Score de confiance de votre dossier</p>
                  <p style="margin:6px 0 0 0;color:{color};font-size:28px;font-weight:bold;font-family:monospace;">{trust_score} / 100 · {label}</p>
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr><td align="center" style="padding:24px 0;">
                    <a href="{dashboard_url}" style="display:inline-block;background-color:#1e3a8a;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:9999px;font-size:16px;font-weight:bold;">
                      Accéder à mon dashboard →
                    </a>
                  </td></tr>
                </table>

                <p style="margin:24px 0 0 0;color:#78716c;font-size:13px;line-height:1.6;">
                  Connectez-vous avec l'email et le mot de passe que vous avez utilisés lors de votre demande. Pour toute question, répondez simplement à cet email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#fafaf9;padding:20px 32px;text-align:center;border-top:1px solid #e7e5e4;">
                <p style="margin:0;color:#78716c;font-size:12px;">
                  © {os.environ.get('CURRENT_YEAR', '2026')} keneyakafisa — Votre santé, notre priorité.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """


def _build_claim_rejected_html(
    user_name: str, provider_name: str, trust_score: int,
    role_label: str, reason: str, support_email: str, claim_again_url: str
) -> str:
    label, color, bg = _trust_meta(trust_score)
    reason_block = ""
    if reason:
        reason_block = f"""
        <div style="background-color:#fff7ed;border-left:4px solid #ea580c;border-radius:6px;padding:14px 16px;margin:20px 0;">
          <p style="margin:0;color:#9a3412;font-size:13px;font-weight:bold;">Motif communiqué par l'équipe</p>
          <p style="margin:8px 0 0 0;color:#7c2d12;font-size:14px;font-style:italic;line-height:1.5;">"{reason}"</p>
        </div>
        """
    return f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f4;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f4;padding:32px 0;">
        <tr><td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#9f1239 0%,#be123c 100%);padding:36px 32px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;">Revendication non validée</h1>
                <p style="margin:8px 0 0 0;color:#fecaca;font-size:14px;">Nous avons besoin de plus d'informations</p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px;">
                <h2 style="margin:0 0 12px 0;color:#1c1917;font-size:18px;">Bonjour {user_name},</h2>
                <p style="margin:0 0 16px 0;color:#44403c;font-size:15px;line-height:1.6;">
                  Après examen, votre demande de revendication pour <strong>{provider_name}</strong> en tant que <strong>{role_label}</strong> n'a malheureusement pas pu être validée à ce stade.
                </p>

                {reason_block}

                <div style="background-color:{bg};border-radius:6px;padding:12px 16px;margin:16px 0;text-align:center;">
                  <p style="margin:0;color:{color};font-size:13px;">Score de confiance évalué</p>
                  <p style="margin:4px 0 0 0;color:{color};font-size:22px;font-weight:bold;font-family:monospace;">{trust_score} / 100 · {label}</p>
                </div>

                <div style="background-color:#eff6ff;border-radius:6px;padding:16px;margin:20px 0;">
                  <p style="margin:0 0 8px 0;color:#1e40af;font-size:14px;font-weight:bold;">Comment relancer votre demande ?</p>
                  <ol style="margin:0;padding-left:20px;color:#1e3a8a;font-size:13px;line-height:1.7;">
                    <li>Préparez vos <strong>documents officiels</strong> (carte professionnelle, licence d'exercice, registre de commerce, attestation d'employeur)</li>
                    <li>Utilisez un <strong>email professionnel</strong> (pas gmail/yahoo si possible)</li>
                    <li>Rédigez une <strong>justification claire</strong> (30+ caractères) expliquant votre lien avec la structure</li>
                    <li>Si vous représentez une équipe, joignez un mandat signé par le propriétaire</li>
                  </ol>
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr><td align="center" style="padding:16px 0;">
                    <a href="{claim_again_url}" style="display:inline-block;background-color:#1e3a8a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:9999px;font-size:15px;font-weight:bold;">
                      Soumettre une nouvelle demande →
                    </a>
                  </td></tr>
                </table>

                <p style="margin:24px 0 0 0;color:#78716c;font-size:13px;line-height:1.6;">
                  Une question ? Écrivez-nous à <a href="mailto:{support_email}" style="color:#1e40af;">{support_email}</a> en mentionnant l'identifiant de votre demande.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#fafaf9;padding:20px 32px;text-align:center;border-top:1px solid #e7e5e4;">
                <p style="margin:0;color:#78716c;font-size:12px;">
                  © {os.environ.get('CURRENT_YEAR', '2026')} keneyakafisa — Votre santé, notre priorité.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """


CLAIM_ROLE_LABELS = {
    "owner": "Propriétaire",
    "manager": "Manager / Directeur",
    "doctor": "Médecin / Praticien",
    "secretary": "Secrétaire / Assistant(e)",
    "admin_rep": "Représentant administratif",
}


def _build_structure_added_html(
    user_name: str, structure_name: str, category: str,
    email: str, role_label: str, dashboard_url: str
) -> str:
    return f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f4;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f4;padding:32px 0;">
        <tr><td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%);padding:40px 32px;text-align:center;">
                <div style="display:inline-block;background:rgba(255,255,255,0.2);width:64px;height:64px;border-radius:50%;text-align:center;line-height:64px;font-size:32px;margin-bottom:12px;">🎉</div>
                <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:bold;">Bienvenue sur keneyakafisa</h1>
                <p style="margin:8px 0 0 0;color:#bfdbfe;font-size:14px;">Votre structure est en ligne</p>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 32px;">
                <h2 style="margin:0 0 12px 0;color:#1c1917;font-size:20px;">Bonjour {user_name} 👋</h2>
                <p style="margin:0 0 16px 0;color:#44403c;font-size:16px;line-height:1.6;">
                  Votre structure <strong>{structure_name}</strong> ({category}) a été ajoutée avec succès sur la plateforme keneyakafisa. Elle est <strong style="color:#059669;">automatiquement vérifiée ✓</strong> car vous l'avez créée vous-même.
                </p>

                <div style="background-color:#eff6ff;border-left:4px solid #1e40af;border-radius:6px;padding:16px;margin:20px 0;">
                  <p style="margin:0 0 8px 0;color:#1e3a8a;font-size:14px;font-weight:bold;">🔐 Vos identifiants de connexion</p>
                  <table cellspacing="0" cellpadding="4" border="0" style="margin-top:6px;font-size:14px;">
                    <tr><td style="color:#475569;padding-right:12px;">Email :</td><td style="color:#0f172a;font-family:monospace;font-weight:bold;">{email}</td></tr>
                    <tr><td style="color:#475569;padding-right:12px;">Rôle :</td><td style="color:#0f172a;font-weight:bold;">{role_label}</td></tr>
                    <tr><td style="color:#475569;padding-right:12px;">Mot de passe :</td><td style="color:#0f172a;font-style:italic;">(celui que vous avez choisi à l'inscription)</td></tr>
                  </table>
                </div>

                <div style="background-color:#f0fdf4;border-radius:6px;padding:16px;margin:20px 0;">
                  <p style="margin:0 0 10px 0;color:#065f46;font-size:14px;font-weight:bold;">Que faire maintenant ?</p>
                  <ul style="margin:0;padding-left:20px;color:#065f46;font-size:14px;line-height:1.8;">
                    <li>Complétez votre profil : photo, vidéo de présentation, horaires, équipe</li>
                    <li>Configurez vos services et tarifs</li>
                    <li>Activez la prise de rendez-vous en ligne</li>
                    <li>Recevez vos premiers patients via la recherche IA</li>
                  </ul>
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr><td align="center" style="padding:24px 0 12px 0;">
                    <a href="{dashboard_url}" style="display:inline-block;background-color:#1e3a8a;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:9999px;font-size:16px;font-weight:bold;">
                      Accéder à mon dashboard →
                    </a>
                  </td></tr>
                </table>

                <p style="margin:24px 0 0 0;color:#78716c;font-size:13px;line-height:1.6;">
                  💡 <strong>Astuce</strong> : ajoutez votre photo de couverture, votre logo et au moins 3 photos de votre établissement — les fiches complètes reçoivent 4× plus de demandes de rendez-vous.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#fafaf9;padding:20px 32px;text-align:center;border-top:1px solid #e7e5e4;">
                <p style="margin:0;color:#78716c;font-size:12px;">
                  © {os.environ.get('CURRENT_YEAR', '2026')} keneyakafisa — Votre santé, notre priorité.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """


async def send_structure_added_email(
    recipient_email: str,
    user_name: str,
    structure_name: str,
    category: str,
    claim_type: str = "owner",
) -> bool:
    """Send welcome email when a new structure is self-added via /api/structures/add."""
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        logger.warning("RESEND_API_KEY not configured; skipping structure-added email")
        return False
    if not recipient_email or recipient_email.endswith("@keneyakafisa.app"):
        logger.info(f"Skipping structure email to auto-generated address: {recipient_email}")
        return False

    resend.api_key = api_key
    frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    role_label = CLAIM_ROLE_LABELS.get(claim_type, "Propriétaire")
    dashboard_url = f"{frontend_url}/login"

    params = {
        "from": f"keneyakafisa <{sender}>",
        "to": [recipient_email],
        "subject": f"🎉 Bienvenue sur keneyakafisa — {structure_name} est en ligne",
        "html": _build_structure_added_html(
            user_name, structure_name, category or "Autre",
            recipient_email, role_label, dashboard_url,
        ),
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Structure-added email sent to {recipient_email}: id={result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send structure-added email to {recipient_email}: {e}")
        return False


# ============ J+7 PROFILE INCOMPLETE REMINDER ============

REMINDER_ITEM_LABELS = {
    "profile_image": ("📷 Photo de profil", "Ajoutez votre photo ou logo pour humaniser votre fiche"),
    "cover_image": ("🖼️ Photo de couverture", "Mettez en avant votre établissement avec une bannière"),
    "bio": ("📝 Description", "Décrivez vos services en quelques lignes pour rassurer les patients"),
    "video_url": ("🎬 Vidéo de présentation", "Une vidéo de 30s booste 3× les rendez-vous"),
    "horaires": ("⏰ Horaires d'ouverture", "Indiquez vos disponibilités pour recevoir des RDV pertinents"),
    "city": ("📍 Adresse complète", "Ville et quartier précis pour apparaître dans les recherches locales"),
    "whatsapp_number": ("💬 Numéro WhatsApp", "Permettez aux patients de vous contacter instantanément"),
    "specialties": ("🩺 Spécialités", "Listez vos domaines d'expertise pour matcher avec les symptômes IA"),
}


def _build_j7_reminder_html(
    user_name: str, structure_name: str, missing_items: list, edit_url: str
) -> str:
    items_html = "".join([
        f"""
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
            <table cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:top;width:30px;font-size:18px;">{label_emoji}</td>
                <td>
                  <p style="margin:0;color:#0f172a;font-size:14px;font-weight:bold;">{label_text}</p>
                  <p style="margin:2px 0 0 0;color:#64748b;font-size:12px;line-height:1.5;">{desc}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        """
        for item_key in missing_items
        for (label_full, desc) in [REMINDER_ITEM_LABELS.get(item_key, (f"⚙️ {item_key}", "À compléter"))]
        for (label_emoji, label_text) in [(label_full.split(' ', 1)[0], label_full.split(' ', 1)[1] if ' ' in label_full else label_full)]
    ])
    completion_pct = max(0, min(100, 100 - len(missing_items) * 12))
    return f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f4;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f4;padding:32px 0;">
        <tr><td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#7c2d12 0%,#c2410c 100%);padding:36px 32px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;">📸 Votre fiche reçoit 4× plus de RDV avec une photo</h1>
                <p style="margin:8px 0 0 0;color:#fed7aa;font-size:14px;">Complétez en 1 min — c'est tout ce qui manque</p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px;">
                <h2 style="margin:0 0 12px 0;color:#1c1917;font-size:18px;">Bonjour {user_name} 👋</h2>
                <p style="margin:0 0 18px 0;color:#44403c;font-size:15px;line-height:1.6;">
                  Cela fait <strong>une semaine</strong> que <strong>{structure_name}</strong> est sur keneyakafisa. Bonne nouvelle : les patients commencent à vous découvrir via la recherche IA ! Mais votre fiche est encore <strong style="color:#c2410c;">incomplète à {100 - completion_pct}%</strong>.
                </p>

                <!-- Completion bar -->
                <div style="margin:16px 0 8px 0;background-color:#f1f5f9;border-radius:9999px;height:12px;overflow:hidden;">
                  <div style="width:{completion_pct}%;background:linear-gradient(90deg,#ea580c,#f59e0b);height:12px;"></div>
                </div>
                <p style="margin:0 0 24px 0;color:#64748b;font-size:12px;text-align:right;font-family:monospace;">
                  Complétude : <strong style="color:#ea580c;">{completion_pct}%</strong>
                </p>

                <p style="margin:0 0 12px 0;color:#1c1917;font-size:15px;font-weight:bold;">
                  ✏️ Ce qu'il vous manque encore ({len(missing_items)} éléments) :
                </p>
                <table cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:8px;">
                  {items_html}
                </table>

                <div style="background-color:#fef3c7;border-left:4px solid #d97706;border-radius:6px;padding:14px 16px;margin:24px 0;">
                  <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;">
                    💡 <strong>Le saviez-vous ?</strong> Une fiche avec photo + description + horaires reçoit en moyenne <strong>4× plus de demandes de rendez-vous</strong> qu'une fiche incomplète. Et ça ne prend que 60 secondes à finaliser.
                  </p>
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr><td align="center" style="padding:8px 0 16px 0;">
                    <a href="{edit_url}" style="display:inline-block;background-color:#c2410c;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:9999px;font-size:16px;font-weight:bold;">
                      Compléter ma fiche maintenant →
                    </a>
                  </td></tr>
                </table>

                <p style="margin:24px 0 0 0;color:#a8a29e;font-size:12px;line-height:1.6;text-align:center;">
                  Vous ne recevrez ce rappel qu'une seule fois. Si vous ne souhaitez plus utiliser la plateforme, vous pouvez ignorer cet email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#fafaf9;padding:20px 32px;text-align:center;border-top:1px solid #e7e5e4;">
                <p style="margin:0;color:#78716c;font-size:12px;">
                  © {os.environ.get('CURRENT_YEAR', '2026')} keneyakafisa — Votre santé, notre priorité.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """


async def send_j7_reminder_email(
    recipient_email: str, user_name: str, structure_name: str, missing_items: list
) -> bool:
    """Send a J+7 incomplete-profile reminder email."""
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        logger.warning("RESEND_API_KEY not configured; skipping J+7 reminder")
        return False
    if not recipient_email or recipient_email.endswith("@keneyakafisa.app"):
        logger.info(f"Skipping J+7 reminder to auto-generated address: {recipient_email}")
        return False
    if not missing_items:
        return False  # nothing to nag about

    resend.api_key = api_key
    frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    edit_url = f"{frontend_url}/login"

    params = {
        "from": f"keneyakafisa <{sender}>",
        "to": [recipient_email],
        "subject": f"📸 {structure_name} — il manque encore {len(missing_items)} éléments pour booster vos RDV",
        "html": _build_j7_reminder_html(user_name, structure_name, missing_items, edit_url),
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"J+7 reminder sent to {recipient_email}: id={result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send J+7 reminder to {recipient_email}: {e}")
        return False


async def send_claim_decision_email(
    recipient_email: str,
    user_name: str,
    provider_name: str,
    trust_score: int,
    claim_type: str,
    decision: str,
    reason: str = "",
) -> bool:
    """Send claim approval/rejection email. Fire-and-forget; returns True if sent."""
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        logger.warning("RESEND_API_KEY not configured; skipping claim decision email")
        return False
    if not recipient_email or recipient_email.endswith("@keneyakafisa.app"):
        # Auto-generated email — user did not provide a real address. Skip silently.
        logger.info(f"Skipping claim email to auto-generated address: {recipient_email}")
        return False

    resend.api_key = api_key
    frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    support_email = os.environ.get("SUPPORT_EMAIL", sender)
    role_label = CLAIM_ROLE_LABELS.get(claim_type, claim_type or "Représentant")

    if decision == "approve":
        dashboard_url = f"{frontend_url}/login"
        subject = f"✓ Votre revendication a été approuvée — {provider_name}"
        html = _build_claim_approved_html(user_name, provider_name, trust_score, role_label, dashboard_url)
    else:
        claim_again_url = f"{frontend_url}/claim"
        subject = f"Votre revendication nécessite plus d'informations — {provider_name}"
        html = _build_claim_rejected_html(
            user_name, provider_name, trust_score, role_label, reason, support_email, claim_again_url
        )

    params = {
        "from": f"keneyakafisa <{sender}>",
        "to": [recipient_email],
        "subject": subject,
        "html": html,
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Claim {decision} email sent to {recipient_email}: id={result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send claim {decision} email to {recipient_email}: {e}")
        return False
