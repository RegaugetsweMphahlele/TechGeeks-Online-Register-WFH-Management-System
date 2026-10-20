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

## Technology

The frontend is built with React 19 and Vite, with React Router for navigation. Supabase provides authentication and a Postgres database. Row Level Security and database functions enforce access and attendance/request rules. The app is designed to deploy on Vercel.