import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { parseTodoPrompt } from "../utils/assistantParser";
import "./TodoAssistant.css";

const SpeechRecognitionAPI =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

const TodoAssistant = ({ onCreateTodo }) => {
  const [prompt, setPrompt] = useState("");
  const [parsed, setParsed] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const canUseVoice = useMemo(() => Boolean(SpeechRecognitionAPI), []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const syncParsed = (value) => {
    const nextParsed = parseTodoPrompt(value);
    setParsed(nextParsed);
    return nextParsed;
  };

  const handleVerifyAndAdd = async () => {
    if (!prompt.trim()) {
      toast.info("Type or speak a task to analyze first.");
      return;
    }

    const nextParsed = syncParsed(prompt);
    if (!nextParsed.text && !nextParsed.deadline) {
      toast.warning("I could not extract a todo or deadline from that prompt.");
      return;
    }

    if (!nextParsed.text) {
      toast.warning("Please give the assistant a todo description.");
      return;
    }

    await onCreateTodo({
      text: nextParsed.text,
      deadline: nextParsed.deadline,
    });

    toast.success("Todo added from your prompt.");
    setPrompt("");
    setParsed(null);
  };

  const handleVoice = () => {
    if (!canUseVoice) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }

    if (isListening) {
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("Listening for your prompt...");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      if (transcript) {
        setPrompt(transcript);
        setParsed(parseTodoPrompt(transcript));
      }
    };

    recognition.onerror = (event) => {
      toast.error(
        event.error
          ? `Voice input error: ${event.error}`
          : "Voice input failed",
      );
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="todo-assistant">
      <div className="todo-assistant-header">
        <div>
          <p className="todo-assistant-kicker">Assistant</p>
          <h4>Quick voice prompt</h4>
        </div>
        <button
          type="button"
          className={`todo-assistant-voice ${isListening ? "listening" : ""}`}
          onClick={handleVoice}
          title={
            canUseVoice ? "Speak a todo with deadline" : "Voice not supported"
          }
          disabled={isListening}
        >
          {isListening ? "🎙️ Listening" : "🎙️ Voice"}
        </button>
      </div>

      <textarea
        className="todo-assistant-input"
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          setParsed(null);
        }}
        placeholder='Try: "Pay electricity bill next Friday" or "Call mom tomorrow"'
        rows={3}
      />

      <div className="todo-assistant-actions">
        <button
          type="button"
          className="todo-assistant-primary todo-assistant-full"
          onClick={handleVerifyAndAdd}
        >
          Verify & Add
        </button>
      </div>

      <div className="todo-assistant-preview">
        <div className="todo-assistant-preview-label">Parsed result</div>
        <div className="todo-assistant-preview-grid">
          <div>
            <span>Todo</span>
            <strong>{parsed?.text || "Waiting for input"}</strong>
          </div>
          <div>
            <span>Deadline</span>
            <strong>{parsed?.deadline || "No deadline detected"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodoAssistant;
