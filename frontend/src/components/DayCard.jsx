import React, { useState, forwardRef } from "react";
import TaskItem from "./TaskItem";
import "./DayCard.css";

const DayCard = forwardRef(
  (
    {
      date,
      dayName,
      tasks,
      categories = [],
      onAddTask,
      onToggleTask,
      onDeleteTask,
      onDeleteDayTasks,
      onToggleNotification,
      onReorderTasks,
      onHeaderClick,
      isAddingTask = false,
      deletingTask = {},
    },
    ref
  ) => {
    const [taskInput, setTaskInput] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [plannedTime, setPlannedTime] = useState("");
    const [isAutomated, setIsAutomated] = useState(false);
    const [scheduledStartTime, setScheduledStartTime] = useState("");
    const [scheduledEndTime, setScheduledEndTime] = useState("");
    const [draggedTask, setDraggedTask] = useState(null);
    const [isAddFormExpanded, setIsAddFormExpanded] = useState(false);
    const [formErrors, setFormErrors] = useState({});

    const [localTasks, setLocalTasks] = useState(tasks);

    // Sync localTasks with props tasks when not dragging
    React.useEffect(() => {
      if (!draggedTask) {
        setLocalTasks(tasks);
      }
    }, [tasks, draggedTask]);

    const handleDragStart = (e, task) => {
      setDraggedTask(task);
      e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    };

    const handleDragEnter = (targetTask) => {
      if (!draggedTask || draggedTask._id === targetTask._id) return;

      const draggedIndex = localTasks.findIndex((t) => t._id === draggedTask._id);
      const targetIndex = localTasks.findIndex((t) => t._id === targetTask._id);

      if (draggedIndex === -1 || targetIndex === -1) return;

      const newOrder = [...localTasks];
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed);

      setLocalTasks(newOrder);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      if (!draggedTask) return;

      onReorderTasks(date, localTasks);
      setDraggedTask(null);
    };

    const handleAddTask = () => {
      const errors = {};
      if (!taskInput.trim()) errors.taskInput = 'Task name is required';
      if (!selectedCategory) errors.selectedCategory = 'Please select a category';

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
      setFormErrors({});

      const plannedMinutes = parseInt(plannedTime) || 0;
      onAddTask(
        date,
        taskInput.trim(),
        selectedCategory,
        plannedMinutes * 60 * 1000,
        isAutomated,
        scheduledStartTime || null,
        scheduledEndTime || null
      );
      setTaskInput("");
      setPlannedTime("");
      setIsAutomated(false);
      setScheduledStartTime("");
      setScheduledEndTime("");
      setIsAddFormExpanded(false);
    };

    const handleKeyPress = (e) => {
      if (e.key === "Enter") {
        handleAddTask();
      }
    };

    const calculateDayStats = () => {
      const totalTime = tasks.reduce((sum, task) => {
        let time = task.totalTime;
        if (task.isActive && task.startTime) {
          time += Date.now() - new Date(task.startTime).getTime();
        }
        return sum + time;
      }, 0);

      return {
        totalTime,
        taskCount: tasks.length,
      };
    };

    const formatTime = (milliseconds) => {
      const totalSeconds = Math.floor(milliseconds / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    };

    const getCategoryInfo = (categoryId) => {
      const category = categories.find((c) => c._id === categoryId);
      return category || { color: "#6366f1", icon: "📋" };
    };

    // Check if this day card is for today
    const isToday = () => {
      const cardDate = new Date(date);
      const today = new Date();
      return (
        cardDate.getFullYear() === today.getFullYear() &&
        cardDate.getMonth() === today.getMonth() &&
        cardDate.getDate() === today.getDate()
      );
    };

    const stats = calculateDayStats();

    return (
      <div className={`day-card ${isToday() ? "today" : ""}`} ref={ref}>
        <div 
          className={`day-header ${onHeaderClick ? "clickable" : ""}`} 
          onClick={onHeaderClick}
          title={onHeaderClick ? "Click to view full day" : ""}
        >
          <h3>{dayName}</h3>
          <div className="day-stats">
            <span className="day-time">{formatTime(stats.totalTime)}</span>
            <span className="day-count">
              {stats.taskCount} task{stats.taskCount !== 1 ? "s" : ""}
            </span>
            {tasks.length > 0 && (
              <button
                className="btn-delete-day"
                onClick={() => onDeleteDayTasks(date)}
                title="Delete all tasks for this day"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
        {/* Collapsible Add Task Section */}
        <div className={`add-task-section ${isAddFormExpanded ? 'expanded' : 'collapsed'}`}>
          {!isAddFormExpanded ? (
            <button 
              className="btn-expand-add-task"
              onClick={() => { setIsAddFormExpanded(true); setFormErrors({}); }}
            >
              <span className="btn-expand-icon">+</span>
              <span>Add New Task</span>
            </button>
          ) : (
            <>
              <div className="add-task-form-header">
                <span className="add-task-title">➕ New Task</span>
                <button 
                  className="btn-collapse-form"
                  onClick={() => setIsAddFormExpanded(false)}
                  title="Collapse"
                >
                  ✕
                </button>
              </div>
              <div className="category-row">
                <div className="field-group">
                <select
                  className={`category-select${formErrors.selectedCategory ? ' has-error' : ''}`}
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); if (formErrors.selectedCategory) setFormErrors(p => ({...p, selectedCategory: undefined})); }}
                >
                  <option value="">Select Category *</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
                {formErrors.selectedCategory && <span className="field-error">{formErrors.selectedCategory}</span>}
                </div>
                <input
                  type="number"
                  className="time-input"
                  placeholder="Time (min) — optional"
                  value={plannedTime}
                  onChange={(e) => setPlannedTime(e.target.value)}
                  onKeyPress={handleKeyPress}
                  min="0"
                />
              </div>
              <div className="task-input-row">
                <div className="field-group task-field-group">
                <input
                  type="text"
                  className={`task-input${formErrors.taskInput ? ' has-error' : ''}`}
                  placeholder="Task name (required)"
                  value={taskInput}
                  onChange={(e) => { setTaskInput(e.target.value); if (formErrors.taskInput) setFormErrors(p => ({...p, taskInput: undefined})); }}
                  onKeyPress={handleKeyPress}
                  autoFocus
                />
                {formErrors.taskInput && <span className="field-error">{formErrors.taskInput}</span>}
                </div>
                <label
                  className="automated-checkbox"
                  title="Automated tasks are tracked daily"
                >
                  <input
                    type="checkbox"
                    checked={isAutomated}
                    onChange={(e) => setIsAutomated(e.target.checked)}
                  />
                  <span>🔄 Auto</span>
                </label>
                <button
                  className="btn-add"
                  onClick={handleAddTask}
                  disabled={isAddingTask}
                  title="Add task"
                >
                  {isAddingTask ? "..." : "Add"}
                </button>
              </div>
              <div className="time-slot-row">
                <input
                  type="time"
                  className="time-slot-input"
                  placeholder="Start"
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                  title="Optional: Scheduled start time"
                />
                <span className="time-slot-separator">-</span>
                <input
                  type="time"
                  className="time-slot-input"
                  placeholder="End"
                  value={scheduledEndTime}
                  onChange={(e) => setScheduledEndTime(e.target.value)}
                  title="Optional: Scheduled end time"
                />
                <span className="time-slot-hint">⏰ Optional time slot</span>
              </div>
            </>
          )}
        </div>
        <div 
          className="tasks-list"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {localTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <p>No tasks yet. Add one above!</p>
            </div>
          ) : (
            localTasks.map((task) => {
              const categoryInfo = getCategoryInfo(task.category);
              return (
                <TaskItem
                  key={task._id}
                  task={task}
                  categoryColor={categoryInfo.color}
                  categoryIcon={categoryInfo.icon}
                  onToggle={onToggleTask}
                  onDelete={onDeleteTask}
                  onToggleNotification={onToggleNotification}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDrop={handleDrop}
                  draggedTask={draggedTask}
                  isDragging={draggedTask?._id === task._id}
                  isDeleting={deletingTask[task._id]}
                />
              );
            })
          )}
        </div>
      </div>
    );
  }
);

DayCard.displayName = "DayCard";

export default DayCard;
