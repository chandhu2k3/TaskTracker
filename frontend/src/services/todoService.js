import api from "./api";
import { getUserTimezone } from "../utils/timezone";

const getConfig = () => ({
  headers: {
    "X-Timezone": getUserTimezone(),
  },
});

// Get todos for today (includes overdue carryover)
const getTodos = async () => {
  const response = await api.get(`/api/todos`, getConfig());
  return response.data;
};

// Create new todo
const createTodo = async (text, deadline = null) => {
  const response = await api.post(
    `/api/todos`,
    { text, deadline },
    getConfig()
  );
  return response.data;
};

// Toggle todo completion
const toggleTodo = async (id, completed) => {
  const response = await api.put(
    `/api/todos/${id}`,
    { completed },
    getConfig()
  );
  return response.data;
};

// Delete todo
const deleteTodo = async (id) => {
  const response = await api.delete(
    `/api/todos/${id}`,
    getConfig()
  );
  return response.data;
};

// Clear all completed todos
const clearCompleted = async () => {
  const response = await api.delete(
    `/api/todos/clear-completed`,
    getConfig()
  );
  return response.data;
};

const todoService = {
  getTodos,
  createTodo,
  toggleTodo,
  deleteTodo,
  clearCompleted,
};

export default todoService;
