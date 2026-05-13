import api, { API_URL } from "./api";
import { getUserTimezone } from "../utils/timezone";

const getConfig = () => ({
  headers: {
    "X-Timezone": getUserTimezone(),
  },
});

const getStoredUserToken = () => {
  try {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      return null;
    }

    const parsedUser = JSON.parse(storedUser);
    return parsedUser?.token || null;
  } catch (error) {
    return null;
  }
};

const createAssistantError = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  let message = "Assistant request failed";

  try {
    if (contentType.includes("application/json")) {
      const data = await response.json();
      message = data?.message || message;
    } else {
      const text = await response.text();
      message = text || message;
    }
  } catch {
    // Fall back to the default message above.
  }

  const error = new Error(message);
  error.response = {
    status: response.status,
    data: { message },
  };
  throw error;
};

const sendMessage = async (
  message,
  context = {},
  conversation = [],
  options = {},
) => {
  const { stream = false, onChunk } = options;

  if (!stream) {
    const response = await api.post(
      "/api/assistant/message",
      { message, context, conversation },
      getConfig(),
    );

    return response.data;
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Timezone": getUserTimezone(),
  };

  const token = getStoredUserToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${API_URL}/api/assistant/message`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        message,
        context,
        conversation,
        stream: true,
      }),
    });

    if (!response.ok) {
      await createAssistantError(response);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    if (!response.body) {
      return {
        reply: "Assistant returned no response.",
        type: "error",
        refresh: false,
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let reply = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      reply += decoder.decode(value, { stream: true });

      if (typeof onChunk === "function") {
        onChunk(reply);
      }
    }

    reply += decoder.decode();

    if (typeof onChunk === "function") {
      onChunk(reply);
    }

    return {
      reply: reply.trim(),
      type: "chat",
      refresh: false,
      streamed: true,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error(
        "Assistant request timed out. Please try again with a shorter prompt.",
      );
      timeoutError.response = {
        data: {
          message:
            "Assistant request timed out. Please try again with a shorter prompt.",
        },
      };
      throw timeoutError;
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const getHistory = async () => {
  const response = await api.get("/api/assistant/history", getConfig());
  return response.data;
};

const clearHistory = async () => {
  const response = await api.delete("/api/assistant/history", getConfig());
  return response.data;
};

const getStatus = async () => {
  const response = await api.get("/api/assistant/status", getConfig());
  return response.data;
};

const assistantService = {
  sendMessage,
  getHistory,
  clearHistory,
  getStatus,
};

export default assistantService;
