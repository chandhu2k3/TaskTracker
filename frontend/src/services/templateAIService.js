import api from "./api";
import { getUserTimezone } from "../utils/timezone";

const getConfig = () => ({
  headers: { "X-Timezone": getUserTimezone() },
});

const BASE = "/api/assistant/template-sessions";

const createSession = async ({ mode = "create", sourceTemplateId = null } = {}) => {
  const response = await api.post(BASE, { mode, sourceTemplateId }, getConfig());
  return response.data;
};

const listSessions = async () => {
  const response = await api.get(BASE, getConfig());
  return response.data;
};

const getSession = async (id) => {
  const response = await api.get(`${BASE}/${id}`, getConfig());
  return response.data;
};

const sendMessage = async (id, message, expectedVersion) => {
  const response = await api.post(
    `${BASE}/${id}/message`,
    { message, expectedVersion },
    getConfig(),
  );
  return response.data;
};

const getPreview = async (id) => {
  const response = await api.get(`${BASE}/${id}/preview`, getConfig());
  return response.data;
};

const saveSession = async (id, { idempotencyKey, updateExisting = false } = {}) => {
  const response = await api.post(
    `${BASE}/${id}/save`,
    {
      idempotencyKey: idempotencyKey || `${id}-${Date.now()}`,
      updateExisting,
    },
    getConfig(),
  );
  return response.data;
};

const deleteSession = async (id) => {
  const response = await api.delete(`${BASE}/${id}`, getConfig());
  return response.data;
};

const templateAIService = {
  createSession,
  listSessions,
  getSession,
  sendMessage,
  getPreview,
  saveSession,
  deleteSession,
};

export default templateAIService;
