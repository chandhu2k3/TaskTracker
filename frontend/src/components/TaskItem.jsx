import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { toast } from "react-toastify";
import "./TaskItem.css";
import calendarService from "../services/calendarService";

const TaskItem = ({
  task,
  onToggle,
  onDelete,
  onToggleNotification,
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
    // Add opacity to the dragging element for visual effect
    e.currentTarget.style.opacity = '0.5';
    onDragStart(e, task);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
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
        calendarPickerRef.current && !calendarPickerRef.current.contains(e.target) &&
        calendarBtnRef.current && !calendarBtnRef.current.contains(e.target)
      ) {
        setShowCalendarPicker(false);
      }
    };
    if (showCalendarPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCalendarPicker]);

  // State for time picker when task has no scheduled time
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [selectedEndTime, setSelectedEndTime] = useState('');
  const [pendingReminderMinutes, setPendingReminderMinutes] = useState(0);

  // Toggle reminder picker on calendar button click
  const handleCalendarClick = (e) => {
    e.stopPropagation();
    if (task.calendarEventId) {
      toast.info('📅 This task already has a calendar reminder');
      return;
    }
    if (!showCalendarPicker && calendarBtnRef.current) {
      const rect = calendarBtnRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 4, left: rect.right - 170 });
    }
    setShowCalendarPicker(!showCalendarPicker);
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
    
    await createCalendarEvent(reminderMinutes, task.scheduledStartTime, task.scheduledEndTime);
  };

  // Create calendar event with time information
  const createCalendarEvent = async (reminderMinutes, startTime, endTime) => {
    setCalendarStatus('adding');
    const plannedMinutes = Math.round((task.plannedTime || 1800000) / 60000);

    try {
      const result = await calendarService.smartAddToCalendar(
        {
          title: `📋 ${task.name}`,
          description: `Task from Task Tracker Pro\n\nPlanned time: ${formatTime(task.plannedTime || 0)}`,
          date: task.date,
          startTime: startTime || null,
          endTime: endTime || null,
          durationMinutes: plannedMinutes,
          reminderMinutes,
          taskId: task._id,
        },
        () => {
          setCalendarStatus('error');
          toast.error('❌ Please connect Google Calendar first from the profile menu.');
        }
      );

      if (result.success) {
        if (result.duplicate) {
          // Task already has a calendar event
          const confirmRecreate = window.confirm(
            '⚠️ This task already has a calendar reminder.\n\nDo you want to create another reminder?'
          );
          
          if (confirmRecreate) {
            // User wants to create duplicate - need to force create by not sending taskId
            const retryResult = await calendarService.smartAddToCalendar(
              {
                title: `📋 ${task.name}`,
                description: `Task from Task Tracker Pro\n\nPlanned time: ${formatTime(task.plannedTime || 0)}`,
                date: task.date,
                startTime: startTime || null,
                endTime: endTime || null,
                durationMinutes: plannedMinutes,
                reminderMinutes,
                taskId: null, // Don't send taskId to avoid duplicate check
              },
              () => {
                toast.error('❌ Failed to connect calendar');
              }
            );
            
            if (retryResult.success) {
              setCalendarStatus('added');
              toast.success('✅ Reminder set successfully!');
              setTimeout(() => setCalendarStatus(null), 3000);
            }
          } else {
            setCalendarStatus(null);
          }
        } else {
          // Successfully created new event
          setCalendarStatus('added');
          toast.success('✅ Reminder set successfully!');
          setTimeout(() => setCalendarStatus(null), 3000);
        }
      } else {
        setCalendarStatus(null);
      }
    } catch (err) {
      console.error('Calendar error:', err);
      setCalendarStatus('error');
      toast.error('❌ Failed to set reminder');
      setTimeout(() => setCalendarStatus(null), 2000);
    }
  };

  // Handle time picker submission
  const handleTimePickerSubmit = () => {
    if (!selectedStartTime || !selectedEndTime) {
      toast.warning('⚠️ Please select both start and end times');
      return;
    }
    
    // Validate time range
    const [startH, startM] = selectedStartTime.split(':').map(Number);
    const [endH, endM] = selectedEndTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    
    if (endMins <= startMins) {
      toast.warning('⚠️ End time must be after start time');
      return;
    }
    
    setShowTimePicker(false);
    createCalendarEvent(pendingReminderMinutes, selectedStartTime, selectedEndTime);
  };

  return (
    <div
      className={`task-item ${task.isActive ? "active" : ""} ${
        isDragging ? "dragging" : ""
      }`}
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
          <div className="calendar-btn-wrapper">
            <button
              ref={calendarBtnRef}
              className={`btn-calendar ${calendarStatus === 'added' || task.calendarEventId ? 'calendar-added' : ''}`}
              onClick={handleCalendarClick}
              title={task.calendarEventId ? 'Already in Google Calendar' : calendarStatus === 'added' ? 'Added to Calendar!' : calendarStatus === 'adding' ? 'Adding...' : 'Add to Google Calendar'}
              draggable="false"
              disabled={calendarStatus === 'adding'}
            >
              {calendarStatus === 'adding' ? '⏳' : (calendarStatus === 'added' || task.calendarEventId) ? '✅' : '📅'}
            </button>
            {showCalendarPicker && ReactDOM.createPortal(
              <div
                ref={calendarPickerRef}
                className="calendar-reminder-picker"
                style={{ top: pickerPos.top, left: pickerPos.left }}
              >
                <div className="calendar-picker-title">Set Reminder</div>
                <button onClick={() => handleAddToCalendar(0)}>No reminder</button>
                <button onClick={() => handleAddToCalendar(5)}>5 min before</button>
                <button onClick={() => handleAddToCalendar(10)}>10 min before</button>
                <button onClick={() => handleAddToCalendar(15)}>15 min before</button>
                <button onClick={() => handleAddToCalendar(30)}>30 min before</button>
                <button onClick={() => handleAddToCalendar(60)}>1 hour before</button>
              </div>,
              document.body
            )}
            {showTimePicker && ReactDOM.createPortal(
              <div className="time-picker-modal-overlay" onClick={() => setShowTimePicker(false)}>
                <div className="time-picker-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="time-picker-header">
                    <h3>⏰ Select Time Slot</h3>
                    <button className="time-picker-close" onClick={() => setShowTimePicker(false)}>✕</button>
                  </div>
                  <div className="time-picker-content">
                    <p className="time-picker-info">This task doesn't have a scheduled time. Please select when you want to work on it:</p>
                    <div className="time-input-group">
                      <label>
                        <span>Start Time:</span>
                        <input 
                          type="time" 
                          value={selectedStartTime}
                          onChange={(e) => setSelectedStartTime(e.target.value)}
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
                      <button className="btn-cancel" onClick={() => setShowTimePicker(false)}>Cancel</button>
                      <button className="btn-confirm" onClick={handleTimePickerSubmit}>Set Reminder</button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
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
      </div>
    </div>
  );
};

export default TaskItem;
