import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import assistantService from "../services/assistantService";
import "./AssistantPanel.css";

const ASSISTANT_HISTORY_LIMIT = 20;

const starterPrompts = [
  "How's my week going?",
  "Analyze my progress",
  "What should I focus on?",
  "Any overdue items?",
  "Add gym on Monday at 6 pm",
];

const defaultAssistantMessages = [
  {
    role: "assistant",
    text: "Hey! I'm your productivity coach 🎯 I can analyze your progress, spot patterns, suggest improvements, and help manage tasks. Try asking 'How am I doing?' or 'Analyze my week'!",
  },
];

const getAssistantHistoryKey = () => {
  try {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      return "assistant-chat-history:anonymous";
    }

    const parsedUser = JSON.parse(storedUser);
    return `assistant-chat-history:${parsedUser?._id || parsedUser?.email || "anonymous"}`;
  } catch (error) {
    return "assistant-chat-history:anonymous";
  }
};

const getStoredAssistantMessages = () => {
  try {
    const storedMessages = localStorage.getItem(getAssistantHistoryKey());
    if (!storedMessages) {
      return defaultAssistantMessages;
    }

    const parsedMessages = JSON.parse(storedMessages);
    if (!Array.isArray(parsedMessages) || parsedMessages.length === 0) {
      return defaultAssistantMessages;
    }

    return parsedMessages
      .filter(
        (message) =>
          message &&
          typeof message.role === "string" &&
          typeof message.text === "string" &&
          message.text.trim().length > 0,
      )
      .slice(-ASSISTANT_HISTORY_LIMIT);
  } catch (error) {
    return defaultAssistantMessages;
  }
};

