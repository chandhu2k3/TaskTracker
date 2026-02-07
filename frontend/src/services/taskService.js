import axios from "axios";
import { getUserTimezone } from "../utils/timezone";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Get auth token and timezone header
const getAuthConfig = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || !user.token) {
    console.error("No user token found in localStorage");
  }
  return {
    headers: {
      Authorization: `Bearer ${user?.token}`,
      "X-Timezone": getUserTimezone(),
    },
  };
};

// Get tasks by date range
const getTasksByDateRange = async (startDate, endDate) => {
  const response = await axios.get(
    `${API_URL}/api/tasks/range?startDate=${startDate}&endDate=${endDate}`,
    getAuthConfig()
  );
  return response.data;
};

// Get tasks for specific week
const getTasksByWeek = async (year, month, weekNumber) => {
  const response = await axios.get(
    `${API_URL}/api/tasks/week/${year}/${month}/${weekNumber}`,
    getAuthConfig()
  );
  return response.data;
};

// Create task
const createTask = async (taskData) => {
  const response = await axios.post(
    `${API_URL}/api/tasks`,
    taskData,
    getAuthConfig()
  );
  return response.data;
};

// Update task (toggle, edit)
const updateTask = async (id, taskData) => {
  const response = await axios.put(
    `${API_URL}/api/tasks/${id}`,
    taskData,
    getAuthConfig()
  );
  return response.data;
};

// Delete task
const deleteTask = async (id) => {
  const response = await axios.delete(
    `${API_URL}/api/tasks/${id}`,
    getAuthConfig()
  );
  return response.data;
};

// Delete all tasks for a specific day
const deleteTasksByDay = async (date) => {
  const response = await axios.delete(
    `${API_URL}/api/tasks/day/${date}`,
    getAuthConfig()
  );
  return response.data;
};

// Delete all tasks for a specific week
const deleteTasksByWeek = async (year, month, weekNumber) => {
  const response = await axios.delete(
    `${API_URL}/api/tasks/week/${year}/${month}/${weekNumber}`,
    getAuthConfig()
  );
  return response.data;
};

// Get weekly analytics
const getWeeklyAnalytics = async (year, month, weekNumber) => {
  const response = await axios.get(
    `${API_URL}/api/tasks/analytics/week/${year}/${month}/${weekNumber}`,
    getAuthConfig()
  );
  return response.data;
};

// Get monthly analytics
const getMonthlyAnalytics = async (year, month) => {
  const response = await axios.get(
    `${API_URL}/api/tasks/analytics/month/${year}/${month}`,
    getAuthConfig()
  );
  return response.data;
};

// Get category analytics
const getCategoryAnalytics = async (category, startDate, endDate) => {
  let url = `${API_URL}/api/tasks/analytics/category/${category}`;
  if (startDate && endDate) {
    url += `?startDate=${startDate}&endDate=${endDate}`;
  }
  const response = await axios.get(url, getAuthConfig());
  return response.data;
};

// Stop/pause a task
const stopTask = async (id) => {
  // To stop a task, we update it with isActive: false and calculate end time
  const response = await axios.put(
    `${API_URL}/api/tasks/${id}`,
    { isActive: false },
    getAuthConfig()
  );
  return response.data;
};

const taskService = {
  getTasksByDateRange,
  getTasksByWeek,
  createTask,
  updateTask,
  deleteTask,
  deleteTasksByDay,
  deleteTasksByWeek,
  stopTask,
  getWeeklyAnalytics,
  getMonthlyAnalytics,
  getCategoryAnalytics,
};

export default taskService;
