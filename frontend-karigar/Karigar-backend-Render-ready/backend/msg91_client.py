"""MSG91 OTP (API v5) client.

Sends, verifies and resends OTP via MSG91. MSG91 itself generates, stores and
validates the code, so the app never persists OTPs. All credentials come from
environment variables.

Docs: https://docs.msg91.com/p/tf9GTextN/e/B-Ve5gQOh/MSG91
"""
import os
import logging

import httpx

logger = logging.getLogger("msg91")

MSG91_AUTH_KEY = os.environ.get("MSG91_AUTH_KEY", "")
MSG91_OTP_TEMPLATE_ID = os.environ.get("MSG91_OTP_TEMPLATE_ID", "")
MSG91_BASE_URL = os.environ.get("MSG91_BASE_URL", "https://control.msg91.com/api/v5")
MSG91_OTP_EXPIRY_MINUTES = int(os.environ.get("MSG91_OTP_EXPIRY_MINUTES", "10"))


class MSG91Error(Exception):
    """Raised when MSG91 returns a non-success response."""


def is_configured() -> bool:
    return bool(MSG91_AUTH_KEY)


def to_mobile(phone: str) -> str:
    """Normalise a phone number to MSG91 format: 91XXXXXXXXXX (no '+')."""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) == 10:
        return f"91{digits}"
    return digits


async def send_otp(phone: str) -> dict:
    mobile = to_mobile(phone)
    params = {
        "mobile": mobile,
        "otp_expiry": MSG91_OTP_EXPIRY_MINUTES,
    }
    # template_id is optional — when omitted MSG91 uses the account's default template.
    if MSG91_OTP_TEMPLATE_ID:
        params["template_id"] = MSG91_OTP_TEMPLATE_ID
    headers = {"authkey": MSG91_AUTH_KEY, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{MSG91_BASE_URL}/otp", params=params, headers=headers)
    data = _parse(resp)
    if data.get("type") != "success":
        raise MSG91Error(data.get("message") or "Failed to send OTP")
    return data


async def verify_otp(phone: str, otp: str) -> bool:
    mobile = to_mobile(phone)
    params = {"mobile": mobile, "otp": otp}
    headers = {"authkey": MSG91_AUTH_KEY}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{MSG91_BASE_URL}/otp/verify", params=params, headers=headers)
    data = _parse(resp)
    if data.get("type") == "success":
        return True
    # MSG91 returns type=error with a message like "OTP not match" / "OTP expired"
    raise MSG91Error(data.get("message") or "Invalid OTP")


async def resend_otp(phone: str, retrytype: str = "text") -> dict:
    mobile = to_mobile(phone)
    params = {"mobile": mobile, "retrytype": retrytype}
    headers = {"authkey": MSG91_AUTH_KEY}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{MSG91_BASE_URL}/otp/retry", params=params, headers=headers)
    data = _parse(resp)
    if data.get("type") != "success":
        raise MSG91Error(data.get("message") or "Failed to resend OTP")
    return data


def _parse(resp: httpx.Response) -> dict:
    try:
        data = resp.json()
    except Exception:
        logger.error("MSG91 non-JSON response (%s): %s", resp.status_code, resp.text[:200])
        raise MSG91Error("SMS provider error")
    if resp.status_code >= 400:
        logger.error("MSG91 HTTP %s: %s", resp.status_code, data)
    return data
