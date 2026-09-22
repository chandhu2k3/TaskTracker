import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { toast } from "react-toastify";
import "./TaskItem.css";
import calendarService from "../services/calendarService";
import { formatLocalDate, getTodayString } from "../utils/timezone";
import taskService from "../services/taskService";
import { manualFinishTask } from "../services/taskService";

const TaskItem = ({
  task,
  onToggle,
  onDelete,
  onToggleNotification,
  onMarkMissed,
  categoryColor,
  categoryIcon,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDrop,
  draggedTask,
  isDragging,
  isDeleting = false,
}) => {
  const [isFinishing, setIsFinishing] = useState(false);
  const [isMarkingMissed, setIsMarkingMissed] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSpentH, setEditSpentH] = useState(0);
  const [editSpentM, setEditSpentM] = useState(0);
  const [editPlannedH, setEditPlannedH] = useState(0);
  const [editPlannedM, setEditPlannedM] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Open edit modal pre-filled with current values
  const handleEditOpen = () => {
    const spentMs = task.totalTime || 0;
    const plannedMs = task.plannedTime || 0;
    setEditName(task.name);
    setEditSpentH(Math.floor(spentMs / 3600000));
    setEditSpentM(Math.floor((spentMs % 3600000) / 60000));
    setEditPlannedH(Math.floor(plannedMs / 3600000));
    setEditPlannedM(Math.floor((plannedMs % 3600000) / 60000));
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    const spentMs  = (Number(editSpentH)   * 3600 + Number(editSpentM)   * 60) * 1000;
    const plannedMs= (Number(editPlannedH) * 3600 + Number(editPlannedM) * 60) * 1000;
    const nameVal  = editName.trim();
    if (!nameVal) { toast.warn("Task name can't be empty"); return; }
    setIsSavingEdit(true);
    try {
      await taskService.updateTask(task._id, { name: nameVal, totalTime: spentMs, plannedTime: plannedMs });
      setShowEditModal(false);
      toast.success("✅ Task updated");
      // Refresh-only nudge: third arg true avoids triggering a real start/stop toggle
      if (typeof onToggle === "function") await onToggle(task._id, task.isActive, true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save changes");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handler for manual finish
  const handleManualFinish = async () => {
    setIsFinishing(true);
    try {
      await manualFinishTask(task._id);
      if (typeof onToggle === "function") {
        await onToggle(task._id, false, true);
      } else {
        toast.success("Task marked as finished!");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to finish task");
    } finally {
      setIsFinishing(false);
    }
  };

  // Handler for marking missed
  const handleMarkMissed = async () => {
    setIsMarkingMissed(true);
    try {
      const newMissed = !task.missed;
      if (typeof onMarkMissed === "function") {
        await onMarkMissed(task._id, newMissed);
      }
    } catch (err) {
      toast.error("Failed to update missed status");
    } finally {
      setIsMarkingMissed(false);
    }
  };

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

  // Check if task is for today (timezone-aware; avoids UTC-midnight shift)
  const isToday = () => {
    try {
      return formatLocalDate(task.date) === getTodayString();
    } catch {
      return false;
    }
  };

  const canToggle = isToday();
  const isManuallyCompleted = !task.isActive && task.totalTime > 0;
  const progressDenominator =
    task.plannedTime > 0
      ? task.plannedTime
      : task.totalTime > 0
        ? task.totalTime
        : 1;

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
    // Add opacity to the dragging element for visual effect
    e.currentTarget.style.opacity = "0.5";
    onDragStart(e, task);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = "1";
  };

  const handleMouseDown = (e) => {
    // Prevent drag from child elements like buttons
    if (e.target.closest(".task-controls")) {
      e.stopPropagation();
    }
  };

  const [calendarStatus, setCalendarStatus] = React.useState(null); // 'adding' | 'added' | 'error' | null
  const [showCalendarPicker, setShowCalendarPicker] = React.useState(false);
  const [pickerPos, setPickerPos] = React.useState({ top: 0, left: 0 });
  const calendarBtnRef = React.useRef(null);
  const calendarPickerRef = React.useRef(null);

  // Close picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        calendarPickerRef.current &&
        !calendarPickerRef.current.contains(e.target) &&
        calendarBtnRef.current &&
        !calendarBtnRef.current.contains(e.target)
      ) {
        setShowCalendarPicker(false);
      }
    };
    if (showCalendarPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCalendarPicker]);

  // State for time picker when task has no scheduled time
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");
  const [pendingReminderMinutes, setPendingReminderMinutes] = useState(0);

  // Toggle reminder picker on calendar button click
  const handleCalendarClick = (e) => {
    e.stopPropagation();
    if (!showCalendarPicker && calendarBtnRef.current) {
      const rect = calendarBtnRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 4, left: rect.right - 170 });
    }
    setShowCalendarPicker(!showCalendarPicker);
  };

  // Remove calendar event
  const handleRemoveFromCalendar = async () => {
    if (!task.calendarEventId) return;
    setShowCalendarPicker(false);
    setCalendarStatus("adding");
    try {
      await calendarService.deleteEvent(task.calendarEventId);
      task.calendarEventId = null; // Update local reference
      setCalendarStatus(null);
      toast.success("🗑 Removed from Google Calendar");
    } catch (err) {
      console.error("Calendar delete error:", err);
      setCalendarStatus(null);
      toast.error("Failed to remove calendar event");
    }
  };

  // Add task to Google Calendar via API with chosen reminder
  const handleAddToCalendar = async (reminderMinutes) => {
    setShowCalendarPicker(false);

    // Check if task has time slot - if not, show time picker
    if (!task.scheduledStartTime || !task.scheduledEndTime) {
      setPendingReminderMinutes(reminderMinutes);
      setShowTimePicker(true);
      return;
    }

    await createCalendarEvent(
      reminderMinutes,
      task.scheduledStartTime,
      task.scheduledEndTime,
    );
  };

  // Create calendar event with time information
  const createCalendarEvent = async (reminderMinutes, startTime, endTime) => {
    setCalendarStatus("adding");
    const plannedMinutes = Math.round((task.plannedTime || 1800000) / 60000);
    const eventDate = task.date ? new Date(task.date).toISOString().split("T")[0] : getTodayString();

    try {
      const result = await calendarService.smartAddToCalendar(
        {
          title: `📋 ${task.name}`,
          description: `Task from Task Tracker Pro\n\nPlanned time: ${formatTime(task.plannedTime || 0)}`,
          date: eventDate,
          startTime: startTime || null,
          endTime: endTime || null,
          durationMinutes: plannedMinutes,
          reminderMinutes,
          taskId: task._id,
        },
        () => {
          setCalendarStatus("error");
          toast.error(
            "❌ Please connect Google Calendar first from the profile menu.",
          );
        },
      );

      if (result.success) {
        if (result.duplicate) {
          // Task already has a calendar event
          const confirmRecreate = window.confirm(
            "⚠️ This task already has a calendar reminder.\n\nDo you want to create another reminder?",
          );

          if (confirmRecreate) {
            // User wants to create duplicate - need to force create by not sending taskId
            const retryResult = await calendarService.smartAddToCalendar(
              {
                title: `📋 ${task.name}`,
                description: `Task from Task Tracker Pro\n\nPlanned time: ${formatTime(task.plannedTime || 0)}`,
                date: eventDate,
                startTime: startTime || null,
                endTime: endTime || null,
                durationMinutes: plannedMinutes,
                reminderMinutes,
                taskId: null, // Don't send taskId to avoid duplicate check
              },
              () => {
                toast.error("❌ Failed to connect calendar");
              },
            );

            if (retryResult.success) {
              setCalendarStatus("added");
              toast.success("✅ Reminder set successfully!");
              setTimeout(() => setCalendarStatus(null), 3000);
            }
          } else {
            setCalendarStatus(null);
          }
        } else {
          // Successfully created new event
          setCalendarStatus("added");
          toast.success("✅ Reminder set successfully!");
          setTimeout(() => setCalendarStatus(null), 3000);
        }
      } else {
        setCalendarStatus(null);
      }
    } catch (err) {
      console.error("Calendar error:", err);
      setCalendarStatus("error");
      toast.error("❌ Failed to set reminder");
      setTimeout(() => setCalendarStatus(null), 2000);
    }
  };

  // Handle time picker submission
  const handleTimePickerSubmit = () => {
    if (!selectedStartTime || !selectedEndTime) {
      toast.warning("⚠️ Please select both start and end times");
      return;
    }

    // Validate time range
    const [startH, startM] = selectedStartTime.split(":").map(Number);
    const [endH, endM] = selectedEndTime.split(":").map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (endMins <= startMins) {
      toast.warning("⚠️ End time must be after start time");
      return;
    }

    setShowTimePicker(false);
    createCalendarEvent(
      pendingReminderMinutes,
      selectedStartTime,
      selectedEndTime,
    );
  };

  return (
    <div
      className={`task-item ${task.isActive ? "active" : ""} ${
        isManuallyCompleted ? "completed" : ""
      } ${isDragging ? "dragging" : ""} ${task.missed ? "missed" : ""}`}
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => onDragOver(e, task)}
      onDragEnter={() => onDragEnter(task)}
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
          {task.missed && (
            <span className="missed-badge" title="Marked as missed">
              ✗ Missed
            </span>
          )}
          {totalSessionCount > 0 && (
            <span className="task-sessions">
              🔄 {totalSessionCount} session{totalSessionCount > 1 ? "s" : ""}
            </span>
          )}
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
          {/* Manual Finish Button: Only show if not active and not finished */}
          {!task.isActive && task.totalTime === 0 && !isFinishing && !task.missed && (
            <button
              className="btn-manual-finish"
              onClick={handleManualFinish}
              title="Mark as finished manually"
              draggable="false"
            >
              ✓ Finish
            </button>
          )}
          {isFinishing && (
            <button className="btn-manual-finish finishing" disabled>
              Finishing...
            </button>
          )}
          {/* Edit Button */}
          {!task.isActive && (
            <button
              className="btn-edit-task"
              onClick={handleEditOpen}
              title="Edit task (fix name or time)"
              draggable="false"
            >
              ✎
            </button>
          )}
          {/* Mark Missed Button: show if not active and not manually completed */}
          {!task.isActive && !isFinishing && (
            <button
              className={`btn-mark-missed ${task.missed ? "active-missed" : ""}`}
              onClick={handleMarkMissed}
              disabled={isMarkingMissed}
              title={task.missed ? "Remove missed mark" : "Mark as missed"}
              draggable="false"
            >
              {isMarkingMissed ? "..." : task.missed ? "↺ Undo" : "✗ Missed"}
            </button>
          )}
          <div className="calendar-btn-wrapper">
            <button
              ref={calendarBtnRef}
              className={`btn-calendar ${calendarStatus === "added" || task.calendarEventId ? "calendar-added" : ""}`}
              onClick={handleCalendarClick}
              title={
                task.calendarEventId
                  ? "Already in Google Calendar"
                  : calendarStatus === "added"
                    ? "Added to Calendar!"
                    : calendarStatus === "adding"
                      ? "Adding..."
                      : "Add to Google Calendar"
              }
              draggable="false"
              disabled={calendarStatus === "adding"}
            >
              {calendarStatus === "adding"
                ? "⏳"
                : calendarStatus === "added" || task.calendarEventId
                  ? "✅"
                  : "📅"}
            </button>
            {showCalendarPicker &&
              ReactDOM.createPortal(
                <div
                  ref={calendarPickerRef}
                  className="calendar-reminder-picker"
                  style={{ top: pickerPos.top, left: pickerPos.left }}
                >
                  {task.calendarEventId ? (
                    <>
                      <div className="calendar-picker-title">Calendar Event</div>
                      <div className="calendar-event-status">✅ In Calendar</div>
                      <button className="btn-remove-calendar" onClick={handleRemoveFromCalendar}>
                        🗑 Remove from Calendar
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="calendar-picker-title">Set Reminder</div>
                      <button onClick={() => handleAddToCalendar(0)}>
                        No reminder
                      </button>
                      <button onClick={() => handleAddToCalendar(5)}>
                        5 min before
                      </button>
                      <button onClick={() => handleAddToCalendar(10)}>
                        10 min before
                      </button>
                      <button onClick={() => handleAddToCalendar(15)}>
                        15 min before
                      </button>
                      <button onClick={() => handleAddToCalendar(30)}>
                        30 min before
                      </button>
                      <button onClick={() => handleAddToCalendar(60)}>
                        1 hour before
                      </button>
                    </>
                  )}
                </div>,
                document.body,
              )}
            {showTimePicker &&
              ReactDOM.createPortal(
                <div
                  className="time-picker-modal-overlay"
                  onClick={() => setShowTimePicker(false)}
                >
                  <div
                    className="time-picker-modal"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="time-picker-header">
                      <h3>⏰ Select Time Slot</h3>
                      <button
                        className="time-picker-close"
                        onClick={() => setShowTimePicker(false)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="time-picker-content">
                      <p className="time-picker-info">
                        This task doesn't have a scheduled time. Please select
                        when you want to work on it:
                      </p>
                      <div className="time-input-group">
                        <label>
                          <span>Start Time:</span>
                          <input
                            type="time"
                            value={selectedStartTime}
                            onChange={(e) =>
                              setSelectedStartTime(e.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>End Time:</span>
                          <input
                            type="time"
                            value={selectedEndTime}
                            onChange={(e) => setSelectedEndTime(e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="time-picker-actions">
                        <button
                          className="btn-cancel"
                          onClick={() => setShowTimePicker(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-confirm"
                          onClick={handleTimePickerSubmit}
                        >
                          Set Reminder
                        </button>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body,
              )}
          </div>

          <button
            className={`btn-play-pause ${task.isActive ? "active" : ""} ${
              !canToggle ? "disabled" : ""
            }`}
            onClick={() => {
              if (canToggle) {
                onToggle(task._id, !task.isActive);
              }
            }}
            title={
              !canToggle
                ? "You can only start/stop today's tasks"
                : task.isActive
                  ? "Pause task"
                  : "Start task"
            }
            draggable="false"
            disabled={!canToggle}
          >
            <span className="material-symbols-outlined">
              {task.isActive ? "pause" : "play_arrow"}
            </span>
          </button>
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
            disabled={isDeleting}
            draggable="false"
          >
            {isDeleting ? "..." : "×"}
          </button>
        </div>
      </div>
      <div className="task-info">
        {/* Progress bar showing actual vs planned time */}
        <div className="task-progress-container">
          <span className="progress-text">
            {task.isActive ? "" : ""}
            {formatTime(calculateTime())}
          </span>
          <div className="progress-bar-wrapper">
            <div
              className="progress-bar-fill"
              style={{
                width: `${Math.min(
                  (calculateTime() / progressDenominator) * 100,
                  100,
                )}%`,
              }}
            />
          </div>
          <span className="planned-time-label">
            {formatTime(task.plannedTime || task.totalTime || 0)}
          </span>
        </div>
      </div>

      {/* ── Edit Modal ─────────────────────────────────── */}
      {showEditModal && ReactDOM.createPortal(
        <div className="task-edit-overlay" onClick={() => setShowEditModal(false)}>
          <div className="task-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="task-edit-header">
              <h3>✎ Edit Task</h3>
              <button className="task-edit-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <div className="task-edit-body">
              <label className="task-edit-field">
                <span>Task name</span>
                <input
                  className="task-edit-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={120}
                  autoFocus
                />
              </label>

              <label className="task-edit-field">
                <span>Time spent <small>(correct if timer ran too long)</small></span>
                <div className="task-edit-time-row">
                  <input type="number" min="0" max="23" value={editSpentH}
                    onChange={(e) => setEditSpentH(Math.max(0, Number(e.target.value)))}
                    className="task-edit-time-input" />
                  <span>h</span>
                  <input type="number" min="0" max="59" value={editSpentM}
                    onChange={(e) => setEditSpentM(Math.max(0, Math.min(59, Number(e.target.value))))}
                    className="task-edit-time-input" />
                  <span>m</span>
                </div>
              </label>

              <label className="task-edit-field">
                <span>Planned time</span>
                <div className="task-edit-time-row">
                  <input type="number" min="0" max="23" value={editPlannedH}
                    onChange={(e) => setEditPlannedH(Math.max(0, Number(e.target.value)))}
                    className="task-edit-time-input" />
                  <span>h</span>
                  <input type="number" min="0" max="59" value={editPlannedM}
                    onChange={(e) => setEditPlannedM(Math.max(0, Math.min(59, Number(e.target.value))))}
                    className="task-edit-time-input" />
                  <span>m</span>
                </div>
              </label>
            </div>
            <div className="task-edit-actions">
              <button className="task-edit-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="task-edit-save" onClick={handleEditSave} disabled={isSavingEdit}>
                {isSavingEdit ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TaskItem;
