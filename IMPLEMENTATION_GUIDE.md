# Implementation Guide v2.1

**Patch**: Authentication & Email Verification  
**Updated**: March 21, 2026  
**Status**: Ready for Production Deployment

---

## Phase 1: Environment Variable Setup

### Step 1.1: Backend Host (Render/Railway)

**Vercel contains:** `BACKEND_URL` and `FRONTEND_URL` for frontend  
**Backend host must have:** `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

**If using Render:**

1. Dashboard → Your App → Environment
2. Add/Update these 3 variables:
   ```
   FRONTEND_URL=https://task-tracker-frontend-lime.vercel.app
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```
3. Click "Deploy" or just save — backend auto-redeploys with new vars

**If using Railway:**

1. Project → Variables
2. Add the same 3 variables
3. Service auto-redeployed

**Verify:**

```bash
# Check logs in Render/Railway dashboard
# Should see:
# Server running on port 5000
# MongoDB connected
# Ready for requests
```

---

### Step 1.2: Vercel Frontend (Critical!)

Create React App **only exposes `REACT_APP_*` variables**

1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add these 2:
   ```
   REACT_APP_API_URL=https://your-backend-url.com
   REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   ```
3. **Save** → Automatically triggers redeploy (watch Deployments tab)
4. Wait for "Ready" status (1-2 minutes)

**Check:**

- Build logs show no warnings about missing env vars
- Prod frontend at `https://task-tracker-frontend-lime.vercel.app/login` loads without errors

---

### Step 1.3: Google Cloud OAuth Client

