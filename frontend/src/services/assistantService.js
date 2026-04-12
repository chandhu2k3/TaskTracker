import api from "./api";
import { getUserTimezone } from "../utils/timezone";

const getConfig = () => ({
  headers: {
    "X-Timezone": getUserTimezone(),
  },
});

const sendMessage = async (message, context = {}, conversation = []) => {
  const response = await api.post(
    "/api/assistant/message",
    { message, context, conversation },
    getConfig(),
  );
  return response.data;
};

const assistantService = {
  sendMessage,
};

export default assistantService;
