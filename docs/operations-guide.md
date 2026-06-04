# Bilan Sky — Operations Guide

This guide summarizes recent Bilan Air Booking System work and explains how to run day-to-day operations from the **portal** (primary UI) and **Desk** (Frappe back office).

---

## 1. What was built (summary)

| Area | What changed |
|------|----------------|
| **Booking agents** | Contact, address, and **user rights** live on **Booking Agent** (not on Frappe User). Portal users get activation email; login enables after password is set. |
| **Company / agency** | New **Booking Company** DocType. Each agent links to one company or agency (`is_agency` on the company). Portal: select existing or **+** to create. |
| **Partial seat release** | Not all aircraft seats are for sale at once. Some seats stay **Unreleased** until you release more. |
| **Multi-stop routes** | Routes like **MGQ → NBO → MBA** on one flight. Seats can be sold per **journey** (segment range), not only for the full route. |
| **Portal routes** | Multi-segment route editor at `/portal/master/routes`. |
| **Recurring plans** | **Flight Schedule Plan** saves correctly when fare override is empty (Desk JSON fix). Fare overrides are optional and mainly set from portal recurring flights. |

After pulling code:

```bash
bench --site <your-site> migrate
bench restart
# rebuild portal if you use the Next.js frontend
cd apps/bilan_sky/frontend && npm run build
```

---

## 2. Where to manage things

| Task | Portal (recommended) | Desk |
|------|----------------------|------|
| Routes (incl. multi-stop) | **Master → Routes** (`/portal/master/routes`) | Flight Route |
| Flights & seat release | **Flights** (`/portal/flights`) | Flight Schedule |
| Recurring flight plans | **Flights → Recurring** (`/portal/flights/recurring`) | Flight Schedule Plan |
| Booking agents | **Users → Booking agents** | Booking Agent, Booking Company |
| Bookings / seats | **Bookings**, **Booking (new)** | Air Booking, Seat Inventory |
| Master data | **Master** (airports, airlines, airplanes) | Same DocTypes |

Most configuration and operations are intended to happen in the **portal**. Desk remains useful for support, reports, and edge-case edits.

---

## 3. Booking agents & companies

### Booking Company

- **Company** — default (`is_agency` unchecked).
- **Agency** — tick **Is Agency** when creating via portal **+**.
- Document name = company/agency display name (`company_agency`).

### Booking Agent

- **Company / Agency** — required link to Booking Company.
- **Profile name** — auto-generated (hidden on form): usually the company name, or `Company (username)` if several agents share one company.
- **Username, email, names, address, phones, city** — on the agent profile.
- **User rights** — Active, can book, can confirm, deposit required, credit limit.
- **Portal User** — linked Frappe User; password via **activation email** (no admin-set password).

### Portal workflow (new agent)

1. **Users → Booking agents → New booking agent**
2. Step 1: pick **Company / agency** (or **+** to create company/agency).
3. Fill contact, address, enable **Send activation email**.
4. Step 2: set rights and credit limit → **Create agent**.

### Desk workflow

1. Create **Booking Company** if needed.
2. Create **Booking Agent**: set **Company / Agency**, **Username**, and other required fields.
3. Save — profile name is filled automatically before save.

---

## 4. Seat restriction (partial release)

### Why

You may want to sell only part of the cabin initially (e.g. 50 of 100 seats) and open the rest later.

### Seat statuses (relevant)

| Status | Meaning |
|--------|---------|
| **Unreleased** | Exists on the aircraft but **not offered for sale** yet. |
| **Available** | Open for booking. |
| **Hold** | Temporarily reserved (timer). |
| **Booked** / **Occupied** | Confirmed / checked in. |

### When seats are created

On **Flight Schedule** save/submit, the system generates **Seat Inventory** for the airplane layout:

- First **N** seats (layout order) → **Available**
- Remaining seats → **Unreleased**

**N** comes from:

- **Initial seats released** on the schedule (or on the **Flight Schedule Plan** that generated it), or
- **Seats released count** after you release more later.

### Portal — new single flight

1. **Flights →** create flight.
2. Set **Initial seats released** (e.g. `50` on a 100-seat aircraft).
3. Save / submit schedule → seats are generated with the split above.

### Portal — release more seats later

Use the API-backed action on the flight (staff): release additional seats by count. This:

- Increases `seats_released_count` (capped at aircraft capacity).
- Moves matching **Unreleased** seats to **Available** (only if not already held/booked).

Desk: you can adjust **Initial seats released** / **Seats released count** on **Flight Schedule** and re-run seat logic via save where applicable.

### Recurring plans

**Flight Schedule Plan** has **Initial seats released**. Each generated **Flight Schedule** inherits that value when flights are generated from the plan.

### Rules of thumb

- **Unreleased** seats never appear as bookable in search.
- Releasing more seats does not take seats away from existing bookings.
- Empty **Available** seats can be moved back to **Unreleased** if you reduce the release count (only when not allocated).

---

## 5. Three cities on one flight (multi-stop) — seat “retention”

This is **not** a separate “retention” setting. It works through **route segments** + **seat segment allocations**.

### Example: Mogadishu → Nairobi → Mombasa

One physical flight, three airports, **two legs**:

| Leg | From | To |
|-----|------|-----|
| 0 | MGQ | NBO |
| 1 | NBO | MBA |

