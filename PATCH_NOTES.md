# Patch Notes

## Patch: Authentication & Deployment Polish (v2.1)

**Date:** March 21, 2026  
**Status:** Ready for testing

### 🎯 Scope

Fixed critical authentication bugs (email verification, Google OAuth) and deployed SEO improvements. All UX enhancements from previous patches included.

---

## ✅ Completed in This Patch

### 1. Email Verification Fix

**Problem:** Clicking verification email link showed blank page (infinite spinner)  
**Root Cause:** `FRONTEND_URL` environment variable had `/dashboard` path suffix

- Email verification flow: email → frontend `/verify-email/:token` → redirects to backend API → backend redirects back to `${FRONTEND_URL}/login?verified=success`
- Backend was redirecting to `https://example.com/dashboard/login?verified=success` — route doesn't exist

**Solution:** Added defensive regex in [backend/controllers/authController.js](backend/controllers/authController.js#L133-L143)

```javascript
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000")
  .replace(/\/(dashboard|verify-email).*$/, "") // Strip any accidental paths
  .replace(/\/+$/, ""); // Remove trailing slashes
```

**Deploy Check:**

- ✅ `backend/.env.production`: `FRONTEND_URL=https://task-tracker-frontend-lime.vercel.app` (no slash)
- ✅ Backend host (Render/Railway): Same value for `FRONTEND_URL`

---

### 2. Google OAuth Configuration

**Problem:** Sign-In button showed errors: "Error 401: invalid_client" → "Error 400: origin_mismatch"

**Root Causes Identified:**

1. `REACT_APP_GOOGLE_CLIENT_ID` was not set in Vercel
2. Frontend domain not registered in Google Cloud OAuth client
3. Different/missing client IDs between frontend and backend
4. Frontend repo had real Google secrets exposed (`.env.development`)

**Solution:**

1. Set `REACT_APP_GOOGLE_CLIENT_ID` in Vercel environment variables (ends with `.apps.googleusercontent.com`)
2. Updated Google Cloud OAuth 2.0 Client:
   - Authorized JavaScript origins: `https://task-tracker-frontend-lime.vercel.app`
   - Authorized redirect URIs: include callback URL
3. Set `GOOGLE_CLIENT_ID` (same value) on backend host
4. Set `GOOGLE_CLIENT_SECRET` on backend only (starts with `GOCSPX-`)

**Key Learning:** Client ID (public) ≠ Client Secret (private)

- Frontend: `REACT_APP_GOOGLE_CLIENT_ID` → visible in code → OK
- Backend: `GOOGLE_CLIENT_SECRET` → hidden in env → CRITICAL

**Deploy Check:**

- ✅ Vercel frontend: `REACT_APP_GOOGLE_CLIENT_ID` set
- ✅ Backend host: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set
- ✅ Google Cloud: Origins/URIs configured
- ❌ **SECURITY:** Delete old Google client (real secrets were in `.env.development`), create new one

---

### 3. Previous Patches (Already Delivered)

#### UX/Design Enhancements

- ✅ Task form validation with inline error styling (red text, error states)
- ✅ Amber "Add New Task" CTA button (matches theme)
- ✅ Equal panel dimensions (1fr 1fr) for dashboard layout
- ✅ Dual light/dark mode toggle (☀️/🌙) on landing page
- ✅ Auth pages (Login/Register) inherit theme from localStorage
- ✅ Warm amber/brown backgrounds on auth pages
- ✅ Hamburger button styled amber in light mode

#### Dark Mode Polish

- ✅ Pitch black instead of blueish-dark (#0a0a0a not #0f172a)
- ✅ DayCard header gradient (amber in light, dark-slate in dark)
- ✅ Mobile menu fixed to use light bg in light mode (was hardcoded dark)
- ✅ All 11 CSS files updated with correct palette

#### Deployment & SEO

- ✅ Fixed Unicode BOM encoding errors (Vercel CI)
- ✅ Removed unnecessary `fix-encoding.ps1`
- ✅ Rich SEO meta tags, Open Graph, Twitter Card, JSON-LD schema
- ✅ `sitemap.xml` and `robots.txt` created
- ✅ Enhanced `site.webmanifest`

---

## ⚙️ Environment Variables Checklist

### Vercel (Frontend)

```
REACT_APP_API_URL=https://your-backend-url.com
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### Render/Railway (Backend)

```
FRONTEND_URL=https://task-tracker-frontend-lime.vercel.app
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
MONGODB_URI=mongodb+srv://...
JWT_SECRET=strong_secret_here
GMAIL_USER=...
GMAIL_APP_PASSWORD=...
```

---

## 🧪 Test Cases

### Email Verification

1. Register new account → Receive email
2. Click verification link → Should land on login page with "✅ Email verified!" toast
3. Attempt to login without verification → Should show error and link to resend

**Expected:** Links redirect cleanly to `/login?verified=success|expired|invalid|error`

### Google Sign-In

1. Open login page in incognito
2. Click "Sign in with Google" button
3. Select your Google account
4. On success: redirected to `/dashboard` with welcome toast
5. On error: should see clear error message, not blank page

**Expected:** No OAuth errors, token properly verified on backend

### Email Delivery

1. Register → Email arrives within 30 seconds
2. Resend verification → New email with fresh token
3. Old token should expire after 24 hours

**Expected:** Verification emails deliver with correct links

---

## 🐛 Known Issues / Next Steps

1. **Security:** Old Google OAuth client exposed in repo → Rotate credentials immediately
2. **Redis:** Keep-alive service may not be optimal for all backends
3. **Timezone:** Analytics may need timezone adjustments for global users
4. **Load Testing:** Backend not tested under heavy concurrent load

---

## 📋 Deployment Checklist

- [ ] Backend host updated with all env vars (FRONTEND_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- [ ] Vercel frontend env vars set (REACT_APP_API_URL, REACT_APP_GOOGLE_CLIENT_ID)
- [ ] Google Cloud OAuth client has correct origins/redirect URIs
- [ ] Old Google credentials rotated (never expose secrets in Git)
- [ ] Frontend redeploy triggered
- [ ] Backend redeploy triggered
- [ ] Test email verification link in production
- [ ] Test Google Sign-In in production (incognito)
- [ ] Verify analytics load without errors

---

## 🔄 Next Patch Goals

1. Calendar integration refinements
2. Notification system improvements
3. Performance profiling & optimization
4. Mobile responsive fine-tuning
5. Advanced filtering/search

---

**Patch Author:** GitHub Copilot  
**Ready For:** QA / Production Testing
