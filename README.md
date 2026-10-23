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

## Local Setup

Use Node.js 20 or newer. Install dependencies with `npm install`, copy `.env.example` to `.env`, and set the Supabase project URL and publishable key. Start the app with `npm run dev` and open the local URL printed by Vite.

Apply all SQL files in `supabase/migrations` to the Supabase project in filename order (or use `supabase db push` from a linked Supabase CLI project) before testing attendance and WFH workflows. The live-location migration adds coordinate/address fields and updates the authenticated RPC functions.

## Location Privacy

Attendance check-in requires a one-time device location fix; WFH request location is optional. The browser asks only after the candidate chooses **Get My Current Location**. The app does not continuously track location, use IP addresses as a substitute, or treat a WFH request location as proof of a home address or a reason to approve a request automatically.

Coordinates and the resolved address are stored with the attendance record or WFH request. Candidates can see their own records; Tech Champions can see records only for candidates assigned to them, as enforced by row-level security. The coordinates are sent to OpenStreetMap's Nominatim reverse-geocoding endpoint to resolve a readable address, and map tiles are served by OpenStreetMap. Address lookup is best-effort; coordinates are retained if lookup fails. Review applicable POPIA requirements, provide the appropriate notice/retention policy, and obtain any required consent before production use.

Browser geolocation requires a secure context: use HTTPS in production. Browsers generally permit `localhost` during development. If location permission is denied, unavailable, or times out, the candidate can retry; attendance is not submitted without coordinates. WFH location may be left unshared.

## Technology

The frontend is built with React 19 and Vite, with React Router for navigation. Supabase provides authentication and a Postgres database. Row Level Security and database functions enforce access and attendance/request rules. The app is designed to deploy on Vercel.