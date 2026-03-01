import React, { useState } from "react";
import ReactDOM from "react-dom";
import "./TodoList.css";
import calendarService from "../services/calendarService";

const TodoList = ({ todos, onAddTodo, onToggleTodo, onDeleteTodo, isAddingTodo = false, togglingTodo = {}, deletingTodo = {} }) => {
  const [newTodo, setNewTodo] = useState("");
  const [deadline, setDeadline] = useState("");
  const [calendarStatuses, setCalendarStatuses] = useState({});
  const [showPickerForTodo, setShowPickerForTodo] = useState(null);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const pickerRef = React.useRef(null);
  const calBtnRefs = React.useRef({});

  // Compute today string for overdue comparison (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split("T")[0];

  // Close picker on outside click
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target) &&
        !Object.values(calBtnRefs.current).some(btn => btn && btn.contains(e.target))
      ) {
        setShowPickerForTodo(null);
      }
    };
    if (showPickerForTodo) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPickerForTodo]);

  const handleCalBtnClick = (todo) => {
    const todoId = todo._id;
    if (showPickerForTodo === todoId) {
      setShowPickerForTodo(null);
      return;
    }
    // If todo has a deadline, auto-trigger the reminder directly (no picker)
    if (todo.deadline && !todo.completed) {
      handleAddToCalendar(todo, 15); // Auto-remind 15 min before deadline
      return;
    }
    const btn = calBtnRefs.current[todoId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 4, left: rect.right - 170 });
    }
    setShowPickerForTodo(todoId);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newTodo.trim()) {
      onAddTodo(newTodo.trim(), deadline || null);
      setNewTodo("");
      setDeadline("");
    }
  };

  const handleAddToCalendar = async (todo, reminderMinutes) => {
    setShowPickerForTodo(null);
    setCalendarStatuses(prev => ({ ...prev, [todo._id]: 'adding' }));

    try {
      // Use deadline date if available, otherwise today
      const eventDate = todo.deadline ? new Date(todo.deadline + 'T14:00:00') : new Date();

      const result = await calendarService.smartAddToCalendar(
        {
          title: `✓ ${todo.text}`,
          description: todo.deadline
            ? `Deadline: ${new Date(todo.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
            : "Quick todo from Task Tracker Pro",
          date: eventDate,
          durationMinutes: 30,
          reminderMinutes,
        },
        () => {
          setCalendarStatuses(prev => ({ ...prev, [todo._id]: 'error' }));
          alert('Please connect Google Calendar first from the profile menu.');
        }
      );

      if (result.success) {
        setCalendarStatuses(prev => ({ ...prev, [todo._id]: 'added' }));
        setTimeout(() => setCalendarStatuses(prev => ({ ...prev, [todo._id]: null })), 2000);
      } else {
        setCalendarStatuses(prev => ({ ...prev, [todo._id]: null }));
      }
    } catch (err) {
      console.error('Calendar error:', err);
      setCalendarStatuses(prev => ({ ...prev, [todo._id]: 'error' }));
      setTimeout(() => setCalendarStatuses(prev => ({ ...prev, [todo._id]: null })), 2000);
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
              // Compute overdue locally: use deadline if available, else isOverdue from server
              const isOverdue = !todo.completed && (
                todo.deadline
                  ? todo.deadline < todayStr           // Overdue = deadline date passed
                  : todo.isOverdue                     // Fallback: server-set overdue
              );
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
                {isOverdue && (
                  <span className="overdue-tag">OVERDUE</span>
                )}
                {todo.text}
                {todo.deadline && (
                  <span className={`todo-deadline-badge ${isOverdue ? 'deadline-overdue' : ''}`} title="Deadline">
                    📅 {new Date(todo.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </span>
              <div className="todo-actions">
                <div className="calendar-btn-wrapper">
                  <button
                    ref={el => calBtnRefs.current[todo._id] = el}
                    onClick={() => handleCalBtnClick(todo)}
                    className={`todo-calendar-btn ${calendarStatuses[todo._id] === 'added' ? 'calendar-added' : ''}`}
                    title={todo.deadline
                      ? `Auto-add to calendar on ${new Date(todo.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : calendarStatuses[todo._id] === 'added' ? 'Added to Calendar!' : 'Add to Google Calendar'}
                    disabled={calendarStatuses[todo._id] === 'adding'}
                  >
                    {calendarStatuses[todo._id] === 'adding' ? '⏳' : calendarStatuses[todo._id] === 'added' ? '✅' : '📅'}
                  </button>
                  {showPickerForTodo === todo._id && ReactDOM.createPortal(
                    <div
                      ref={pickerRef}
                      className="calendar-reminder-picker"
                      style={{ top: pickerPos.top, left: pickerPos.left }}
                    >
                      <div className="calendar-picker-title">Set Reminder</div>
                      <button onClick={() => handleAddToCalendar(todo, 0)}>No reminder</button>
                      <button onClick={() => handleAddToCalendar(todo, 5)}>5 min before</button>
                      <button onClick={() => handleAddToCalendar(todo, 10)}>10 min before</button>
                      <button onClick={() => handleAddToCalendar(todo, 15)}>15 min before</button>
                      <button onClick={() => handleAddToCalendar(todo, 30)}>30 min before</button>
                      <button onClick={() => handleAddToCalendar(todo, 60)}>1 hour before</button>
                    </div>,
                    document.body
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
