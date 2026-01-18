import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const getAuthConfig = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  return {
    headers: {
      Authorization: `Bearer ${user?.token}`,
    },
  };
};

// Get all categories
const getCategories = async () => {
  const response = await axios.get(
    `${API_URL}/api/categories`,
    getAuthConfig()
  );
  return response.data;
};

// Create category
const createCategory = async (categoryData) => {
  const response = await axios.post(
    `${API_URL}/api/categories`,
    categoryData,
    getAuthConfig()
  );
  return response.data;
};

// Update category
const updateCategory = async (id, categoryData) => {
  const response = await axios.put(
    `${API_URL}/api/categories/${id}`,
    categoryData,
    getAuthConfig()
  );
  return response.data;
};

// Delete category
const deleteCategory = async (id) => {
  const response = await axios.delete(
    `${API_URL}/api/categories/${id}`,
    getAuthConfig()
  );
  return response.data;
};

const categoryService = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};

export default categoryService;
