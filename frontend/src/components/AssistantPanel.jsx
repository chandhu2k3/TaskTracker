import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import assistantService from "../services/assistantService";
import "./AssistantPanel.css";

const starterPrompts = [
  "Analyze my week",
  "Add gym on Monday at 6 pm",
  "Add pay electricity bill tomorrow",
  "Add meeting prep to template work week on Friday",
];

const AssistantPanel = ({
  selectedDate,
  selectedDayDate,
  activeTab,
  viewMode,
  onRefresh,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "I can chat naturally, analyze your week, create tasks, add quick todos, or edit templates.",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");

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

  const appendMessage = (role, text) => {
    setMessages((prev) => [...prev, { role, text }]);
  };

  const buildConversation = (nextUserMessage) =>
    [...messages, { role: "user", text: nextUserMessage }].slice(-8);

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
    appendMessage("user", message);
    setIsSending(true);

    try {
      const result = await assistantService.sendMessage(
        message,
        context,
        conversation,
      );
      appendMessage("assistant", result.reply || "Done.");
      setPrompt("");

      if (result.refresh && typeof onRefresh === "function") {
        await onRefresh(result);
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Assistant request failed";
      appendMessage("assistant", errorMessage);
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
        {isOpen ? "✕" : "🤖"}
      </button>

      {isOpen && (
        <section
          className="assistant-panel assistant-panel-popup"
          role="dialog"
          aria-label="AI assistant"
        >
          <div className="assistant-panel-header">
            <div>
              <p className="assistant-kicker">AI Assistant</p>
              <h3>Chat with your workspace</h3>
            </div>
            <div className="assistant-header-actions">
              <div className="assistant-status">
                <span
                  className={`assistant-dot ${isSending ? "busy" : isListening ? "listening" : "ready"}`}
                />
                {isSending ? "Working" : isListening ? "Listening" : "Ready"}
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
                {message.text}
              </div>
            ))}
          </div>

          <div className="assistant-composer">
            <textarea
              className="assistant-input"
              placeholder='Try: "How is my week going?" or "Add gym on Monday at 6 pm"'
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
