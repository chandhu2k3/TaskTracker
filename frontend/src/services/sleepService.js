import axios from "axios";

const API_URL = "http://localhost:5000/api/sleep";

const getAuthHeader = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || !user.token) {
    console.error("No auth token found for sleep service");
    throw new Error("Authentication required");
  }
  return {
    headers: {
      Authorization: `Bearer ${user.token}`,
    },
  };
};

const startSleep = async () => {
  try {
    console.log("Starting sleep session...");
    const response = await axios.post(`${API_URL}/start`, {}, getAuthHeader());
    console.log("Sleep session started:", response.data);
    return response.data;
  } catch (error) {
    console.error("Start sleep error:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || "Failed to start sleep tracking"
    );
  }
};

const stopSleep = async () => {
  try {
    const response = await axios.put(`${API_URL}/stop`, {}, getAuthHeader());
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || "Failed to stop sleep tracking"
    );
  }
};

const getActiveSleep = async () => {
  try {
    const response = await axios.get(`${API_URL}/active`, getAuthHeader());
    return response.data;
  } catch (error) {
    // Return null if no active session or API is unavailable
    return null;
  }
};

const getSleepHistory = async (startDate, endDate) => {
  const response = await axios.get(`${API_URL}/history`, {
    params: { startDate, endDate },
    ...getAuthHeader(),
  });
  return response.data;
};

const getSleepAnalytics = async (startDate, endDate) => {
  const response = await axios.get(`${API_URL}/analytics`, {
    params: { startDate, endDate },
    ...getAuthHeader(),
  });
  return response.data;
};

const sleepService = {
  startSleep,
  stopSleep,
  getActiveSleep,
  getSleepHistory,
  getSleepAnalytics,
};

export default sleepService;
