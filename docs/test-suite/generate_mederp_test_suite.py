"""
Generate MedERP_Test_Suite.xlsx — manual test workbook.
Run: python docs/test-suite/generate_mederp_test_suite.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from cases_ts02_08 import ts02_cases, ts03_cases, ts04_cases, ts05_cases, ts06_cases, ts07_cases, ts08_cases
from cases_ts09_13 import ts09_cases, ts10_cases, ts11_cases, ts12_cases, ts13_cases
from cases_ts14_20 import ts14_cases, ts15_cases, ts16_cases, ts17_cases, ts18_cases, ts19_cases, ts20_cases

OUT = HERE / "MedERP_Test_Suite.xlsx"
OUT_FALLBACK = HERE / "MedERP_Test_Suite_updated.xlsx"

HEADERS = [
    "Case ID",
    "Sub-Module",
    "Title",
    "Priority",
    "Type",
    "Precondition",
    "Role",
    "Test Data",
    "Steps",
    "Expected Result",
    "Actual Result",
    "Status",
    "Executed By",
    "Date",
    "API / Route",
    "Defect ID",
]

SUITES = [
    ("TS-01", "Hospital Registration", "Self-registration, free trial, Razorpay paid signup, hospital code, T&C", 22, "P0"),
    ("TS-02", "Authentication & Session", "Login, OTP, forgot/reset password, logout, rate limits, session", 30, "P0"),
    ("TS-03", "Staff Signup & Join Request", "Signup → OTP → login → join → approve/reject/cancel", 18, "P0"),
    ("TS-04", "Subscription & Tiers", "Tiers, seats, module gating, trial expiry, tier change, webhooks", 20, "P0"),
    ("TS-05", "Platform Admin Console", "Hospital CRUD, stop access, platform users, invoices, billing settings", 24, "P1"),
    ("TS-06", "Hospital User Management", "Create/edit staff, codes, seats, deactivate, signatures, merge", 34, "P0"),
    ("TS-07", "Hospital Settings", "Branding, OPD fee, signature & walk-in policy, admin-as-doctor, view-mode", 18, "P1"),
    ("TS-08", "Staff Leave", "Apply/approve/reject/cancel, overlap, doctor availability impact", 20, "P1"),
    ("TS-09", "Patient Management", "Register, UHID, duplicates, family, merge, search, edit permissions", 38, "P0"),
    ("TS-10", "Appointments & Queue", "Booking, walk-in, token, status machine, reschedule, no-show, remind", 42, "P0"),
    ("TS-11", "Vitals & Nurse Station", "Vital fields, ranges, BMI, fever flag, same-day lock", 26, "P0"),
    ("TS-12", "Doctor Visit & Assessment", "Draft/approve, signature gate, Rx, medicine suggest, summary PDF/send", 32, "P0"),
    ("TS-13", "Medical Certificates", "Sick leave / fitness / general, issue, void ownership, send", 20, "P1"),
    ("TS-14", "Invoices & OPD Collection", "Invoice numbering, line math, OPD collect, card brand", 28, "P0"),
    ("TS-15", "Discounts, Waivers, Advances, Refunds", "Discount caps, waiver flow, advance apply, refunds", 30, "P0"),
    ("TS-16", "Billing Reports & Receipts", "Daily collections, monthly report, CSV, outstanding, WhatsApp receipt", 22, "P1"),
    ("TS-17", "Helpdesk", "Ticket lifecycle, escalation, SLA, visibility, support actions", 26, "P1"),
    ("TS-18", "Board & Notifications", "Post/reply/pin/delete, in-app notifications, templates", 18, "P2"),
    ("TS-19", "Audit Log", "Audited actions, record shape, redaction, viewer access", 14, "P2"),
    ("TS-20", "RBAC & Tenant Isolation", "Role × module negative matrix, cross-hospital access attempts", 30, "P0"),
]

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
THIN = Border(
    left=Side(style="thin", color="D0D5DD"),
    right=Side(style="thin", color="D0D5DD"),
    top=Side(style="thin", color="D0D5DD"),
    bottom=Side(style="thin", color="D0D5DD"),
)
HEADER_FILL = PatternFill("solid", fgColor="1F4E79")
HEADER_FONT = Font(bold=True, color="FFFFFF", name="Calibri", size=11)
TITLE_FONT = Font(bold=True, name="Calibri", size=16, color="1F4E79")
SECTION_FONT = Font(bold=True, name="Calibri", size=12, color="1F4E79")
P0_FILL = PatternFill("solid", fgColor="FCE4D6")
P1_FILL = PatternFill("solid", fgColor="FFF2CC")
P2_FILL = PatternFill("solid", fgColor="E2EFDA")
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(wrap_text=True, vertical="center", horizontal="center")


def style_header(ws, row=1):
    for col, _ in enumerate(HEADERS, 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = CENTER
        cell.border = THIN


def set_col_widths(ws, widths):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


def add_status_validation(ws, start_row=2, end_row=500):
    dv = DataValidation(
        type="list",
        formula1='"Not Run,Pass,Fail,Blocked,Skip"',
        allow_blank=True,
    )
    dv.error = "Pick a status"
    dv.errorTitle = "Invalid Status"
    ws.add_data_validation(dv)
    dv.add(f"L{start_row}:L{end_row}")


def write_case_rows(ws, cases, start_row=2):
    for i, case in enumerate(cases):
        r = start_row + i
        for c, key in enumerate(
            [
                "id",
                "sub",
                "title",
                "priority",
                "type",
                "pre",
                "role",
                "data",
                "steps",
                "expected",
                "actual",
                "status",
                "by",
                "date",
                "route",
                "defect",
            ],
            1,
        ):
            val = case.get(key, "")
            cell = ws.cell(row=r, column=c, value=val)
            cell.alignment = WRAP
            cell.border = THIN
            if key == "priority":
                if val == "P0":
                    cell.fill = P0_FILL
                elif val == "P1":
                    cell.fill = P1_FILL
                elif val == "P2":
                    cell.fill = P2_FILL
        ws.row_dimensions[r].height = max(60, 18 * (1 + str(case.get("steps", "")).count("\n")))


# ---------------------------------------------------------------------------
# TS-01 cases
# ---------------------------------------------------------------------------
def ts01_cases():
    # Shared happy-path data referenced across cases
    base = (
        "Hospital Name: Apex Care Clinic\n"
        "Address: 12 MG Road, Bengaluru 560001\n"
        "Hospital Mobile: 9876500001\n"
        "Admin Username: apexadmin\n"
        "Admin Mobile: 9876500002\n"
        "Admin Email: admin@apexcare.test\n"
        "Admin Password: ApexAdmin@1\n"
        "Tier: CLINIC\n"
        "Terms: Accepted"
    )
    return [
        {
            "id": "TS-01-001",
            "sub": "Page Load",
            "title": "Register Hospital page loads for anonymous user",
            "priority": "P0",
            "type": "Positive",
            "pre": "Browser logged out. App reachable.",
            "role": "Anonymous",
            "data": "URL: /register-hospital",
            "steps": (
                "1. Open /register-hospital in a private/incognito window.\n"
                "2. Wait for package/tiers to load."
            ),
            "expected": (
                "Page renders without redirect to /login.\n"
                "Hospital name, phone, admin fields, tier selector, Terms checkbox, "
                "Start free trial and Pay & register buttons are visible.\n"
                "GET /api/public/package returns companyName + tiers[] + razorpayEnabled."
            ),
            "status": "Not Run",
            "route": "GET /register-hospital\nGET /api/public/package",
        },
        {
            "id": "TS-01-002",
            "sub": "Public Package",
            "title": "Package API returns three OPD subscription plans with correct prices",
            "priority": "P0",
            "type": "Positive",
            "pre": "App running.",
            "role": "Anonymous",
            "data": "—",
            "steps": "1. Open Network tab.\n2. Load /register-hospital.\n3. Inspect GET /api/public/package response.",
            "expected": (
                "tiers contain exactly 3 plans:\n"
                "CLINIC (Plan 1) ₹1999 — 3 seats (1 doctor, 1 nurse, 1 receptionist);\n"
                "STARTER (Plan 2) ₹3500 — 6 seats (2 doctors, 3 nurses, 1 receptionist);\n"
                "GROWTH (Plan 3) ₹4999 — 9 seats (3 doctors, 5 nurses, 1 receptionist).\n"
                "No pharmacy / lab / wards / inventory flags or feature bullets.\n"
                "Default selected tier in UI is CLINIC (Plan 1)."
            ),
            "status": "Not Run",
            "route": "GET /api/public/package",
        },
        {
            "id": "TS-01-003",
            "sub": "Hospital Code",
            "title": "Hospital code auto-generates as 8-char uppercase alphanumeric from name",
            "priority": "P0",
            "type": "Positive",
            "pre": "On /register-hospital with empty draft.",
            "role": "Anonymous",
            "data": "Hospital Name: Apex Care Clinic",
            "steps": (
                "1. Type 'Apex Care Clinic' in Hospital Name.\n"
                "2. Tab/blur out of the field.\n"
                "3. Observe Hospital Code field and Network call."
            ),
            "expected": (
                "GET /api/public/hospital-code?name=Apex%20Care%20Clinic returns "
                '{"code":"<8 chars A-Z0-9>"}.\n'
                "Code field fills with that value (typically based on name slug, e.g. APEXCARE).\n"
                "Code is uppercase alphanumeric length exactly 8."
            ),
            "status": "Not Run",
            "route": "GET /api/public/hospital-code",
        },
        {
            "id": "TS-01-004",
            "sub": "Hospital Code",
            "title": "Hospital code stays empty when name shorter than 2 characters",
            "priority": "P2",
            "type": "Boundary",
            "pre": "On /register-hospital.",
            "role": "Anonymous",
            "data": "Hospital Name: A",
            "steps": "1. Clear Hospital Name.\n2. Type single letter 'A'.\n3. Blur field.",
            "expected": (
                "API returns {\"code\":\"\"} or code field remains blank / not a final code.\n"
                "No hospital is created."
            ),
            "status": "Not Run",
            "route": "GET /api/public/hospital-code",
        },
        {
            "id": "TS-01-005",
            "sub": "Validation",
            "title": "Submit blocked when Hospital Name is empty",
            "priority": "P0",
            "type": "Negative",
            "pre": "On /register-hospital. Fill all other required fields except name.",
            "role": "Anonymous",
            "data": (
                "Name: (blank)\n"
                "Hospital Mobile: 9876500101\n"
                "Admin Username: emptynameadm\n"
                "Admin Mobile: 9876500102\n"
                "Admin Email: empty@test.com\n"
                "Admin Password: Password1\n"
                "Tier: CLINIC\nTerms: Accepted"
            ),
            "steps": "1. Leave Hospital Name blank.\n2. Accept Terms.\n3. Click Start free trial.",
            "expected": (
                "Request fails with 400.\n"
                "Error message includes 'Hospital name is required.'\n"
                "No hospital / user / invoice created."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-006",
            "sub": "Validation",
            "title": "Invalid hospital mobile rejected (not Indian 10-digit starting 6–9)",
            "priority": "P0",
            "type": "Negative",
            "pre": "On /register-hospital.",
            "role": "Anonymous",
            "data": (
                "Name: Mobile Fail Clinic\n"
                "Hospital Mobile: 12345\n"
                "Admin Username: mobfailadm\n"
                "Admin Mobile: 9876500202\n"
                "Admin Email: mobfail@test.com\n"
                "Admin Password: Password1\n"
                "Tier: CLINIC\nTerms: Accepted"
            ),
            "steps": "1. Enter hospital mobile 12345.\n2. Fill remaining valid fields.\n3. Click Start free trial.",
            "expected": (
                "Client and/or server reject with hospital mobile validation error "
                "(valid = 10 digits, starts with 6–9).\n"
                "No hospital created."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-007",
            "sub": "Validation",
            "title": "Admin username shorter than 3 characters rejected",
            "priority": "P1",
            "type": "Boundary",
            "pre": "On /register-hospital.",
            "role": "Anonymous",
            "data": (
                "Name: Short User Clinic\n"
                "Hospital Mobile: 9876500301\n"
                "Admin Username: ab\n"
                "Admin Mobile: 9876500302\n"
                "Admin Email: short@test.com\n"
                "Admin Password: Password1\n"
                "Tier: CLINIC\nTerms: Accepted"
            ),
            "steps": "1. Enter admin username 'ab'.\n2. Accept Terms.\n3. Click Start free trial.",
            "expected": (
                "400 with message: Super admin username must be at least 3 letters, "
                "numbers, dots, or underscores.\n"
                "No hospital created."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-008",
            "sub": "Validation",
            "title": "Admin username with special characters rejected",
            "priority": "P1",
            "type": "Negative",
            "pre": "On /register-hospital.",
            "role": "Anonymous",
            "data": (
                "Name: Bad User Clinic\n"
                "Hospital Mobile: 9876500401\n"
                "Admin Username: apex@admin!\n"
                "Admin Mobile: 9876500402\n"
                "Admin Email: baduser@test.com\n"
                "Admin Password: Password1\n"
                "Tier: CLINIC\nTerms: Accepted"
            ),
            "steps": "1. Enter username apex@admin!.\n2. Submit Start free trial.",
            "expected": (
                "400 — username may only contain letters, numbers, dots, or underscores.\n"
                "No hospital created."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-009",
            "sub": "Validation",
            "title": "Admin password shorter than 8 characters rejected",
            "priority": "P0",
            "type": "Boundary",
            "pre": "On /register-hospital.",
            "role": "Anonymous",
            "data": (
                "Name: Short Pass Clinic\n"
                "Hospital Mobile: 9876500501\n"
                "Admin Username: shortpassadm\n"
                "Admin Mobile: 9876500502\n"
                "Admin Email: shortpass@test.com\n"
                "Admin Password: Pass1\n"
                "Tier: CLINIC\nTerms: Accepted"
            ),
            "steps": "1. Enter password Pass1 (5 chars).\n2. Submit Start free trial.",
            "expected": (
                "400 — password must be at least 8 characters "
                "(MIN_PASSWORD_LENGTH = 8).\n"
                "No hospital created."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-010",
            "sub": "Validation",
            "title": "Invalid admin email rejected",
            "priority": "P1",
            "type": "Negative",
            "pre": "On /register-hospital.",
            "role": "Anonymous",
            "data": (
                "Name: Bad Email Clinic\n"
                "Hospital Mobile: 9876500601\n"
                "Admin Username: bademailadm\n"
                "Admin Mobile: 9876500602\n"
                "Admin Email: not-an-email\n"
                "Admin Password: Password1\n"
                "Tier: CLINIC\nTerms: Accepted"
            ),
            "steps": "1. Enter Admin Email as 'not-an-email'.\n2. Submit Start free trial.",
            "expected": "400 — valid email required (must match local@domain form).\nNo hospital created.",
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-011",
            "sub": "Terms & Conditions",
            "title": "Registration blocked when Terms are not accepted",
            "priority": "P0",
            "type": "Negative",
            "pre": "On /register-hospital with all fields valid.",
            "role": "Anonymous",
            "data": base.replace("Terms: Accepted", "Terms: NOT accepted"),
            "steps": (
                "1. Fill all required fields with valid data.\n"
                "2. Leave Terms checkbox unchecked.\n"
                "3. Click Start free trial."
            ),
            "expected": (
                "Client blocks submit and/or server returns 400 requiring termsAccepted=true.\n"
                "No hospital created."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-012",
            "sub": "Free Trial",
            "title": "Happy path — Start free trial creates hospital, SUPER_ADMIN, ISSUED invoice, session",
            "priority": "P0",
            "type": "Positive",
            "pre": (
                "Mobiles 9876500001 / 9876500002 and username apexadmin are unused.\n"
                "OTP_DUMMY may be anything (trial admin is pre-verified)."
            ),
            "role": "Anonymous → SUPER_ADMIN",
            "data": base,
            "steps": (
                "1. Open /register-hospital.\n"
                "2. Enter all Test Data fields.\n"
                "3. Confirm Hospital Code auto-filled (8 chars).\n"
                "4. Select tier CLINIC.\n"
                "5. Tick Terms.\n"
                "6. Click Start free trial.\n"
                "7. Observe redirect and session cookie."
            ),
            "expected": (
                "POST /api/public/register-hospital/trial returns 200:\n"
                "  ok=true, trial=true, hospital{id,name,code}, invoice{invoiceNo,status:ISSUED}, redirectTo='/'\n"
                "Cookie mederp_session is set (httpOnly, SameSite=strict).\n"
                "Browser lands on home (or hospital dashboard) as SUPER_ADMIN.\n"
                "Hospital.trialEndsAt ≈ now + 1 month.\n"
                "Platform invoice status = ISSUED (not PAID) for trial.\n"
                "Invoice number format: {prefix}-INV-NNNNN (default MEDERP-INV-0000N).\n"
                "Departments seeded for the hospital.\n"
                "Draft in localStorage (mederp.registerHospital.v3) is cleared."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-013",
            "sub": "Free Trial",
            "title": "Trial hospital admin can log in later with same mobile/password",
            "priority": "P0",
            "type": "Positive",
            "pre": "TS-01-012 passed. Log out.",
            "role": "SUPER_ADMIN",
            "data": "Mobile: 9876500002\nPassword: ApexAdmin@1",
            "steps": (
                "1. Go to /login.\n"
                "2. Enter admin mobile and password from TS-01-012.\n"
                "3. Submit."
            ),
            "expected": (
                "200 ok. Session created. Role SUPER_ADMIN.\n"
                "Redirect to /. isVerified=true (pre-verified at registration).\n"
                "No OTP challenge."
            ),
            "status": "Not Run",
            "route": "POST /api/auth/login",
        },
        {
            "id": "TS-01-014",
            "sub": "Uniqueness",
            "title": "Duplicate hospital phone rejected (409)",
            "priority": "P0",
            "type": "Negative",
            "pre": "TS-01-012 hospital exists with phone 9876500001.",
            "role": "Anonymous",
            "data": (
                "Name: Second Apex Clinic\n"
                "Hospital Mobile: 9876500001  (same as existing)\n"
                "Admin Username: secondapex\n"
                "Admin Mobile: 9876500702\n"
                "Admin Email: second@test.com\n"
                "Admin Password: Password1\n"
                "Tier: CLINIC\nTerms: Accepted"
            ),
            "steps": "1. Fill form with duplicate hospital mobile.\n2. Click Start free trial.",
            "expected": "409 — hospital phone already registered / in use.\nNo second hospital created.",
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-015",
            "sub": "Uniqueness",
            "title": "Duplicate admin username rejected (409)",
            "priority": "P0",
            "type": "Negative",
            "pre": "TS-01-012 created username apexadmin.",
            "role": "Anonymous",
            "data": (
                "Name: Dup User Clinic\n"
                "Hospital Mobile: 9876500801\n"
                "Admin Username: apexadmin  (existing)\n"
                "Admin Mobile: 9876500802\n"
                "Admin Email: dupuser@test.com\n"
                "Admin Password: Password1\n"
                "Tier: CLINIC\nTerms: Accepted"
            ),
            "steps": "1. Fill form with existing admin username.\n2. Click Start free trial.",
            "expected": "409 — Super admin username is already in use.\nNo hospital created.",
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-016",
            "sub": "Uniqueness",
            "title": "Duplicate admin mobile rejected (409)",
            "priority": "P0",
            "type": "Negative",
            "pre": "TS-01-012 created admin mobile 9876500002.",
            "role": "Anonymous",
            "data": (
                "Name: Dup Mobile Clinic\n"
                "Hospital Mobile: 9876500901\n"
                "Admin Username: dupmobadm\n"
                "Admin Mobile: 9876500002  (existing)\n"
                "Admin Email: dupmob@test.com\n"
                "Admin Password: Password1\n"
                "Tier: CLINIC\nTerms: Accepted"
            ),
            "steps": "1. Fill form with existing admin mobile.\n2. Click Start free trial.",
            "expected": "409 — Super admin mobile is already registered.\nNo hospital created.",
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-017",
            "sub": "Admin as Doctor",
            "title": "Admin-as-doctor blocked when specialization or medicalRegNo missing",
            "priority": "P1",
            "type": "Negative",
            "pre": "On /register-hospital.",
            "role": "Anonymous",
            "data": (
                "Name: Doctor Gate Clinic\n"
                "Hospital Mobile: 9876501001\n"
                "Admin Username: docgateadm\n"
                "Admin Mobile: 9876501002\n"
                "Admin Email: docgate@test.com\n"
                "Admin Password: Password1\n"
                "Tier: CLINIC\nTerms: Accepted\n"
                "Admin as Doctor: ON\n"
                "Specialization: (blank)\n"
                "Medical Reg No: (blank)"
            ),
            "steps": (
                "1. Fill hospital + admin fields.\n"
                "2. Enable Admin as Doctor.\n"
                "3. Leave specialization and medicalRegNo blank.\n"
                "4. Click Start free trial."
            ),
            "expected": (
                "400 — specialization and medical registration number are required "
                "when admin-as-doctor is enabled.\n"
                "No hospital created."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-018",
            "sub": "Admin as Doctor",
            "title": "Admin-as-doctor creates linked DOCTOR Staff profile on trial register",
            "priority": "P0",
            "type": "Positive",
            "pre": "Mobiles/username unused.",
            "role": "Anonymous → SUPER_ADMIN (doctor mode)",
            "data": (
                "Name: Admin Doctor Clinic\n"
                "Hospital Mobile: 9876501101\n"
                "Admin Username: admindoctor\n"
                "Admin Mobile: 9876501102\n"
                "Admin Email: admindoctor@test.com\n"
                "Admin Password: Password1\n"
                "Tier: CLINIC\nTerms: Accepted\n"
                "Admin as Doctor: ON\n"
                "First Name: Priya\nLast Name: Nair\n"
                "Specialization: General Medicine\n"
                "Medical Reg No: KMC-12345\n"
                "Consultation Fee: 600\nFollow-up Fee: 300"
            ),
            "steps": (
                "1. Fill all fields including doctor professional fields.\n"
                "2. Start free trial.\n"
                "3. After login, open Hospital Settings / view-mode and Staff directory."
            ),
            "expected": (
                "Registration succeeds.\n"
                "AppUser role = SUPER_ADMIN with linked Staff role = DOCTOR.\n"
                "Staff has specialization General Medicine, medicalRegNo KMC-12345, "
                "consultationFee 600, followUpFee 300.\n"
                "Audit includes ADMIN_DOCTOR_ENABLED (or equivalent during registration).\n"
                "View-mode toggle admin|doctor becomes available."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
        {
            "id": "TS-01-019",
            "sub": "Paid Registration",
            "title": "Pay & register — create Razorpay order/subscription checkout params",
            "priority": "P0",
            "type": "Positive",
            "pre": (
                "Razorpay test keys configured (RAZORPAY_KEY_ID / SECRET).\n"
                "razorpayEnabled=true from /api/public/package.\n"
                "Unused mobiles/username."
            ),
            "role": "Anonymous",
            "data": (
                "Name: Paid Care Clinic\n"
                "Hospital Mobile: 9876501201\n"
                "Admin Username: paidcareadm\n"
                "Admin Mobile: 9876501202\n"
                "Admin Email: paid@test.com\n"
                "Admin Password: Password1\n"
                "Tier: STARTER (₹3500)\nTerms: Accepted"
            ),
            "steps": (
                "1. Fill form, select STARTER (Plan 2).\n"
                "2. Accept Terms.\n"
                "3. Click Pay & register.\n"
                "4. Inspect POST /api/public/register-hospital/order response before checkout UI."
            ),
            "expected": (
                "200 with mode=subscription (preferred) OR mode=order (fallback).\n"
                "amount = 350000 paise (₹3500) for STARTER.\n"
                "currency=INR, keyId present, quote.total=3500.\n"
                "prefill contains admin name/contact/email.\n"
                "Razorpay Checkout script loads.\n"
                "If subscriptions unavailable: mode=order with notice string."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/order",
        },
        {
            "id": "TS-01-020",
            "sub": "Paid Registration",
            "title": "Pay & register — successful payment finalizes hospital with PAID invoice",
            "priority": "P0",
            "type": "Positive",
            "pre": "TS-01-019 checkout opened. Use Razorpay test card success path.",
            "role": "Anonymous → SUPER_ADMIN",
            "data": (
                "Razorpay test card (as per Razorpay docs for test mode).\n"
                "Continue from TS-01-019 form data."
            ),
            "steps": (
                "1. Complete Razorpay Checkout successfully.\n"
                "2. Observe POST /api/public/register-hospital finalize call.\n"
                "3. Confirm redirect and login state."
            ),
            "expected": (
                "Finalize returns 200 ok.\n"
                "Hospital created; SUPER_ADMIN session set.\n"
                "Platform invoice status = PAID (not ISSUED).\n"
                "If subscription mode: HospitalSubscription linked ACTIVE/AUTHENTICATED "
                "with plan matching STARTER.\n"
                "trialEndsAt may be unset or not blocking because paid subscription is active.\n"
                "Redirect to /."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital",
        },
        {
            "id": "TS-01-021",
            "sub": "Paid Registration",
            "title": "Paid finalize rejects amount mismatch / invalid signature",
            "priority": "P0",
            "type": "Security",
            "pre": "Ability to call API directly (Postman/curl) with forged payment ids.",
            "role": "Anonymous",
            "data": (
                "Valid registration body for a unused hospital.\n"
                "razorpay_payment_id / signature that do not match HMAC or amount ≠ tier fee."
            ),
            "steps": (
                "1. POST /api/public/register-hospital with valid hospital fields "
                "but invalid razorpay_signature OR wrong amount tier.\n"
                "2. Observe response."
            ),
            "expected": (
                "400 — payment verification failed / amount mismatch.\n"
                "No hospital, no user, no invoice created.\n"
                "No session cookie set."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital",
        },
        {
            "id": "TS-01-022",
            "sub": "Paid Registration",
            "title": "Pay & register returns 503 when Razorpay is not configured",
            "priority": "P1",
            "type": "Negative",
            "pre": (
                "Environment where Razorpay keys are missing OR package.razorpayEnabled=false.\n"
                "(Use staging without keys, or confirm UI hides/disables Pay path.)"
            ),
            "role": "Anonymous",
            "data": "Any valid registration payload; try Pay & register / order API.",
            "steps": (
                "1. Confirm package shows razorpayEnabled=false OR keys unset.\n"
                "2. Attempt Pay & register / POST order."
            ),
            "expected": (
                "UI disables Pay path and/or order API returns 503.\n"
                "Start free trial remains available.\n"
                "No partial hospital record."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/order",
        },
        {
            "id": "TS-01-023",
            "sub": "Draft Persistence",
            "title": "Form draft saved to localStorage and restored on reload",
            "priority": "P2",
            "type": "Positive",
            "pre": "Fresh /register-hospital. Clear site data first.",
            "role": "Anonymous",
            "data": (
                "Name: Draft Save Clinic\n"
                "Admin Username: draftsaveadm\n"
                "Partial fill only — do not submit."
            ),
            "steps": (
                "1. Type hospital name and admin username.\n"
                "2. Reload the page.\n"
                "3. Inspect localStorage key mederp.registerHospital.v3."
            ),
            "expected": (
                "Draft restored into form fields.\n"
                "localStorage key mederp.registerHospital.v3 holds JSON with name/username.\n"
                "After successful registration (any later case), draft is cleared."
            ),
            "status": "Not Run",
            "route": "Client: register-hospital-draft.ts",
        },
        {
            "id": "TS-01-024",
            "sub": "Tier Selection",
            "title": "Register page shows only 3 OPD plans — no pharmacy/lab/wards/inventory",
            "priority": "P0",
            "type": "Positive",
            "pre": "On /register-hospital.",
            "role": "Anonymous",
            "data": "Toggle Plan 1 → Plan 2 → Plan 3.",
            "steps": (
                "1. Select CLINIC (Plan 1) — fee ₹1999, 3 seats, role mix 1/1/1.\n"
                "2. Select STARTER (Plan 2) — fee ₹3500, 6 seats, role mix 2/3/1.\n"
                "3. Select GROWTH (Plan 3) — fee ₹4999, 9 seats, role mix 3/5/1.\n"
                "4. Scan feature lists and page copy for pharmacy, lab, wards, inventory."
            ),
            "expected": (
                "Exactly three plan cards.\n"
                "Prices and seat suggestions match subscription-tiers.ts.\n"
                "No pharmacy / lab / wards / inventory options, badges, or feature bullets."
            ),
            "status": "Not Run",
            "route": "GET /api/public/package (UI)",
        },
        {
            "id": "TS-01-025",
            "sub": "Mobile Normalize",
            "title": "Hospital/admin mobile with +91 / leading 0 is normalized to 10 digits",
            "priority": "P1",
            "type": "Boundary",
            "pre": "Unused numbers.",
            "role": "Anonymous",
            "data": (
                "Name: Normalize Mobile Clinic\n"
                "Hospital Mobile: 09876501301  (leading 0)\n"
                "Admin Username: normmobadm\n"
                "Admin Mobile: 919876501302  (91 prefix)\n"
                "Admin Email: norm@test.com\n"
                "Admin Password: Password1\n"
                "Tier: CLINIC\nTerms: Accepted"
            ),
            "steps": "1. Enter mobiles with 0 / 91 prefixes.\n2. Start free trial.",
            "expected": (
                "Registration succeeds.\n"
                "Stored hospital.phone = 9876501301 and admin.mobile = 9876501302 "
                "(10 digits, no prefix).\n"
                "Subsequent login uses 10-digit admin mobile."
            ),
            "status": "Not Run",
            "route": "POST /api/public/register-hospital/trial",
        },
    ]


# ---------------------------------------------------------------------------
# Sheets
# ---------------------------------------------------------------------------
def build_index(wb: Workbook):
    ws = wb.active
    ws.title = "00_Index"
    ws["A1"] = "MedERP — Manual Test Suite Index"
    ws["A1"].font = TITLE_FONT
    ws.merge_cells("A1:H1")
    ws["A2"] = (
        "Scope: All modules EXCEPT Lab, Pharmacy, Wards/IPD. "
        "One suite = one script. Fill Status column while executing. "
        "Run TS-01 → TS-03 before other hospital suites (fixture dependency)."
    )
    ws["A2"].alignment = WRAP
    ws.merge_cells("A2:H2")
    ws.row_dimensions[2].height = 45

    headers = [
        "Suite ID",
        "Module",
        "Coverage Summary",
        "Est. Cases",
        "Priority",
        "Sheet Status",
        "Pass",
        "Fail",
        "Blocked",
        "Not Run",
        "Execution Order",
        "Notes",
    ]
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=4, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = CENTER
        cell.border = THIN

    case_counts = {sid: len(fn()) for sid, fn in SUITE_CASES.items()}
    for i, (sid, name, summary, _est, pri) in enumerate(SUITES):
        r = 5 + i
        n = case_counts.get(sid, 0)
        row = [
            sid,
            name,
            summary,
            n,
            pri,
            "Ready" if n else "Pending",
            "",
            "",
            "",
            "",
            i + 1,
            f"{n} cases written" if n else "Empty",
        ]
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = THIN
            cell.alignment = WRAP
            if c == 5:
                if pri == "P0":
                    cell.fill = P0_FILL
                elif pri == "P1":
                    cell.fill = P1_FILL
                else:
                    cell.fill = P2_FILL

    # Legend
    r = 27
    ws.cell(row=r, column=1, value="Legend / Conventions").font = SECTION_FONT
    ws.cell(row=r + 1, column=1, value=(
        "P0 = blocker / must-pass before release. P1 = important. P2 = polish.\n"
        "Type: Positive | Negative | Boundary | RBAC | Security.\n"
        "Status values: Not Run | Pass | Fail | Blocked | Skip.\n"
        "OTP in non-prod when OTP_DUMMY≠0: 123456.\n"
        "Demo seed password (if using seed-demo-data): Demo@123. Software admin: 9999999999 / Software@123.\n"
        "Out of scope for this workbook: Lab, Pharmacy, Wards/IPD."
    ))
    ws.merge_cells(start_row=r + 1, start_column=1, end_row=r + 1, end_column=8)
    ws[f"A{r+1}"].alignment = WRAP
    ws.row_dimensions[r + 1].height = 90

    set_col_widths(ws, [10, 28, 55, 12, 10, 22, 8, 8, 10, 10, 14, 40])


def build_testdata(wb: Workbook):
    ws = wb.create_sheet("01_TestData_Master")
    ws["A1"] = "Master Test Data (use across suites — update Actual values after TS-01/TS-06 create fixtures)"
    ws["A1"].font = TITLE_FONT
    ws.merge_cells("A1:F1")

    # Hospitals
    ws["A3"] = "Hospitals"
    ws["A3"].font = SECTION_FONT
    h_headers = ["Key", "Name", "Code (actual)", "Phone", "Tier", "Notes"]
    for c, h in enumerate(h_headers, 1):
        cell = ws.cell(row=4, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.border = THIN
    hospitals = [
        ("H1", "Apex Care Clinic", "(from TS-01-012)", "9876500001", "CLINIC", "Primary fixture hospital (trial)"),
        ("H2", "Admin Doctor Clinic", "(from TS-01-018)", "9876501101", "CLINIC", "Admin-as-doctor fixture"),
        ("H3", "Paid Care Clinic", "(from TS-01-020)", "9876501201", "STARTER", "Paid registration fixture (if Razorpay available)"),
        ("H4", "Tenant B Clinic", "TENANTB1", "9876502001", "CLINIC", "Second tenant for isolation (TS-20) — create via trial or platform"),
    ]
    for i, row in enumerate(hospitals):
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=5 + i, column=c, value=v)
            cell.border = THIN
            cell.alignment = WRAP

    # Users
    ws["A10"] = "Users (per hospital unless Platform)"
    ws["A10"].font = SECTION_FONT
    u_headers = ["Key", "Hospital", "Role", "Username", "Mobile", "Password", "Email", "Notes"]
    for c, h in enumerate(u_headers, 1):
        cell = ws.cell(row=11, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.border = THIN
    users = [
        ("U-SAAS", "Platform", "SOFTWARE_ADMIN", "(existing)", "9999999999", "Software@123", "—", "From seed / existing platform admin"),
        ("U-HD", "Platform", "HELPDESK", "helpdesk01", "9999990001", "Helpdesk@1", "hd@mederp.test", "Create in TS-05 / platform helpdesk-team"),
        ("U-H1-SUPER", "H1", "SUPER_ADMIN", "apexadmin", "9876500002", "ApexAdmin@1", "admin@apexcare.test", "Created by TS-01-012"),
        ("U-H1-DOC", "H1", "DOCTOR", "(auto)", "9876500011", "Doctor@123", "doc@apexcare.test", "Create in TS-06"),
        ("U-H1-NUR", "H1", "NURSE", "(auto)", "9876500012", "Nurse@123", "nurse@apexcare.test", "Create in TS-06"),
        ("U-H1-REC", "H1", "RECEPTIONIST", "(auto)", "9876500013", "Recep@123", "rec@apexcare.test", "Create in TS-06"),
        ("U-H1-ACC", "H1", "ACCOUNTANT", "(auto)", "9876500014", "Account@123", "acc@apexcare.test", "Create in TS-06"),
        ("U-H4-SUPER", "H4", "SUPER_ADMIN", "tenantbadmin", "9876502002", "TenantB@123", "admin@tenantb.test", "Second tenant — TS-20"),
    ]
    for i, row in enumerate(users):
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=12 + i, column=c, value=v)
            cell.border = THIN
            cell.alignment = WRAP

    # Patients (placeholders for later suites)
    ws["A22"] = "Patients (create in TS-09 — placeholders)"
    ws["A22"].font = SECTION_FONT
    p_headers = ["Key", "Hospital", "First", "Last", "DOB", "Gender", "Phone", "Purpose"]
    for c, h in enumerate(p_headers, 1):
        cell = ws.cell(row=23, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.border = THIN
    patients = [
        ("P1", "H1", "Ramesh", "Kumar", "1985-03-15", "MALE", "9876510001", "Adult male — primary OPD patient"),
        ("P2", "H1", "Sita", "Kumar", "1988-07-22", "FEMALE", "9876510001", "Spouse — same phone / family group"),
        ("P3", "H1", "Aarav", "Kumar", "2025-06-01", "MALE", "9876510001", "Infant <24 months — age shows in months"),
        ("P4", "H1", "Ramesh", "Kumar", "1985-03-15", "MALE", "9876510099", "Intentional name+DOB duplicate of P1"),
        ("P5", "H1", "Meera", "Iyer", "1992-11-08", "FEMALE", "9876510005", "Standalone female — billing/advance"),
        ("P6", "H4", "Other", "Tenant", "1990-01-01", "MALE", "9876520001", "Tenant B patient — isolation"),
    ]
    for i, row in enumerate(patients):
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=24 + i, column=c, value=v)
            cell.border = THIN

    # Constants
    ws["A32"] = "Constants"
    ws["A32"].font = SECTION_FONT
    constants = [
        ("OTP (dummy mode)", "123456", "When OTP_DUMMY ≠ '0'"),
        ("Password min length", "8", "No complexity rules"),
        ("Session cookie", "mederp_session", "7 days, httpOnly, SameSite=strict"),
        ("Default OPD fee fallback", "₹500", "If hospital/doctor/dept fee unset"),
        ("Plan 1 CLINIC", "₹1999 / 3 seats", "1 doctor, 1 nurse, 1 receptionist"),
        ("Plan 2 STARTER", "₹3500 / 6 seats", "2 doctors, 3 nurses, 1 receptionist"),
        ("Plan 3 GROWTH", "₹4999 / 9 seats", "3 doctors, 5 nurses, 1 receptionist"),
        ("Modules deferred", "pharmacy/lab/wards/inventory off", "Not offered on register or current plans"),
        ("Invoice number", "INV-{HOSPITALCODE}-000NN", "HospitalCounter kind=INVOICE"),
        ("UHID / MRN", "{HOSPITALCODE}-{YYYY}-000NN", "HospitalCounter kind=PATIENT-{year}"),
        ("Platform invoice", "{prefix}-INV-000NN", "Default prefix MEDERP"),
        ("Valid Indian mobile", "10 digits, starts 6–9", "normalize strips 91 / leading 0"),
        ("Valid username", "≥3 chars [a-zA-Z0-9._]", "Staff signup only — hospital register uses display name"),
        ("Card brands (OPD collect)", "Visa / Mastercard / RuPay / Amex / Other", "Required when method=CARD"),
    ]
    c_headers = ["Name", "Value", "Notes"]
    for c, h in enumerate(c_headers, 1):
        cell = ws.cell(row=33, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.border = THIN
    for i, row in enumerate(constants):
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=34 + i, column=c, value=v)
            cell.border = THIN
            cell.alignment = WRAP

    set_col_widths(ws, [14, 22, 22, 16, 14, 18, 24, 45])


def build_env(wb: Workbook):
    ws = wb.create_sheet("02_Environment")
    ws["A1"] = "Environment & Config Checklist"
    ws["A1"].font = TITLE_FONT
    headers = ["Item", "Expected / Notes", "Actual (fill)", "OK?"]
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=3, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.border = THIN
    rows = [
        ("Base URL (web)", "e.g. http://localhost:3000 or staging URL", "", ""),
        ("DATABASE_URL", "Postgres reachable; migrations applied", "", ""),
        ("OTP_DUMMY", "≠0 for manual testing without WhatsApp (OTP=123456)", "", ""),
        ("COOKIE_SECURE", "0/false on http localhost", "", ""),
        ("RAZORPAY_KEY_ID / SECRET", "Required for TS-01 paid path & TS-04", "", ""),
        ("RAZORPAY_WEBHOOK_SECRET", "Required for webhook cases in TS-04", "", ""),
        ("WhatsApp / ASKEVA token", "Optional; without it messaging is console/dummy", "", ""),
        ("Browser", "Chrome latest + one mobile viewport check", "", ""),
        ("Roles available in env", "SOFTWARE_ADMIN exists (9999999999) or create", "", ""),
        ("Out of scope modules", "Do NOT execute Lab / Pharmacy / Ward scenarios", "", ""),
        ("Seed (optional)", "prisma seed-demo-data — Demo@123 for demo hospitals", "", ""),
    ]
    for i, row in enumerate(rows):
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=4 + i, column=c, value=v)
            cell.border = THIN
            cell.alignment = WRAP
    set_col_widths(ws, [28, 60, 30, 8])


def build_watchlist(wb: Workbook):
    ws = wb.create_sheet("97_Watchlist")
    ws["A1"] = "Known quirks / possible defects (confirm expected result before marking Fail)"
    ws["A1"].font = TITLE_FONT
    headers = ["ID", "Area", "Observation", "Likely suite", "Decide: Bug or By Design?"]
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=3, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.border = THIN
    items = [
        ("W-01", "Appointments", "Receptionist cannot action=start (doctorOwnsVisit) even though front-desk roles include them.", "TS-10", ""),
        ("W-02", "Appointments", "action=checkout completes visit WITHOUT approved assessment; action=complete correctly requires APPROVED.", "TS-10", ""),
        ("W-03", "Appointments", "action=noshow has no status guard — can mark NO_SHOW from IN_PROGRESS.", "TS-10", ""),
        ("W-04", "Billing", "Refund of ADVANCE-method collection does NOT restore patient.advanceBalance.", "TS-15", ""),
        ("W-05", "Billing", "InvoiceStatus DRAFT and VOID exist in schema but no API sets them.", "TS-14", ""),
        ("W-06", "Billing", "Pending waiver does not reduce due — patient can pay full amount before approval.", "TS-15", ""),
        ("W-07", "Billing", "/billing/new uses doctor.consultationFee; /billing/collect uses consultationFeeForVisit (follow-up differs).", "TS-14", ""),
        ("W-08", "Auth", "/forgot-password/reset is NOT in middleware public paths — may require session unexpectedly.", "TS-02", ""),
        ("W-09", "Patients", "Patient phone is NOT validated as Indian mobile on register (unlike login/users).", "TS-09", ""),
        ("W-10", "Fees", "followUpFee=0 does not make follow-up free — falls through to full consultation fee (min ₹500).", "TS-10/TS-14", ""),
    ]
    for i, row in enumerate(items):
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=4 + i, column=c, value=v)
            cell.border = THIN
            cell.alignment = WRAP
            ws.row_dimensions[4 + i].height = 40
    set_col_widths(ws, [8, 14, 75, 14, 28])


def build_traceability(wb: Workbook):
    ws = wb.create_sheet("98_Traceability")
    ws["A1"] = "Module → Route → Suite mapping (in-scope only)"
    ws["A1"].font = TITLE_FONT
    headers = ["Module", "Primary UI routes", "Primary API routes", "Suite"]
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=3, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.border = THIN
    rows = [
        ("Hospital Registration", "/register-hospital", "/api/public/register-hospital*, /api/public/package, /api/public/hospital-code", "TS-01"),
        ("Auth", "/login, /signup, /forgot-password", "/api/auth/*", "TS-02"),
        ("Join", "/join, /hospital/join-requests, /platform/join-requests", "/api/join-requests*", "TS-03"),
        ("Subscription", "/subscribe, /hospital/subscription", "/api/hospital/subscription*, /api/public/razorpay/webhook", "TS-04"),
        ("Platform Admin", "/platform/**", "/api/platform/**", "TS-05"),
        ("Hospital Users", "/hospital/users, /staff", "/api/hospital/users*", "TS-06"),
        ("Settings", "/hospital/settings", "/api/hospital/settings, /api/hospital/doctor-profile, /api/session/view-mode", "TS-07"),
        ("Leave", "/leave, /hospital/leaves", "/api/leaves*", "TS-08"),
        ("Patients", "/patients/**", "/api/patients*", "TS-09"),
        ("Appointments", "/appointments/**, /queue", "/api/appointments*", "TS-10"),
        ("Vitals", "/nurse, appointment vitals panel", "/api/appointments/[id]/vitals", "TS-11"),
        ("Assessment", "/appointments/[id]", "/api/appointments/[id]/assessment, /summary/send, /medicines/suggest", "TS-12"),
        ("Certificates", "/certificates/**", "/api/certificates*", "TS-13"),
        ("Billing core", "/billing/**, /billing/collect/**", "/api/invoices*, /api/appointments/[id]/collect", "TS-14"),
        ("Billing money ops", "/billing/[id], /billing/advance", "/api/invoices/[id] PATCH, /api/payments/advance", "TS-15"),
        ("Billing reports", "/billing/collections, /billing/reports", "/api/billing/reports, /api/invoices/[id]/send", "TS-16"),
        ("Helpdesk", "/helpdesk/**, /platform/helpdesk-team", "/api/helpdesk/**, /api/public/help-request", "TS-17"),
        ("Board / Notifs", "/ (board chat), notifications bell", "/api/board*, /api/notifications", "TS-18"),
        ("Audit", "/hospital/audit-log, /platform/audit-log", "/api/hospital/audit-log", "TS-19"),
        ("RBAC / Tenancy", "All modules (negative)", "Cross-tenant API ID probes", "TS-20"),
    ]
    for i, row in enumerate(rows):
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=4 + i, column=c, value=v)
            cell.border = THIN
            cell.alignment = WRAP
            ws.row_dimensions[4 + i].height = 35
    set_col_widths(ws, [22, 45, 70, 10])


def build_defect_log(wb: Workbook):
    ws = wb.create_sheet("99_Defect_Log")
    ws["A1"] = "Defect Log — fill during execution"
    ws["A1"].font = TITLE_FONT
    headers = [
        "Defect ID",
        "Suite",
        "Case ID",
        "Title",
        "Severity",
        "Status",
        "Found By",
        "Date",
        "Steps to Reproduce",
        "Expected",
        "Actual",
        "Notes",
    ]
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=3, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.border = THIN
    for r in range(4, 54):
        for c in range(1, 13):
            cell = ws.cell(row=r, column=c, value="")
            cell.border = THIN
    set_col_widths(ws, [12, 10, 12, 28, 10, 12, 12, 12, 40, 30, 30, 20])


def build_suite_sheet(wb: Workbook, suite_id: str, title: str, cases: list | None):
    ws = wb.create_sheet(suite_id)
    ws["A1"] = f"{suite_id} — {title}"
    ws["A1"].font = TITLE_FONT
    ws.merge_cells("A1:P1")
    if cases is None:
        ws["A2"] = (
            "CASES NOT WRITTEN YET. Ask the agent: “write TS-XX next” "
            "and this sheet will be filled with full manual steps."
        )
        ws["A2"].alignment = WRAP
        ws.merge_cells("A2:P2")
        ws.row_dimensions[2].height = 40
        for c, h in enumerate(HEADERS, 1):
            cell = ws.cell(row=4, column=c, value=h)
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.border = THIN
        set_col_widths(
            ws,
            [12, 16, 40, 10, 12, 28, 14, 32, 40, 40, 18, 12, 12, 12, 28, 12],
        )
        add_status_validation(ws, 5, 100)
        return

    ws["A2"] = (
        f"Manual script — {len(cases)} cases. Execute in Case ID order where dependencies exist. "
        "Update Status / Actual Result / Defect ID columns. Out of scope: Lab, Pharmacy, Wards."
    )
    ws["A2"].alignment = WRAP
    ws.merge_cells("A2:P2")
    ws.row_dimensions[2].height = 35

    for c, h in enumerate(HEADERS, 1):
        cell = ws.cell(row=4, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = CENTER
        cell.border = THIN

    write_case_rows(ws, cases, start_row=5)
    add_status_validation(ws, 5, 5 + len(cases) + 20)
    set_col_widths(
        ws,
        [12, 16, 42, 10, 12, 30, 16, 34, 42, 42, 18, 12, 12, 12, 30, 12],
    )
    ws.freeze_panes = "A5"
    ws.auto_filter.ref = f"A4:P{4 + len(cases)}"


SUITE_CASES = {
    "TS-01": ts01_cases,
    "TS-02": ts02_cases,
    "TS-03": ts03_cases,
    "TS-04": ts04_cases,
    "TS-05": ts05_cases,
    "TS-06": ts06_cases,
    "TS-07": ts07_cases,
    "TS-08": ts08_cases,
    "TS-09": ts09_cases,
    "TS-10": ts10_cases,
    "TS-11": ts11_cases,
    "TS-12": ts12_cases,
    "TS-13": ts13_cases,
    "TS-14": ts14_cases,
    "TS-15": ts15_cases,
    "TS-16": ts16_cases,
    "TS-17": ts17_cases,
    "TS-18": ts18_cases,
    "TS-19": ts19_cases,
    "TS-20": ts20_cases,
}


def main():
    wb = Workbook()
    build_index(wb)
    build_testdata(wb)
    build_env(wb)

    for sid, name, _summary, _cases, _pri in SUITES:
        fn = SUITE_CASES.get(sid)
        build_suite_sheet(wb, sid, name, fn() if fn else None)

    build_watchlist(wb)
    build_traceability(wb)
    build_defect_log(wb)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    try:
        wb.save(OUT)
        saved = OUT
    except PermissionError:
        wb.save(OUT_FALLBACK)
        saved = OUT_FALLBACK
        print(f"NOTE: {OUT.name} is locked (close Excel). Wrote {OUT_FALLBACK.name} instead.")
    total = sum(len(fn()) for fn in SUITE_CASES.values())
    print(f"Wrote {saved}")
    for sid, fn in SUITE_CASES.items():
        print(f"  {sid}: {len(fn())} cases")
    print(f"Total: {total} cases")


if __name__ == "__main__":
    main()
