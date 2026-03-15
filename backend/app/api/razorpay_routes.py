"""
Razorpay subscription billing routes.

Endpoints:
  POST /razorpay/create-subscription  — Create a new subscription for the authenticated user
  GET  /razorpay/subscription-status  — Get current subscription info from Supabase
  POST /razorpay/cancel               — Cancel active subscription
  POST /razorpay/webhook              — Razorpay webhook handler (no auth, uses signature verification)
"""
import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone

import aiohttp
from fastapi import APIRouter, Request, HTTPException, Header, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.security import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/razorpay", tags=["Razorpay Billing"])
settings = get_settings()


def _get_razorpay_client():
    """Lazily import and create Razorpay client."""
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        return None
    import razorpay
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


# ── Supabase REST helper ──────────────────────────────────────

async def _supabase_query(method: str, table: str, params: dict = None, body: dict = None, prefer: str = None) -> dict | list | None:
    """Call Supabase REST API with service_role key. Returns parsed JSON or None on failure."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    url = f"{settings.SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    try:
        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, params=params, json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status >= 400:
                    text = await resp.text()
                    logger.warning("Supabase %s %s → %s: %s", method, table, resp.status, text[:200])
                    return None
                if resp.content_length == 0 or resp.status == 204:
                    return {}
                return await resp.json()
    except Exception as e:
        logger.error("Supabase REST error: %s", e)
        return None


async def _get_user_plan(user_id: str) -> dict:
    """Look up user's subscription from Supabase. Returns dict with plan, status, and billing cycle."""
    result = await _supabase_query("GET", "subscriptions", params={
        "user_id": f"eq.{user_id}",
        "select": "plan,status,razorpay_subscription_id,razorpay_plan_id,current_period_end",
        "limit": "1",
    })
    if result and len(result) > 0:
        row = result[0]
        plan_id = row.get("razorpay_plan_id", "")
        billing = "annual" if plan_id == settings.RAZORPAY_PLAN_PRO_ANNUAL_ID else "monthly"
        return {
            "plan": row.get("plan", "free"),
            "status": row.get("status", "active"),
            "billing": billing if row.get("plan") != "free" else None,
            "subscription_id": row.get("razorpay_subscription_id"),
            "expires_at": row.get("current_period_end"),
        }
    return {"plan": "free", "status": "active", "billing": None, "subscription_id": None, "expires_at": None}


