import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Configure axios defaults for better timeout handling
axios.defaults.timeout = 15000; // 15 second timeout

// Retry helper for handling cold starts
const retryRequest = async (requestFn, retries = 2) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      const isLastRetry = i === retries - 1;
      const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
      
      // Only retry on timeout or network errors
      if (isLastRetry || (!isTimeout && error.response)) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

// Register user
const register = async (userData) => {
  const response = await retryRequest(() => 
    axios.post(`${API_URL}/api/auth/register`, userData)
  );

  if (response.data) {
    localStorage.setItem("user", JSON.stringify(response.data));
  }

  return response.data;
};

// Login user
const login = async (userData) => {
  const response = await retryRequest(() =>
    axios.post(`${API_URL}/api/auth/login`, userData)
  );

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
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.get(`${API_URL}/api/auth/profile`, config);
  return response.data;
};

// Update onboarding status
const updateOnboarding = async (onboardingComplete) => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || !user.token) {
    throw new Error("Not authenticated");
  }

  const config = {
    headers: {
      Authorization: `Bearer ${user.token}`,
    },
  };

  const response = await axios.put(
    `${API_URL}/api/auth/onboarding`,
    { onboardingComplete },
    config
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

