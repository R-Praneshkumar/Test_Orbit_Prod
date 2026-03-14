"""
Weekly digest email service.

Builds an HTML digest summarising the past week's API testing activity
and sends it via Resend's HTTP API (using aiohttp — no extra dependency).
"""
import logging
from datetime import datetime, timezone, timedelta

import aiohttp

from app.core.config import get_settings
from app.services.usage_service import usage_service, FREE_LIMITS

logger = logging.getLogger(__name__)


def build_digest_html(period_label: str = "This Week") -> dict:
    """
    Aggregate usage data and return a dict with subject, html, and stats.

    Returns:
        {
            "subject": str,
            "html": str,
            "stats": { ... },
            "period": str,
        }
    """
    data = usage_service._data
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    week_ago_str = week_ago.strftime("%Y-%m-%d")

    # Aggregate weekly stats
    total_users = 0
    total_ai_calls = 0
    total_test_gen = 0
    total_code_gen = 0
    total_security_scan = 0

    for uid, entry in data.items():
        entry_date = entry.get("date", "")
        if entry_date >= week_ago_str:
            total_users += 1
            total_ai_calls += entry.get("ai_calls", 0)
            total_test_gen += entry.get("test_gen", 0)
            total_code_gen += entry.get("code_gen", 0)
            total_security_scan += entry.get("security_scan", 0)

    stats = {
        "active_users": total_users,
        "ai_calls": total_ai_calls,
        "test_gen": total_test_gen,
        "code_gen": total_code_gen,
        "security_scan": total_security_scan,
        "total_actions": total_ai_calls + total_test_gen + total_code_gen + total_security_scan,
    }

    date_range = f"{week_ago.strftime('%b %d')} – {now.strftime('%b %d, %Y')}"
    subject = f"TestOrbit Weekly Digest — {date_range}"

    html = _render_html(stats, date_range, period_label)

    return {
        "subject": subject,
        "html": html,
        "stats": stats,
        "period": date_range,
    }


def _render_html(stats: dict, date_range: str, period_label: str) -> str:
    """Render the digest email as inline-styled HTML."""
    return f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

<!-- Header -->
<tr><td style="background:#6d28d9;padding:24px 32px;">
  <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">TestOrbit</h1>
  <p style="margin:4px 0 0;color:#c4b5fd;font-size:13px;">{period_label} · {date_range}</p>
</td></tr>

<!-- Stats Grid -->
<tr><td style="padding:24px 32px;">
  <h2 style="margin:0 0 16px;font-size:16px;color:#18181b;">Activity Summary</h2>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="50%" style="padding:8px;">
        <div style="background:#f5f3ff;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#6d28d9;">{stats['active_users']}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Active Users</div>
        </div>
      </td>
      <td width="50%" style="padding:8px;">
        <div style="background:#ecfdf5;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#059669;">{stats['ai_calls']}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">AI Calls</div>
        </div>
      </td>
    </tr>
    <tr>
      <td width="50%" style="padding:8px;">
        <div style="background:#eff6ff;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#2563eb;">{stats['test_gen']}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Tests Generated</div>
        </div>
      </td>
      <td width="50%" style="padding:8px;">
        <div style="background:#fef3c7;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#d97706;">{stats['code_gen']}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Code Snippets</div>
        </div>
      </td>
    </tr>
    <tr>
      <td width="50%" style="padding:8px;">
        <div style="background:#fef2f2;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#dc2626;">{stats['security_scan']}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Security Scans</div>
        </div>
      </td>
      <td width="50%" style="padding:8px;">
        <div style="background:#f4f4f5;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#18181b;">{stats['total_actions']}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Total Actions</div>
        </div>
      </td>
    </tr>
  </table>
</td></tr>

<!-- Free Tier Info -->
<tr><td style="padding:0 32px 24px;">
  <div style="background:#f9fafb;border-radius:8px;padding:16px;">
    <h3 style="margin:0 0 8px;font-size:13px;color:#374151;">Free Tier Limits (per user/day)</h3>
    <table width="100%" style="font-size:12px;color:#6b7280;">
      <tr><td>AI Calls</td><td align="right" style="font-weight:600;color:#18181b;">{FREE_LIMITS['ai_calls']}/day</td></tr>
      <tr><td>Test Generation</td><td align="right" style="font-weight:600;color:#18181b;">{FREE_LIMITS['test_gen']}/day</td></tr>
      <tr><td>Code Generation</td><td align="right" style="font-weight:600;color:#18181b;">{FREE_LIMITS['code_gen']}/day</td></tr>
      <tr><td>Security Scans</td><td align="right" style="font-weight:600;color:#18181b;">{FREE_LIMITS['security_scan']}/day</td></tr>
    </table>
  </div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0;font-size:11px;color:#9ca3af;">
    You're receiving this because you're a TestOrbit admin.
    <br>Sent from TestOrbit · AI-Native API Testing
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""


async def send_digest_email(to_emails: list[str]) -> dict:
    """
    Build the weekly digest and send it via Resend HTTP API.

    Args:
        to_emails: List of recipient email addresses.

    Returns:
        {"sent": True/False, "recipients": int, "resend_id": str|None, "error": str|None}
    """
    if not to_emails:
        return {"sent": False, "recipients": 0, "resend_id": None, "error": "No recipients"}

    settings = get_settings()

    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured — skipping digest email")
        return {"sent": False, "recipients": 0, "resend_id": None, "error": "RESEND_API_KEY not configured"}

    digest = build_digest_html()

    payload = {
        "from": settings.DIGEST_FROM_EMAIL,
        "to": to_emails,
        "subject": digest["subject"],
        "html": digest["html"],
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.resend.com/emails",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                body = await resp.json()
                if resp.status in (200, 201):
                    resend_id = body.get("id")
                    logger.info("Digest email sent to %d recipients (resend_id=%s)", len(to_emails), resend_id)
                    return {"sent": True, "recipients": len(to_emails), "resend_id": resend_id, "error": None}
                else:
                    error_msg = body.get("message", str(body))
                    logger.error("Resend API error %d: %s", resp.status, error_msg)
                    return {"sent": False, "recipients": 0, "resend_id": None, "error": error_msg}
    except Exception as e:
        logger.exception("Failed to send digest email")
        return {"sent": False, "recipients": 0, "resend_id": None, "error": str(e)}