**Go to:** [Google Cloud Console](https://console.cloud.google.com)  
→ APIs & Services → Credentials → OAuth 2.0 Client ID

**Update Authorized JavaScript Origins:**

```
https://task-tracker-frontend-lime.vercel.app
http://localhost:3000
```

**Update Authorized Redirect URIs:**

```
https://task-tracker-frontend-lime.vercel.app/calendar/callback
http://localhost:3000/calendar/callback
```

**Save → Wait 1-2 minutes for propagation**

---

## Phase 2: Local Testing

### Step 2.1: Backend

```bash
cd backend
npm install
node server.js
```

**Expected Output:**

```
Server running on port 5000
MongoDB connected
Auth routes ready
Listening on http://localhost:5000
```

---

### Step 2.2: Frontend

```bash
cd frontend
npm install
npm start
```

**Expected:**

- Starts on `http://localhost:3000`
- No env-var related warnings in console
- Logo and "Task Tracker" title visible

---

### Step 2.3: Test Email Verification (Local)

1. Go to `http://localhost:3000/register`
2. Register new account (name, email, password)
3. Backend logs will show verification token:
   ```
   Verification token: abc123xyz789...
   ```
4. Copy token → visit `http://localhost:3000/verify-email/abc123xyz789...`
5. Should redirect to `/login?verified=success`
6. Should see toast: "✅ Email verified! You can now log in."

---

### Step 2.4: Test Google Sign-In (Local)

1. Go to `http://localhost:3000/login`
2. Click "Sign in with Google"
3. Should see real Google popup (not error)
4. Select Google account
5. Should redirect to dashboard

**If Error:**

- Check browser console (F12) for detailed error
- If `REACT_APP_GOOGLE_CLIENT_ID` not set locally, add to `frontend/.env.development`:
  ```
  REACT_APP_API_URL=http://localhost:5000
  REACT_APP_GOOGLE_CLIENT_ID=<your_client_id>
  ```
- Restart `npm start`

---

## Phase 3: Production Testing

### Step 3.1: Test Email Verification (Production)

1. Open `https://task-tracker-frontend-lime.vercel.app/register` in **incognito**
2. Register with a real email address
3. Check inbox for verification email (arrives within 30 seconds)
4. Click link in email
5. Should land on login with toast: "✅ Email verified!"
6. Try logging in with the email + password

**If Blank Page:**

- Backend's `FRONTEND_URL` has path suffix like `/dashboard`
- Fix: Backend host env vars → Remove path from `FRONTEND_URL`
- Restart backend

---

### Step 3.2: Test Google Sign-In (Production)

1. Open `https://task-tracker-frontend-lime.vercel.app/login` in **incognito**
2. Click "Sign in with Google"
3. Should see real Google OAuth popup

**If Error 401 (invalid_client):**

- `REACT_APP_GOOGLE_CLIENT_ID` not set in Vercel
- Add it in Vercel Settings → Environment Variables
- Redeploy frontend

**If Error 400 (origin_mismatch):**

- Frontend domain not in Google OAuth client's authorized list
- Add `https://task-tracker-frontend-lime.vercel.app` to Google Cloud Console
- Wait 1-2 minutes and retry

---

## Phase 4: Security Hardening

### Step 4.1: Rotate Exposed Credentials

**If you committed `.env*` files to Git:**

1. Google Cloud Console → Delete old OAuth Client (revokes all tokens)
2. Create new OAuth 2.0 Client
3. Copy new Client ID + Secret
4. Update all environment variables:
   - Vercel `REACT_APP_GOOGLE_CLIENT_ID` = new Client ID
   - Backend `GOOGLE_CLIENT_ID` = new Client ID
   - Backend `GOOGLE_CLIENT_SECRET` = new Secret
5. Redeploy both

---

### Step 4.2: Fix `.gitignore`

```bash
# Ensure backend/.gitignore and frontend/.gitignore contain:
.env
.env.local
.env.*.local
.env.production
.env.development
```

**Never commit real secrets!**

---

## Phase 5: Full Test Checklist

### Email Verification

- [ ] Registration page loads
- [ ] Can enter name, email, password
- [ ] Gets verification email within 30s
- [ ] Link in email works
- [ ] Redirects to login with success toast
- [ ] Can now log in with email + password
- [ ] Expired token shows error
- [ ] Resend verification works

### Google Sign-In

- [ ] Login page has "Sign in with Google" button
- [ ] Button is styled (dark/light mode appropriate)
- [ ] Clicking shows real Google OAuth popup
- [ ] Can select Google account
- [ ] After login, redirected to dashboard
- [ ] Welcome toast shows
- [ ] User can create tasks

### Dark/Light Mode (Already Implemented)

- [ ] Home page has sun/moon toggle
- [ ] Selected theme persists on login/register
- [ ] Auth pages respect theme
- [ ] Dashboard theme persists
- [ ] Light mode: amber accents, white inputs
- [ ] Dark mode: pitch black bg, white text

---

## 🚨 Common Issues & Fixes

### "Can't sign up / can't login"

1. Check MongoDB connection: `MONGODB_URI` set on backend?
2. Check backend is running: Port 5000 accessible?
3. Check `REACT_APP_API_URL` points to correct backend

### Email verification link doesn't work

1. Check `FRONTEND_URL` has NO `/dashboard` suffix
2. Check email link in inbox matches `https://task-tracker-frontend-lime.vercel.app/verify-email/TOKEN`
3. Try resending verification email
4. Check backend logs for errors

### Google Sign-In shows error every time

1. **Error 401**: `REACT_APP_GOOGLE_CLIENT_ID` not set in Vercel
   - Add it, redeploy frontend, clear browser cache
2. **Error 400**: Frontend domain not in Google Cloud OAuth client
   - Add `https://task-tracker-frontend-lime.vercel.app` to authorized origins
   - Wait 1-2 minutes
   - Test in incognito

### Blank page after email verification link

1. Backend `FRONTEND_URL` has accidental path → Remove it
2. Restart backend after env var change
3. Generate new verification email
4. Click link again

---

## Deployment Checklist

Before declaring "Done":

- [ ] Backend updated with all 3 env vars (FRONTEND_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- [ ] Vercel frontend has both env vars (REACT_APP_API_URL, REACT_APP_GOOGLE_CLIENT_ID)
- [ ] Google Cloud OAuth client has correct origins + redirect URIs
- [ ] Old Google credentials deleted (if they were exposed)
- [ ] Frontend redeploy triggered
- [ ] Backend redeploy triggered
- [ ] Email verification works in production
- [ ] Google Sign-In works in production
- [ ] `.gitignore` prevents `.env*` commits
- [ ] No `REACT_APP_` warnings in Vercel build logs

---

## Next Steps After v2.1

1. **Calendar Integration**: Connect Google Calendar to task creation
2. **Notifications**: Browser push notifications for task reminders
3. **Mobile Optimization**: Fine-tune responsive design
4. **Performance**: Profile & optimize slow API calls
5. **Advanced Filtering**: Search, tags, recurring tasks

---

**Status**: ✅ v2.1 Complete — Ready for v2.2  
**Author**: GitHub Copilot  
**Last Updated**: March 21, 2026

**OLD**: Tasks were just Monday-Sunday without dates
**NEW**: Each task has a specific date (e.g., January 6, 2026)

**OLD**: Single time tracking per task
**NEW**: Multiple sessions per task per day - can toggle on/off multiple times

**OLD**: No categories
**NEW**: Every task must have a category

**OLD**: Manual task creation each week
**NEW**: Create template once, apply to any week

### Step 3: Frontend Integration Flow

1. User selects Year → Month → Week
2. Click "Apply Template" button (creates tasks from template)
3. Tasks appear for that week
4. Toggle tasks on/off multiple times
5. View analytics filtered by:
   - Specific week
   - Entire month
   - Specific category
   - Compare across weeks

## 🎨 Recommended UI Flow

```
┌─────────────────────────────────────────┐
│  Year: [2026] → Month: [January] →     │
│  Week: [Week 1]  [Apply Template]      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Categories: [+ Add]                     │
│  💪 Gym  |  📚 DSA  |  📖 Study         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Analytics Toggle:                       │
│  [This Week] [This Month] [By Category] │
└─────────────────────────────────────────┘

┌──── Monday ────┬──── Tuesday ────┐
│ 💪 Gym         │ 📚 DSA Practice │
│ ⏱ 1h 30m      │ ⏱ 2h 15m       │
│ 🔄 3 sessions  │ 🔄 2 sessions  │
│ [Toggle]       │ [Toggle]        │
└────────────────┴─────────────────┘
```

## 📊 Analytics Features Now Available

### Weekly Analytics

- Total time per day
- Total time per category
- Number of sessions per task
- Average time per day

### Monthly Analytics

- Week-by-week comparison
- Category distribution
- Total sessions count
- Month totals

### Category Analytics

- Time spent on specific category
- Sessions per day for that category
- Historical data

## 🔧 Next Steps for Full Implementation

1. **Create CategoryManager.js** component
2. **Create TemplateSetup.js** component
3. **Update Dashboard.js** to use DatePicker
4. **Create Analytics.js** component for visualizations
5. **Update TaskItem.js** to show sessions count

The backend is 100% ready and working! All API endpoints are functional.

---

## ✅ Google Calendar Integration (Feb 2026)

### Overview

Full Google Calendar API integration via OAuth2. Tasks and todos can be automatically added to Google Calendar without leaving the app — no redirects, no manual copying.

### Backend Changes

1. **calendarController.js** — New controller with 6 endpoints:
   - `GET /api/calendar/auth-url` — Generates Google OAuth consent URL
   - `POST /api/calendar/callback` — Handles OAuth authorization code exchange
   - `GET /api/calendar/status` — Check if user's calendar is connected
   - `DELETE /api/calendar/disconnect` — Revoke calendar connection
   - `POST /api/calendar/events` — Create event in Google Calendar (automatic, API-based)
   - `DELETE /api/calendar/events/:eventId` — Delete a calendar event

2. **calendar routes** (`routes/calendar.js`) — All endpoints protected with auth middleware

3. **User.js** model — Added `googleCalendar` subdocument:
   - `connected` (Boolean)
   - `accessToken`, `refreshToken` (String)
   - `tokenExpiry` (Date)
   - `calendarId` (String)

4. **TaskTemplate.js** model — Added per-task fields:
   - `addToCalendar` (Boolean) — Flag to auto-create calendar event on template apply
   - `reminderMinutes` (Number) — Reminder time before event (5/10/15/30/60 min)

5. **templateController.js** — Updated `applyTemplate` to auto-create Google Calendar events for tasks with `addToCalendar: true` when user's calendar is connected

6. **Dependencies**: `googleapis` npm package installed

7. **Environment Variables** (`.env.development`):
   ```
   GOOGLE_CLIENT_ID=<your_client_id>
   GOOGLE_CLIENT_SECRET=<your_client_secret>
   GOOGLE_REDIRECT_URI=http://localhost:3000/calendar/callback
   FRONTEND_URL=http://localhost:3000
   ```

### Frontend Changes

1. **calendarService.js** — Full API integration service:
   - `getStatus()` — Check connection
   - `getAuthUrl()` — Get OAuth URL
   - `handleCallback(code)` — Exchange auth code
   - `disconnect()` — Disconnect calendar
   - `createEvent(options)` — Create event via API (automatic)
   - `deleteEvent(eventId)` — Delete event
   - `smartAddToCalendar(options, onNeedsConnection)` — Tries API first, falls back to URL
   - `generateGoogleCalendarUrl(options)` — URL fallback method
   - `generateICSContent(options)` — ICS file generation
   - `downloadICS(options)` — Download .ics file

2. **CalendarCallback.jsx** — OAuth redirect callback page. Receives auth code and sends to parent via `postMessage`.

3. **Dashboard.jsx** — Calendar connection management:
   - `googleCalendarConnected` state
   - Connect/Disconnect button in profile dropdown
   - Auto-creates calendar events when adding tasks with scheduled time

4. **TaskItem.jsx** — 📅 button updated:
   - Uses `smartAddToCalendar()` API (no redirect!)
   - Shows ⏳ while adding, ✅ on success
   - Alerts user if calendar not connected

5. **TodoList.jsx** — 📅 button updated:
   - Same API-based approach with per-todo status tracking
   - Visual feedback (⏳ → ✅)

6. **TemplateSetup.jsx** — New fields per template task:
   - **📅 Cal** toggle — auto-add to Google Calendar when template is applied
   - **Reminder dropdown** — 5/10/15/30/60 min before (visible when Cal is on)

7. **App.jsx** — Added `/calendar/callback` route

### Google Cloud Setup Required

1. Create project at https://console.cloud.google.com
2. Enable Google Calendar API
3. Configure OAuth consent screen (External, add test users)
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3000/calendar/callback`
   - `https://your-domain.vercel.app/calendar/callback`

### User Flow

```
1. User clicks "Connect Calendar" in profile dropdown
2. OAuth popup opens → User signs in with Google
3. Callback exchanges code for tokens → stored in DB
4. Now:
   - Click 📅 on any task → event created instantly via API
   - Click 📅 on any todo → event created instantly
   - Apply template with "Cal" toggled → all flagged tasks auto-added
   - Adding task with scheduled time → auto-creates event
```

---

## 🎨 UI/UX Updates (Feb 2026)

### DayCard Styling

- Today's card: slate gray header (`#64748b`), light background (`#f1f5f9`)
- Went through iterations: blue → white → slate gray

### Navigation Fixes

- Day view shows "Next Day" / "Previous Day" (was "Next Week")
- Date picker in day view shows selected date's tasks (was hardcoded to today)

### Analytics Enhancements

- Quick Todos tracking: completed/total count and missed todos stats
- Added `todos` prop to Analytics component

### Vercel Optimization

- Cache headers configured in `vercel.json` for API responses
- Addressed timeout issues with Vercel serverless functions
