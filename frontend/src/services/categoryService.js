import api from "./api";
import { getUserTimezone } from "../utils/timezone";

const getConfig = () => ({
  headers: {
    "X-Timezone": getUserTimezone(),
  },
});

// Get all categories
const getCategories = async () => {
  const response = await api.get(
    `/api/categories`,
    getConfig()
  );
  return response.data;
};

// Create category
const createCategory = async (categoryData) => {
  const response = await api.post(
    `/api/categories`,
    categoryData,
    getConfig()
  );
  return response.data;
};

// Update category
const updateCategory = async (id, categoryData) => {
  const response = await api.put(
    `/api/categories/${id}`,
    categoryData,
    getConfig()
  );
  return response.data;
};

// Delete category
const deleteCategory = async (id) => {
  const response = await api.delete(
    `/api/categories/${id}`,
    getConfig()
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
