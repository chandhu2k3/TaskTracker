import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import CategoryManager from "../components/CategoryManager";
import TemplateSetup from "../components/TemplateSetup";
import DayCard from "../components/DayCard";
import Analytics from "../components/Analytics";
import TodoList from "../components/TodoList";
import taskService from "../services/taskService";
import categoryService from "../services/categoryService";
import templateService from "../services/templateService";
import sleepService from "../services/sleepService";
import notificationService from "../services/notificationService";
import "./Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();

  // Helper function to get local date string (not UTC)
  const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate current week on component mount
  const getCurrentWeek = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    // Calculate week number based on calendar (Week 1 = days 1-7, Week 2 = 8-14, etc.)
    const week = Math.ceil(day / 7);

    return { year, month, week };
  };

  // Get today's date string for the date input
  const getTodayDateString = () => {
    return getLocalDateString();
  };

  // Convert date object to week selection
  const dateToWeekSelection = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const week = Math.ceil(day / 7);

    return { year, month, week };
  };

  const handleDateChange = (e) => {
    const dateString = e.target.value;
    if (dateString) {
      const newSelection = dateToWeekSelection(dateString);
      setSelectedDate(newSelection);
      setDisplayDate(dateString);
      setSelectedDayDate(dateString); // Update day view selected date
      setScrollToDate(dateString);
    }
  };

  const [selectedDate, setSelectedDate] = useState(getCurrentWeek());
  const [displayDate, setDisplayDate] = useState(getTodayDateString());
  const [selectedDayDate, setSelectedDayDate] = useState(getTodayDateString()); // For day view
  const [scrollToDate, setScrollToDate] = useState(null);
  const dayCardRefs = useRef({});
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("week"); // week, categories, template, analytics
  const [viewMode, setViewMode] = useState("day"); // day or week
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsType, setAnalyticsType] = useState("week"); // week, month, category
  const [selectedAnalyticsCategory, setSelectedAnalyticsCategory] =
    useState("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateForApply, setSelectedTemplateForApply] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sleepMode, setSleepMode] = useState(false);
  const [activeSleepSession, setActiveSleepSession] = useState(null);
  const [sleepDuration, setSleepDuration] = useState(0);
  const [todos, setTodos] = useState([]);

  // Load todos from localStorage and handle carryover
  useEffect(() => {
    const loadTodos = () => {
      const savedTodos = localStorage.getItem('todos');
      if (savedTodos) {
        const parsedTodos = JSON.parse(savedTodos);
        const today = getLocalDateString();
        
        // Mark overdue todos and update their dates to today
        const updatedTodos = parsedTodos.map(todo => {
          if (todo.date < today && !todo.completed) {
            return { ...todo, date: today, isOverdue: true };
          }
          return todo;
        });
        
        // Filter to show only today's todos
        const todayTodos = updatedTodos.filter(todo => todo.date === today);
        setTodos(todayTodos);
        
        // Save back to localStorage if we updated dates
        if (JSON.stringify(updatedTodos) !== savedTodos) {
          localStorage.setItem('todos', JSON.stringify(updatedTodos));
        }
      }
    };
    
    loadTodos();
  }, []);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    if (todos.length >= 0) {
      localStorage.setItem('todos', JSON.stringify(todos));
    }
  }, [todos]);

  useEffect(() => {
    loadCategories();
    loadTemplates();
    checkActiveSleep();

    // Request notification permission on mount
    notificationService.requestPermission();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Start notification monitoring when tasks change
  useEffect(() => {
    if (tasks.length > 0) {
      notificationService.startMonitoring(tasks, (task) => {
        console.log("Notification sent for task:", task.name);
      });
    }

    return () => {
      notificationService.stopMonitoring();
    };
  }, [tasks]);

  const loadCategories = async () => {
    try {
      const data = await categoryService.getCategories();
      setCategories(data);
    } catch (error) {
      toast.error("Failed to load categories");
      if (error.response?.status === 401) {
        navigate("/login");
      }
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await templateService.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.log("Failed to load templates:", error);
    }
  };

  const loadTasks = async () => {
    if (!selectedDate || selectedDate.month === null || !selectedDate.week) {
      console.log("Cannot load tasks: incomplete date selection", selectedDate);
      return;
    }

    setLoading(true);
    try {
      console.log("Loading tasks for:", selectedDate);
      const data = await taskService.getTasksByWeek(
        selectedDate.year,
        selectedDate.month,
        selectedDate.week,
      );
      console.log("Tasks loaded:", data);
      setTasks(data);
    } catch (error) {
      console.error("Load tasks error:", error.response || error);
      toast.error(error.response?.data?.message || "Failed to load tasks");
      if (error.response?.status === 401) {
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  // Scroll to specific day card when scrollToDate is set
  useEffect(() => {
    if (scrollToDate && !loading && dayCardRefs.current[scrollToDate]) {
      setTimeout(() => {
        dayCardRefs.current[scrollToDate]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        setScrollToDate(null);
      }, 100);
    }
  }, [scrollToDate, loading]);

  const loadAnalytics = async () => {
    if (!selectedDate) return;

    try {
      let data;
      if (analyticsType === "week") {
        console.log("Loading week analytics:", selectedDate);
        data = await taskService.getWeeklyAnalytics(
          selectedDate.year,
          selectedDate.month,
          selectedDate.week,
        );
      } else if (analyticsType === "month") {
        console.log("Loading month analytics:", selectedDate);
        data = await taskService.getMonthlyAnalytics(
          selectedDate.year,
          selectedDate.month,
        );
      } else if (analyticsType === "category" && selectedAnalyticsCategory) {
        console.log("Loading category analytics:", selectedAnalyticsCategory);
        data = await taskService.getCategoryAnalytics(
          selectedAnalyticsCategory,
        );
      }
      console.log("Analytics data loaded:", data);
      setAnalyticsData(data);
    } catch (error) {
      console.error("Analytics error:", error);
      toast.error(
        "Failed to load analytics: " +
          (error.response?.data?.message || error.message),
      );
    }
  };

  useEffect(() => {
    if (activeTab === "analytics") {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, analyticsType, selectedAnalyticsCategory, selectedDate]);

  const navigateWeek = (direction) => {
    if (!selectedDate || selectedDate.month === null || !selectedDate.week) {
      return;
    }

    const { year, month, week } = selectedDate;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const maxWeeks = Math.ceil(daysInMonth / 7);

    let newWeek = week + direction;
    let newMonth = month;
    let newYear = year;

    // Move to next month if week exceeds max
    if (newWeek > maxWeeks) {
      newWeek = 1;
      newMonth++;
      if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
    }
    // Move to previous month if week is less than 1
    else if (newWeek < 1) {
      newMonth--;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      }
      const prevMonthDays = new Date(newYear, newMonth + 1, 0).getDate();
      newWeek = Math.ceil(prevMonthDays / 7);
    }

    setSelectedDate({ year: newYear, month: newMonth, week: newWeek });

    // Update display date to first day of the new week
    const firstDayOfWeek = 1 + (newWeek - 1) * 7;
    const newDate = new Date(newYear, newMonth, firstDayOfWeek);
    setDisplayDate(getLocalDateString(newDate));
  };

  const navigateDay = (direction) => {
    const currentDate = new Date(selectedDayDate);
    currentDate.setDate(currentDate.getDate() + direction);
    
    const newDateString = getLocalDateString(currentDate);
    setSelectedDayDate(newDateString);
    setDisplayDate(newDateString);
    
    // Update week selection for the new date
    const newSelection = dateToWeekSelection(newDateString);
    setSelectedDate(newSelection);
  };

  const handleAddTask = async (
    date,
    name,
    categoryId,
    plannedTime = 0,
    isAutomated = false,
    scheduledStartTime = null,
    scheduledEndTime = null,
  ) => {
    try {
      await taskService.createTask({
        name,
        date,
        category: categoryId,
        plannedTime,
        isAutomated,
        scheduledStartTime,
        scheduledEndTime,
      });
      toast.success("Task added successfully");
      // Reload tasks only if we have a complete selectedDate
      if (
        selectedDate?.year &&
        selectedDate?.month !== null &&
        selectedDate?.week
      ) {
        await loadTasks();
      }
    } catch (error) {
      toast.error("Failed to add task");
      console.error("Add task error:", error);
    }
  };

  const handleToggleTask = async (taskId, isActive) => {
    try {
      // If trying to start a task, check if another task is running
      if (isActive) {
        const currentlyActiveTask = tasks.find(
          (task) => task.isActive && task._id !== taskId,
        );

        if (currentlyActiveTask) {
          const shouldStop = window.confirm(
            `"${currentlyActiveTask.name}" is currently running. Do you want to stop it and start this task?\n\nClick OK to stop the previous task, or Cancel to keep both running.`,
          );

          if (shouldStop) {
            // Stop the currently active task
            await taskService.updateTask(currentlyActiveTask._id, {
              isActive: false,
            });
          }
        }
      }

      await taskService.updateTask(taskId, { isActive });

      // Reload all tasks to get fresh data
      await loadTasks();

      toast.success(isActive ? "Task started" : "Task stopped");
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await taskService.deleteTask(taskId);
      setTasks(tasks.filter((task) => task._id !== taskId));
      toast.success("Task deleted successfully");
    } catch (error) {
      toast.error("Failed to delete task");
    }
  };

  const handleDeleteDayTasks = async (date) => {
    if (
      !window.confirm(
        `Delete all tasks for ${new Date(date).toLocaleDateString()}?`,
      )
    ) {
      return;
    }

    try {
      await taskService.deleteTasksByDay(date);
      setTasks(tasks.filter((task) => task.date !== date));
      toast.success("Day tasks deleted successfully");
    } catch (error) {
      toast.error("Failed to delete day tasks");
    }
  };

  const handleResetWeek = async () => {
    if (
      !window.confirm("Delete all tasks for this week? This cannot be undone!")
    ) {
      return;
    }

    try {
      const { year, month, week } = selectedDate;
      await taskService.deleteTasksByWeek(year, month, week);
      await loadTasks();
      toast.success("Week reset successfully");
    } catch (error) {
      toast.error("Failed to reset week");
    }
  };

  const handleToggleNotification = async (
    taskId,
    enabled,
    notificationTime,
  ) => {
    try {
      // Request permission if enabling and don't have it
      if (enabled && !notificationService.hasPermission()) {
        const granted = await notificationService.requestPermission();
        if (!granted) {
          toast.error("Notification permission denied");
          return;
        }
      }

      const updateData = { notificationsEnabled: enabled };

      // Update notification time if provided
      if (notificationTime !== undefined) {
        updateData.notificationTime = notificationTime;
      }

      await taskService.updateTask(taskId, updateData);

      // Update local state
      setTasks(
        tasks.map((task) =>
          task._id === taskId ? { ...task, ...updateData } : task,
        ),
      );

      if (enabled) {
        const timeLabel = notificationTime || tasks.notificationTime || 30;
        toast.success(`Notifications enabled (${timeLabel} min before)`);
      } else {
        toast.success("Notifications disabled");
      }
    } catch (error) {
      toast.error("Failed to update notification settings");
    }
  };

  const handleReorderTasks = async (date, reorderedTasks) => {
    // Update local state immediately for smooth UX
    // Replace all tasks for the specific date with reordered tasks
    const updatedTasks = tasks.map((task) => {
      const reorderedTask = reorderedTasks.find((t) => t._id === task._id);
      if (reorderedTask) {
        return {
          ...reorderedTask,
          order: reorderedTasks.indexOf(reorderedTask),
        };
      }
      return task;
    });

    // Sort tasks by date and order
    updatedTasks.sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.order || 0) - (b.order || 0);
    });

    setTasks(updatedTasks);

    // Update order in backend for each task
    try {
      const updates = reorderedTasks.map((task, index) =>
        taskService.updateTask(task._id, { order: index }),
      );
      await Promise.all(updates);
    } catch (error) {
      console.error("Failed to update task order:", error);
      // Reload tasks to sync with server
      await loadTasks();
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedDate) {
      toast.error("Please select a week first");
      return;
    }

    if (templates.length === 0) {
      toast.error("No templates available. Create one first!");
      return;
    }

    if (!selectedTemplateForApply) {
      setShowTemplateModal(true);
      return;
    }

    try {
      await templateService.applyTemplate(
        selectedTemplateForApply,
        selectedDate.year,
        selectedDate.month,
        selectedDate.week,
      );
      toast.success("Template applied successfully!");
      setShowTemplateModal(false);
      setSelectedTemplateForApply("");
      await loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to apply template");
    }
  };

  const handleCreateTemplate = async (templateData) => {
    try {
      await templateService.createTemplate(templateData);
      toast.success("Template created successfully");
      loadTemplates();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create template");
    }
  };

  const handleUpdateTemplate = async (templateId, templateData) => {
    try {
      await templateService.updateTemplate(templateId, templateData);
      toast.success("Template updated successfully");
      await loadTemplates(); // Wait for templates to reload
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update template");
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      await templateService.deleteTemplate(templateId);
      toast.success("Template deleted successfully");
      loadTemplates();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete template");
    }
  };

  const handleAddCategory = async (categoryData) => {
    try {
      await categoryService.createCategory(categoryData);
      toast.success("Category created successfully");
      loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create category");
    }
  };

  const handleUpdateCategory = async (categoryId, categoryData) => {
    try {
      await categoryService.updateCategory(categoryId, categoryData);
      toast.success("Category updated successfully");
      loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update category");
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      await categoryService.deleteCategory(categoryId);
      toast.success("Category deleted successfully");
      loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete category");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
    toast.success("Logged out successfully");
  };

  // Sleep mode functions
  const checkActiveSleep = async () => {
    try {
      const activeSession = await sleepService.getActiveSleep();
      if (activeSession) {
        setActiveSleepSession(activeSession);
        setSleepMode(true);
      }
    } catch (error) {
      // Silently fail - sleep feature is optional
      console.log("Sleep tracking not available:", error.message);
    }
  };

  const toggleSleepMode = async () => {
    try {
      if (sleepMode) {
        // Stop sleep
        const stoppedSession = await sleepService.stopSleep();
        const duration = Math.floor(stoppedSession.duration / 1000 / 60); // minutes
        toast.success(`Sleep ended: ${duration} minutes tracked`);
        setSleepMode(false);
        setActiveSleepSession(null);
        setSleepDuration(0);
        loadTasks(); // Reload to include sleep in analytics
      } else {
        // Pause all active tasks before starting sleep
        const activeTasks = tasks.filter((task) => task.isActive);
        if (activeTasks.length > 0) {
          toast.info(`Pausing ${activeTasks.length} active task(s)...`);
          try {
            for (const task of activeTasks) {
              await taskService.stopTask(task._id);
            }
            await loadTasks(); // Reload tasks to show updated state
          } catch (error) {
            console.error("Error pausing tasks:", error);
            toast.error("Failed to pause some tasks");
            return; // Don't start sleep if pausing failed
          }
        }

        // Start sleep
        const newSession = await sleepService.startSleep();
        setActiveSleepSession(newSession);
        setSleepMode(true);
        toast.success("Sleep mode activated 😴");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to toggle sleep mode",
      );
    }
  };

  // Update sleep duration every minute when sleep is active
  useEffect(() => {
    let interval;
    if (sleepMode && activeSleepSession) {
      interval = setInterval(() => {
        const elapsed =
          Date.now() - new Date(activeSleepSession.startTime).getTime();
        setSleepDuration(Math.floor(elapsed / 1000 / 60)); // minutes
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sleepMode, activeSleepSession]);

  // Group tasks by date
  const getWeekDays = () => {
    if (!selectedDate || selectedDate.month === null || !selectedDate.week)
      return [];

    const { year, month, week } = selectedDate;

    // Week 1 starts from the 1st of the month
    // Week 2 starts from the 8th, Week 3 from the 15th, etc.
    const startDay = 1 + (week - 1) * 7;
    const weekStart = new Date(year, month, startDay, 12, 0, 0);

    const days = [];
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);

      // Only include if still in the same month
      if (date.getMonth() === month) {
        // Format date as YYYY-MM-DD without timezone conversion
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateString = `${year}-${month}-${day}`;

        const dayOfWeek = date.getDay();
        days.push({
          date: dateString,
          dayName: dayNames[dayOfWeek],
          displayName: `${dayNames[dayOfWeek]} (${date.getDate()}/${
            date.getMonth() + 1
          })`,
        });
      }
    }

    return days;
  };

  const weekDays = getWeekDays();
  const groupedTasks = weekDays.reduce((acc, day) => {
    acc[day.date] = tasks.filter((task) => {
      // Convert task date to YYYY-MM-DD format for comparison (use local date)
      const taskDate = task.date
        ? getLocalDateString(new Date(task.date))
        : null;
      return taskDate === day.date;
    });
    return acc;
  }, {});

  console.log("Tasks:", tasks);
  console.log("Week Days:", weekDays);
  console.log("Grouped Tasks:", groupedTasks);

  // Todo handlers
  const handleAddTodo = (text) => {
    const today = getLocalDateString();
    const newTodo = {
      id: Date.now(),
      text,
      completed: false,
      date: today,
      isOverdue: false,
    };
    setTodos([...todos, newTodo]);
  };

  const handleToggleTodo = (id) => {
    setTodos(todos.map((todo) => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const handleDeleteTodo = (id) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-left">
          <h1>� Task Tracker Pro</h1>
        </div>
        {/* Hamburger Menu Button - Mobile Only */}
        <button
          className="hamburger-menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>{" "}
        <div className="header-nav">
          <button
            className={`nav-btn ${activeTab === "week" ? "active" : ""}`}
            onClick={() => setActiveTab("week")}
          >
            🏠 Home
          </button>
          <button
            className={`nav-btn ${activeTab === "categories" ? "active" : ""}`}
            onClick={() => setActiveTab("categories")}
          >
            🏷️ Categories
          </button>
          <button
            className={`nav-btn ${activeTab === "template" ? "active" : ""}`}
            onClick={() => setActiveTab("template")}
          >
            📋 Template
          </button>
          <button
            className={`nav-btn ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            📈 Analytics
          </button>
        </div>
        <button
          className={`btn-sleep-mode ${sleepMode ? "active" : ""}`}
          onClick={toggleSleepMode}
          title={sleepMode ? `Sleep: ${sleepDuration} min` : "Start Sleep Mode"}
        >
          {sleepMode ? `😴 ${sleepDuration}m` : "💤 Sleep"}
        </button>
        <button className="btn-logout desktop-only" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <button
            className={`mobile-menu-item ${
              activeTab === "week" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("week");
              setMobileMenuOpen(false);
            }}
          >
            🏠 Home
          </button>
          <button
            className={`mobile-menu-item ${
              activeTab === "categories" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("categories");
              setMobileMenuOpen(false);
            }}
          >
            🏷️ Categories
          </button>
          <button
            className={`mobile-menu-item ${
              activeTab === "template" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("template");
              setMobileMenuOpen(false);
            }}
          >
            📋 Template
          </button>
          <button
            className={`mobile-menu-item ${
              activeTab === "analytics" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("analytics");
              setMobileMenuOpen(false);
            }}
          >
            📈 Analytics
          </button>
          <button
            className={`mobile-menu-item ${sleepMode ? "active" : ""}`}
            onClick={() => {
              toggleSleepMode();
              setMobileMenuOpen(false);
            }}
          >
            {sleepMode ? `😴 Sleep: ${sleepDuration}m` : "💤 Start Sleep"}
          </button>
          <button
            className="mobile-menu-item logout-item"
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
          >
            🚪 Logout
          </button>
        </div>
      )}

      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === "week" ? "active" : ""}`}
          onClick={() => setActiveTab("week")}
        >
          🏠 Home
        </button>
        <button
          className={`tab-btn ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          🏷️ Categories
        </button>
        <button
          className={`tab-btn ${activeTab === "template" ? "active" : ""}`}
          onClick={() => setActiveTab("template")}
        >
          📋 Template
        </button>
        <button
          className={`tab-btn ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          📈 Analytics
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === "week" && (
          <div className="week-view">
            {!selectedDate ||
            selectedDate.month === null ||
            !selectedDate.week ? (
              <div className="empty-state-large">
                <div className="empty-icon">📆</div>
                <h3>Select a Week to Get Started</h3>
                <p>Use the date picker in the header to choose a week</p>
              </div>
            ) : (
              <>
                <div className="week-actions">
                  <div className="view-mode-toggle">
                    <button
                      className={`view-mode-btn ${viewMode === "day" ? "active" : ""}`}
                      onClick={() => setViewMode("day")}
                      title="Day View"
                    >
                      📅 Day
                    </button>
                    <button
                      className={`view-mode-btn ${viewMode === "week" ? "active" : ""}`}
                      onClick={() => setViewMode("week")}
                      title="Week View"
                    >
                      📆 Week
                    </button>
                  </div>
                  <div className="week-navigation">
                    <button
                      className="btn-week-nav"
                      onClick={() => viewMode === "day" ? navigateDay(-1) : navigateWeek(-1)}
                      title={viewMode === "day" ? "Previous Day" : "Previous Week"}
                    >
                      ← {viewMode === "day" ? "Previous Day" : "Previous Week"}
                    </button>
                    <input
                      type="date"
                      className="date-input-compact"
                      value={displayDate}
                      onChange={handleDateChange}
                      title="Jump to specific date"
                    />
                    <button
                      className="btn-week-nav"
                      onClick={() => viewMode === "day" ? navigateDay(1) : navigateWeek(1)}
                      title={viewMode === "day" ? "Next Day" : "Next Week"}
                    >
                      {viewMode === "day" ? "Next Day" : "Next Week"} →
                    </button>
                  </div>
                  <div className="week-actions-right">
                    <button
                      className="btn-apply-template"
                      onClick={handleApplyTemplate}
                    >
                      ✨ Apply Template to This Week
                    </button>
                    <button
                      className="btn-reset-week"
                      onClick={handleResetWeek}
                      title="Delete all tasks for this week"
                    >
                      🗑️ Reset Week
                    </button>
                  </div>
                </div>
                {loading ? (
                  <div className="loading">Loading tasks...</div>
                ) : viewMode === "day" ? (
                  <div className="day-with-todos">
                    <div className="day-section">
                      {(() => {
                        const today = new Date();
                        const todayStr = getLocalDateString(today);
                        const selectedTask = weekDays.find(day => day.date === selectedDayDate);
                        return selectedTask ? (
                          <DayCard
                            key={selectedTask.date}
                            ref={(el) => (dayCardRefs.current[selectedTask.date] = el)}
                            date={selectedTask.date}
                            dayName={selectedTask.displayName}
                            tasks={groupedTasks[selectedTask.date] || []}
                            categories={categories}
                            onAddTask={handleAddTask}
                            onToggleTask={handleToggleTask}
                            onDeleteTask={handleDeleteTask}
                            onDeleteDayTasks={handleDeleteDayTasks}
                            isToday={selectedTask.date === todayStr}
                          />
                        ) : (
                          <div className="empty-state">No tasks for this date</div>
                        );
                      })()}
                    </div>
                    <div className="todos-section">
                      <TodoList
                        todos={todos}
                        onAddTodo={handleAddTodo}
                        onToggleTodo={handleToggleTodo}
                        onDeleteTodo={handleDeleteTodo}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="days-grid">
                    {weekDays.map((day) => (
                      <DayCard
                        key={day.date}
                        ref={(el) => (dayCardRefs.current[day.date] = el)}
                        date={day.date}
                        dayName={day.displayName}
                        tasks={groupedTasks[day.date] || []}
                        categories={categories}
                        onAddTask={handleAddTask}
                        onToggleTask={handleToggleTask}
                        onDeleteTask={handleDeleteTask}
                        onDeleteDayTasks={handleDeleteDayTasks}
                        onToggleNotification={handleToggleNotification}
                        onReorderTasks={handleReorderTasks}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {showTemplateModal && (
              <div
                className="modal-overlay"
                onClick={() => setShowTemplateModal(false)}
              >
                <div
                  className="modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3>Select Template to Apply</h3>
                  <div className="form-group">
                    <label>Choose a template:</label>
                    <select
                      value={selectedTemplateForApply}
                      onChange={(e) =>
                        setSelectedTemplateForApply(e.target.value)
                      }
                      className="template-select"
                    >
                      <option value="">Select a template...</option>
                      {templates.map((template) => (
                        <option key={template._id} value={template._id}>
                          {template.name} ({template.tasks?.length || 0} tasks)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-actions">
                    <button
                      onClick={() => {
                        setShowTemplateModal(false);
                        setSelectedTemplateForApply("");
                      }}
                      className="btn-cancel"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApplyTemplate}
                      className="btn-save"
                      disabled={!selectedTemplateForApply}
                    >
                      Apply Template
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "categories" && (
          <div className="categories-view">
            <CategoryManager
              categories={categories}
              onAdd={handleAddCategory}
              onUpdate={handleUpdateCategory}
              onDelete={handleDeleteCategory}
            />
          </div>
        )}

        {activeTab === "template" && (
          <div className="template-view">
            <TemplateSetup
              categories={categories}
              templates={templates}
              onCreateTemplate={handleCreateTemplate}
              onUpdateTemplate={handleUpdateTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onApplyTemplate={handleApplyTemplate}
            />
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="analytics-view">
            <div className="analytics-controls">
              <div className="analytics-type-selector">
                <button
                  className={`type-btn ${
                    analyticsType === "week" ? "active" : ""
                  }`}
                  onClick={() => setAnalyticsType("week")}
                >
                  Week View
                </button>
                <button
                  className={`type-btn ${
                    analyticsType === "month" ? "active" : ""
                  }`}
                  onClick={() => setAnalyticsType("month")}
                >
                  Month View
                </button>
                <button
                  className={`type-btn ${
                    analyticsType === "category" ? "active" : ""
                  }`}
                  onClick={() => setAnalyticsType("category")}
                >
                  Category View
                </button>
              </div>
              {analyticsType === "category" && (
                <select
                  className="category-filter"
                  value={selectedAnalyticsCategory}
                  onChange={(e) => setSelectedAnalyticsCategory(e.target.value)}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {analyticsData ? (
              <Analytics analytics={analyticsData} type={analyticsType} todos={todos} />
            ) : (
              <div className="empty-state-large">
                <div className="empty-icon">📊</div>
                <h3>Select Options to View Analytics</h3>
                <p>
                  Choose a view type and select a week/month to see your
                  progress
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