### Step 1 — Define the route (portal)

1. **Master → Routes → New route**
2. Enable **Multi-stop route**
3. Add legs: **MGQ → NBO**, then **NBO → MBA** (each leg must start where the previous ends).
4. Set distance, base fares, airline, etc. → **Save**

The route stores `is_multi_segment` and `route_segments`. Overall origin/destination become MGQ and MBA.

**Route ID (document name):** Direct routes use `ORIGIN-DEST` (e.g. `ADI-NBO`). Multi-stop routes use the **full path** (e.g. `ADI-NBO-MBA` for ADI→NBO→MBA), so they do not conflict with an existing direct `ADI-NBO` route.

### Captain / crew (pilots only)

**Captain** and **First Officer** must be **Crew Member** records whose **Crew Role** has category **Pilot** (e.g. role names “Captain”, “First Officer”). Cabin crew cannot be assigned as captain. Desk link fields and the portal flight forms enforce this; save is blocked if a non-pilot is selected.

Ensure **Crew Role** master data has active roles under category **Pilot**.

### Step 2 — Create the flight

1. **Flights** — create schedule using that route and airplane.
2. On save, **Flight Schedule** copies segments from the route into **Flight Schedule Segment** child rows.
3. Set **Initial seats released** as needed.

### Step 3 — How seats behave for different passengers

The system tracks **Seat Segment Allocation** per booking:

- **Full trip (MGQ → MBA)** — allocation covers leg indices `0–1` (both segments). Same seat for the whole journey.
- **MGQ → NBO only** — allocation covers index `0` only. After that passenger leaves, the **same seat number** can be sold for **NBO → MBA** (index `1`) to another passenger.
- **NBO → MBA only** — allocation covers index `1` only.

Availability uses **overlapping segment ranges**: two bookings conflict only if their ranges on that seat overlap.

### Step 4 — Booking

On **Air Booking**, set:

- **Boarding airport** — where the passenger gets on.
- **Deboarding airport** — where they get off.

Search and seat maps use that **journey** to count availability and to reserve/confirm seats.

For multi-segment schedules, reservation uses **Seat Segment Allocation** (not a whole-seat Hold on the inventory row for partial journeys).

### Mental model

```
Seat 12A on flight F-001
├── Allocation A: MGQ→MBA  (segments 0–1)  → through passenger
├── Allocation B: MGQ→NBO  (segment 0)     → gets off in Nairobi
└── Allocation C: NBO→MBA  (segment 1)     → can use 12A after B ends
```

B and C can coexist on the **same seat** because segment ranges do not overlap.

### Direct (single-leg) routes

If **Multi-stop** is off, the route has one segment. Behavior is classic: one seat = one passenger for the full flight (normal Hold/Booked on **Seat Inventory**).

---

## 6. Recurring flights & pricing

### Route pricing (default)

**Flight Route** carries **base fares** (adult / child / infant). Generated flights normally inherit these.

### Optional override on a plan

**Flight Schedule** and **Flight Schedule Plan** have three optional Currency fields:

- **Base Fare Override (Adult / Child / Infant)**

Leave a field empty to use the **route** fare for that passenger type. Set a value only when this flight (or all flights from a plan) should differ from the route.

Managed in portal **Flights** (edit prices) and **Recurring flights**. No JSON editing required.

---

## 7. Quick troubleshooting

| Problem | Check |
|---------|--------|
| “Profile name is required” on Booking Agent (Desk) | **Company / Agency** and **Username** filled; reload DocType after migrate. |
| Flight Schedule Plan won’t save | Leave override fare fields blank if not needed; use Currency fields, not JSON. |
| No seats to book | Seats **Unreleased** — increase **Initial seats released** or release more seats. |
| Multi-stop seat “not available” | Boarding/deboarding airports must match a valid segment pair on the route; ranges must not overlap another booking on that seat. |
| Agent can’t log in | Activation pending — resend activation from portal; profile must be **Active**. |

---

## 8. Key DocTypes (reference)

| DocType | Role |
|---------|------|
| **Booking Company** | Company or agency master |
| **Booking Agent** | Agent profile, rights, link to user |
| **Flight Route** / **Flight Route Segment** | Direct or multi-stop path |
| **Flight Schedule** / **Flight Schedule Segment** | Dated flight + legs |
| **Flight Schedule Plan** | Recurring generator |
| **Seat Inventory** | Physical seat on a schedule |
| **Seat Segment Allocation** | Which leg(s) a booking uses on a seat |
| **Air Booking** | PNR; boarding/deboarding for journey |
| **BA Settings** | Hold duration, child/infant % defaults, etc. |

---

## 9. Related code (for developers)

| Topic | Location |
|-------|----------|
| Seat release | `bilan_air_booking_system/utils/seat_release.py` |
| Segments & overlap | `bilan_air_booking_system/utils/flight_segments.py` |
| Reserve / confirm / release | `bilan_air_booking_system/utils/seat_booking.py` |
| Portal APIs | `bilan_air_booking_system/api/portal.py`, `portal_master.py` |
| Booking agent | `bilan_air_booking_system/utils/booking_agent.py` |
| Fare override normalize | `bilan_air_booking_system/utils/fare_pricing.py` |

---

*Last updated: June 2026 — reflects portal-first operations, booking companies, partial seat release, and multi-stop journey seating.*
