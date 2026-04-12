# Assistant Implementation Notes

- Fast path stays local for tasks, quick todos, template edits, and weekly insights.
- Chat replies are grounded with a semantic retrieval layer over the user's own tasks, todos, templates, and categories.
- Document embeddings are cached in memory and persisted in MongoDB so they survive restarts.
- Open-ended conversation uses a small chat model only when the prompt is not an action command.
- Recent message history is trimmed to keep the request small and latency low.
- A hard timeout keeps slow model calls from stalling the assistant UI.
- Voice input is browser-native SpeechRecognition, so there is no extra dependency or server cost.
- The assistant keeps the UI as a floating launcher so the page stays usable while the panel is closed.
- If the conversational API key is missing, the assistant falls back to a helpful local response instead of failing.
- Suggested env vars: `ASSISTANT_API_KEY`, `ASSISTANT_MODEL`, `ASSISTANT_BASE_URL`, `ASSISTANT_MAX_TURNS`, `ASSISTANT_MAX_TOKENS`, `ASSISTANT_TEMPERATURE`.
