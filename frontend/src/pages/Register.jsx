import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { AuthContext } from "../context/AuthContext";
import { toast } from "react-toastify";
import "./Auth.css";

const Register = () => {
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) return toast.error("Passwords do not match");
    if (formData.password.length < 6) return toast.error("Password must be at least 6 characters");

    setIsLoading(true);
    try {
      const data = await register({ name: formData.name, email: formData.email, password: formData.password });
      // Navigate to verify pending — do NOT log in
      navigate(`/verify-pending?email=${encodeURIComponent(data.email)}`);
    } catch (error) {
      const res = error.response?.data;
      if (res?.unverified) {
        toast.warn("Account exists but email not verified.");
        navigate(`/verify-pending?email=${encodeURIComponent(res.email)}`);
      } else {
        toast.error(res?.message || "Registration failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const data = await googleLogin(credentialResponse.credential);
      sessionStorage.setItem("isNewRegistration", "true");
      toast.success(`Account created! Welcome, ${data.name?.split(" ")[0]}! 🎉`);
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Google Sign-Up failed");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.svg" alt="Task Tracker" />
        </div>
        <h1>Task Tracker</h1>
        <h2>Create Account</h2>

        {/* Google Sign-Up */}
        <div className="google-btn-wrap">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => toast.error("Google Sign-Up failed")}
            theme="filled_black"
            shape="rectangular"
            size="large"
            text="signup_with"
            width="340"
          />
        </div>

        <div className="auth-divider"><span>or register with email</span></div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Enter your name" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="Enter your email" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="password-wrapper">
              <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required placeholder="At least 6 characters" />
              <button type="button" className="toggle-pw" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required placeholder="Confirm your password" />
          </div>
          <button type="submit" className="btn-submit" disabled={isLoading}>
            {isLoading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <a href="/login">Login</a>
        </p>
      </div>
    </div>
  );
};

export default Register;
