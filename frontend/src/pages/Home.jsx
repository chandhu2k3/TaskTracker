import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import "./Home.css";

const Home = () => {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "dark",
  );

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="home-page">
      <Seo
        title="Daily Task & Productivity Manager"
        description="Plan daily tasks, track quick todos, sync reminders to Google Calendar, and stay focused with Task Tracker Pro."
        path="/"
      />
      {/* Navigation */}
      <header className="home-header">
        <div className="home-header-inner">
          <Link to="/" className="home-logo">
            ✓ Task Tracker
          </Link>
          <nav className="home-nav">
            <Link to="/login" className="home-nav-link">
              Login
            </Link>
            <Link to="/register" className="home-nav-btn">
              Get Started Free
            </Link>
            <button
              className="home-theme-toggle"
              onClick={toggleTheme}
              title="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-inner">
          <h1 className="home-hero-title">
            Manage Tasks.
            <br />
            <span className="home-hero-accent">Stay Focused.</span>
            <br />
            Get Things Done.
          </h1>
          <p className="home-hero-sub">
            Task Tracker Pro is a smart productivity app that helps you organize
            your work, track daily todos, and sync reminders directly to Google
            Calendar — all in one place.
          </p>
          <div className="home-hero-cta">
            <Link to="/register" className="home-btn-primary">
              Start for Free
            </Link>
            <Link to="/login" className="home-btn-secondary">
              Sign In
            </Link>
          </div>
        </div>
        <div className="home-hero-badges">
          <span className="home-badge">✓ Email Verification</span>
          <span className="home-badge">✓ Google Sign-In</span>
          <span className="home-badge">✓ Calendar Sync</span>
          <span className="home-badge">✓ Free to Use</span>
        </div>
      </section>

      {/* Features Section */}
      <section className="home-features">
        <h2 className="home-section-title">
          Everything you need to stay productive
        </h2>
        <div className="home-features-grid">
          <div className="home-feature-card">
            <div className="home-feature-icon">📋</div>
            <h3>Smart Task Management</h3>
            <p>
              Create and organize tasks with priorities, deadlines, planned
              times, and categories. Quickly track what matters most.
            </p>
          </div>
          <div className="home-feature-card">
            <div className="home-feature-icon">✅</div>
            <h3>Daily Todos</h3>
            <p>
              Build a structured daily todo list to stay on top of recurring
              responsibilities and day-to-day work items.
            </p>
          </div>
          <div className="home-feature-card">
            <div className="home-feature-icon">📅</div>
            <h3>Google Calendar Sync</h3>
            <p>
              Automatically add task reminders to your Google Calendar at the
              click of a button. Never miss a deadline.
            </p>
          </div>
          <div className="home-feature-card">
            <div className="home-feature-icon">📊</div>
            <h3>Progress Dashboard</h3>
            <p>
              Get a clear overview of your completed tasks, pending work, and
              productivity trends at a glance.
            </p>
          </div>
          <div className="home-feature-card">
            <div className="home-feature-icon">🏷️</div>
            <h3>Templates & Categories</h3>
            <p>
              Create reusable task templates and custom categories to maintain a
              consistent, organized workflow.
            </p>
          </div>
          <div className="home-feature-card">
            <div className="home-feature-icon">🔒</div>
            <h3>Secure & Private</h3>
            <p>
              Your data is encrypted, your passwords are hashed, and your Google
              access is scoped to the minimum required.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="home-how">
        <h2 className="home-section-title">Get started in seconds</h2>
        <div className="home-steps">
          <div className="home-step">
            <div className="home-step-num">1</div>
            <h3>Create your account</h3>
            <p>
              Register with email or sign in with Google. Email accounts are
              verified for security.
            </p>
          </div>
          <div className="home-step-arrow">→</div>
          <div className="home-step">
            <div className="home-step-num">2</div>
            <h3>Add your tasks</h3>
            <p>
              Create tasks with details, deadlines, and categories. Build your
              daily todo list.
            </p>
          </div>
          <div className="home-step-arrow">→</div>
          <div className="home-step">
            <div className="home-step-num">3</div>
            <h3>Stay on track</h3>
            <p>
              Track progress, sync reminders to Google Calendar, and complete
              tasks efficiently.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="home-cta-banner">
        <h2>Ready to take control of your tasks?</h2>
        <p>
          Join thousands of users who manage their work smarter with Task
          Tracker Pro.
        </p>
        <Link to="/register" className="home-btn-primary home-btn-large">
          Get Started — It's Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <span className="home-logo">✓ Task Tracker</span>
            <p>A smart productivity tool for modern professionals.</p>
          </div>
          <div className="home-footer-links">
            <h4>Account</h4>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </div>
          <div className="home-footer-links">
            <h4>Legal</h4>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-service">Terms of Service</Link>
          </div>
        </div>
        <div className="home-footer-bottom">
          <p>
            © {new Date().getFullYear()} Task Tracker Pro. All rights reserved.
          </p>
          <p>
            <Link to="/privacy-policy">Privacy Policy</Link> ·{" "}
            <Link to="/terms-of-service">Terms of Service</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
