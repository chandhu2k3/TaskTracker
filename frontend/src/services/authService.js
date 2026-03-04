import api from "./api";

// Register user — returns { email, requiresVerification } (does NOT log in)
const register = async (userData) => {
  const response = await api.post(`/api/auth/register`, userData);
  return response.data;
};

// Login user
const login = async (userData) => {
  const response = await api.post(`/api/auth/login`, userData);
  if (response.data?.token) {
    localStorage.setItem("user", JSON.stringify(response.data));
  }
  return response.data;
};

// Google OAuth Sign-In / Sign-Up
const googleLogin = async (credential) => {
  const response = await api.post(`/api/auth/google`, { credential });
  if (response.data?.token) {
    localStorage.setItem("user", JSON.stringify(response.data));
  }
  return response.data;
};

// Resend verification email
const resendVerification = async (email) => {
  const response = await api.post(`/api/auth/resend-verification`, { email });
  return response.data;
};

// Logout user
const logout = () => {
  localStorage.removeItem("user");
};

// Get user profile
const getProfile = async () => {
  const response = await api.get(`/api/auth/profile`);
  return response.data;
};

// Update onboarding status
const updateOnboarding = async (onboardingComplete) => {
  const response = await api.put(`/api/auth/onboarding`, { onboardingComplete });
  const user = JSON.parse(localStorage.getItem("user"));
  if (user && response.data) {
    localStorage.setItem("user", JSON.stringify({ ...user, onboardingComplete: response.data.onboardingComplete }));
  }
  return response.data;
};

const authService = { register, login, googleLogin, resendVerification, logout, getProfile, updateOnboarding };
export default authService;

