import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Get auth token
const getAuthConfig = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  return {
    headers: {
      Authorization: `Bearer ${user?.token}`,
    },
  };
};

// Get todos for today (includes overdue carryover)
const getTodos = async () => {
  const response = await axios.get(`${API_URL}/api/todos`, getAuthConfig());
  return response.data;
};

// Create new todo
const createTodo = async (text) => {
  const response = await axios.post(
    `${API_URL}/api/todos`,
    { text },
    getAuthConfig()
  );
  return response.data;
};

// Toggle todo completion
const toggleTodo = async (id, completed) => {
  const response = await axios.put(
    `${API_URL}/api/todos/${id}`,
    { completed },
    getAuthConfig()
  );
  return response.data;
};

// Delete todo
const deleteTodo = async (id) => {
  const response = await axios.delete(
    `${API_URL}/api/todos/${id}`,
    getAuthConfig()
  );
  return response.data;
};

// Clear all completed todos
const clearCompleted = async () => {
  const response = await axios.delete(
    `${API_URL}/api/todos/clear-completed`,
    getAuthConfig()
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
