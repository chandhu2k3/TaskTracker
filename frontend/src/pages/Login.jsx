import React, { useState, useContext, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { AuthContext } from "../context/AuthContext";
import { toast } from "react-toastify";
import "./Auth.css";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, googleLogin, hydrateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    document.body.setAttribute("data-theme", saved);
  }, []);

  // Handle redirect back from email verification link
  useEffect(() => {
    const verified = searchParams.get("verified");
    const email = searchParams.get("email");
    const autologin = searchParams.get("autologin");
    const token = searchParams.get("token");

    if (verified === "success" && autologin === "1" && token) {
      const userData = {
        _id: searchParams.get("id") || "",
        name: searchParams.get("name") || "User",
        email: searchParams.get("email") || "",
        onboardingComplete: searchParams.get("onboardingComplete") === "1",
        emailVerified: true,
        token,
      };
      hydrateUser(userData);
      toast.success("✅ Email verified! You're now logged in.");
      navigate("/dashboard", { replace: true });
      return;
    }

    if (verified === "success")
      toast.success("✅ Email verified! You can now log in.");
    else if (verified === "expired") {
      toast.warn("⚠️ Verification link expired. Request a new one.");
      if (email) navigate(`/verify-pending?email=${encodeURIComponent(email)}`);
    } else if (verified === "invalid")
      toast.error("❌ Invalid verification link.");
    else if (verified === "error")
      toast.error("Something went wrong. Please try again.");
  }, [searchParams, navigate, hydrateUser]);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(formData);
      toast.success("Welcome back! 👋");
      navigate("/dashboard");
    } catch (error) {
      const data = error.response?.data;
      if (data?.requiresVerification) {
        toast.warn("Please verify your email first.");
        navigate(
          `/verify-pending?email=${encodeURIComponent(data.email || formData.email)}`,
        );
      } else {
        toast.error(data?.message || "Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const data = await googleLogin(credentialResponse.credential);
      toast.success(
        `Welcome${data.isNewUser ? "" : " back"}, ${data.name?.split(" ")[0]}! 👋`,
      );
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Google Sign-In failed");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.svg" alt="Task Tracker" />
        </div>
        <h1>Task Tracker</h1>
        <h2>Welcome Back</h2>

        {/* Google Sign-In */}
        <div className="google-btn-wrap">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => toast.error("Google Sign-In failed")}
            theme="filled_black"
            shape="rectangular"
            size="large"
            text="signin_with"
            width="340"
          />
        </div>

        <div className="auth-divider">
          <span>or sign in with email</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="toggle-pw"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-submit" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <a href="/register">Register</a>
        </p>
        <p className="auth-legal">
          By using this service you agree to our{" "}
          <a href="/terms-of-service">Terms of Service</a> and{" "}
          <a href="/privacy-policy">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

export default Login;
