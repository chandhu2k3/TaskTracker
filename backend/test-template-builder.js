// Lightweight verification for the AI Template Builder (no new deps, no DB).
// Run: node test-template-builder.js
const assert = require("node:assert");
const { validateDraft } = require("./utils/templateValidation");
const builderLLM = require("./utils/templateBuilderLLM");
const { TRANSITIONS } = require("./controllers/templateBuilderController");

let passed = 0;
const ok = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
};

// 1. Empty draft rejected
ok("empty draft invalid", () => {
  const v = validateDraft(null, { categoryNames: ["Study"] });
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.length > 0);
});

// 2. Missing name + missing fields
ok("missing name/tasks flagged", () => {
  const v = validateDraft({ tasks: [], quickTodos: [] }, { categoryNames: [] });
  assert.ok(v.errors.some((e) => /name/i.test(e)));
  assert.ok(v.errors.some((e) => /at least one/i.test(e)));
});

// 3. Bad day + bad time + end<=start
ok("day/time rules enforced", () => {
  const v = validateDraft(
    { name: "T", tasks: [{ name: "X", category: "Study", day: "funday", plannedTime: 100, scheduledStartTime: "25:00", scheduledEndTime: "09:00" }] },
    { categoryNames: ["Study"] },
  );
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some((e) => /day/i.test(e)));
  assert.ok(v.errors.some((e) => /HH:MM/i.test(e)));
});

// 4. End before start is an error (unless endsNextDay)
ok("end-before-start error, overnight allowed", () => {
  const bad = validateDraft(
    { name: "T", tasks: [{ name: "Night", category: "Study", day: "monday", plannedTime: 3600000, scheduledStartTime: "18:00", scheduledEndTime: "09:00" }] },
    { categoryNames: ["Study"] },
  );
  assert.ok(bad.errors.some((e) => /end time/i.test(e)));
  const good = validateDraft(
    { name: "T", tasks: [{ name: "Night", category: "Study", day: "monday", plannedTime: 3600000, scheduledStartTime: "18:00", scheduledEndTime: "09:00", endsNextDay: true }] },
    { categoryNames: ["Study"] },
  );
  assert.strictEqual(good.valid, true);
});

// 5. Overlap surfaces as warning (never silently moved)
ok("overlap is warning not error", () => {
  const v = validateDraft(
    {
      name: "T",
      tasks: [
        { name: "A", category: "Study", day: "monday", plannedTime: 3600000, scheduledStartTime: "09:00", scheduledEndTime: "11:00" },
        { name: "B", category: "Study", day: "monday", plannedTime: 3600000, scheduledStartTime: "10:30", scheduledEndTime: "12:00" },
      ],
    },
    { categoryNames: ["Study"] },
  );
  assert.strictEqual(v.valid, true);
  assert.ok(v.warnings.some((w) => /overlaps/i.test(w)));
});

// 6. Unknown category warns (does not block save)
ok("unknown category warns only", () => {
  const v = validateDraft(
    { name: "T", tasks: [{ name: "Gym", category: "Nope", day: "tuesday", plannedTime: 3600000 }] },
    { categoryNames: ["Study"] },
  );
  assert.strictEqual(v.valid, true);
  assert.ok(v.warnings.some((w) => /unknown category/i.test(w)));
});

// 7. Valid draft passes
ok("valid draft passes", () => {
  const v = validateDraft(
    {
      name: "GATE Prep",
      tasks: [{ name: "DSA", category: "Study", day: "monday", plannedTime: 7200000, scheduledStartTime: "18:00", scheduledEndTime: "20:00" }],
      quickTodos: [{ text: "Revise notes", day: "sunday", reminderMinutes: 10, reminderTime: "09:00" }],
    },
    { categoryNames: ["Study"] },
  );
  assert.strictEqual(v.valid, true);
});

// 8. Heuristic extraction keeps prior answers, adds duration/day
ok("heuristic extraction merges state", () => {
  const current = { templateName: "GATE", activities: [{ name: "DSA", days: [], durationMinutes: 0 }] };
  const req = builderLLM.heuristicExtract("DSA 2 hours monday to friday", current, ["Study"]);
  const dsa = req.activities.find((a) => /dsa/i.test(a.name));
  assert.ok(dsa);
  assert.strictEqual(dsa.durationMinutes, 120);
  assert.strictEqual(req.templateName, "GATE");
});

// 9. Completeness drives clarification, not generation
ok("completeness requires days+duration", () => {
  const missing = builderLLM.completeness({ activities: [{ name: "DSA" }] });
  assert.ok(missing.some((m) => /days for DSA/i.test(m)));
  const q = builderLLM.clarificationQuestion(missing);
  assert.ok(/which days/i.test(q));
});

// 10. State machine forbids skipping approval (no direct save)
ok("state machine gates save", () => {
  assert.ok(!TRANSITIONS.COLLECTING_REQUIREMENTS.has("SAVED"));
  assert.ok(!TRANSITIONS.PREVIEW_READY.has("SAVED"));
  assert.ok(TRANSITIONS.AWAITING_SAVE_CONFIRMATION.has("SAVING"));
  assert.ok(TRANSITIONS.SAVING.has("SAVED"));
});

// 11. Saved/cancelled sessions are terminal
ok("terminal states locked", () => {
  assert.strictEqual(TRANSITIONS.SAVED.size, 0);
  assert.strictEqual(TRANSITIONS.CANCELLED.size, 0);
});

console.log(`\n${passed} checks passed.`);
