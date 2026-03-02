"""
Razorpay subscription billing routes.

Endpoints:
  POST /razorpay/create-subscription  — Create a new subscription for the authenticated user
  GET  /razorpay/subscription-status  — Get current subscription info
  POST /razorpay/cancel               — Cancel active subscription
  POST /razorpay/webhook              — Razorpay webhook handler (no auth, uses signature verification)
"""
import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/razorpay", tags=["Razorpay Billing"])
settings = get_settings()


def _get_razorpay_client():
    """Lazily import and create Razorpay client."""
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        return None
    import razorpay
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


# ── Models ──────────────────────────────────────────────────────

class CreateSubscriptionRequest(BaseModel):
    plan: str = Field(..., pattern="^(pro_monthly|pro_annual)$")


class CancelSubscriptionRequest(BaseModel):
    subscription_id: str = Field(..., min_length=4, max_length=64)


# ── Helpers ─────────────────────────────────────────────────────

PLAN_DETAILS = {
    "pro_monthly": {"price": 250, "period": "monthly", "name": "Pro Monthly (₹250/mo)"},
    "pro_annual": {"price": 2500, "period": "yearly", "name": "Pro Annual (₹2,500/yr)"},
}

def _get_plan_id(plan_key: str) -> str:
    if plan_key == "pro_monthly":
        return settings.RAZORPAY_PLAN_PRO_ID
    elif plan_key == "pro_annual":
        return settings.RAZORPAY_PLAN_PRO_ANNUAL_ID
    return ""


def _verify_webhook_signature(body: bytes, signature: str, secret: str) -> bool:
    """Verify Razorpay webhook signature using HMAC SHA256."""
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


# ── Routes ──────────────────────────────────────────────────────

@router.post("/create-subscription")
async def create_subscription(req: CreateSubscriptionRequest, request: Request):
    """Create a Razorpay subscription. Returns subscription_id + short_url for checkout."""
    client = _get_razorpay_client()
    if not client:
        raise HTTPException(503, detail="Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.")

    plan_id = _get_plan_id(req.plan)
    if not plan_id:
        raise HTTPException(400, detail=f"Plan ID not configured for '{req.plan}'. Set RAZORPAY_PLAN_PRO_ID in env.")

    plan_info = PLAN_DETAILS.get(req.plan, {})

    try:
        subscription = client.subscription.create({
            "plan_id": plan_id,
            "total_count": 12 if req.plan == "pro_monthly" else 1,
            "quantity": 1,
            "notes": {
                "plan_name": plan_info.get("name", req.plan),
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        })

        return {
            "subscription_id": subscription["id"],
            "short_url": subscription.get("short_url", ""),
            "status": subscription.get("status", "created"),
            "plan": req.plan,
            "plan_details": plan_info,
            "razorpay_key_id": settings.RAZORPAY_KEY_ID,
        }
    except Exception as e:
        logger.error(f"Razorpay create subscription failed: {e}")
        raise HTTPException(502, detail=f"Failed to create subscription: {str(e)}")


@router.get("/subscription-status")
async def subscription_status(request: Request):
    """Get subscription status. For now returns plan from query/header.
    Full implementation needs Supabase subscriptions table (Sprint 4.2+)."""
    # Placeholder: return free plan. Real implementation will query Supabase.
    return {
        "plan": "free",
        "status": "active",
        "expires_at": None,
        "ai_calls_today": 0,
        "ai_calls_limit": 25,
        "test_gen_today": 0,
        "test_gen_limit": 5,
    }


@router.post("/cancel")
async def cancel_subscription(req: CancelSubscriptionRequest, request: Request):
    """Cancel a Razorpay subscription."""
    client = _get_razorpay_client()
    if not client:
        raise HTTPException(503, detail="Razorpay not configured.")

    try:
        result = client.subscription.cancel(req.subscription_id)
        return {"status": "cancelled", "subscription_id": req.subscription_id, "detail": result}
    except Exception as e:
        logger.error(f"Razorpay cancel failed: {e}")
        raise HTTPException(502, detail=f"Failed to cancel subscription: {str(e)}")


@router.post("/webhook")
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhook events. No JWT auth — uses signature verification."""
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")

    if settings.RAZORPAY_WEBHOOK_SECRET:
        if not _verify_webhook_signature(body, signature, settings.RAZORPAY_WEBHOOK_SECRET):
            logger.warning("Razorpay webhook signature verification failed")
            raise HTTPException(400, detail="Invalid webhook signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(400, detail="Invalid JSON payload")

    event = payload.get("event", "")
    logger.info(f"Razorpay webhook: {event}")

    # Handle subscription events
    # Full Supabase integration happens in S4.2 (usage tracking).
    # For now, log the events for verification.
    if event == "subscription.activated":
        logger.info("Subscription activated: %s", payload.get("payload", {}).get("subscription", {}).get("entity", {}).get("id"))
    elif event == "subscription.charged":
        logger.info("Subscription charged successfully")
    elif event == "subscription.cancelled":
        logger.info("Subscription cancelled")
    elif event == "subscription.paused":
        logger.info("Subscription paused")
    elif event == "payment.failed":
        logger.warning("Payment failed: %s", payload.get("payload", {}).get("payment", {}).get("entity", {}).get("id"))

    return JSONResponse({"status": "ok"})
