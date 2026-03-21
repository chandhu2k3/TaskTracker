import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import Seo from "../components/Seo";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const VerifyEmail = () => {
  const { token } = useParams();

  useEffect(() => {
    if (token) {
      // Full browser navigation to backend — no CORS issues, backend handles redirect to /login
      window.location.href = `${API_URL}/api/auth/verify-email/${token}`;
    }
  }, [token]);

  return (
    <>
      <Seo
        title="Verifying Email"
        description="Verifying your Task Tracker Pro email address."
        path="/verify-email"
        noindex
      />
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Segoe UI', Arial, sans-serif",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(16px)",
            borderRadius: "20px",
            padding: "48px 40px",
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            maxWidth: "380px",
            width: "90%",
          }}
        >
          {/* Spinner */}
          <div
            style={{
              width: 56,
              height: 56,
              border: "4px solid rgba(30,41,59,0.1)",
              borderTop: "4px solid #1e293b",
              borderRadius: "50%",
              animation: "spin 0.9s linear infinite",
              margin: "0 auto 24px",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          <h2
            style={{
              margin: "0 0 10px",
              color: "#1e293b",
              fontSize: "1.4rem",
              fontWeight: 700,
            }}
          >
            Verifying your email…
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
            Please wait, this will only take a moment.
          </p>
        </div>
      </div>
    </>
  );
};

export default VerifyEmail;
