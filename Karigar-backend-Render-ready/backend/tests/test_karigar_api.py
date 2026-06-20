"""Comprehensive backend API tests for Project Karigar (phone + password auth)."""
import os
import time
import uuid
import random
import hashlib
import pytest
import requests
from pathlib import Path
from pymongo import MongoClient
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mobile-craft-1101.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# A deterministic test admin seeded directly into the DB so tests never depend
# on the open first-admin signup (which the real operator may have already used).
ADMIN_PHONE = "9000000000"
ADMIN_PWD = "admintest123"

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash(pw: str) -> str:
    return _pwd.hash(hashlib.sha256(pw.encode()).hexdigest())


def _register(phone: str, password: str, role: str = "karigar"):
    return requests.post(f"{API}/auth/register", json={"phone": phone, "password": password, "role": role}, timeout=20)


def _login(phone: str, password: str):
    return requests.post(f"{API}/auth/login", json={"phone": phone, "password": password}, timeout=20)


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _rand_phone(prefix: str = "7") -> str:
    return f"{prefix}{random.randint(100000000, 999999999)}"


def _new_artisan() -> dict:
    phone = _rand_phone()
    pwd = "pass123"
    r = _register(phone, pwd, "karigar")
    assert r.status_code == 200, f"artisan register failed: {r.text}"
    body = r.json()
    return {"phone": phone, "password": pwd, "token": body["access_token"], "user": body["user"]}


@pytest.fixture(scope="session")
def admin_token() -> str:
    # Seed a known test admin straight into the DB (upsert) so tests are
    # independent of the one-time open admin signup and the real operator account.
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    db.users.update_one(
        {"phone": ADMIN_PHONE},
        {
            "$setOnInsert": {"id": uuid.uuid4().hex, "created_at": "2026-01-01T00:00:00+00:00"},
            "$set": {"phone": ADMIN_PHONE, "role": "admin", "password_hash": _hash(ADMIN_PWD)},
        },
        upsert=True,
    )
    r = _login(ADMIN_PHONE, ADMIN_PWD)
    assert r.status_code == 200, f"could not log in test admin: {r.text}"
    return r.json()["access_token"]


