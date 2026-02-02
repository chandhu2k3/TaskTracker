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

    const handleDragStart = (e, task) => {
      setDraggedTask(task);
      e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e, task) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e, targetTask) => {
      e.preventDefault();

      if (!draggedTask || draggedTask._id === targetTask._id) {
        setDraggedTask(null);
        return;
      }

      const draggedIndex = tasks.findIndex((t) => t._id === draggedTask._id);
      const targetIndex = tasks.findIndex((t) => t._id === targetTask._id);

      if (draggedIndex === -1 || targetIndex === -1) return;

      const reorderedTasks = [...tasks];
      const [removed] = reorderedTasks.splice(draggedIndex, 1);
      reorderedTasks.splice(targetIndex, 0, removed);

      onReorderTasks(date, reorderedTasks);
      setDraggedTask(null);
    };

    const handleAddTask = () => {
      if (taskInput.trim() && selectedCategory) {
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
        setIsAddFormExpanded(false); // Collapse after adding
      }
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
        <div className="day-header">
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
              onClick={() => setIsAddFormExpanded(true)}
            >
              <span className="btn-expand-icon">+</span>
              <span>Add Task</span>
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
                <select
                  className="category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="time-input"
                  placeholder="Time (min)"
                  value={plannedTime}
                  onChange={(e) => setPlannedTime(e.target.value)}
                  onKeyPress={handleKeyPress}
                  min="0"
                />
              </div>
              <div className="task-input-row">
                <input
                  type="text"
                  className="task-input"
                  placeholder="Add new task..."
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  autoFocus
                />
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
                  disabled={!taskInput.trim() || !selectedCategory}
                >
                  +
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
        <div className="tasks-list">
          {tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <p>No tasks yet. Add one above!</p>
            </div>
          ) : (
            tasks.map((task) => {
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
                  onDrop={handleDrop}
                  isDragging={draggedTask?._id === task._id}
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
