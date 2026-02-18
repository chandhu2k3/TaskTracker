import api from "./api";
import { getUserTimezone } from "../utils/timezone";

const getConfig = () => ({
  headers: {
    "X-Timezone": getUserTimezone(),
  },
});

// Get all templates
const getTemplates = async () => {
  const response = await api.get(`/api/templates`, getConfig());
  return response.data;
};

// Get single template
const getTemplate = async (id) => {
  const response = await api.get(
    `/api/templates/${id}`,
    getConfig()
  );
  return response.data;
};

// Create template
const createTemplate = async (templateData) => {
  const response = await api.post(
    `/api/templates`,
    templateData,
    getConfig()
  );
  return response.data;
};

// Update template
const updateTemplate = async (id, templateData) => {
  const response = await api.put(
    `/api/templates/${id}`,
    templateData,
    getConfig()
  );
  return response.data;
};

// Delete template
const deleteTemplate = async (id) => {
  const response = await api.delete(
    `/api/templates/${id}`,
    getConfig()
  );
  return response.data;
};

// Apply template to week
const applyTemplate = async (id, year, month, weekNumber) => {
  const response = await api.post(
    `/api/templates/${id}/apply/${year}/${month}/${weekNumber}`,
    {},
    getConfig()
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
