import api from "./api";

// Manually finish a task
const manualFinishTask = async (id) => {
  const response = await api.put(`/api/tasks/${id}/finish`, {});
  return response.data;
};

// Get tasks by date range
const getTasksByDateRange = async (startDate, endDate) => {
  const response = await api.get(
    `/api/tasks/range?startDate=${startDate}&endDate=${endDate}`
  );
  return response.data;
};

// Get tasks for specific week
const getTasksByWeek = async (year, month, weekNumber) => {
  const response = await api.get(
    `/api/tasks/week/${year}/${month}/${weekNumber}`
  );
  return response.data;
};

// Create task
const createTask = async (taskData) => {
  const response = await api.post(`/api/tasks`, taskData);
  return response.data;
};

// Update task (toggle, edit)
const updateTask = async (id, taskData) => {
  const response = await api.put(`/api/tasks/${id}`, taskData);
  return response.data;
};

// Delete task
const deleteTask = async (id) => {
  const response = await api.delete(`/api/tasks/${id}`);
  return response.data;
};

// Delete all tasks for a specific day
const deleteTasksByDay = async (date) => {
  const response = await api.delete(`/api/tasks/day/${date}`);
  return response.data;
};

// Delete all tasks for a specific week
const deleteTasksByWeek = async (year, month, weekNumber) => {
  const response = await api.delete(
    `/api/tasks/week/${year}/${month}/${weekNumber}`
  );
  return response.data;
};

// Get weekly analytics
const getWeeklyAnalytics = async (year, month, weekNumber) => {
  const response = await api.get(
    `/api/tasks/analytics/week/${year}/${month}/${weekNumber}`
  );
  return response.data;
};

// Get monthly analytics
const getMonthlyAnalytics = async (year, month) => {
  const response = await api.get(
    `/api/tasks/analytics/month/${year}/${month}`
  );
  return response.data;
};

// Get category analytics
const getCategoryAnalytics = async (category, startDate, endDate) => {
  let url = `/api/tasks/analytics/category/${category}`;
  if (startDate && endDate) {
    url += `?startDate=${startDate}&endDate=${endDate}`;
  }
  const response = await api.get(url);
  return response.data;
};

// Stop/pause a task
const stopTask = async (id) => {
  const response = await api.put(
    `/api/tasks/${id}`,
    { isActive: false }
  );
  return response.data;
};

const taskService = {
  manualFinishTask,
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
  getDeletedTasks: async () => {
    const response = await api.get(`/api/tasks/deleted`);
    return response.data;
  },
  restoreTask: async (id) => {
    const response = await api.put(`/api/tasks/${id}/restore`, {});
    return response.data;
  },
};

export default taskService;
export { manualFinishTask };
