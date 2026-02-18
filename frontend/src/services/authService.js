import api from "./api";

// Register user
const register = async (userData) => {
  const response = await api.post(`/api/auth/register`, userData);

  if (response.data) {
    localStorage.setItem("user", JSON.stringify(response.data));
  }

  return response.data;
};

// Login user
const login = async (userData) => {
  const response = await api.post(`/api/auth/login`, userData);

  if (response.data) {
    localStorage.setItem("user", JSON.stringify(response.data));
  }

  return response.data;
};

// Logout user
const logout = () => {
  localStorage.removeItem("user");
};

// Get user profile
const getProfile = async (token) => {
  const response = await api.get(`/api/auth/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

// Update onboarding status
const updateOnboarding = async (onboardingComplete) => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || !user.token) {
    throw new Error("Not authenticated");
  }

  const response = await api.put(
    `/api/auth/onboarding`,
    { onboardingComplete }
  );

  // Update local storage with new onboarding status
  if (response.data) {
    const updatedUser = { ...user, onboardingComplete: response.data.onboardingComplete };
    localStorage.setItem("user", JSON.stringify(updatedUser));
  }

  return response.data;
};

const authService = {
  register,
  login,
  logout,
  getProfile,
  updateOnboarding,
};

export default authService;

