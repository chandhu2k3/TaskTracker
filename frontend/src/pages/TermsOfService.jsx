import React from "react";
import { Link } from "react-router-dom";
import "./Legal.css";

const TermsOfService = () => {
  const LAST_UPDATED = "March 4, 2026";
  const APP_NAME = "Task Tracker Pro";
  const CONTACT_EMAIL = "chandrakanthr876@gmail.com";
  const APP_URL = "https://task-tracker-gilt-three.vercel.app";

  return (
    <div className="legal-page">
      <div className="legal-header">
        <Link to="/login" className="legal-logo">✓ Task Tracker</Link>
        <nav className="legal-nav">
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
          <Link to="/privacy-policy">Privacy Policy</Link>
        </nav>
      </div>

      <main className="legal-content">
        <h1>Terms of Service</h1>
        <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

        <section>
          <p>
            Please read these Terms of Service ("Terms") carefully before using {APP_NAME}
            (the "Service") operated at <a href={APP_URL}>{APP_URL}</a>. By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of these Terms, do not use the Service.
          </p>
        </section>

        <section>
          <h2>1. Eligibility and Account Registration</h2>
          <ul>
            <li>You must be at least 13 years old to use the Service</li>
            <li>You must provide accurate and complete information when creating an account</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials</li>
            <li>You are responsible for all activities that occur under your account</li>
            <li>You must notify us immediately of any unauthorized use of your account at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
          </ul>
        </section>

        <section>
          <h2>2. Acceptable Use</h2>
          <p>You agree to use the Service only for lawful purposes. You may <strong>not</strong>:</p>
          <ul>
            <li>Use the Service for any illegal activity or to violate any applicable laws</li>
            <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure</li>
            <li>Use automated bots, scrapers, or scripts to access the Service without prior written consent</li>
            <li>Upload, transmit, or store malicious code, viruses, or harmful data</li>
            <li>Interfere with or disrupt the integrity or performance of the Service</li>
            <li>Attempt to reverse-engineer, decompile, or disassemble any part of the Service</li>
            <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity</li>
          </ul>
        </section>

        <section>
          <h2>3. Your Content</h2>
          <ul>
            <li>You retain ownership of all content you create within the Service (tasks, todos, notes, templates)</li>
            <li>By using the Service, you grant us a limited license to store and process your content solely to provide the Service to you</li>
            <li>You are responsible for the accuracy and legality of all content you create</li>
            <li>We do not claim any intellectual property rights over your content</li>
          </ul>
        </section>

        <section>
          <h2>4. Google API Integration</h2>
          <ul>
            <li>The Service offers optional integration with Google Sign-In and Google Calendar</li>
            <li>By connecting Google services, you authorize the Service to act on your behalf within the scope you approve (calendar event creation only)</li>
            <li>Your use of Google services through our application is also governed by <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Google's Terms of Service</a></li>
            <li>You may revoke Google access at any time through your profile settings or directly through <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google Account Permissions</a></li>
            <li>We are not responsible for any issues arising from changes to Google's APIs or terms</li>
          </ul>
        </section>

        <section>
          <h2>5. Email Communications</h2>
          <ul>
            <li>By registering, you consent to receive transactional emails including account verification and security notifications</li>
            <li>We do not send marketing emails without your explicit consent</li>
          </ul>
        </section>

        <section>
          <h2>6. Service Availability</h2>
          <ul>
            <li>We strive for maximum uptime but do not guarantee uninterrupted access to the Service</li>
            <li>We may temporarily suspend the Service for maintenance or updates, with notice when practical</li>
            <li>We are not liable for any loss resulting from service unavailability</li>
          </ul>
        </section>

        <section>
          <h2>7. Account Termination</h2>
          <ul>
            <li>You may delete your account at any time by contacting us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
            <li>We reserve the right to suspend or terminate accounts that violate these Terms</li>
            <li>Upon termination, your right to use the Service immediately ceases</li>
            <li>After account deletion, your data will be permanently deleted within 30 days</li>
          </ul>
        </section>

        <section>
          <h2>8. Disclaimer of Warranties</h2>
          <p>
            The Service is provided on an <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> basis without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the Service will be error-free or that defects will be corrected.
          </p>
        </section>

        <section>
          <h2>9. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by applicable law, {APP_NAME} and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, loss of profits, or loss of goodwill, arising out of or in connection with your use of the Service, even if advised of the possibility of such damages.
          </p>
          <p>
            Our total liability for any claim arising from your use of the Service shall not exceed the amount you paid us in the 12 months preceding the claim (or $10 USD if no payments were made).
          </p>
        </section>

        <section>
          <h2>10. Intellectual Property</h2>
          <p>
            The Service, including its design, code, logos, and original content (excluding your user content), is the intellectual property of {APP_NAME} and is protected by copyright and other laws. You may not copy, reproduce, or distribute any part of the Service without prior written permission.
          </p>
        </section>

        <section>
          <h2>11. Privacy</h2>
          <p>
            Your use of the Service is also governed by our{" "}
            <Link to="/privacy-policy">Privacy Policy</Link>, which is incorporated into these Terms by reference.
          </p>
        </section>

        <section>
          <h2>12. Changes to These Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on this page and updating the "Last updated" date. Continued use of the Service after changes constitutes your acceptance of the new Terms.
          </p>
        </section>

        <section>
          <h2>13. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration or in a court of competent jurisdiction.
          </p>
        </section>

        <section>
          <h2>14. Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us at:</p>
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

export default TermsOfService;
