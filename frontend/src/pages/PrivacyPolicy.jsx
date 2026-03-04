import React from "react";
import { Link } from "react-router-dom";
import "./Legal.css";

const PrivacyPolicy = () => {
  const LAST_UPDATED = "March 4, 2026";
  const APP_NAME = "Task Tracker Pro";
  const CONTACT_EMAIL = "support@tasktrackerpro.app";
  const APP_URL = "https://task-tracker-gilt-three.vercel.app";

  return (
    <div className="legal-page">
      <div className="legal-header">
        <Link to="/login" className="legal-logo">✓ Task Tracker</Link>
        <nav className="legal-nav">
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
          <Link to="/terms-of-service">Terms of Service</Link>
        </nav>
      </div>

      <main className="legal-content">
        <h1>Privacy Policy</h1>
        <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

        <section>
          <p>
            {APP_NAME} ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect,
            use, and safeguard your information when you use our task management application at <a href={APP_URL}>{APP_URL}</a>.
          </p>
        </section>

        <section>
          <h2>1. Information We Collect</h2>
          <h3>1.1 Information You Provide</h3>
          <ul>
            <li><strong>Account information:</strong> name, email address, and password (hashed — never stored in plaintext)</li>
            <li><strong>Task and todo data:</strong> tasks, task names, categories, planned times, deadlines, completion status, and notes you create</li>
            <li><strong>Template data:</strong> task templates and categories you configure</li>
          </ul>

          <h3>1.2 Information from Google (when you connect Google services)</h3>
          <ul>
            <li><strong>Google Sign-In:</strong> If you sign in with Google, we receive your name, email address, and Google account ID. We do not access your Google contacts, Gmail, Drive, or any other Google service.</li>
            <li><strong>Google Calendar:</strong> If you choose to connect Google Calendar, we access only your primary calendar to create events. We request only <code>https://www.googleapis.com/auth/calendar.events</code> — the minimum scope needed to create calendar reminders on your behalf. We do not read, modify, or delete your existing calendar events.</li>
          </ul>
        </section>

        <section>
          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To create and manage your account</li>
            <li>To store and display your tasks, todos, and productivity data</li>
            <li>To create Google Calendar events when you explicitly request a reminder</li>
            <li>To send account-related emails (email verification, welcome emails)</li>
            <li>To improve the application's functionality and performance</li>
          </ul>
          <p>
            We do <strong>not</strong> sell, rent, or share your personal information with third parties for advertising or marketing purposes.
          </p>
        </section>

        <section>
          <h2>3. Google API Services — Limited Use Disclosure</h2>
          <p>
            {APP_NAME}'s use of information received from Google APIs adheres to the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <p>Specifically:</p>
          <ul>
            <li>We only use Google user data to provide the calendar reminder feature you explicitly activate</li>
            <li>We do not use Google user data for advertising or to train AI/ML models</li>
            <li>We do not transfer Google user data to third parties except as necessary to operate the Google Calendar integration</li>
            <li>Human access to Google user data is limited to security and debugging purposes, and only with your explicit consent</li>
            <li>Google OAuth tokens (access token and refresh token) are encrypted and stored securely in our database solely to maintain your calendar connection</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Storage and Security</h2>
          <ul>
            <li>Your data is stored on MongoDB Atlas (cloud database) with encryption at rest</li>
            <li>Passwords are hashed using bcrypt — we never store plaintext passwords</li>
            <li>Authentication uses industry-standard JWT tokens with 30-day expiry</li>
            <li>Google OAuth tokens are stored encrypted and used only to create calendar events on your behalf</li>
            <li>All data is transmitted over HTTPS/TLS</li>
          </ul>
        </section>

        <section>
          <h2>5. Data Retention and Deletion</h2>
          <ul>
            <li>Your account and all associated data remains as long as your account is active</li>
            <li>You can disconnect Google Calendar at any time from your profile — this immediately deletes stored Google tokens from our database</li>
            <li>To delete your account and all data, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
            <li>Deleted tasks are soft-deleted and permanently purged after 30 days</li>
          </ul>
        </section>

        <section>
          <h2>6. Cookies and Local Storage</h2>
          <p>
            We use browser <code>localStorage</code> to store your authentication session (name, email, and JWT token). We do not use tracking cookies or third-party analytics cookies.
          </p>
        </section>

        <section>
          <h2>7. Third-Party Services</h2>
          <p>We use the following third-party services to operate the application:</p>
          <ul>
            <li><strong>MongoDB Atlas</strong> — database hosting (<a href="https://www.mongodb.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>)</li>
            <li><strong>Vercel</strong> — application hosting (<a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>)</li>
            <li><strong>Google APIs</strong> — OAuth sign-in and Calendar integration (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>)</li>
            <li><strong>Resend</strong> — transactional email delivery (<a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>)</li>
          </ul>
        </section>

        <section>
          <h2>8. Children's Privacy</h2>
          <p>
            {APP_NAME} is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us to have it removed.
          </p>
        </section>

        <section>
          <h2>9. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Disconnect Google services at any time</li>
            <li>Export your task data</li>
          </ul>
          <p>To exercise these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </section>

        <section>
          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page and updating the "Last updated" date. Continued use of the service after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2>11. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy or how we handle your data, please contact us at:</p>
          <p>
            <strong>{APP_NAME}</strong><br />
            Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </section>
      </main>

      <footer className="legal-footer">
        <p>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
        <div className="legal-footer-links">
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms-of-service">Terms of Service</Link>
          <Link to="/login">Login</Link>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
