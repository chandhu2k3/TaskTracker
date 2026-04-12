const { DateTime } = require("luxon");
const Task = require("../models/Task");
const Todo = require("../models/Todo");
const TaskTemplate = require("../models/TaskTemplate");
const Category = require("../models/Category");
const AssistantEmbedding = require("../models/AssistantEmbedding");
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
const ASSISTANT_MAX_TOKENS = Number(process.env.ASSISTANT_MAX_TOKENS || 220);
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

const buildSystemPrompt = ({
  timezone,
  selectedDate,
  selectedDayDate,
  activeTab,
  viewMode,
  retrievedContext,
}) => {
  const selectedWeekLabel =
    selectedDate?.year !== undefined &&
    selectedDate?.month !== null &&
    selectedDate?.week
      ? `${selectedDate.year}-${String(selectedDate.month + 1).padStart(2, "0")}-W${selectedDate.week}`
      : "not set";

  return [
    "You are a fast, friendly assistant inside a task tracking app.",
    "Sound human, concise, and practical.",
    "Keep replies short unless the user asks for detail.",
    "Use a warm, conversational tone.",
    "If the user asks for an action, confirm the result clearly and briefly.",
    "If the user is just chatting, answer naturally and keep the flow going.",
    "Ask at most one short follow-up question when you need clarification.",
    "Use the retrieved workspace context as grounding for app-specific claims. Prefer the freshest relevant items and do not invent details that are not present in the context.",
    `Context: timezone=${timezone}, tab=${activeTab || "unknown"}, viewMode=${viewMode || "unknown"}, selectedWeek=${selectedWeekLabel}, selectedDay=${selectedDayDate || "not set"}.`,
    retrievedContext
      ? `Retrieved workspace context:\n${retrievedContext}`
      : "No retrieved workspace context available.",
  ].join(" ");
};

const buildConversationMessages = ({
  prompt,
  conversation,
  timezone,
  selectedDate,
  selectedDayDate,
  activeTab,
  viewMode,
  retrievedContext,
}) => {
  const history = normalizeConversation(conversation);
  const messages =
    history.length > 0 ? history : [{ role: "user", content: prompt }];

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

const generateConversationalReply = async ({
  userId,
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

  const retrievedContext = await buildRagContext({
    userId,
    prompt,
    timezone,
    selectedDate,
  }).catch(() => "");

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
        messages: buildConversationMessages({
          prompt,
          conversation,
          timezone,
          selectedDate,
          selectedDayDate,
          activeTab,
          viewMode,
          retrievedContext,
        }),
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

  const categoryMap = new Map();
  for (const task of tasks) {
    const categoryKey = task.category || "Uncategorized";
    const current = categoryMap.get(categoryKey) || 0;
    categoryMap.set(
      categoryKey,
      current + (task.totalTime || task.plannedTime || 0),
    );
  }

  const topCategoryEntry = [...categoryMap.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  const overdueTodos = todos.filter(
    (todo) =>
      !todo.completed &&
      ((todo.deadline && todo.deadline < toDateString(now)) ||
        (todo.date && todo.date < toDateString(now))),
  ).length;
  const dueTodayTodos = todos.filter(
    (todo) =>
      !todo.completed &&
      (todo.deadline === toDateString(now) || todo.date === toDateString(now)),
  ).length;

  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const topCategoryName = topCategoryEntry ? topCategoryEntry[0] : null;
  const topCategory = categories.find(
    (category) =>
      category._id.toString() === String(topCategoryName) ||
      category.name === topCategoryName,
  );
  const topCategoryLabel = topCategory
    ? `${topCategory.icon} ${topCategory.name}`
    : topCategoryName || "none";

  return {
    reply: [
      `This week you have ${totalTasks} tasks with ${completionRate}% completion.`,
      `Planned time: ${Math.round(plannedTime / 60000)} min, actual logged time: ${Math.round(actualTime / 60000)} min.`,
      activeTasks > 0
        ? `${activeTasks} task${activeTasks > 1 ? "s are" : " is"} still running.`
        : "No active tasks right now.",
      overdueTodos > 0
        ? `${overdueTodos} quick todo${overdueTodos > 1 ? "s" : ""} are overdue.`
        : "No overdue quick todos found.",
      dueTodayTodos > 0
        ? `${dueTodayTodos} quick todo${dueTodayTodos > 1 ? "s are" : " is"} due today.`
        : null,
      topCategoryEntry
        ? `Your most time-heavy category is ${topCategoryLabel}.`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    type: "insight",
    data: {
      totalTasks,
      completedTasks,
      activeTasks,
      plannedTime,
      actualTime,
      overdueTodos,
      dueTodayTodos,
      topCategory: topCategoryLabel,
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
    const userId = req.user._id;

    const insightMatch =
      /\b(insight|insights|analy[sz]e|analysis|summary|review|report|how am i doing|what do you see)\b/i;
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
      result = await generateConversationalReply({
        userId,
        prompt,
        conversation,
        timezone,
        selectedDate,
        selectedDayDate,
        activeTab,
        viewMode,
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("Assistant error:", error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  handleAssistantMessage,
};
