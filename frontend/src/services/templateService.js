import axios from "axios";
import { getUserTimezone } from "../utils/timezone";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const getAuthConfig = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  return {
    headers: {
      Authorization: `Bearer ${user?.token}`,
      "X-Timezone": getUserTimezone(),
    },
  };
};

// Get all templates
const getTemplates = async () => {
  const response = await axios.get(`${API_URL}/api/templates`, getAuthConfig());
  return response.data;
};

// Get single template
const getTemplate = async (id) => {
  const response = await axios.get(
    `${API_URL}/api/templates/${id}`,
    getAuthConfig()
  );
  return response.data;
};

// Create template
const createTemplate = async (templateData) => {
  const response = await axios.post(
    `${API_URL}/api/templates`,
    templateData,
    getAuthConfig()
  );
  return response.data;
};

// Update template
const updateTemplate = async (id, templateData) => {
  const response = await axios.put(
    `${API_URL}/api/templates/${id}`,
    templateData,
    getAuthConfig()
  );
  return response.data;
};

// Delete template
const deleteTemplate = async (id) => {
  const response = await axios.delete(
    `${API_URL}/api/templates/${id}`,
    getAuthConfig()
  );
  return response.data;
};

// Apply template to week
const applyTemplate = async (id, year, month, weekNumber) => {
  const response = await axios.post(
    `${API_URL}/api/templates/${id}/apply/${year}/${month}/${weekNumber}`,
    {},
    getAuthConfig()
  );
  return response.data;
};

const templateService = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
};

export default templateService;
