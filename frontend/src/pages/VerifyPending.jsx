import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import authService from "../services/authService";
import Seo from "../components/Seo";
import "./Auth.css";

const VerifyPending = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  const handleResend = async () => {
    if (!email) return toast.error("Email address not found.");
    setResending(true);
    try {
      await authService.resendVerification(email);
      toast.success("Verification email resent! Check your inbox.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to resend email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-container">
      <Seo
        title="Verify Your Email"
        description="Email verification pending for your Task Tracker Pro account."
        path="/verify-pending"
        noindex
      />
      <div className="auth-card verify-card">
        <div className="verify-icon">📧</div>
        <h1>Task Tracker</h1>
        <h2>Check Your Email</h2>
        <p className="verify-msg">
          We sent a verification link to
          <br />
          <strong className="verify-email">{email || "your email"}</strong>
        </p>
        <p className="verify-sub">
          Click the link in the email to activate your account. The link expires
          in 24 hours.
        </p>

        <button
          className="btn-submit"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? "Sending…" : "Resend Verification Email"}
        </button>

        <div className="verify-steps">
          <p className="verify-hint">
            📬 Don't see it? Check your spam / junk folder.
          </p>
        </div>

        <p className="auth-switch">
          Already verified? <a href="/login">Log in</a>
          &nbsp;·&nbsp;
          <span className="link-btn" onClick={() => navigate("/register")}>
            Use a different email
          </span>
        </p>
      </div>
    </div>
  );
};

export default VerifyPending;
