import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
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
import todoService from "../services/todoService";
import notificationService from "../services/notificationService";
import calendarService from "../services/calendarService";
import Onboarding from "../components/Onboarding";
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

    // Calculate week number (Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-end)
    // Always limit to 4 weeks per month
    const week = Math.min(Math.ceil(day / 7), 4);

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
    // Always limit to 4 weeks per month
    const week = Math.min(Math.ceil(day / 7), 4);

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
  const [selectedAnalyticsYear, setSelectedAnalyticsYear] = useState(new Date().getFullYear());
  const [selectedAnalyticsMonth, setSelectedAnalyticsMonth] = useState(new Date().getMonth());
  const [selectedAnalyticsWeek, setSelectedAnalyticsWeek] = useState(Math.ceil(new Date().getDate() / 7));
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateForApply, setSelectedTemplateForApply] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sleepMode, setSleepMode] = useState(false);
  const [activeSleepSession, setActiveSleepSession] = useState(null);
  const [sleepDuration, setSleepDuration] = useState(0);
  const [todos, setTodos] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [user] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  // Check if user needs onboarding (first time) - using database value
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    const isNewUser = sessionStorage.getItem('isNewRegistration');
    
    // Show onboarding for new registrations or if never completed (from database)
    if (isNewUser === 'true' || (user && !user.onboardingComplete)) {
      setShowOnboarding(true);
      sessionStorage.removeItem('isNewRegistration');
    }
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  // Function to manually start the tour
  const startTour = () => {
    setShowOnboarding(true);
  };

  // Theme toggle function
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Apply theme class to document
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuOpen && !event.target.closest('.profile-dropdown-container')) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [profileMenuOpen]);

  // Load todos from API
  const loadTodos = async () => {
    try {
      const data = await todoService.getTodos();
      setTodos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log("Failed to load todos:", error.message);
      setTodos([]);
    }
  };

  // Check Google Calendar connection status
  const checkCalendarConnection = async () => {
    try {
      const status = await calendarService.getStatus();
      setGoogleCalendarConnected(status.connected);
    } catch (error) {
      console.log("Failed to check calendar status:", error.message);
    }
  };

  // Connect Google Calendar
  const handleConnectCalendar = async () => {
    try {
      const { authUrl } = await calendarService.getAuthUrl();
      // Open OAuth popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        authUrl,
        'Google Calendar Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for OAuth callback
      const handleMessage = async (event) => {
        if (event.data?.type === 'GOOGLE_CALENDAR_CALLBACK') {
          window.removeEventListener('message', handleMessage);
          popup?.close();
          
          if (event.data.code) {
            try {
              await calendarService.handleCallback(event.data.code);
              setGoogleCalendarConnected(true);
              toast.success('📅 Google Calendar connected!');
            } catch (error) {
              toast.error('Failed to connect Google Calendar');
            }
          }
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (error) {
      toast.error('Failed to connect Google Calendar');
      console.error('Calendar connect error:', error);
    }
  };

  // Disconnect Google Calendar
  const handleDisconnectCalendar = async () => {
    try {
      await calendarService.disconnect();
      setGoogleCalendarConnected(false);
      toast.success('Google Calendar disconnected');
    } catch (error) {
      toast.error('Failed to disconnect calendar');
    }
  };

  useEffect(() => {
    loadCategories();
    loadTemplates();
    checkActiveSleep();
    loadTodos();
    checkCalendarConnection();

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
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error("Failed to load categories");
      setCategories([]);
      if (error.response?.status === 401) {
        navigate("/login");
      }
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await templateService.getTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log("Failed to load templates:", error);
      setTemplates([]);
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
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Load tasks error:", error.response || error);
      toast.error(error.response?.data?.message || "Failed to load tasks");
      setTasks([]); // Set empty array on error to prevent undefined errors
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
      setAnalyticsData(data || null);
    } catch (error) {
      console.error("Analytics error:", error);
      setAnalyticsData(null);
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

  // Helper function to get max weeks in a month
  const getMaxWeeksInMonth = (year, month) => {
    // Always return 4 weeks per month (Week 4 covers days 22 to end of month)
    return 4;
  };

  // Handle analytics period changes
  const handleAnalyticsYearChange = (year) => {
    setSelectedAnalyticsYear(year);
    setSelectedDate({ year, month: selectedAnalyticsMonth, week: selectedAnalyticsWeek });
  };

  const handleAnalyticsMonthChange = (month) => {
    setSelectedAnalyticsMonth(month);
    const maxWeeks = getMaxWeeksInMonth(selectedAnalyticsYear, month);
    const safeWeek = Math.min(selectedAnalyticsWeek, maxWeeks);
    setSelectedAnalyticsWeek(safeWeek);
    setSelectedDate({ year: selectedAnalyticsYear, month, week: safeWeek });
  };

  const handleAnalyticsWeekChange = (week) => {
    setSelectedAnalyticsWeek(week);
    setSelectedDate({ year: selectedAnalyticsYear, month: selectedAnalyticsMonth, week });
  };

  const navigateWeek = (direction) => {
    if (!selectedDate || selectedDate.month === null || !selectedDate.week) {
      return;
    }

    const { year, month, week } = selectedDate;
    const maxWeeks = 4; // Always 4 weeks per month

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
      newWeek = 4; // Always 4 weeks per month
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
      // If trying to start a task while sleep mode is active, prompt to turn off sleep
      if (isActive && sleepMode) {
        const shouldWakeUp = window.confirm(
          '😴 Sleep mode is currently active!\n\nYou cannot start tasks while sleeping. Would you like to turn off sleep mode and start this task?'
        );
        
        if (shouldWakeUp) {
          await toggleSleepMode(); // Turn off sleep mode
        } else {
          return; // Don't start the task
        }
      }
      
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

  

  // Todo handlers - API-based
  const handleAddTodo = async (text) => {
    try {
      const newTodo = await todoService.createTodo(text);
      setTodos([...todos, newTodo]);
    } catch (error) {
      toast.error("Failed to add todo");
    }
  };

  const handleToggleTodo = async (id) => {
    try {
      const todo = todos.find((t) => t._id === id);
      if (todo) {
        const updated = await todoService.toggleTodo(id, !todo.completed);
        setTodos(todos.map((t) => (t._id === id ? updated : t)));
      }
    } catch (error) {
      toast.error("Failed to update todo");
    }
  };

  const handleDeleteTodo = async (id) => {
    try {
      await todoService.deleteTodo(id);
      setTodos(todos.filter((todo) => todo._id !== id));
    } catch (error) {
      toast.error("Failed to delete todo");
    }
  };

  return (
    <div className={`dashboard ${sleepMode ? 'sleep-mode-active' : ''}`}>
      {/* Sleep Mode Overlay */}
      {sleepMode && (
        <div className="sleep-mode-overlay">
          <div className="sleep-mode-indicator">
            <span className="sleep-icon">😴</span>
            <span className="sleep-text">Sleep Mode Active</span>
            <span className="sleep-duration">{sleepDuration} min</span>
          </div>
        </div>
      )}
      
      {/* Onboarding Modal for new users */}
      {showOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}
      
      <div className="dashboard-header">
        <div className="header-left">
          {/* Hamburger menu - mobile only, on the left */}
          <button
            className="hamburger-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
          <div 
            className="logo-container" 
            onClick={() => setActiveTab("week")}
            style={{ cursor: 'pointer' }}
            title="Go to Home"
          >
            <img src="\logo.svg" alt="Task Tracker Pro Logo" className="app-logo" />
            <h1>Task Tracker</h1>
          </div>
        </div>
        {/* Mobile right side: Sleep + Theme Toggle */}
        <div className="mobile-header-actions">
          <button
            className={`btn-sleep-mode ${sleepMode ? "active" : ""}`}
            onClick={toggleSleepMode}
            title={sleepMode ? `Sleep: ${sleepDuration} min` : "Start Sleep Mode"}
          >
            {sleepMode ? `😴 ${sleepDuration}m` : "💤 Sleep"}
          </button>
          <button
            className="btn-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
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
        <div className="desktop-header-actions desktop-only">
          <button
            className={`btn-sleep-mode ${sleepMode ? "active" : ""}`}
            onClick={toggleSleepMode}
            title={sleepMode ? `Sleep: ${sleepDuration} min` : "Start Sleep Mode"}
          >
            {sleepMode ? `😴 ${sleepDuration}m` : "💤 Sleep"}
          </button>
          <button
            className="btn-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <div className="profile-dropdown-container">
            <button 
              className={`btn-profile ${profileMenuOpen ? 'active' : ''}`}
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              title="Profile menu"
            >
              <span className="profile-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || '👤'}
              </span>
              <span className="profile-name">{user?.name?.split(' ')[0] || 'Profile'}</span>
              <span className="dropdown-arrow">{profileMenuOpen ? '▲' : '▼'}</span>
            </button>
            {profileMenuOpen && (
              <div className="profile-dropdown-menu">
                <div className="profile-dropdown-header">
                  <span className="profile-avatar-large">
                    {user?.name?.charAt(0)?.toUpperCase() || '👤'}
                  </span>
                  <div className="profile-info">
                    <span className="profile-name-full">{user?.name || 'User'}</span>
                    <span className="profile-email">{user?.email || ''}</span>
                  </div>
                </div>
                <div className="profile-dropdown-divider"></div>
                <button 
                  className="profile-dropdown-item theme-toggle"
                  onClick={() => {
                    toggleTheme();
                  }}
                >
                  {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>
                <button 
                  className="profile-dropdown-item"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    startTour();
                  }}
                >
                  🎯 Tour Guide
                </button>
                <button 
                  className={`profile-dropdown-item ${googleCalendarConnected ? 'connected' : ''}`}
                  onClick={() => {
                    if (googleCalendarConnected) {
                      handleDisconnectCalendar();
                    } else {
                      handleConnectCalendar();
                    }
                  }}
                >
                  {googleCalendarConnected ? '📅 Disconnect Calendar' : '📅 Connect Google Calendar'}
                </button>
                <button 
                  className="profile-dropdown-item logout"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    handleLogout();
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
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
            className="mobile-menu-item tour-item"
            onClick={() => {
              setMobileMenuOpen(false);
              startTour();
            }}
          >
            🎯 Tour Guide
          </button>
          <button
            className={`mobile-menu-item ${googleCalendarConnected ? 'connected' : ''}`}
            onClick={() => {
              setMobileMenuOpen(false);
              if (googleCalendarConnected) {
                handleDisconnectCalendar();
              } else {
                handleConnectCalendar();
              }
            }}
          >
            {googleCalendarConnected ? '📅 Disconnect Calendar' : '📅 Connect Google Calendar'}
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
                            onToggleNotification={handleToggleNotification}
                            onReorderTasks={handleReorderTasks}
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
                        onReorderTasks={handleReorderTasks}
                        onHeaderClick={() => {
                          handleDateChange({ target: { value: day.date } });
                          setViewMode("day");
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
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
              
              {/* Week View Selectors */}
              {analyticsType === "week" && (
                <div className="analytics-date-selectors">
                  <select
                    className="analytics-selector"
                    value={selectedAnalyticsYear}
                    onChange={(e) => handleAnalyticsYearChange(Number(e.target.value))}
                  >
                    {[...Array(5)].map((_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="analytics-selector"
                    value={selectedAnalyticsMonth}
                    onChange={(e) => handleAnalyticsMonthChange(Number(e.target.value))}
                  >
                    {[
                      "January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"
                    ].map((month, index) => (
                      <option key={index} value={index}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <select
                    className="analytics-selector"
                    value={selectedAnalyticsWeek}
                    onChange={(e) => handleAnalyticsWeekChange(Number(e.target.value))}
                  >
                    {[...Array(getMaxWeeksInMonth(selectedAnalyticsYear, selectedAnalyticsMonth))].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Week {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Month View Selectors */}
              {analyticsType === "month" && (
                <div className="analytics-date-selectors">
                  <select
                    className="analytics-selector"
                    value={selectedAnalyticsYear}
                    onChange={(e) => handleAnalyticsYearChange(Number(e.target.value))}
                  >
                    {[...Array(5)].map((_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="analytics-selector"
                    value={selectedAnalyticsMonth}
                    onChange={(e) => handleAnalyticsMonthChange(Number(e.target.value))}
                  >
                    {[
                      "January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"
                    ].map((month, index) => (
                      <option key={index} value={index}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
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

      {/* Template Modal - rendered via Portal to appear above all content */}
      {showTemplateModal && ReactDOM.createPortal(
        <div
          className="modal-overlay"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="modal-content template-apply-modal"
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default Dashboard;
