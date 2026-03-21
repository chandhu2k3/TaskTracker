# Task Tracker Pro 📊

An advanced task tracking application with categories, templates, multiple daily sessions, and comprehensive analytics.

## Features

### 🎯 Core Features

- **Date-Based Organization**: Select year → month → week to manage tasks
- **Category Management**: Create custom categories with icons and colors
- **Weekly Templates**: Set up reusable weekly schedules
- **Multiple Sessions**: Toggle tasks on/off multiple times per day
- **Session Tracking**: Track each work session with start/end times
- **Real-time Updates**: Live time tracking for active tasks

### 📈 Analytics

- **Weekly Analytics**: View breakdown by day and category
- **Monthly Analytics**: Compare different weeks in a month
- **Category Analytics**: Track time spent on specific categories
- **Quick Todos Stats**: Completed/total count, missed todos tracking
- **Visual Charts**: Progress bars and stat cards for easy visualization

## Quick Start

### Prerequisites

- Node.js v14+
- MongoDB (local or cloud)

### Installation

1. **Backend Setup**

   ```bash
   cd backend
   npm install
   ```

   Create `.env`:

   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/tasktracker
   JWT_SECRET=your_secret_key
   ```

2. **Frontend Setup**

   ```bash
   cd frontend
   npm install
   ```

3. **Run Application**

   ```bash
   # Terminal 1 - Backend
   cd backend
   node server.js

   # Terminal 2 - Frontend
   cd frontend
   npm start
   ```

## Usage Guide

1. **Register/Login** to create your account
2. **Create Categories** (🏷️ tab): Add Gym, DSA, Study, etc.
3. **Setup Template** (📋 tab): Define your weekly schedule
4. **Select Week**: Use date picker (Year → Month → Week)
5. **Apply Template** (✨ button): Populate the week with your schedule
6. **Track Tasks**: Toggle on/off to track time (supports multiple sessions!)
7. **View Analytics** (📈 tab): See your progress by week/month/category

## Key Features

### Multiple Sessions Per Day

Each task can be toggled on/off **multiple times** per day. Each session records:

- Start time
- End time
- Duration

Total time = sum of all sessions + current active session

### Template System

Create a weekly template once, apply to any week:

- Saves hours vs. manual entry
- Consistent week-to-week tracking
- Prevents duplicate tasks

### Advanced Analytics

- **By Day**: See which days you're most productive
- **By Category**: Track time across Gym, Study, Work, etc.
- **By Week**: Compare weeks in a month
- Visual progress bars and percentage breakdowns

### 📅 Google Calendar Integration

- **One-Click Calendar Sync**: Click 📅 on any task or todo to instantly add it to Google Calendar — no redirects
- **Template Calendar Sync**: Toggle "📅 Cal" on template tasks → events auto-created when template is applied
- **Custom Reminders**: Set 5/10/15/30/60 min reminders per template task
- **OAuth2 Connection**: Secure Google sign-in from profile dropdown
- **Smart Fallback**: If API fails, falls back to Google Calendar URL method

### 🔔 Notifications & Reminders

- Per-task notification toggle with customizable timing (5/10/15/30/60 min)
- Overtime detection: auto-stops tasks exceeding planned time + 1 hour
- Audio notification via Web Audio API

## Tech Stack

- **Backend**: Node.js, Express, MongoDB, JWT
- **Frontend**: React 18, React Router, Axios
- **Styling**: Custom CSS with responsive design, dark mode support
- **Google Calendar**: googleapis (OAuth2, Calendar API v3)
- **Deployment**: Vercel (frontend + backend)

## API Endpoints

### Auth

- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user

### Tasks

- `GET /api/tasks/week/:year/:month/:week` - Get weekly tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task (toggle)
- `GET /api/tasks/analytics/week/:year/:month/:week` - Weekly stats
- `GET /api/tasks/analytics/month/:year/:month` - Monthly stats

### Categories

- `GET /api/categories` - Get categories
- `POST /api/categories` - Create category

### Templates

- `GET /api/templates` - Get templates
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template
- `POST /api/templates/:id/apply/:year/:month/:week` - Apply template (+ auto-create calendar events)

### Google Calendar

- `GET /api/calendar/auth-url` - Get Google OAuth URL
- `POST /api/calendar/callback` - Handle OAuth callback
- `GET /api/calendar/status` - Check connection status
- `DELETE /api/calendar/disconnect` - Disconnect calendar
- `POST /api/calendar/events` - Create calendar event
- `DELETE /api/calendar/events/:eventId` - Delete calendar event

## Environment Variables

### Backend (.env / Render/Railway)

```
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/tasktracker_prod
JWT_SECRET=your_production_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret (SECRET - never commit)
GOOGLE_REDIRECT_URI=https://your-backend.com/api/calendar/callback
FRONTEND_URL=https://task-tracker-frontend-lime.vercel.app (NO trailing slash)
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

