import React, { useState } from "react";
import ReactDOM from "react-dom";
import { toast } from "react-toastify";
import "./TodoList.css";
import calendarService from "../services/calendarService";

const TodoList = ({
  todos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  isAddingTodo = false,
  togglingTodo = {},
  deletingTodo = {},
  onConnectCalendar,
}) => {
  const [newTodo, setNewTodo] = useState("");
  const [deadline, setDeadline] = useState("");
  const [calendarStatuses, setCalendarStatuses] = useState({});
  const [showPickerForTodo, setShowPickerForTodo] = useState(null);
  const [calendarForm, setCalendarForm] = useState({
    date: "",
    time: "14:00",
    reminderMinutes: 15,
  });

  // Compute today string for overdue comparison (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split("T")[0];

  // Close picker with Escape
  React.useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setShowPickerForTodo(null);
      }
    };

    if (showPickerForTodo) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => document.removeEventListener("keydown", handleEsc);
  }, [showPickerForTodo]);

  const handleCalBtnClick = (todo) => {
    const todoId = todo._id;
    if (showPickerForTodo === todoId) {
      setShowPickerForTodo(null);
      return;
    }

    const now = new Date();
    const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
    const defaultTime = todo.deadline
      ? "14:00"
      : `${String((roundedMinutes === 60 ? now.getHours() + 1 : now.getHours()) % 24).padStart(2, "0")}:${String(roundedMinutes % 60).padStart(2, "0")}`;

    setCalendarForm({
      date: todo.deadline || todayStr,
      time: defaultTime,
      reminderMinutes: 15,
    });

    setShowPickerForTodo(todoId);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newTodo.trim()) {
      onAddTodo(newTodo.trim(), deadline || todayStr);
      setNewTodo("");
      setDeadline("");
    }
  };

  const handleAddToCalendar = async (todo, reminderMinutes) => {
    const selectedDate = calendarForm.date || todayStr;
    const selectedTime = calendarForm.time || "14:00";

    if (!/^\d{2}:\d{2}$/.test(selectedTime)) {
      toast.warn("Please pick a valid time.");
      return;
    }

    setShowPickerForTodo(null);
    setCalendarStatuses((prev) => ({ ...prev, [todo._id]: "adding" }));

    try {
      const eventDate = new Date(`${selectedDate}T${selectedTime}:00`);

      if (Number.isNaN(eventDate.getTime())) {
        toast.warn("Please pick a valid date and time.");
        setCalendarStatuses((prev) => ({ ...prev, [todo._id]: null }));
        return;
      }

      const result = await calendarService.smartAddToCalendar(
        {
          title: `✓ ${todo.text}`,
          description: `Quick todo from Task Tracker Pro\nDate: ${new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}\nTime: ${selectedTime}`,
          date: eventDate,
          durationMinutes: 30,
          reminderMinutes,
        },
        () => {
          // Not connected — show in-app toast with Connect button, no redirect
          setCalendarStatuses((prev) => ({ ...prev, [todo._id]: "error" }));
          setTimeout(
            () =>
              setCalendarStatuses((prev) => ({ ...prev, [todo._id]: null })),
            3000,
          );
          if (onConnectCalendar) {
            toast.info(
              ({ closeToast }) => (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span>
                    Connect Google Calendar to enable background reminders
                  </span>
                  <button
                    onClick={() => {
                      closeToast();
                      onConnectCalendar();
                    }}
                    style={{
                      background: "linear-gradient(135deg,#1e293b,#334155)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      padding: "4px 12px",
                      cursor: "pointer",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Connect
                  </button>
                </div>
              ),
              { autoClose: 8000 },
            );
          } else {
            toast.warn(
              "Connect Google Calendar from the Profile menu to enable background reminders.",
            );
          }
        },
      );

      if (result.success) {
        setCalendarStatuses((prev) => ({ ...prev, [todo._id]: "added" }));
        setTimeout(
          () => setCalendarStatuses((prev) => ({ ...prev, [todo._id]: null })),
          2000,
        );
      } else {
        setCalendarStatuses((prev) => ({ ...prev, [todo._id]: null }));
      }
    } catch (err) {
      console.error("Calendar error:", err);
      setCalendarStatuses((prev) => ({ ...prev, [todo._id]: "error" }));
      setTimeout(
        () => setCalendarStatuses((prev) => ({ ...prev, [todo._id]: null })),
        2000,
      );
    }
  };

  return (
    <div className="todo-list-container">
      <div className="todo-header">
        <h3>✓ Quick Todos</h3>
        <p className="todo-subtitle">Simple checklist for daily tasks</p>
      </div>

      <form onSubmit={handleSubmit} className="todo-input-form">
        <div className="todo-input-group">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a quick todo..."
            className="todo-input"
          />
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="todo-deadline-input"
            title="Optional deadline"
          />
        </div>
        <button type="submit" className="todo-add-btn" disabled={isAddingTodo}>
          {isAddingTodo ? "Adding..." : "+ Add"}
        </button>
      </form>

      <div className="todo-items">
        {todos.length === 0 ? (
          <div className="todo-empty">
            <span>📝</span>
            <p>No todos yet. Add one above!</p>
          </div>
        ) : (
          [...todos]
            .sort((a, b) => {
              // Pending todos first, completed todos at bottom
              if (a.completed === b.completed) return 0;
              return a.completed ? 1 : -1;
            })
            .map((todo) => {
              const todoTagDate = todo.deadline || todo.date || todayStr;
              const isTodayTag = todoTagDate === todayStr;
              // Compute overdue locally: use deadline if available, else isOverdue from server
              const isOverdue =
                !todo.completed &&
                (todo.deadline
                  ? todo.deadline < todayStr // Overdue = deadline date passed
                  : todo.isOverdue); // Fallback: server-set overdue
              return (
                <div
                  key={todo._id}
                  className={`todo-item ${todo.completed ? "completed" : ""} ${isOverdue ? "overdue-item" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => onToggleTodo(todo._id)}
                    className="todo-checkbox"
                    disabled={togglingTodo[todo._id]}
                  />
                  <span className="todo-text">
                    {isOverdue && <span className="overdue-tag">OVERDUE</span>}
                    {todo.text}
                    {todoTagDate && (
                      <span
                        className={`todo-deadline-badge ${isTodayTag ? "deadline-today" : ""} ${isOverdue ? "deadline-overdue" : ""}`}
                        title={todo.deadline ? "Deadline" : "Todo day"}
                      >
                        {isTodayTag
                          ? "Today"
                          : new Date(
                              todoTagDate + "T00:00:00",
                            ).toLocaleDateString("en-US", {
                              weekday: "short",
                            })}{" "}
                        •{" "}
                        {new Date(todoTagDate + "T00:00:00").toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </span>
                    )}
                  </span>
                  <div className="todo-actions">
                    <div className="calendar-btn-wrapper">
                      <button
                        onClick={() => handleCalBtnClick(todo)}
                        className={`todo-calendar-btn ${calendarStatuses[todo._id] === "added" ? "calendar-added" : ""}`}
                        title={
                          todoTagDate
                            ? `Add to calendar on ${new Date(todoTagDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                            : calendarStatuses[todo._id] === "added"
                              ? "Added to Calendar!"
                              : "Add to Google Calendar"
                        }
                        disabled={calendarStatuses[todo._id] === "adding"}
                      >
                        {calendarStatuses[todo._id] === "adding"
                          ? "⏳"
                          : calendarStatuses[todo._id] === "added"
                            ? "✅"
                            : "📅"}
                      </button>
                      {showPickerForTodo === todo._id &&
                        ReactDOM.createPortal(
                          <div
                            className="calendar-picker-overlay"
                            onClick={() => setShowPickerForTodo(null)}
                          >
                            <div
                              className="calendar-reminder-picker"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="calendar-picker-title">
                                Set Date, Time & Reminder
                              </div>
                              <div className="calendar-picker-context">
                                <div className="calendar-picker-context-label">
                                  Adding reminder for
                                </div>
                                <div className="calendar-picker-context-title">
                                  {todo.text}
                                </div>
                                <div className="calendar-picker-context-meta">
                                  {new Date(
                                    todoTagDate + "T00:00:00",
                                  ).toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </div>
                              </div>
                              <div className="calendar-picker-grid">
                                <label className="calendar-picker-field">
                                  <span>Date</span>
                                  <input
                                    type="date"
                                    value={calendarForm.date}
                                    onChange={(e) =>
                                      setCalendarForm((prev) => ({
                                        ...prev,
                                        date: e.target.value || todayStr,
                                      }))
                                    }
                                  />
                                </label>
                                <label className="calendar-picker-field">
                                  <span>Time</span>
                                  <input
                                    type="time"
                                    value={calendarForm.time}
                                    onChange={(e) =>
                                      setCalendarForm((prev) => ({
                                        ...prev,
                                        time: e.target.value,
                                      }))
                                    }
                                  />
                                </label>
                              </div>
                              <label className="calendar-picker-field">
                                <span>Reminder</span>
                                <select
                                  value={calendarForm.reminderMinutes}
                                  onChange={(e) =>
                                    setCalendarForm((prev) => ({
                                      ...prev,
                                      reminderMinutes: Number(e.target.value),
                                    }))
                                  }
                                >
                                  <option value={0}>No reminder</option>
                                  <option value={5}>5 min before</option>
                                  <option value={10}>10 min before</option>
                                  <option value={15}>15 min before</option>
                                  <option value={30}>30 min before</option>
                                  <option value={60}>1 hour before</option>
                                </select>
                              </label>
                              <div className="calendar-picker-actions">
                                <button
                                  className="btn-cancel"
                                  onClick={() => setShowPickerForTodo(null)}
                                  type="button"
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn-add"
                                  onClick={() =>
                                    handleAddToCalendar(
                                      todo,
                                      calendarForm.reminderMinutes,
                                    )
                                  }
                                  type="button"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>,
                          document.body,
                        )}
                    </div>
                    <button
                      onClick={() => onDeleteTodo(todo._id)}
                      className="todo-delete-btn"
                      title="Delete todo"
                      disabled={deletingTodo[todo._id]}
                    >
                      {deletingTodo[todo._id] ? "..." : "×"}
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </div>

      {todos.length > 0 && (
        <div className="todo-stats">
          {todos.filter((t) => t.completed).length} of {todos.length} completed
        </div>
      )}
    </div>
  );
};

export default TodoList;
