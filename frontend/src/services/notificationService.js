// Browser Notification Service
class NotificationService {
  constructor() {
    // Safely check for Notification API support (not available on iOS Safari web)
    this.isSupported = typeof window !== 'undefined' && 'Notification' in window;
    this.permission = this.isSupported ? Notification.permission : 'denied';
    this.checkInterval = null;
  }

  // Request notification permission
  async requestPermission() {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      return false;
    }

    if (this.permission === "granted") {
      return true;
    }

    if (this.permission !== "denied") {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === "granted";
    }

    return false;
  }

  // Send a notification
  sendNotification(title, options = {}) {
    if (this.permission !== "granted") {
      console.log("Notification permission not granted");
      return null;
    }

    const notification = new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options,
    });

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);

    return notification;
  }

  // Check if a task needs notification
  shouldNotify(task) {
    if (!task.notificationsEnabled || !task.scheduledStartTime) {
      return false;
    }

    const taskDate = new Date(task.date);
    const today = new Date();
    
    // Only notify for today's tasks
    if (
      taskDate.getFullYear() !== today.getFullYear() ||
      taskDate.getMonth() !== today.getMonth() ||
      taskDate.getDate() !== today.getDate()
    ) {
      return false;
    }

    // Parse scheduled time
    const [hours, minutes] = task.scheduledStartTime.split(":").map(Number);
    const scheduledTime = new Date(today);
    scheduledTime.setHours(hours, minutes, 0, 0);

    // Calculate notification time (default 30 min before)
    const notificationMinutes = task.notificationTime || 30;
    const notificationTime = new Date(scheduledTime.getTime() - notificationMinutes * 60 * 1000);

    const now = new Date();
    
    // Check if we're within 1 minute of notification time
    const timeDiff = notificationTime.getTime() - now.getTime();
    const shouldNotify = timeDiff > 0 && timeDiff <= 60000; // Within next minute

    return shouldNotify;
  }

  // Start monitoring tasks for notifications
  startMonitoring(tasks, onNotify) {
    // Clear existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Check every 30 seconds
    this.checkInterval = setInterval(() => {
      const notifiedTasks = new Set();
      
      tasks.forEach((task) => {
        const taskKey = `${task._id}-${task.date}`;
        
        if (this.shouldNotify(task) && !notifiedTasks.has(taskKey)) {
          const [hours, minutes] = task.scheduledStartTime.split(":");
          const timeStr = `${hours}:${minutes}`;
          
          this.sendNotification(`⏰ Task Reminder: ${task.name}`, {
            body: `Scheduled at ${timeStr}\nClick to view`,
            tag: taskKey,
            requireInteraction: false,
          });

          notifiedTasks.add(taskKey);
          
          if (onNotify) {
            onNotify(task);
          }
        }
      });
    }, 30000); // Check every 30 seconds
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Check permission status
  hasPermission() {
    return this.permission === "granted";
  }
}

const notificationService = new NotificationService();
export default notificationService;
