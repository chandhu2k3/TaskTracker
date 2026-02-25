import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Create a centralized axios instance with robust network handling
const api = axios.create({
  baseURL: API_URL,
  timeout: 45000, // 45 seconds - very generous for college WiFi + serverless cold starts
});

// Retry configuration
const MAX_RETRIES = 5; // More retries for unreliable networks
const RETRY_DELAY_BASE = 2000; // 2 seconds base delay

// Check if an error is retryable
const isRetryable = (error) => {
  // Network errors (no response at all)
  if (!error.response) return true;

  // Timeout
  if (error.code === "ECONNABORTED") return true;

  // Server errors (502, 503, 504 - common with serverless cold starts)
  if ([502, 503, 504, 408].includes(error.response?.status)) return true;

  // CORS errors often manifest as network errors
  if (error.message?.includes("Network Error")) return true;

  return false;
};

// Request interceptor - attach auth token
api.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - automatic retry with exponential backoff
api.interceptors.response.use(
  (response) => {
    // Log successful responses in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Success] ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
    }
    return response;
  },
  async (error) => {
    const config = error.config;

    // Log detailed error info
    console.error(`[API Error] ${config?.method?.toUpperCase()} ${config?.url}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code,
    });

    // Initialize retry count
    if (!config.__retryCount) {
      config.__retryCount = 0;
    }

    // Check if we should retry
    if (config.__retryCount < MAX_RETRIES && isRetryable(error)) {
      config.__retryCount++;

      const delay = RETRY_DELAY_BASE * Math.pow(2, config.__retryCount - 1);
      console.warn(
        `[API Retry ${config.__retryCount}/${MAX_RETRIES}] ${config.method?.toUpperCase()} ${config.url} - retrying in ${delay}ms...`
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Retry the request
      return api(config);
    }

    // All retries exhausted
    if (config.__retryCount > 0) {
      console.error(
        `[API Failed] ${config.method?.toUpperCase()} ${config.url} after ${config.__retryCount} retries`
      );
    }

    return Promise.reject(error);
  }
);

export { API_URL };
export default api;