async def _upsert_subscription(user_id: str, plan: str, status: str, razorpay_sub_id: str = None, razorpay_plan_id: str = None, period_start: str = None, period_end: str = None):
    """Insert or update user's subscription in Supabase."""
    body = {
        "user_id": user_id,
        "plan": plan,
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if razorpay_sub_id:
        body["razorpay_subscription_id"] = razorpay_sub_id
    if razorpay_plan_id:
        body["razorpay_plan_id"] = razorpay_plan_id
    if period_start:
        body["current_period_start"] = period_start
    if period_end:
        body["current_period_end"] = period_end

    return await _supabase_query(
        "POST", "subscriptions", body=body,
        prefer="resolution=merge-duplicates,return=minimal",
    )


# ── Models ──────────────────────────────────────────────────────

class CreateSubscriptionRequest(BaseModel):
    plan: str = Field(..., pattern="^(pro_monthly|pro_annual)$")


class CancelSubscriptionRequest(BaseModel):
    subscription_id: str = Field(..., min_length=4, max_length=64)


# ── Helpers ─────────────────────────────────────────────────────

PLAN_DETAILS = {
    "pro_monthly": {"price": 399, "period": "monthly", "name": "Pro Monthly (₹399/mo)"},
    "pro_annual": {"price": 3999, "period": "yearly", "name": "Pro Annual (₹3,999/yr)"},
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


def _extract_user_from_notes(entity: dict) -> str | None:
    """Try to extract user_id from Razorpay subscription notes."""
    notes = entity.get("notes", {})
    return notes.get("user_id")


# ── Routes ──────────────────────────────────────────────────────

@router.post("/create-subscription")
async def create_subscription(req: CreateSubscriptionRequest, request: Request, user: dict = Depends(verify_token)):
    """Create a Razorpay subscription. Returns subscription_id + short_url for checkout."""
    client = _get_razorpay_client()
    if not client:
        raise HTTPException(503, detail="Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.")

    plan_id = _get_plan_id(req.plan)
    if not plan_id:
        raise HTTPException(400, detail=f"Plan ID not configured for '{req.plan}'. Set RAZORPAY_PLAN_PRO_ID in env.")

    plan_info = PLAN_DETAILS.get(req.plan, {})
    user_id = user.get("sub", "")

    # Prevent duplicate subscriptions
    if user_id:
        existing = await _get_user_plan(user_id)
        if existing.get("plan") == "pro" and existing.get("status") == "active":
            raise HTTPException(409, detail="You already have an active Pro subscription. Cancel it first to create a new one.")

    try:
        subscription = client.subscription.create({
            "plan_id": plan_id,
            "total_count": 12 if req.plan == "pro_monthly" else 1,
            "quantity": 1,
            "notes": {
                "plan_name": plan_info.get("name", req.plan),
                "user_id": user_id,
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


@router.post("/confirm-subscription")
async def confirm_subscription(request: Request, user: dict = Depends(verify_token)):
    """Called by frontend after successful Razorpay checkout. Confirms and records the subscription."""
    body = await request.json()
    sub_id = body.get("subscription_id")
    if not sub_id:
        raise HTTPException(400, detail="subscription_id required")

    client = _get_razorpay_client()
    if not client:
        raise HTTPException(503, detail="Razorpay not configured")

    # Fetch subscription details directly from Razorpay API
    try:
        sub = client.subscription.fetch(sub_id)
    except Exception as e:
        logger.error(f"Razorpay fetch subscription failed: {e}")
        raise HTTPException(502, detail=f"Failed to verify subscription: {e}")

    # Verify the subscription is active/authenticated/created
    rzp_status = sub.get("status", "")
    if rzp_status not in ("active", "authenticated", "created"):
        raise HTTPException(400, detail=f"Subscription status is '{rzp_status}', not active")

    user_id = user.get("sub", "")
    plan_id = sub.get("plan_id", "")
    billing = "annual" if plan_id == settings.RAZORPAY_PLAN_PRO_ANNUAL_ID else "monthly"

    # Write to Supabase — this is the primary record creation (not webhook)
    if user_id:
        result = await _upsert_subscription(
            user_id=user_id,
            plan="pro",
            status="active",
            razorpay_sub_id=sub_id,
            razorpay_plan_id=plan_id,
        )
        if result is None:
            logger.error("Failed to write subscription to Supabase for user %s (sub=%s)", user_id, sub_id)
            raise HTTPException(502, detail="Payment confirmed but failed to save subscription. Please contact support or try refreshing.")

    return {
        "plan": "pro",
        "status": "active",
        "billing": billing,
        "subscription_id": sub_id,
    }


@router.get("/subscription-status")
async def subscription_status(request: Request, user: dict = Depends(verify_token)):
    """Get current subscription info from Supabase subscriptions table."""
    user_id = user.get("sub", "")
    if not user_id:
        return {"plan": "free", "status": "active", "subscription_id": None, "expires_at": None}

    sub = await _get_user_plan(user_id)
    return sub


@router.post("/cancel")
async def cancel_subscription(req: CancelSubscriptionRequest, request: Request, user: dict = Depends(verify_token)):
    """Cancel a Razorpay subscription."""
    client = _get_razorpay_client()
    if not client:
        raise HTTPException(503, detail="Razorpay not configured.")

    # Verify user owns this subscription
    user_id = user.get("sub", "")
    if user_id:
        existing = await _get_user_plan(user_id)
        if existing.get("subscription_id") and existing["subscription_id"] != req.subscription_id:
            raise HTTPException(403, detail="This subscription does not belong to you.")

    try:
        result = client.subscription.cancel(req.subscription_id)

        # Update DB status
        user_id = user.get("sub", "")
        if user_id:
            await _upsert_subscription(user_id=user_id, plan="free", status="cancelled", razorpay_sub_id=req.subscription_id)

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
    entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    razorpay_sub_id = entity.get("id", "")
    user_id = _extract_user_from_notes(entity)

    logger.info("Razorpay webhook: %s (sub=%s, user=%s)", event, razorpay_sub_id, user_id or "unknown")

    # Update subscription state in Supabase
    if user_id:
        if event == "subscription.activated":
            await _upsert_subscription(
                user_id=user_id, plan="pro", status="active",
                razorpay_sub_id=razorpay_sub_id,
                period_start=entity.get("current_start") and datetime.fromtimestamp(entity["current_start"], tz=timezone.utc).isoformat(),
                period_end=entity.get("current_end") and datetime.fromtimestamp(entity["current_end"], tz=timezone.utc).isoformat(),
            )
            logger.info("Subscription activated for user %s", user_id)
        elif event == "subscription.charged":
            await _upsert_subscription(
                user_id=user_id, plan="pro", status="active",
                razorpay_sub_id=razorpay_sub_id,
                period_start=entity.get("current_start") and datetime.fromtimestamp(entity["current_start"], tz=timezone.utc).isoformat(),
                period_end=entity.get("current_end") and datetime.fromtimestamp(entity["current_end"], tz=timezone.utc).isoformat(),
            )
            logger.info("Subscription charged for user %s", user_id)
        elif event == "subscription.cancelled":
            await _upsert_subscription(user_id=user_id, plan="free", status="cancelled", razorpay_sub_id=razorpay_sub_id)
            logger.info("Subscription cancelled for user %s", user_id)
        elif event == "subscription.paused":
            await _upsert_subscription(user_id=user_id, plan="free", status="paused", razorpay_sub_id=razorpay_sub_id)
            logger.info("Subscription paused (downgraded to free) for user %s", user_id)
    elif event == "payment.failed":
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        logger.warning("Payment failed: %s", payment_entity.get("id"))

    return JSONResponse({"status": "ok"})
