const { DateTime } = require("luxon");
const Task = require("../models/Task");
const Todo = require("../models/Todo");
const TaskTemplate = require("../models/TaskTemplate");
const Category = require("../models/Category");
const AssistantEmbedding = require("../models/AssistantEmbedding");
const AssistantConversation = require("../models/AssistantConversation");
const tz = require("../utils/timezone");
const {
  parseDateReference,
  parseDurationMinutes,
  parseTimeRange,
  pickCategory,
  extractTemplateName,
  extractDay,
  parseTitle,
  normalizePrompt,
  toDateString,
} = require("../utils/assistantParser");

const ASSISTANT_MODEL = process.env.ASSISTANT_MODEL || "gpt-5.4-mini";
const ASSISTANT_BASE_URL = (
  process.env.ASSISTANT_BASE_URL || "https://api.openai.com/v1"
).replace(/\/$/, "");
const ASSISTANT_API_KEY =
  process.env.ASSISTANT_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.AI_API_KEY;
const ASSISTANT_MAX_TURNS = Number(process.env.ASSISTANT_MAX_TURNS || 8);
const ASSISTANT_MAX_TOKENS = Number(process.env.ASSISTANT_MAX_TOKENS || 500);
const ASSISTANT_TEMPERATURE = Number(process.env.ASSISTANT_TEMPERATURE || 0.4);
const ASSISTANT_REQUEST_TIMEOUT_MS = Number(
  process.env.ASSISTANT_REQUEST_TIMEOUT_MS || 12000,
);
const ASSISTANT_EMBEDDING_MODEL =
  process.env.ASSISTANT_EMBEDDING_MODEL || "text-embedding-3-small";
const ASSISTANT_RAG_USE_EMBEDDINGS =
  process.env.ASSISTANT_RAG_USE_EMBEDDINGS !== "false";
const ASSISTANT_RAG_MAX_RESULTS = Number(
  process.env.ASSISTANT_RAG_MAX_RESULTS || 5,
);
const ASSISTANT_RAG_TASK_LIMIT = Number(
  process.env.ASSISTANT_RAG_TASK_LIMIT || 40,
);
const ASSISTANT_RAG_TODO_LIMIT = Number(
  process.env.ASSISTANT_RAG_TODO_LIMIT || 30,
);
const ASSISTANT_RAG_TEMPLATE_LIMIT = Number(
  process.env.ASSISTANT_RAG_TEMPLATE_LIMIT || 10,
);
const ASSISTANT_RAG_PREFILTER_LIMIT = Number(
  process.env.ASSISTANT_RAG_PREFILTER_LIMIT || 18,
);
const ASSISTANT_EMBEDDING_CACHE_MAX = Number(
  process.env.ASSISTANT_EMBEDDING_CACHE_MAX || 500,
);
const ASSISTANT_MEMORY_LIMIT = Number(process.env.ASSISTANT_MEMORY_LIMIT || 20);

const RAG_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "about",
  "what",
  "when",
  "where",
  "which",
  "will",
  "your",
  "have",
  "has",
  "had",
  "can",
  "could",
  "should",
  "would",
  "there",
  "here",
  "today",
  "tomorrow",
  "week",
  "task",
  "tasks",
  "todo",
  "todos",
  "template",
  "templates",
  "please",
  "me",
  "you",
]);

const semanticEmbeddingCache = new Map();

const dayNameFromDate = (dateString, timezone) => {
  const dateTime = DateTime.fromISO(dateString, { zone: timezone });
  return dateTime.toFormat("cccc").toLowerCase();
};

const semanticCacheKey = (type, item) => {
  const version = item.updatedAt || item.createdAt || item.date || "0";
  return `${type}:${item._id}:${new Date(version).getTime()}`;
};

const semanticRecordKey = (type, itemId) => `${type}:${itemId}`;

const semanticItemVersion = (item) =>
  String(
    new Date(item.updatedAt || item.createdAt || item.date || 0).getTime(),
  );

const pruneSemanticEmbeddingCache = () => {
  while (semanticEmbeddingCache.size > ASSISTANT_EMBEDDING_CACHE_MAX) {
    const oldestKey = semanticEmbeddingCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    semanticEmbeddingCache.delete(oldestKey);
  }
};

const storeSemanticEmbedding = (cacheKey, embedding) => {
  semanticEmbeddingCache.set(cacheKey, embedding);
  pruneSemanticEmbeddingCache();
};

const getSemanticEmbedding = (cacheKey) =>
  semanticEmbeddingCache.get(cacheKey) || null;