const AssistantPanel = ({
  selectedDate,
  selectedDayDate,
  activeTab,
  viewMode,
  onRefresh,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => getStoredAssistantMessages());
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [assistantStatus, setAssistantStatus] = useState(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const storageKeyRef = useRef(getAssistantHistoryKey());

  const context = useMemo(
    () => ({
      selectedDate,
      selectedDayDate,
      activeTab,
      viewMode,
    }),
    [selectedDate, selectedDayDate, activeTab, viewMode],
  );

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    setVoiceSupported(true);
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      transcriptRef.current = "";
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        transcript += event.results[index][0].transcript;
      }

      const nextTranscript = transcript.trim();
      transcriptRef.current = nextTranscript;

      if (nextTranscript) {
        setPrompt(nextTranscript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (transcriptRef.current) {
        setPrompt(transcriptRef.current);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      transcriptRef.current = "";

      if (event.error !== "no-speech") {
        toast.error("Voice input stopped. Please try again.");
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrateAssistantHistory = async () => {
      try {
        const data = await assistantService.getHistory();
        const serverMessages = Array.isArray(data?.messages)
          ? data.messages
              .filter(
                (message) =>
                  message &&
                  typeof message.role === "string" &&
                  typeof message.text === "string" &&
                  message.text.trim().length > 0,
              )
              .slice(-ASSISTANT_HISTORY_LIMIT)
          : [];

        if (isMounted && serverMessages.length > 0) {
          setMessages(serverMessages);
        }
      } catch (error) {
        // Keep local storage / default messages when server history is unavailable.
      }
    };

    hydrateAssistantHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAssistantStatus = async () => {
      try {
        const status = await assistantService.getStatus();
        if (isMounted) {
          setAssistantStatus(status);
        }
      } catch (error) {
        if (isMounted) {
          setAssistantStatus({ configured: false });
        }
      }
    };

    loadAssistantStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    storageKeyRef.current = getAssistantHistoryKey();
  }, []);

  useEffect(() => {
    try {
      const trimmedMessages = messages.slice(-ASSISTANT_HISTORY_LIMIT);
      localStorage.setItem(
        storageKeyRef.current,
        JSON.stringify(trimmedMessages),
      );
    } catch (error) {
      // Ignore storage failures so the assistant still works normally.
    }
  }, [messages]);

  const updateMessageAtIndex = (index, text) => {
    setMessages((prev) =>
      prev.map((message, currentIndex) =>
        currentIndex === index ? { ...message, text } : message,
      ),
    );
  };

  const trimConversation = (conversation) =>
    conversation.slice(-ASSISTANT_HISTORY_LIMIT);

  const buildConversation = (nextUserMessage) =>
    trimConversation([...messages, { role: "user", text: nextUserMessage }]);

  const toggleVoiceInput = () => {
    if (!voiceSupported || !recognitionRef.current) {
      toast.info("Voice input is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      return;
    }

    transcriptRef.current = "";

    try {
      recognitionRef.current.start();
    } catch (error) {
      toast.error("Could not start voice input.");
    }
  };

  const handleSubmit = async (value) => {
    const message = (value || prompt).trim();
    if (!message) {
      toast.info("Type a prompt first.");
      return;
    }

    const conversation = buildConversation(message);
    const assistantIndex = messages.length + 1;

    setMessages((prev) => [
      ...trimConversation(prev),
      { role: "user", text: message },
      { role: "assistant", text: "Thinking..." },
    ]);
    setIsSending(true);

    try {
      const result = await assistantService.sendMessage(
        message,
        context,
        conversation,
        {
          stream: true,
          onChunk: (replyText) => {
            updateMessageAtIndex(assistantIndex, replyText || "Thinking...");
          },
        },
      );
      updateMessageAtIndex(assistantIndex, result.reply || "Done.");
      setPrompt("");

      if (result.refresh && typeof onRefresh === "function") {
        await onRefresh(result);
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Assistant request failed";
      updateMessageAtIndex(assistantIndex, errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      <button
        type="button"
        className={`assistant-launcher ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Close assistant" : "Open assistant"}
        title={isOpen ? "Close assistant" : "Open assistant"}
      >
        {isOpen ? "✕" : "📊"}
      </button>

      {isOpen && (
        <section
          className="assistant-panel assistant-panel-popup"
          role="dialog"
          aria-label="AI assistant"
        >
          {assistantStatus && !assistantStatus.configured && (
            <div className="assistant-config-banner">
              Live API responses are not configured yet. Set ASSISTANT_API_KEY
              in the backend env to enable model replies.
            </div>
          )}

          <div className="assistant-panel-header">
            <div>
              <p className="assistant-kicker">Productivity Coach</p>
              <h3>Analyze & Improve</h3>
            </div>
            <div className="assistant-header-actions">
              <div className="assistant-status">
                <span
                  className={`assistant-dot ${isSending ? "busy" : isListening ? "listening" : "ready"}`}
                />
                {assistantStatus && !assistantStatus.configured
                  ? "Setup needed"
                  : isSending
                    ? "Working"
                    : isListening
                      ? "Listening"
                      : "Ready"}
              </div>
              <button
                type="button"
                className="assistant-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close assistant"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="assistant-suggestions">
            {starterPrompts.map((item) => (
              <button
                key={item}
                type="button"
                className="assistant-chip"
                onClick={() => handleSubmit(item)}
                disabled={isSending}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="assistant-thread" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`assistant-bubble ${message.role}`}
              >
                {message.role === "assistant" ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: message.text
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                        .replace(/^• /gm, "‣ ")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />
                ) : (
                  message.text
                )}
              </div>
            ))}
          </div>

          <div className="assistant-composer">
            <textarea
              className="assistant-input"
              placeholder='Try: "How am I doing this week?" or "Where am I spending most time?"'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <div className="assistant-composer-actions">
              <button
                type="button"
                className={`assistant-voice ${isListening ? "listening" : ""}`}
                onClick={toggleVoiceInput}
                disabled={isSending || !voiceSupported}
                aria-pressed={isListening}
                aria-label={
                  isListening ? "Stop voice input" : "Start voice input"
                }
                title={
                  voiceSupported
                    ? isListening
                      ? "Stop voice input"
                      : "Start voice input"
                    : "Voice input not supported"
                }
              >
                {isListening ? "Stop" : "Voice"}
              </button>
              <button
                type="button"
                className="assistant-submit"
                onClick={() => handleSubmit()}
                disabled={isSending}
              >
                {isSending ? "Working..." : "Send"}
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default AssistantPanel;
