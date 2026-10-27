# CAPACITI Online Register & WFH

CAPACITI Online Register is a web app for candidates and Tech Champions to manage daily attendance and work-from-home (WFH) requests. Candidates record when and where they work, while Tech Champions review attendance and make decisions on requests for the candidates assigned to them.

## How It Works

Candidates can:
- Check in and check out, choosing office or WFH and optionally adding a location note.
- View their current attendance status, weekly hours, and attendance history.
- Request WFH for a date, then track the decision and any reviewer comments.
- Update basic profile details and export their attendance records as CSV.

Tech Champions can:
- See a dashboard of their assigned candidates and today's attendance status.
- Review, filter, and export attendance and WFH records.
- Approve or reject WFH requests, with a comment required when rejecting.
- Receive in-app notifications about requests and decisions.

The app has separate candidate and Tech Champion experiences. Users sign in with Supabase Auth, and access is limited to their own records or, for Tech Champions, the records of candidates assigned to them.

## Shifts

Shifts adds a daily schedule and break tracking to the existing register. A shift is the same attendance record as before: **Clock In** is the existing check-in (with its location capture), and **Clock Out** is the existing check-out. Nothing new runs alongside the register.

The standard schedule is 09:00–16:00 SAST, with tea from 10:30 to 10:45 and lunch from 12:00 to 13:00. That makes 7 hours elapsed and 5 hours 45 minutes of net work. The schedule is one row in `shift_schedule`. Change it in the SQL editor (see `supabase/provisioning.sql`). Each shift keeps a copy of the times it was created with.

Candidates use the **Shifts** page. One button changes with their state: Clock In, Start or End Tea Break, Start or End Lunch Break, Clock Out. The page shows scheduled times beside recorded times, a timeline, break durations, and elapsed, break, net and remaining time. After clocking out, candidates are prompted for a daily progress update, which is saved separately from the shift.

The database enforces the rules. Every timestamp comes from the database clock (`now()`), never from the device. Each candidate gets one shift per day and one tea and one lunch break per shift, and only one break can be open at a time. A candidate cannot clock out during a break or start a break after clocking out. A candidate cannot end a break left open on an earlier day; it stays open until a Tech Champion resolves it. Candidates have no direct write access to any shift table.

Durations and flags are worked out in `attendance_overview` from the recorded times. Flags include late arrival, early departure, a long or skipped break, a break started off schedule, a shift with no clock-out, an open break and a missing progress update. A shift or break that is still open has no final duration. No clock-in, break or absence is ever filled in.

Tech Champions get **Shifts**, a per-day monitor with filters and CSV export. A candidate detail view shows the timeline, corrections, notes and four weeks of history. **Weekly Review** gives weekly totals, compares hours with progress updates, records feedback and flags candidates who need support, with CSV export. The dashboard shows shift alerts. A late clock-in, an early clock-out or a break over its allowance also sends an in-app notification. All of these are flags for review. Only a review note with the outcome *Confirmed policy violation* records a decision, and nothing issues a warning automatically.

Tech Champions can correct records for their assigned candidates. They can fix clock-in or clock-out times, record a shift a candidate forgot to clock in for, or close and add a break. Each correction requires a reason and is stored in `attendance_corrections` with the original and corrected values, who made it and when. The candidate is notified, and the shift is marked *Corrected*. Every insert, update and delete of shift or break times is also written to `audit_logs`.

Known limitations: public holidays are not excluded from expected working days. Alerts for missing clock-ins and forgotten clock-outs are worked out when a Tech Champion opens the dashboard; no scheduled job sends them as notifications. Clock-out corrections must fall on the same date as the clock-in. **Microsoft Teams is not integrated.** The feature works on its own using Supabase. The RPCs (`start_break`, `end_break`, `check_in`, `check_out`, `correct_shift`, `correct_break`) are the place a future Microsoft Graph Shifts sync would call or mirror.

## Local Setup

Use Node.js 20 or newer. Install dependencies with `npm install`, copy `.env.example` to `.env`, and set the Supabase project URL and publishable key. Start the app with `npm run dev` and open the local URL printed by Vite.

Apply all SQL files in `supabase/migrations` to the Supabase project in filename order (or use `supabase db push` from a linked Supabase CLI project) before testing attendance and WFH workflows. The live-location migration adds coordinate/address fields and updates the authenticated RPC functions. The shifts migration (`20261026000000_shifts.sql`) adds the schedule, breaks, corrections, reviews and progress updates. The candidate stream migration adds the profile field used by mentor cohort/stream filters. Use the Candidate Learning Progress cohort names (`Demand 1`, `Data`, `Computer Centre`, `Marketing`, `Clickatell`) for live candidate profiles; for `Demand 1`, assign one of the three stream names shown in that page. Run `npm test` to exercise all migrations and RLS policies locally on PGlite.

## Location Privacy

Attendance check-in requires a one-time device location fix; WFH request location is optional. The browser asks only after the candidate chooses **Get My Current Location**. The app does not continuously track location, use IP addresses as a substitute, or treat a WFH request location as proof of a home address or a reason to approve a request automatically.

Coordinates and the resolved address are stored with the attendance record or WFH request. Candidates can see their own records; Tech Champions can see records only for candidates assigned to them, as enforced by row-level security. The coordinates are sent to OpenStreetMap's Nominatim reverse-geocoding endpoint to resolve a readable address, and map tiles are served by OpenStreetMap. Address lookup is best-effort; coordinates are retained if lookup fails. Review applicable POPIA requirements, provide the appropriate notice/retention policy, and obtain any required consent before production use.

Browser geolocation requires a secure context: use HTTPS in production. Browsers generally permit `localhost` during development. If location permission is denied, unavailable, or times out, the candidate can retry; attendance is not submitted without coordinates. WFH location may be left unshared.

## Technology

The frontend is built with React 19 and Vite, with React Router for navigation. Supabase provides authentication and a Postgres database. Row Level Security and database functions enforce access and attendance/request rules. The app is designed to deploy on Vercel.