const cosineSimilarity = (left, right) => {
  if (!left || !right || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
};

const fetchEmbeddings = async (inputs) => {
  if (!ASSISTANT_API_KEY || inputs.length === 0) {
    return [];
  }

  const response = await fetch(`${ASSISTANT_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ASSISTANT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ASSISTANT_EMBEDDING_MODEL,
      input: inputs,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data?.error?.message || "Assistant embedding request failed.",
    );
  }

  return (data?.data || []).map((item) => item.embedding);
};

const buildSelectedWeekRange = (selectedDate, timezone) => {
  if (
    selectedDate?.year === undefined ||
    selectedDate?.month === null ||
    !selectedDate?.week
  ) {
    return null;
  }

  return tz.getWeekDates(
    selectedDate.year,
    selectedDate.month,
    selectedDate.week,
    timezone,
  );
};

const tokenizeRetrievalTerms = (text) => {
  const terms =
    normalizePrompt(text)
      .toLowerCase()
      .match(/[a-z0-9]+/g) || [];
  return [
    ...new Set(
      terms.filter((term) => term.length > 2 && !RAG_STOP_WORDS.has(term)),
    ),
  ];
};

const scoreTextAgainstTerms = (text, terms) => {
  if (!text || terms.length === 0) {
    return 0;
  }

  const haystack = normalizePrompt(text).toLowerCase();
  return terms.reduce((score, term) => {
    if (!haystack.includes(term)) {
      return score;
    }

    return score + Math.min(3, Math.ceil(term.length / 4));
  }, 0);
};

const getDateString = (value, timezone) => {
  if (!value) {
    return null;
  }

  const dateTime = DateTime.fromJSDate(new Date(value), { zone: timezone });
  if (!dateTime.isValid) {
    return null;
  }

  return dateTime.toFormat("yyyy-LL-dd");
};

const formatTaskSnippet = (task, timezone) => {
  const dateLabel = task.date
    ? DateTime.fromJSDate(new Date(task.date), { zone: timezone }).toFormat(
        "ccc LLL d",
      )
    : "no date";
  const scheduleLabel = task.scheduledStartTime
    ? ` @ ${task.scheduledStartTime}${task.scheduledEndTime ? `-${task.scheduledEndTime}` : ""}`
    : "";
  const statusLabel = task.isActive
    ? "active"
    : task.totalTime > 0
      ? "done"
      : "pending";

  return `${task.name} [${task.category}] ${dateLabel}${scheduleLabel} (${statusLabel})`;
};

const formatTodoSnippet = (todo, todayString) => {
  const deadlineLabel = todo.deadline
    ? `deadline ${todo.deadline}`
    : `dated ${todo.date}`;
  const statusLabel = todo.completed
    ? "done"
    : todo.deadline && todo.deadline < todayString
      ? "overdue"
      : "open";

  return `${todo.text} (${deadlineLabel}, ${statusLabel})`;
};

const formatTemplateSnippet = (template) => {
  const taskCount = template.tasks?.length || 0;
  const todoCount = template.quickTodos?.length || 0;
  return `${template.name} (${taskCount} tasks, ${todoCount} quick todos)`;
};

const scoreTaskForRetrieval = (
  task,
  terms,
  timezone,
  selectedWeekRange,
  todayString,
) => {
  let score = scoreTextAgainstTerms(
    `${task.name} ${task.category} ${task.day} ${task.scheduledStartTime || ""} ${task.scheduledEndTime || ""}`,
    terms,
  );

  if (task.isActive) {
    score += 4;
  }

  if ((task.totalTime || 0) > 0) {
    score += 2;
  }

  if ((task.plannedTime || 0) > 0) {
    score += 1;
  }

  const taskDateString = getDateString(task.date, timezone);
  if (taskDateString && taskDateString === todayString) {
    score += 3;
  }

  if (
    taskDateString &&
    selectedWeekRange &&
    taskDateString >= selectedWeekRange.startDate &&
    taskDateString <= selectedWeekRange.endDate
  ) {
    score += 2;
  }

  return score;
};

const scoreTodoForRetrieval = (todo, terms, todayString) => {
  let score = scoreTextAgainstTerms(
    `${todo.text} ${todo.deadline || ""} ${todo.date || ""}`,
    terms,
  );

  if (!todo.completed) {
    score += 2;
  }

  if (todo.deadline && todo.deadline < todayString) {
    score += 3;
  }

  if (todo.deadline === todayString || todo.date === todayString) {
    score += 3;
  }

  return score;
};

const scoreTemplateForRetrieval = (template, terms) => {
  const taskText = (template.tasks || [])
    .map((task) => `${task.name} ${task.category} ${task.day}`)
    .join(" ");
  const todoText = (template.quickTodos || [])
    .map((todo) => `${todo.text} ${todo.day}`)
    .join(" ");

  return scoreTextAgainstTerms(
    `${template.name} ${taskText} ${todoText}`,
    terms,
  );
};

const buildRetrievalCandidates = ({
  recentTasks,
  weekTasks,
  todos,
  templates,
  categories,
  timezone,
  selectedWeekRange,
  todayString,
  terms,
}) => {
  const taskMap = new Map();
  [...recentTasks, ...weekTasks].forEach((task) => {
    taskMap.set(String(task._id), task);
  });

  const candidates = [...taskMap.values()].map((task) => ({
    type: "task",
    item: task,
    text: `Task: ${formatTaskSnippet(task, timezone)}`,
    cacheKey: semanticCacheKey("task", task),
    lexicalScore: scoreTaskForRetrieval(
      task,
      terms,
      timezone,
      selectedWeekRange,
      todayString,
    ),
  }));

  for (const todo of todos) {
    candidates.push({
      type: "todo",
      item: todo,
      text: `Quick todo: ${formatTodoSnippet(todo, todayString)}`,
      cacheKey: semanticCacheKey("todo", todo),
      lexicalScore: scoreTodoForRetrieval(todo, terms, todayString),
    });
  }

  for (const template of templates) {
    const taskNames = (template.tasks || [])
      .slice(0, 4)
      .map((task) => task.name)
      .join(", ");
    const todoNames = (template.quickTodos || [])
      .slice(0, 4)
      .map((todo) => todo.text)
      .join(", ");

    candidates.push({
      type: "template",
      item: template,
      text: `Template: ${formatTemplateSnippet(template)}${taskNames ? ` Tasks: ${taskNames}.` : ""}${todoNames ? ` Todos: ${todoNames}.` : ""}`,
      cacheKey: semanticCacheKey("template", template),
      lexicalScore: scoreTemplateForRetrieval(template, terms),
    });
  }

  for (const category of categories) {
    candidates.push({
      type: "category",
      item: category,
      text: `Category: ${category.name}${category.icon ? ` (${category.icon})` : ""}`,
      cacheKey: semanticCacheKey("category", category),
      lexicalScore: scoreTextAgainstTerms(
        `${category.name} ${category.icon || ""}`,
        terms,
      ),
    });
  }

  return candidates;
};

const rerankRetrievalCandidates = async ({
  prompt,
  candidates,
  timezone,
  selectedDate,
  userId,
}) => {
  const selectedWeekRange = buildSelectedWeekRange(selectedDate, timezone);
  const todayString = tz.getTodayString(timezone);
  const prefiltered = [...candidates]
    .sort((a, b) => {
      if (b.lexicalScore !== a.lexicalScore) {
        return b.lexicalScore - a.lexicalScore;
      }

      return (
        new Date(b.item.updatedAt || b.item.createdAt || b.item.date) -
        new Date(a.item.updatedAt || a.item.createdAt || a.item.date)
      );
    })
    .slice(0, ASSISTANT_RAG_PREFILTER_LIMIT);

  if (
    !ASSISTANT_RAG_USE_EMBEDDINGS ||
    !ASSISTANT_API_KEY ||
    prefiltered.length === 0
  ) {
    return prefiltered.slice(0, ASSISTANT_RAG_MAX_RESULTS);
  }

  try {
    const persistentRecords = await AssistantEmbedding.find({
      user: userId,
      $or: prefiltered.map((candidate) => ({
        type: candidate.type,
        itemId: String(candidate.item._id),
      })),
    }).lean();

    const persistentRecordMap = new Map(
      persistentRecords.map((record) => [
        semanticRecordKey(record.type, record.itemId),
        record,
      ]),
    );

    const semanticEmbeddingMap = new Map();
    const missingCandidates = [];

    prefiltered.forEach((candidate) => {
      const memoryEmbedding = getSemanticEmbedding(candidate.cacheKey);
      if (memoryEmbedding) {
        semanticEmbeddingMap.set(candidate.cacheKey, memoryEmbedding);
        return;
      }

      const itemId = String(candidate.item._id);
      const currentVersion = semanticItemVersion(candidate.item);
      const persistentRecord = persistentRecordMap.get(
        semanticRecordKey(candidate.type, itemId),
      );

      if (
        persistentRecord &&
        persistentRecord.itemVersion === currentVersion &&
        Array.isArray(persistentRecord.embedding) &&
        persistentRecord.embedding.length > 0
      ) {
        semanticEmbeddingMap.set(
          candidate.cacheKey,
          persistentRecord.embedding,
        );
        storeSemanticEmbedding(candidate.cacheKey, persistentRecord.embedding);
        return;
      }

      missingCandidates.push({
        candidate,
        currentVersion,
      });
    });

    const queryEmbeddingInputs = [
      prompt,
      ...missingCandidates.map(({ candidate }) => candidate.text),
    ];
    const embeddings = await fetchEmbeddings(queryEmbeddingInputs);
    if (embeddings.length === 0) {
      return prefiltered.slice(0, ASSISTANT_RAG_MAX_RESULTS);
    }

    const queryEmbedding = embeddings[0];
    const refreshedEmbeddings = embeddings.slice(1);
    const bulkOperations = [];

    missingCandidates.forEach(({ candidate, currentVersion }, index) => {
      const embedding = refreshedEmbeddings[index];
      if (!embedding) {
        return;
      }

      semanticEmbeddingMap.set(candidate.cacheKey, embedding);
      storeSemanticEmbedding(candidate.cacheKey, embedding);
      bulkOperations.push({
        updateOne: {
          filter: {
            user: userId,
            type: candidate.type,
            itemId: String(candidate.item._id),
          },
          update: {
            $set: {
              itemVersion: currentVersion,
              content: candidate.text,
              embedding,
            },
          },
          upsert: true,
        },
      });
    });

    if (bulkOperations.length > 0) {
      await AssistantEmbedding.bulkWrite(bulkOperations, { ordered: false });
    }

    const ranked = prefiltered
      .map((candidate) => {
        const semanticEmbedding =
          semanticEmbeddingMap.get(candidate.cacheKey) || null;
        const semanticScore = semanticEmbedding
          ? Math.max(0, cosineSimilarity(queryEmbedding, semanticEmbedding))
          : 0;
        const freshnessBoost =
          candidate.type === "task" && candidate.item.isActive
            ? 0.18
            : candidate.type === "todo" && !candidate.item.completed
              ? 0.12
              : candidate.type === "template"
                ? 0.08
                : 0.05;
        const recencyBoost =
          candidate.type === "task" &&
          candidate.item.date &&
          getDateString(candidate.item.date, timezone) === todayString
            ? 0.1
            : candidate.type === "task" &&
                candidate.item.date &&
                selectedWeekRange &&
                (() => {
                  const candidateDate = getDateString(
                    candidate.item.date,
                    timezone,
                  );
                  return (
                    candidateDate >= selectedWeekRange.startDate &&
                    candidateDate <= selectedWeekRange.endDate
                  );
                })()
              ? 0.06
              : candidate.type === "todo" &&
                  (candidate.item.deadline === todayString ||
                    candidate.item.date === todayString)
                ? 0.1
                : 0;

        return {
          ...candidate,
          semanticScore,
          finalScore:
            semanticScore * 10 +
            candidate.lexicalScore +
            freshnessBoost +
            recencyBoost,
        };
      })
      .sort((a, b) => {
        if (b.finalScore !== a.finalScore) {
          return b.finalScore - a.finalScore;
        }

        return b.lexicalScore - a.lexicalScore;
      })
      .slice(0, ASSISTANT_RAG_MAX_RESULTS);

    if (ranked.length > 0) {
      return ranked;
    }
  } catch (error) {
    return prefiltered.slice(0, ASSISTANT_RAG_MAX_RESULTS);
  }

  return prefiltered.slice(0, ASSISTANT_RAG_MAX_RESULTS);
};

const buildRagContext = async ({ userId, prompt, timezone, selectedDate }) => {
  const terms = tokenizeRetrievalTerms(prompt);
  const selectedWeekRange = buildSelectedWeekRange(selectedDate, timezone);

  const [recentTasks, weekTasks, todos, templates, categories] =
    await Promise.all([
      Task.find({ user: userId, deleted: { $ne: true } })
        .sort({ updatedAt: -1 })
        .limit(ASSISTANT_RAG_TASK_LIMIT)
        .lean(),
      selectedWeekRange
        ? Task.find({
            user: userId,
            deleted: { $ne: true },
            date: {
              $gte: selectedWeekRange.startDate,
              $lte: selectedWeekRange.endDate,
            },
          })
            .sort({ date: 1, updatedAt: -1 })
            .limit(ASSISTANT_RAG_TASK_LIMIT)
            .lean()
        : Promise.resolve([]),
      Todo.find({ user: userId, deleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(ASSISTANT_RAG_TODO_LIMIT)
        .lean(),
      TaskTemplate.find({ user: userId })
        .sort({ updatedAt: -1 })
        .limit(ASSISTANT_RAG_TEMPLATE_LIMIT)
        .lean(),
      Category.find({ user: userId }).lean(),
    ]);

  const candidates = buildRetrievalCandidates({
    recentTasks,
    weekTasks,
    todos,
    templates,
    categories,
    timezone,
    selectedWeekRange,
    todayString: tz.getTodayString(timezone),
    terms,
  });

  const rankedItems = await rerankRetrievalCandidates({
    prompt,
    candidates,
    timezone,
    selectedDate,
    userId,
  });

  const contextLines = [];

  if (rankedItems.length > 0) {
    contextLines.push(
      `Relevant workspace matches: ${rankedItems.map((item) => `${item.text}${item.semanticScore ? ` [sem:${item.semanticScore.toFixed(2)}]` : ""}`).join(" | ")}`,
    );
  }

  if (categories.length > 0) {
    contextLines.push(
      `Known categories: ${categories.map((category) => category.name).join(", ")}`,
    );
  }

  if (contextLines.length === 0) {
    contextLines.push(
      "No strong workspace matches were found for this prompt.",
    );
  }

  return contextLines.join("\n");
};

const normalizeConversation = (conversation = []) => {
  if (!Array.isArray(conversation)) {
    return [];
  }

  return conversation
    .filter((item) => item && typeof item.text === "string")
    .slice(-ASSISTANT_MAX_TURNS)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.text.trim(),
    }))
    .filter((item) => item.content.length > 0);
};

const normalizeAssistantMessages = (messages = []) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((item) => item && typeof item.text === "string")
    .slice(-ASSISTANT_MEMORY_LIMIT)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      text: item.text.trim(),
    }))
    .filter((item) => item.text.length > 0);
};

const convertAssistantMessagesToConversation = (messages = []) =>
  normalizeAssistantMessages(messages).map((item) => ({
    role: item.role,
    content: item.text,
  }));

const buildPersonalContext = (user) => {
  if (!user) {
    return "";
  }

  const contextParts = [];

  if (user.name) {
    contextParts.push(`name=${user.name}`);
  }

  if (user.authProvider) {
    contextParts.push(`authProvider=${user.authProvider}`);
  }

  if (typeof user.onboardingComplete === "boolean") {
    contextParts.push(
      `onboardingComplete=${user.onboardingComplete ? "true" : "false"}`,
    );
  }

  if (user.googleCalendar) {
    contextParts.push(
      `calendar=${user.googleCalendar.connected ? "connected" : "disconnected"}`,
    );
  }

  return contextParts.join(", ");
};

const getStoredAssistantConversation = async (userId) => {
  const conversation = await AssistantConversation.findOne({ user: userId })
    .lean()
    .catch(() => null);

  return normalizeAssistantMessages(conversation?.messages || []);
};

const persistAssistantConversation = async (userId, messages) => {
  const normalizedMessages = normalizeAssistantMessages(messages);

  if (normalizedMessages.length === 0) {
    return null;
  }

  return AssistantConversation.findOneAndUpdate(
    { user: userId },
    {
      $push: {
        messages: {
          $each: normalizedMessages,
          $slice: -ASSISTANT_MEMORY_LIMIT,
        },
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );
};

const persistAssistantExchange = async ({ userId, prompt, reply }) => {
  if (!prompt || !reply) {
    return;
  }

  await persistAssistantConversation(userId, [
    { role: "user", text: prompt },
    { role: "assistant", text: reply },
  ]).catch((error) => {
    console.error("Failed to persist assistant conversation:", error.message);
  });
};

const buildSystemPrompt = ({
  timezone,
  selectedDate,
  selectedDayDate,
  activeTab,
  viewMode,
  retrievedContext,
  personalContext,
}) => {
  const selectedWeekLabel =
    selectedDate?.year !== undefined &&
    selectedDate?.month !== null &&
    selectedDate?.week
      ? `${selectedDate.year}-${String(selectedDate.month + 1).padStart(2, "0")}-W${selectedDate.week}`
      : "not set";

  return [
    "You are a smart productivity coach embedded inside a task tracking app called Tracku.",
    "Your goal is to help the user improve their productivity, habits, and time management.",
    "",
    "CAPABILITIES:",
    "- Analyze weekly/daily task completion rates, time management, and patterns",
    "- Identify productivity trends (which days are most productive, which categories get the most time)",
    "- Spot problems: overdue todos, unfinished tasks, time overruns, neglected categories",
    "- Give actionable improvement suggestions backed by the user's actual data",
    "- Answer questions like 'How am I doing?', 'Where am I wasting time?', 'What should I focus on?'",
    "- Compare planned vs actual time to find estimation patterns",
    "- Create tasks, quick todos, and edit templates when asked",
    "",
    "TONE & STYLE:",
    "- Warm, encouraging but honest — celebrate wins and gently flag problems",
    "- Use specific numbers and data from context (don't be vague)",
    "- Keep replies concise unless asked for detail",
    "- Use emoji sparingly for emphasis (📊 🎯 ⚠️ ✅)",
    "- When analyzing, structure with bullet points for readability",
    "- If data is insufficient, say so honestly and suggest what the user can do",
    "",
    "ANALYSIS FRAMEWORK (when user asks about progress):",
    "1. Task Completion: X/Y tasks done, completion rate",
    "2. Time Management: planned vs actual, over/under-estimation patterns",
    "3. Active Work: currently running tasks, focus areas",
    "4. Overdue Items: overdue todos, missed deadlines",
    "5. Category Distribution: where time is going",
    "6. Actionable Tips: 1-2 specific suggestions based on the data",
    "",
    personalContext
      ? `Personal user context: ${personalContext}.`
      : "No personal user context available.",
    `Context: timezone=${timezone}, tab=${activeTab || "unknown"}, viewMode=${viewMode || "unknown"}, selectedWeek=${selectedWeekLabel}, selectedDay=${selectedDayDate || "not set"}.`,
    retrievedContext
      ? `Retrieved workspace context:\n${retrievedContext}`
      : "No retrieved workspace context available.",
  ].join("\n");
};

const buildConversationMessages = ({
  prompt,
  conversationMessages,
  timezone,
  selectedDate,
  selectedDayDate,
  activeTab,
  viewMode,
  retrievedContext,
  personalContext,
}) => {
  const messages =
    conversationMessages.length > 0
      ? conversationMessages
      : [{ role: "user", content: prompt }];

  return [
    {
      role: "system",
      content: buildSystemPrompt({
        timezone,
        selectedDate,
        selectedDayDate,
        activeTab,
        viewMode,
        retrievedContext,
        personalContext,
      }),
    },
    ...messages,
  ];
};

const fallbackConversationReply = (prompt) => {
  if (
    /\b(hello|hi|hey|good morning|good afternoon|good evening)\b/i.test(prompt)
  ) {
    return "Hey. I can help with tasks, quick todos, templates, or weekly insights. Tell me what you want to do.";
  }

  if (/\b(who are you|what can you do|help)\b/i.test(prompt)) {
    return "I can chat, create tasks, add quick todos, update templates, and summarize your week. Say what you need and I’ll handle it.";
  }

  return "I can make this conversational once the assistant API key is configured. For now I can still create tasks, quick todos, edit templates, and analyze your week.";
};

const buildConversationalPayload = async ({
  userId,
  user,
  prompt,
  conversation,
  timezone,
  selectedDate,
  selectedDayDate,
  activeTab,
  viewMode,
}) => {
  const retrievedContext = await buildRagContext({
    userId,
    prompt,
    timezone,
    selectedDate,
  }).catch(() => "");

  const requestConversation = normalizeConversation(conversation);
  const conversationMessages =
    requestConversation.length > 0
      ? requestConversation
      : convertAssistantMessagesToConversation(
          await getStoredAssistantConversation(userId),
        );

  const messages = buildConversationMessages({
    prompt,
    conversationMessages,
    timezone,
    selectedDate,
    selectedDayDate,
    activeTab,
    viewMode,
    retrievedContext,
    personalContext: buildPersonalContext(user),
  });

  return { retrievedContext, messages };
};

const generateConversationalReply = async ({
  userId,
  user,
  prompt,
  conversation,
  timezone,
  selectedDate,
  selectedDayDate,
  activeTab,
  viewMode,
}) => {
  if (!ASSISTANT_API_KEY) {
    return {
      reply: fallbackConversationReply(prompt),
      type: "help",
      refresh: false,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    ASSISTANT_REQUEST_TIMEOUT_MS,
  );

  const { messages } = await buildConversationalPayload({
    userId,
    user,
    prompt,
    conversation,
    timezone,
    selectedDate,
    selectedDayDate,
    activeTab,
    viewMode,
  });

  try {
    const response = await fetch(`${ASSISTANT_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${ASSISTANT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ASSISTANT_MODEL,
        messages,
        temperature: ASSISTANT_TEMPERATURE,
        max_tokens: ASSISTANT_MAX_TOKENS,
      }),
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!response.ok) {
      throw new Error(data?.error?.message || "Assistant chat request failed.");
    }

    if (!reply) {
      throw new Error("Assistant returned an empty response.");
    }

    return {
      reply,
      type: "chat",
      refresh: false,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        reply:
          "I hit a timeout talking to the model, but I’m still here. Try a shorter prompt or ask me for a quick task action.",
        type: "help",
        refresh: false,
      };
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const streamConversationalReply = async ({
  userId,
  user,
  prompt,
  conversation,
  timezone,
  selectedDate,
  selectedDayDate,
  activeTab,
  viewMode,
  res,
}) => {
  if (!ASSISTANT_API_KEY) {
    return {
      reply: fallbackConversationReply(prompt),
      type: "help",
      refresh: false,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    ASSISTANT_REQUEST_TIMEOUT_MS,
  );

  const { messages } = await buildConversationalPayload({
    userId,
    user,
    prompt,
    conversation,
    timezone,
    selectedDate,
    selectedDayDate,
    activeTab,
    viewMode,
  });

  try {
    const response = await fetch(`${ASSISTANT_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${ASSISTANT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ASSISTANT_MODEL,
        messages,
        temperature: ASSISTANT_TEMPERATURE,
        max_tokens: ASSISTANT_MAX_TOKENS,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        errorText || "Assistant chat request failed while streaming.",
      );
    }

    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";

    const flushLine = (line) => {
      const trimmed = line.trim();

      if (!trimmed.startsWith("data:")) {
        return false;
      }

      const data = trimmed.slice(5).trim();

      if (!data || data === "[DONE]") {
        return data === "[DONE]";
      }

      try {
        const parsed = JSON.parse(data);
        const delta =
          parsed?.choices?.[0]?.delta?.content ||
          parsed?.choices?.[0]?.message?.content ||
          "";

        if (delta) {
          reply += delta;
          res.write(delta);
        }
      } catch {
        return false;
      }

      return false;
    };

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        const finished = flushLine(line);
        if (finished) {
          break;
        }
      }
    }

    if (buffer.trim()) {
      flushLine(buffer);
    }

    const finalReply = reply.trim();
    await persistAssistantExchange({
      userId,
      prompt,
      reply: finalReply,
    });

    res.end();

    return {
      reply: finalReply,
      type: "chat",
      refresh: false,
    };
  } catch (error) {
    if (res.headersSent) {
      const fallbackMessage =
        error.name === "AbortError"
          ? "I hit a timeout talking to the model, but I'm still here. Try a shorter prompt or ask me for a quick task action."
          : "I hit an error while replying, but I can still help with tasks and templates.";
      res.write(fallbackMessage);
      res.end();

      return {
        reply: fallbackMessage,
        type: "help",
        refresh: false,
      };
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const buildInsights = async ({ userId, timezone, selectedDate }) => {
  const now = DateTime.now().setZone(timezone).startOf("day");
  const hasSelectedWeek =
    selectedDate?.year !== undefined &&
    selectedDate?.month !== null &&
    selectedDate?.week;

  const { startDate, endDate } = hasSelectedWeek
    ? tz.getWeekDates(
        selectedDate.year,
        selectedDate.month,
        selectedDate.week,
        timezone,
      )
    : tz.getWeekDates(
        now.year,
        now.month - 1,
        Math.min(Math.ceil(now.day / 7), 4),
        timezone,
      );

  const [tasks, todos, categories] = await Promise.all([
    Task.find({
      user: userId,
      date: { $gte: startDate, $lte: endDate },
      deleted: { $ne: true },
    }).lean(),
    Todo.find({ user: userId, deleted: { $ne: true } }).lean(),
    Category.find({ user: userId }).lean(),
  ]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (task) => !task.isActive && (task.totalTime || 0) > 0,
  ).length;
  const activeTasks = tasks.filter((task) => task.isActive).length;
  const plannedTime = tasks.reduce(
    (sum, task) => sum + (task.plannedTime || 0),
    0,
  );
  const actualTime = tasks.reduce(
    (sum, task) => sum + (task.totalTime || 0),
    0,
  );

  // Category breakdown
  const categoryMap = new Map();
  for (const task of tasks) {
    const categoryKey = task.category || "Uncategorized";
    const current = categoryMap.get(categoryKey) || { time: 0, count: 0 };
    categoryMap.set(categoryKey, {
      time: current.time + (task.totalTime || task.plannedTime || 0),
      count: current.count + 1,
    });
  }

  const categoryBreakdown = [...categoryMap.entries()]
    .sort((a, b) => b[1].time - a[1].time)
    .slice(0, 5)
    .map(([name, data]) => {
      const cat = categories.find((c) => c.name === name);
      const icon = cat?.icon || "📌";
      return `${icon} ${name}: ${data.count} tasks, ${Math.round(data.time / 60000)} min`;
    });

  // Day-by-day productivity
  const dayMap = new Map();
  for (const task of tasks) {
    const day = task.day || "unknown";
    const current = dayMap.get(day) || { total: 0, completed: 0, time: 0 };
    current.total += 1;
    if (!task.isActive && (task.totalTime || 0) > 0) current.completed += 1;
    current.time += task.totalTime || 0;
    dayMap.set(day, current);
  }

  const bestDay = [...dayMap.entries()].sort((a, b) => b[1].time - a[1].time)[0];

  // Overdue & due today
  const todayStr = toDateString(now);
  const overdueTodos = todos.filter(
    (todo) =>
      !todo.completed &&
      ((todo.deadline && todo.deadline < todayStr) ||
        (todo.date && todo.date < todayStr)),
  ).length;
  const dueTodayTodos = todos.filter(
    (todo) =>
      !todo.completed &&
      (todo.deadline === todayStr || todo.date === todayStr),
  ).length;
  const openTodos = todos.filter((todo) => !todo.completed).length;

  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Time accuracy
  const timeAccuracy = plannedTime > 0 ? Math.round((actualTime / plannedTime) * 100) : null;
  const timeAccuracyLabel = timeAccuracy !== null
    ? timeAccuracy > 120
      ? `⚠️ You're spending ${timeAccuracy}% of planned time — you may be underestimating tasks.`
      : timeAccuracy < 60
        ? `💡 You're only using ${timeAccuracy}% of planned time — you might be overestimating or skipping tasks.`
        : `✅ Time accuracy at ${timeAccuracy}% — solid estimation skills!`
    : null;

  // Coaching tips
  const tips = [];
  if (overdueTodos > 0) tips.push(`Clear ${overdueTodos} overdue todo${overdueTodos > 1 ? "s" : ""} — they add mental clutter.`);
  if (completionRate < 50 && totalTasks > 0) tips.push("Your completion rate is below 50%. Consider breaking big tasks into smaller ones.");
  if (completionRate >= 80 && totalTasks > 3) tips.push("Great completion rate! Consider challenging yourself with stretch goals.");
  if (activeTasks > 3) tips.push(`${activeTasks} tasks are running simultaneously — try focusing on 1-2 at a time.`);
  if (categoryBreakdown.length > 0 && categoryMap.size === 1) tips.push("All your time is in one category. Consider diversifying if you have other goals.");

  return {
    reply: [
      `📊 **Weekly Progress** (${startDate} → ${endDate})`,
      "",
      `**Tasks:** ${completedTasks}/${totalTasks} completed (${completionRate}%)`,
      `**Time:** ${Math.round(plannedTime / 60000)} min planned → ${Math.round(actualTime / 60000)} min logged`,
      timeAccuracyLabel,
      activeTasks > 0
        ? `**Active:** ${activeTasks} task${activeTasks > 1 ? "s" : ""} currently running`
        : null,
      "",
      categoryBreakdown.length > 0
        ? `**Category Breakdown:**\n${categoryBreakdown.join("\n")}`
        : null,
      "",
      bestDay
        ? `**Most productive day:** ${bestDay[0]} (${bestDay[1].completed}/${bestDay[1].total} tasks, ${Math.round(bestDay[1].time / 60000)} min)`
        : null,
      "",
      `**Quick Todos:** ${openTodos} open${overdueTodos > 0 ? `, ⚠️ ${overdueTodos} overdue` : ""}${dueTodayTodos > 0 ? `, ${dueTodayTodos} due today` : ""}`,
      "",
      tips.length > 0 ? `**💡 Tips:**\n${tips.map((t) => `• ${t}`).join("\n")}` : "Keep up the good work! 🎯",
    ]
      .filter(Boolean)
      .join("\n"),
    type: "insight",
    data: {
      totalTasks,
      completedTasks,
      activeTasks,
      plannedTime,
      actualTime,
      overdueTodos,
      dueTodayTodos,
      completionRate,
      timeAccuracy,
      categoryBreakdown: [...categoryMap.entries()].map(([name, data]) => ({ name, ...data })),
    },
    refresh: false,
  };
};

const createTaskFromPrompt = async ({
  userId,
  timezone,
  prompt,
  selectedDate,
}) => {
  const categories = await Category.find({ user: userId }).lean();
  if (categories.length === 0) {
    return {
      reply: "You need at least one category before I can create a task.",
      type: "error",
      refresh: false,
    };
  }

  const taskDate =
    parseDateReference(
      prompt,
      timezone,
      selectedDate?.selectedDayDate || null,
    ) ||
    selectedDate?.selectedDayDate ||
    tz.getTodayString(timezone);
  const category = pickCategory(prompt, categories);
  const parsedDuration = parseDurationMinutes(prompt);
  const parsedTime = parseTimeRange(prompt);
  const title = parseTitle(prompt);

  if (!title) {
    return {
      reply: "Please provide a task name.",
      type: "error",
      refresh: false,
    };
  }

  const task = await Task.create({
    user: userId,
    name: title,
    category: category._id.toString(),
    date: taskDate,
    day: dayNameFromDate(taskDate, timezone),
    plannedTime: parsedDuration * 60000,
    isAutomated: false,
    scheduledStartTime: parsedTime.scheduledStartTime,
    scheduledEndTime: parsedTime.scheduledEndTime,
  });

  return {
    reply: `Created task "${task.name}" for ${taskDate}.${category ? ` Category: ${category.name}.` : ""}`,
    type: "task_created",
    data: task,
    refresh: true,
  };
};

const createTodoFromPrompt = async ({
  userId,
  timezone,
  prompt,
  selectedDate,
}) => {
  const deadline = parseDateReference(
    prompt,
    timezone,
    selectedDate?.selectedDayDate || null,
  );
  const today = tz.getTodayString(timezone);
  const text = parseTitle(prompt);

  if (!text) {
    return {
      reply: "Please provide a todo description.",
      type: "error",
      refresh: false,
    };
  }

  const todo = await Todo.create({
    user: userId,
    text,
    completed: false,
    date: today,
    deadline: deadline || today,
    isOverdue: false,
  });

  return {
    reply: `Created quick todo "${todo.text}"${deadline ? ` with deadline ${deadline}` : ""}.`,
    type: "todo_created",
    data: todo,
    refresh: true,
  };
};

const addTaskToTemplate = async ({ userId, timezone, prompt }) => {
  const templateName = extractTemplateName(prompt);
  if (!templateName) {
    return {
      reply:
        "Tell me which template you want to edit, for example: add gym to template work week on Monday.",
      type: "error",
      refresh: false,
    };
  }

  const template = await TaskTemplate.findOne({
    user: userId,
    name: new RegExp(
      `^${templateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "i",
    ),
  });

  if (!template) {
    return {
      reply: `I could not find a template named "${templateName}".`,
      type: "error",
      refresh: false,
    };
  }

  const categories = await Category.find({ user: userId }).lean();
  const day = extractDay(prompt, timezone);
  if (!day) {
    return {
      reply: `Please specify a day for the template update, for example Monday or Friday.`,
      type: "error",
      refresh: false,
    };
  }

  const category = pickCategory(prompt, categories) || categories[0];
  const title = parseTitle(prompt);
  const parsedDuration = parseDurationMinutes(prompt);
  const parsedTime = parseTimeRange(prompt);

  template.tasks.push({
    name: title,
    category: category ? category.name : "General",
    day,
    plannedTime: parsedDuration * 60000,
    isAutomated: false,
    scheduledStartTime: parsedTime.scheduledStartTime,
    scheduledEndTime: parsedTime.scheduledEndTime,
    addToCalendar: false,
    reminderMinutes: 0,
  });

  await template.save();

  return {
    reply: `Added "${title}" to template "${template.name}" on ${day}.`,
    type: "template_updated",
    data: template,
    refresh: true,
  };
};

const handleAssistantMessage = async (req, res) => {
  try {
    const prompt = normalizePrompt(req.body.message);
    if (!prompt) {
      return res.status(400).json({ message: "Please provide a prompt." });
    }

    const timezone = tz.getTimezoneFromRequest(req);
    const selectedDate = req.body.context?.selectedDate || null;
    const selectedDayDate = req.body.context?.selectedDayDate || null;
    const activeTab = req.body.context?.activeTab || null;
    const viewMode = req.body.context?.viewMode || null;
    const conversation = req.body.conversation || [];
    const wantsStream = req.body.stream === true;
    const userId = req.user._id;
    const user = req.user;

    const insightMatch =
      /\b(insight|insights|analy[sz]e|analysis|summary|review|report|progress|how am i doing|what do you see|how.s my|where.+wasting|what should i focus|productivity|my week|my day|completion rate|time management|overdue|how.+going)\b/i;
    const templateMatch = /\btemplate\b/i;
    const taskMatch =
      /\b(add|create|make|new|schedule).*(task|deadline|reminder)\b/i;
    const todoMatch = /\b(add|create|make|new).*(todo|to[- ]?do|quick todo)\b/i;

    let result;

    if (insightMatch.test(prompt)) {
      result = await buildInsights({
        userId,
        timezone,
        selectedDate,
      });
    } else if (
      templateMatch.test(prompt) &&
      /\b(apply|use|run|deploy)\b/i.test(prompt)
    ) {
      result = {
        reply:
          "Template application is ready from the template panel. I can already edit templates here, and the next step is to let me apply them directly from chat.",
        type: "info",
        refresh: false,
      };
    } else if (templateMatch.test(prompt)) {
      result = await addTaskToTemplate({
        userId,
        timezone,
        prompt,
      });
    } else if (todoMatch.test(prompt)) {
      result = await createTodoFromPrompt({
        userId,
        timezone,
        prompt,
        selectedDate: { selectedDayDate },
      });
    } else if (taskMatch.test(prompt)) {
      result = await createTaskFromPrompt({
        userId,
        timezone,
        prompt,
        selectedDate: { selectedDayDate },
      });
    } else {
      if (wantsStream) {
        const streamedResult = await streamConversationalReply({
          userId,
          user,
          prompt,
          conversation,
          timezone,
          selectedDate,
          selectedDayDate,
          activeTab,
          viewMode,
          res,
        });

        if (streamedResult && !res.headersSent) {
          await persistAssistantExchange({
            userId,
            prompt,
            reply: streamedResult.reply,
          });
          return res.json(streamedResult);
        }

        return;
      }

      result = await generateConversationalReply({
        userId,
        user,
        prompt,
        conversation,
        timezone,
        selectedDate,
        selectedDayDate,
        activeTab,
        viewMode,
      });
    }

    if (result?.reply && result.type !== "error") {
      await persistAssistantExchange({
        userId,
        prompt,
        reply: result.reply,
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("Assistant error:", error);
    return res.status(500).json({ message: error.message });
  }
};

const getAssistantHistory = async (req, res) => {
  try {
    const messages = await getStoredAssistantConversation(req.user._id);
    return res.json({ messages });
  } catch (error) {
    console.error("Assistant history error:", error);
    return res.status(500).json({ message: error.message });
  }
};

const clearAssistantHistory = async (req, res) => {
  try {
    await AssistantConversation.deleteOne({ user: req.user._id });
    return res.json({ message: "Assistant history cleared" });
  } catch (error) {
    console.error("Assistant history clear error:", error);
    return res.status(500).json({ message: error.message });
  }
};

const getAssistantStatus = async (req, res) => {
  return res.json({
    configured: Boolean(ASSISTANT_API_KEY),
    provider: ASSISTANT_BASE_URL.includes("openai") ? "openai-compatible" : "custom",
    model: ASSISTANT_MODEL,
    baseUrl: ASSISTANT_BASE_URL,
    memoryLimit: ASSISTANT_MEMORY_LIMIT,
    streamEnabled: true,
  });
};

module.exports = {
  handleAssistantMessage,
  getAssistantHistory,
  clearAssistantHistory,
  getAssistantStatus,
};
