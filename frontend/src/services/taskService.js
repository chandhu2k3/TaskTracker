import api from "./api";
import { getUserTimezone } from "../utils/timezone";

// Get timezone header (auth is handled by api interceptor)
const getConfig = () => ({
  headers: {
    "X-Timezone": getUserTimezone(),
  },
});

// Get tasks by date range
const getTasksByDateRange = async (startDate, endDate) => {
  const response = await api.get(
    `/api/tasks/range?startDate=${startDate}&endDate=${endDate}`,
    getConfig()
  );
  return response.data;
};

// Get tasks for specific week
const getTasksByWeek = async (year, month, weekNumber) => {
  const response = await api.get(
    `/api/tasks/week/${year}/${month}/${weekNumber}`,
    getConfig()
  );
  return response.data;
};

// Create task
const createTask = async (taskData) => {
  const response = await api.post(
    `/api/tasks`,
    taskData,
    getConfig()
  );
  return response.data;
};

// Update task (toggle, edit)
const updateTask = async (id, taskData) => {
  const response = await api.put(
    `/api/tasks/${id}`,
    taskData,
    getConfig()
  );
  return response.data;
};

// Delete task
const deleteTask = async (id) => {
  const response = await api.delete(
    `/api/tasks/${id}`,
    getConfig()
  );
  return response.data;
};

// Delete all tasks for a specific day
const deleteTasksByDay = async (date) => {
  const response = await api.delete(
    `/api/tasks/day/${date}`,
    getConfig()
  );
  return response.data;
};

// Delete all tasks for a specific week
const deleteTasksByWeek = async (year, month, weekNumber) => {
  const response = await api.delete(
    `/api/tasks/week/${year}/${month}/${weekNumber}`,
    getConfig()
  );
  return response.data;
};

// Get weekly analytics
const getWeeklyAnalytics = async (year, month, weekNumber) => {
  const response = await api.get(
    `/api/tasks/analytics/week/${year}/${month}/${weekNumber}`,
    getConfig()
  );
  return response.data;
};

// Get monthly analytics
const getMonthlyAnalytics = async (year, month) => {
  const response = await api.get(
    `/api/tasks/analytics/month/${year}/${month}`,
    getConfig()
  );
  return response.data;
};

// Get category analytics
const getCategoryAnalytics = async (category, startDate, endDate) => {
  let url = `/api/tasks/analytics/category/${category}`;
  if (startDate && endDate) {
    url += `?startDate=${startDate}&endDate=${endDate}`;
  }
  const response = await api.get(url, getConfig());
  return response.data;
};

// Stop/pause a task
const stopTask = async (id) => {
  const response = await api.put(
    `/api/tasks/${id}`,
    { isActive: false },
    getConfig()
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