# ----------------- AUTH -----------------
class TestAuth:
    def test_register_invalid_phone(self):
        r = _register("123", "pass123", "karigar")
        assert r.status_code == 400

    def test_register_short_password(self):
        r = _register(_rand_phone(), "abc", "karigar")
        assert r.status_code == 400

    def test_register_artisan(self):
        a = _new_artisan()
        assert a["user"]["role"] == "karigar"
        assert a["user"]["has_profile"] is False
        assert "token" in a and a["token"]

    def test_register_duplicate(self):
        phone = _rand_phone()
        assert _register(phone, "pass123", "karigar").status_code == 200
        assert _register(phone, "pass123", "karigar").status_code == 400

    def test_login_success(self):
        phone = _rand_phone()
        _register(phone, "pass123", "karigar")
        r = _login(phone, "pass123")
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "karigar"

    def test_login_wrong_password(self):
        phone = _rand_phone()
        _register(phone, "pass123", "karigar")
        r = _login(phone, "wrongpass")
        assert r.status_code == 401

    def test_login_unknown_user(self):
        r = _login(_rand_phone(), "whatever")
        assert r.status_code == 401

    def test_admin_exists_endpoint(self, admin_token):
        r = requests.get(f"{API}/auth/admin/exists", timeout=10)
        assert r.status_code == 200
        assert r.json()["exists"] is True

    def test_second_admin_registration_blocked(self, admin_token):
        # An admin already exists (fixture); open admin registration must be closed.
        r = _register(_rand_phone("8"), "pass123", "admin")
        assert r.status_code == 403

    def test_auth_me(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_auth_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# ----------------- ADMIN INVITE -----------------
class TestAdminInvite:
    def test_admin_can_create_admin(self, admin_token):
        phone = _rand_phone("8")
        r = requests.post(f"{API}/auth/admin/create", json={"phone": phone, "password": "newadmin123"},
                          headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        # the new admin can log in and is an admin
        login = _login(phone, "newadmin123")
        assert login.status_code == 200
        assert login.json()["user"]["role"] == "admin"

    def test_artisan_cannot_create_admin(self):
        a = _new_artisan()
        r = requests.post(f"{API}/auth/admin/create", json={"phone": _rand_phone("8"), "password": "x123456"},
                          headers=_auth(a["token"]), timeout=10)
        assert r.status_code == 403

    def test_list_admins_requires_admin(self, admin_token):
        r = requests.get(f"{API}/auth/admins", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        admins = r.json()
        assert isinstance(admins, list) and len(admins) >= 1
        assert any(a["is_you"] for a in admins)


# ----------------- SKILLS -----------------
class TestSkills:
    def test_list_skills_seeded(self, admin_token):
        r = requests.get(f"{API}/skills", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        assert len(r.json()) >= 12

    def test_add_skill_artisan_forbidden(self):
        a = _new_artisan()
        r = requests.post(f"{API}/skills", json={"name": "TEST_ArtSkill"},
                          headers=_auth(a["token"]), timeout=10)
        assert r.status_code == 403

    def test_add_and_delete_skill(self, admin_token):
        skill_name = f"TEST_Skill_{random.randint(1000,9999)}"
        r = requests.post(f"{API}/skills", json={"name": skill_name},
                          headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        sid = r.json()["id"]
        d = requests.delete(f"{API}/skills/{sid}", headers=_auth(admin_token), timeout=10)
        assert d.status_code == 200


# ----------------- ARTISAN FLOW -----------------
class TestArtisanFlow:
    @pytest.fixture(scope="class")
    def artisan(self):
        return _new_artisan()

    def test_create_profile(self, artisan):
        payload = {
            "full_name": "TEST Artisan", "dob": "1990-01-01", "gender": "male",
            "languages": ["English", "Hindi"], "area": "Charminar", "city": "Hyderabad",
            "skills": ["Tailor"], "years_experience": 5, "wage_expectation": 8000,
            "previous_employer": "Old Factory Ltd",
            "aadhar_images": ["data:image/jpeg;base64,AAAA", "data:image/jpeg;base64,AAAB"],
            "employment_proof_type": "payslip",
            "employment_proof_images": ["data:image/jpeg;base64,BBBB"],
            "portfolio_images": ["data:image/jpeg;base64,CCCC"],
            "upi_id": "9876543210", "availability_status": "available_now",
        }
        r = requests.post(f"{API}/workers", json=payload, headers=_auth(artisan["token"]), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["full_name"] == "TEST Artisan"
        assert body["verification_status"] == "pending"
        assert body["referral_code"].startswith("KAR-")
        assert len(body["aadhar_images"]) == 2
        assert body["employment_proof_type"] == "payslip"
        assert len(body["portfolio_images"]) == 1
        assert body.get("history") == []
        artisan["referral_code"] = body["referral_code"]
        artisan["worker_id"] = body["id"]

    def test_get_my_profile(self, artisan):
        r = requests.get(f"{API}/workers/me", headers=_auth(artisan["token"]), timeout=10)
        assert r.status_code == 200
        assert r.json()["full_name"] == "TEST Artisan"

    def test_create_duplicate_profile(self, artisan):
        payload = {"full_name": "Dup", "dob": "1990-01-01", "gender": "male",
                   "languages": ["English"], "area": "X", "skills": ["Tailor"]}
        r = requests.post(f"{API}/workers", json=payload, headers=_auth(artisan["token"]), timeout=10)
        assert r.status_code == 400

    def test_update_resets_to_pending_and_snapshots(self, artisan):
        # First approve the worker so we can prove edit resets it to pending.
        import os as _os
        from pymongo import MongoClient as _MC
        _db = _MC(_os.environ["MONGO_URL"])[_os.environ["DB_NAME"]]
        _db.workers.update_one({"id": artisan["worker_id"]}, {"$set": {"verification_status": "approved"}})

        payload = {
            "full_name": "TEST Artisan Updated", "dob": "1990-01-01", "gender": "male",
            "languages": ["English"], "area": "Banjara Hills", "city": "Hyderabad",
            "skills": ["Tailor", "Cutting"], "years_experience": 6,
            "aadhar_images": ["data:image/jpeg;base64,AAAA"],
            "employment_proof_type": "payslip",
            "employment_proof_images": ["data:image/jpeg;base64,BBBB"],
            "portfolio_images": ["data:image/jpeg;base64,CCCC"],
            "previous_employer": "Old Factory Ltd",
        }
        r = requests.put(f"{API}/workers/me", json=payload, headers=_auth(artisan["token"]), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["area"] == "Banjara Hills"
        # Worker self-edit sends profile back for re-verification.
        assert body["verification_status"] == "pending"
        # Previous version archived with edited_by = worker.
        assert len(body["history"]) >= 1
        assert body["history"][-1]["edited_by"] == "worker"
        assert body["history"][-1]["verification_status"] == "approved"

    def test_availability(self, artisan):
        r = requests.patch(f"{API}/workers/me/availability",
                           json={"availability_status": "available_from", "available_from": "2030-01-15"},
                           headers=_auth(artisan["token"]), timeout=10)
        assert r.status_code == 200
        assert r.json()["available_from"] == "2030-01-15"

    def test_availability_from_requires_date(self, artisan):
        r = requests.patch(f"{API}/workers/me/availability",
                           json={"availability_status": "available_from"},
                           headers=_auth(artisan["token"]), timeout=10)
        assert r.status_code == 400

    def test_availability_invalid(self, artisan):
        r = requests.patch(f"{API}/workers/me/availability",
                           json={"availability_status": "blah"},
                           headers=_auth(artisan["token"]), timeout=10)
        assert r.status_code == 400


# ----------------- ROLE ENFORCEMENT -----------------
class TestRoleEnforcement:
    def test_karigar_blocked_from_admin(self):
        a = _new_artisan()
        endpoints = [
            ("GET", f"{API}/admin/metrics"),
            ("GET", f"{API}/admin/workers"),
            ("GET", f"{API}/admin/verification/queue"),
            ("GET", f"{API}/admin/export"),
            ("GET", f"{API}/admin/analytics"),
        ]
        for method, url in endpoints:
            r = requests.request(method, url, headers=_auth(a["token"]), timeout=10)
            assert r.status_code == 403, f"{url} expected 403 got {r.status_code}"


# ----------------- ADMIN -----------------
class TestAdmin:
    def test_metrics(self, admin_token):
        r = requests.get(f"{API}/admin/metrics", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        for k in ["total_workers", "verified_workers", "available_workers", "pending_verification"]:
            assert k in r.json()

    def test_search_workers(self, admin_token):
        r = requests.get(f"{API}/admin/workers", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        assert "items" in r.json() and "total" in r.json()

    def test_verification_queue(self, admin_token):
        r = requests.get(f"{API}/admin/verification/queue", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_register_worker(self, admin_token):
        mobile = f"66{random.randint(10000000, 99999999)}"
        payload = {
            "mobile": mobile, "full_name": "TEST Admin Reg",
            "dob": "1985-05-05", "gender": "female", "languages": ["English"],
            "area": "Old City", "city": "Hyderabad", "skills": ["Zardozi"],
            "years_experience": 3,
        }
        r = requests.post(f"{API}/admin/workers", json=payload, headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["referral_code"].startswith("KAR-")

    def test_export_csv(self, admin_token):
        r = requests.get(f"{API}/admin/export", headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200
        assert "Worker ID" in r.text


# ----------------- VERIFICATION + REFERRAL -----------------
class TestVerificationAndReferral:
    def test_reject_deletes_profile(self, admin_token):
        a = _new_artisan()
        payload = {"full_name": "TEST Reject", "dob": "1990-01-01", "gender": "male",
                   "languages": ["English"], "area": "X", "city": "Hyderabad", "skills": ["Tailor"]}
        w = requests.post(f"{API}/workers", json=payload, headers=_auth(a["token"]), timeout=10).json()
        r = requests.post(f"{API}/admin/workers/{w['id']}/reject",
                          json={"reason": "Incomplete info"}, headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json().get("deleted") is True
        # Profile is gone from the DB entirely.
        assert requests.get(f"{API}/admin/workers/{w['id']}", headers=_auth(admin_token), timeout=10).status_code == 404
        # The artisan login still works but has no profile, so they can re-register.
        me = requests.get(f"{API}/workers/me", headers=_auth(a["token"]), timeout=10)
        assert me.status_code == 404

    def test_admin_can_edit_profile(self, admin_token):
        a = _new_artisan()
        payload = {"full_name": "TEST Edit", "dob": "1990-01-01", "gender": "male",
                   "languages": ["English"], "area": "Charminar", "city": "Hyderabad",
                   "skills": ["Tailor"], "years_experience": 4, "wage_expectation": 9000}
        w = requests.post(f"{API}/workers", json=payload, headers=_auth(a["token"]), timeout=10).json()
        edit = dict(payload)
        edit.update({"full_name": "TEST Edited Name", "area": "Banjara Hills",
                     "wage_expectation": 15000, "skills": ["Tailor", "Cutting"]})
        r = requests.put(f"{API}/admin/workers/{w['id']}", json=edit, headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["full_name"] == "TEST Edited Name"
        assert body["area"] == "Banjara Hills"
        assert body["wage_expectation"] == 15000
        assert "Cutting" in body["skills"]
        # status remains pending (admin editing does not auto-verify)
        assert body["verification_status"] == "pending"
        # previous version archived, attributed to admin
        assert len(body["history"]) >= 1
        assert body["history"][-1]["edited_by"] == "admin"
        assert body["history"][-1]["full_name"] == "TEST Edit"

    def test_artisan_cannot_edit_via_admin_endpoint(self):
        a = _new_artisan()
        payload = {"full_name": "x", "dob": "1990-01-01", "gender": "male",
                   "languages": ["English"], "area": "X", "skills": ["Tailor"]}
        r = requests.put(f"{API}/admin/workers/some-id", json=payload, headers=_auth(a["token"]), timeout=10)
        assert r.status_code == 403

    def test_referral_payout_mock(self, admin_token):
        ref = _new_artisan()
        a_payload = {"full_name": "TEST Referrer", "dob": "1990-01-01", "gender": "male",
                     "languages": ["English"], "area": "Charminar", "city": "Hyderabad",
                     "skills": ["Tailor"], "upi_id": "referrer@upi"}
        a = requests.post(f"{API}/workers", json=a_payload, headers=_auth(ref["token"]), timeout=10).json()
        a_code = a["referral_code"]

        referred = _new_artisan()
        b_payload = {"full_name": "TEST Referred", "dob": "1992-02-02", "gender": "female",
                     "languages": ["English"], "area": "Old City", "city": "Hyderabad",
                     "skills": ["Tailor"], "referred_by_code": a_code, "upi_id": "b@upi"}
        b = requests.post(f"{API}/workers", json=b_payload, headers=_auth(referred["token"]), timeout=10).json()

        r = requests.post(f"{API}/admin/workers/{b['id']}/approve", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200

        time.sleep(0.5)
        notifs = requests.get(f"{API}/notifications", headers=_auth(ref["token"]), timeout=10).json()
        assert any(n.get("type") == "referral_reward" for n in notifs)
        refs = requests.get(f"{API}/referrals/me", headers=_auth(ref["token"]), timeout=10).json()
        assert refs["referred_count"] >= 1
        assert refs["total_paid_rs"] >= 50


# ----------------- NOTIFICATIONS -----------------
class TestNotifications:
    def test_get_notifications_admin(self, admin_token):
        r = requests.get(f"{API}/notifications", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200

    def test_mark_all_read(self, admin_token):
        r = requests.post(f"{API}/notifications/read-all", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200


# ----------------- ANALYTICS -----------------
class TestAnalytics:
    def test_analytics_requires_auth(self):
        r = requests.get(f"{API}/admin/analytics", timeout=10)
        assert r.status_code == 401

    def test_analytics_structure(self, admin_token):
        r = requests.get(f"{API}/admin/analytics", headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for key in ["kpis", "location_distribution", "skill_distribution",
                    "verification_funnel", "availability_distribution",
                    "experience_buckets", "gender_distribution", "registration_trend"]:
            assert key in d, f"missing {key}"
        assert len(d["registration_trend"]) == 14


# ----------------- MSG91 OTP HELPER (dormant) -----------------
class TestMSG91Helper:
    def test_to_mobile_10_digit(self):
        import msg91_client as m
        assert m.to_mobile("9876543210") == "919876543210"

    def test_to_mobile_with_plus_and_spaces(self):
        import msg91_client as m
        assert m.to_mobile("+91 98765 43210") == "919876543210"

    def test_is_configured_returns_bool(self):
        import msg91_client as m
        # MSG91 is dormant; configuration depends on env, so just assert type.
        assert isinstance(m.is_configured(), bool)
