import api from "./api";
import { getUserTimezone } from "../utils/timezone";

const getConfig = () => ({
  headers: {
    "X-Timezone": getUserTimezone(),
  },
});

const startSleep = async () => {
  try {
    console.log("Starting sleep session...");
    const response = await api.post(`/api/sleep/start`, {}, getConfig());
    console.log("Sleep session started:", response.data);
    return response.data;
  } catch (error) {
    console.error("Start sleep error:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || "Failed to start sleep tracking",
    );
  }
};

const stopSleep = async () => {
  try {
    const response = await api.put(`/api/sleep/stop`, {}, getConfig());
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || "Failed to stop sleep tracking",
    );
  }
};

const getActiveSleep = async () => {
  try {
    const response = await api.get(`/api/sleep/active`, getConfig());
    return response.data;
  } catch (error) {
    // Return null if no active session or API is unavailable
    return null;
  }
};

const getSleepHistory = async (startDate, endDate) => {
  const response = await api.get(`/api/sleep/history`, {
    params: { startDate, endDate },
    ...getConfig(),
  });
  return response.data;
};

const getSleepAnalytics = async (startDate, endDate) => {
  const response = await api.get(`/api/sleep/analytics`, {
    params: { startDate, endDate },
    ...getConfig(),
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
