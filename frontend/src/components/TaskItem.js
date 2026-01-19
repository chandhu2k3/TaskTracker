import React, { useEffect, useRef } from "react";
import "./TaskItem.css";

const TaskItem = ({
  task,
  onToggle,
  onDelete,
  onToggleNotification,
  categoryColor,
  categoryIcon,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}) => {
  const overtimeCheckRef = useRef(null);

  // Debug: Log task data
  useEffect(() => {
    if (task.isAutomated) {
      console.log("TaskItem - Automated task:", {
        name: task.name,
        isAutomated: task.isAutomated,
        totalTime: task.totalTime,
        plannedTime: task.plannedTime,
        sessions: task.sessions?.length,
      });
    }
  }, [task]);

  const calculateTime = () => {
    let time = task.totalTime;
    if (task.isActive && task.startTime) {
      time += Date.now() - new Date(task.startTime).getTime();
    }
    return time;
  };

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Check if task is for today
  const isToday = () => {
    const taskDate = new Date(task.date);
    const today = new Date();
    return (
      taskDate.getFullYear() === today.getFullYear() &&
      taskDate.getMonth() === today.getMonth() &&
      taskDate.getDate() === today.getDate()
    );
  };

  const canToggle = isToday();

  const sessionCount = task.sessions ? task.sessions.length : 0;
  const totalSessionCount = sessionCount + (task.isActive ? 1 : 0);

  // Play notification sound
  const playNotificationSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error("Error playing notification sound:", error);
    }
  };

  // Check for overtime (planned time + 1 hour exceeded)
  useEffect(() => {
    if (task.isActive && task.plannedTime > 0) {
      const checkOvertime = () => {
        const currentTime = calculateTime();
        const overtimeThreshold = task.plannedTime + 60 * 60 * 1000; // planned + 1 hour

        if (currentTime >= overtimeThreshold) {
          // Stop the task automatically
          onToggle(task._id, false);

          // Play notification sound
          playNotificationSound();

          // Show notification
          const shouldContinue = window.confirm(
            `⚠️ Task "${task.name}" has exceeded planned time by more than 1 hour!\n\n` +
              `Planned: ${formatTime(task.plannedTime)}\n` +
              `Actual: ${formatTime(currentTime)}\n\n` +
              `The task has been stopped. Do you want to continue working on it?`,
          );

          if (shouldContinue) {
            // Restart the task
            setTimeout(() => onToggle(task._id, true), 100);
          }

          // Clear the interval
          if (overtimeCheckRef.current) {
            clearInterval(overtimeCheckRef.current);
          }
        }
      };

      // Check every 10 seconds
      overtimeCheckRef.current = setInterval(checkOvertime, 10000);

      return () => {
        if (overtimeCheckRef.current) {
          clearInterval(overtimeCheckRef.current);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.isActive, task._id, task.plannedTime, task.name]);

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task._id);
    onDragStart(e, task);
  };

  const handleMouseDown = (e) => {
    // Prevent drag from child elements like buttons
    if (e.target.closest(".task-controls")) {
      e.stopPropagation();
    }
  };

  return (
    <div
      className={`task-item ${task.isActive ? "active" : ""} ${
        isDragging ? "dragging" : ""
      }`}
      style={{ borderLeft: `4px solid ${categoryColor || "#6366f1"}` }}
      draggable="true"
      onDragStart={handleDragStart}
      onDragOver={(e) => onDragOver(e, task)}
      onDrop={(e) => onDrop(e, task)}
      onMouseDown={handleMouseDown}
    >
      <div className="task-header">
        <div className="task-name">
          <span className="drag-handle" title="Drag to reorder">
            ⋮⋮
          </span>
          <span className="task-category-icon">{categoryIcon || "📋"}</span>
          {task.name}
          {task.scheduledStartTime && task.scheduledEndTime && (
            <span className="time-slot-badge" title="Scheduled time">
              🕐 {task.scheduledStartTime}-{task.scheduledEndTime}
            </span>
          )}
          {task.isAutomated && (
            <span
              className="automated-badge"
              title="Automated task - tracked daily"
            >
              🔄 Auto
            </span>
          )}
          {!task.isActive && task.totalTime > 0 && (
            <span className="time-spent-badge">
              ⏱️ {formatTime(task.totalTime)}
            </span>
          )}
        </div>
        <div className="task-controls" draggable="false">
          {task.scheduledStartTime && (
            <div className="notification-controls">
              <button
                className={`btn-notification ${task.notificationsEnabled ? "active" : ""}`}
                onClick={() =>
                  onToggleNotification(task._id, !task.notificationsEnabled)
                }
                title={
                  task.notificationsEnabled
                    ? "Disable notifications"
                    : "Enable notifications"
                }
                draggable="false"
              >
                {task.notificationsEnabled ? "🔔" : "🔕"}
              </button>
              {task.notificationsEnabled && (
                <select
                  className="notification-time-select"
                  value={task.notificationTime || 30}
                  onChange={(e) =>
                    onToggleNotification(
                      task._id,
                      true,
                      parseInt(e.target.value),
                    )
                  }
                  onClick={(e) => e.stopPropagation()}
                  draggable="false"
                  title="Notification time before task"
                >
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 hour</option>
                </select>
              )}
            </div>
          )}
          <div
            className={`toggle-switch ${task.isActive ? "active" : ""} ${
              !canToggle ? "disabled" : ""
            }`}
            onClick={() => {
              if (canToggle) {
                onToggle(task._id, !task.isActive);
              }
            }}
            title={!canToggle ? "You can only start/stop today's tasks" : ""}
            draggable="false"
          >
            <div className="toggle-slider"></div>
          </div>
          <button
            className="btn-delete"
            onClick={() => {
              if (
                window.confirm(
                  `Are you sure you want to delete "${task.name}"?`,
                )
              ) {
                onDelete(task._id);
              }
            }}
            draggable="false"
          >
            ×
          </button>
        </div>
      </div>
      <div className="task-info">
        {/* Progress bar showing actual vs planned time */}
        <div className="task-progress-container">
          <div className="progress-bar-wrapper">
            <div
              className="progress-bar-fill"
              style={{
                width:
                  task.plannedTime > 0
                    ? `${Math.min(
                        (calculateTime() / task.plannedTime) * 100,
                        100,
                      )}%`
                    : "0%",
              }}
            >
              <span className="progress-text">
                {task.isActive ? "⏱️ " : "✓ "}
                {formatTime(calculateTime())}
              </span>
            </div>
          </div>
          <span className="planned-time-label">
            🎯 {formatTime(task.plannedTime || 0)}
          </span>
        </div>

        <div className="task-meta">
          {totalSessionCount > 0 && (
            <span className="task-sessions">
              🔄 {totalSessionCount} session{totalSessionCount > 1 ? "s" : ""}
            </span>
          )}
          <span
            className={`task-status ${task.isActive ? "running" : "stopped"}`}
          >
            {task.isActive ? "🟢 Running" : "⏸️ Stopped"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TaskItem;