### Frontend (Vercel Environment Variables)

```
REACT_APP_API_URL=https://your-backend.com
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

**Critical:**

- `REACT_APP_GOOGLE_CLIENT_ID` ≠ `GOOGLE_CLIENT_SECRET` — they are different values
- Client ID (frontend): Ends in `.apps.googleusercontent.com` — public
- Client Secret (backend only): Starts with `GOCSPX-` — keep secret
- Never commit real secrets to Git; use `.gitignore` to exclude `.env`

## Recent Patches

### Patch: Authentication & Email Verification (v2.1)

**Fixed Issues:**

- ✅ Email verification redirect now works (previously went to `/dashboard/verify-email` — route didn't exist)
- ✅ Defensive code added to strip accidental path suffixes from `FRONTEND_URL`
- ✅ Google OAuth origin mismatch resolved with proper environment variable setup
- ✅ Dark mode polish: pitch black colors, hamburger btn amber in light mode
- ✅ DayCard gradient header in light mode
- ✅ Form validation with inline error styling

**Key Changes:**

1. **authController.js**: Added regex to strip `/dashboard` from `FRONTEND_URL`

   ```javascript
   const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000")
     .replace(/\/(dashboard|verify-email).*$/, "")
     .replace(/\/+$/, "");
   ```

2. **Environment Variables**: Properly configured frontend/backend client IDs
   - Frontend needs `REACT_APP_GOOGLE_CLIENT_ID` (ends in `.apps.googleusercontent.com`)
   - Backend needs `GOOGLE_CLIENT_ID` (same value) + `GOOGLE_CLIENT_SECRET`

3. **Google Cloud Console**:
   - Authorized JavaScript origins → `https://task-tracker-frontend-lime.vercel.app`
   - Authorized redirect URIs → include backend callback URL

**Deployment Status:**

- Frontend: https://task-tracker-frontend-lime.vercel.app
- Backend: Render/Railway (update with correct env vars from above)
- Database: MongoDB Atlas

## Troubleshooting

### Email Verification Link Shows Blank Page

**Cause:** `FRONTEND_URL` env var had wrong path like `/dashboard`
**Fix:** Ensure `FRONTEND_URL=https://task-tracker-frontend-lime.vercel.app` (no path suffix)

### Google Sign-In Shows "Error 400: origin_mismatch"

**Cause:** Frontend domain not registered in Google OAuth client
**Fix:**

1. Google Cloud Console → Credentials → Your OAuth Web Client
2. Authorized JavaScript origins → Add `https://task-tracker-frontend-lime.vercel.app`
3. Wait 1-2 min, test in incognito

### Google Sign-In Shows "Error 401: invalid_client"

**Cause:** `REACT_APP_GOOGLE_CLIENT_ID` not set in Vercel or is blank
**Fix:**

1. Vercel Settings → Environment Variables
2. Add `REACT_APP_GOOGLE_CLIENT_ID=<your_web_client_id>` (ends in `.apps.googleusercontent.com`)
3. Redeploy frontend
4. Test in incognito

### Port in use?

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <pid> /F
```

### MongoDB not connecting?

- Check MONGODB_URI is correct in `.env`
- Ensure MongoDB is running locally or MongoDB Atlas connection is whitelisted

### Tasks not loading?

- Ensure backend running on port 5000
- Select a week in date picker
- Check browser console for API errors
- Verify `REACT_APP_API_URL` points to correct backend

---

**Status: Beta** — All core features complete, auth system tested ✅

**Happy Tracking! 🎯**
