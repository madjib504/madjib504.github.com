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
