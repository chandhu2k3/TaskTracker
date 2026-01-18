// Task Tracker Application
class TaskTracker {
  constructor() {
    this.tasks = this.loadFromStorage();
    this.activeTimers = {};
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.renderAllDays();
    this.updateSummary();
    this.startTimerUpdates();
  }

  setupEventListeners() {
    // Add task buttons
    document.querySelectorAll(".btn-add").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dayCard = e.target.closest(".day-card");
        const input = dayCard.querySelector(".task-input");
        const day = dayCard.dataset.day;

        if (input.value.trim()) {
          this.addTask(day, input.value.trim());
          input.value = "";
        }
      });
    });

    // Enter key to add task
    document.querySelectorAll(".task-input").forEach((input) => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const dayCard = e.target.closest(".day-card");
          const btn = dayCard.querySelector(".btn-add");
          btn.click();
        }
      });
    });

    // Clear all button
    document.getElementById("clearAllBtn").addEventListener("click", () => {
      if (
        confirm(
          "Are you sure you want to clear all tasks? This cannot be undone."
        )
      ) {
        this.clearAllTasks();
      }
    });

    // Export button
    document.getElementById("exportBtn").addEventListener("click", () => {
      this.exportReport();
    });
  }

  addTask(day, name) {
    if (!this.tasks[day]) {
      this.tasks[day] = [];
    }

    const task = {
      id: Date.now(),
      name: name,
      isActive: false,
      totalTime: 0,
      startTime: null,
      createdAt: new Date().toISOString(),
    };

    this.tasks[day].push(task);
    this.saveToStorage();
    this.renderDay(day);
    this.updateSummary();
  }

  toggleTask(day, taskId) {
    const task = this.tasks[day].find((t) => t.id === taskId);
    if (!task) return;

    if (task.isActive) {
      // Stop the task
      const elapsedTime = Date.now() - task.startTime;
      task.totalTime += elapsedTime;
      task.startTime = null;
      task.isActive = false;
      delete this.activeTimers[taskId];
    } else {
      // Start the task
      task.isActive = true;
      task.startTime = Date.now();
    }

    this.saveToStorage();
    this.renderDay(day);
    this.updateSummary();
  }

  deleteTask(day, taskId) {
    if (!confirm("Delete this task?")) return;

    this.tasks[day] = this.tasks[day].filter((t) => t.id !== taskId);
    delete this.activeTimers[taskId];
    this.saveToStorage();
    this.renderDay(day);
    this.updateSummary();
  }

  renderDay(day) {
    const dayCard = document.querySelector(`[data-day="${day}"]`);
    const tasksList = dayCard.querySelector(".tasks-list");
    const tasks = this.tasks[day] || [];

    if (tasks.length === 0) {
      tasksList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <p>No tasks yet. Add one above!</p>
                </div>
            `;
    } else {
      tasksList.innerHTML = tasks
        .map((task) => this.createTaskHTML(day, task))
        .join("");

      // Add event listeners
      tasks.forEach((task) => {
        const taskEl = tasksList.querySelector(`[data-task-id="${task.id}"]`);

        // Toggle button
        const toggleBtn = taskEl.querySelector(".toggle-switch");
        toggleBtn.addEventListener("click", () => {
          this.toggleTask(day, task.id);
        });

        // Delete button
        const deleteBtn = taskEl.querySelector(".btn-delete");
        deleteBtn.addEventListener("click", () => {
          this.deleteTask(day, task.id);
        });
      });
    }

    // Update day stats
    this.updateDayStats(day);
  }

  createTaskHTML(day, task) {
    const currentTime = this.calculateTaskTime(task);
    const formattedTime = this.formatTime(currentTime);
    const activeClass = task.isActive ? "active" : "";
    const toggleClass = task.isActive ? "active" : "";
    const statusClass = task.isActive ? "running" : "stopped";
    const statusText = task.isActive ? "🟢 Running" : "⏸️ Stopped";

    return `
            <div class="task-item ${activeClass}" data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-name">${task.name}</div>
                    <div class="task-controls">
                        <div class="toggle-switch ${toggleClass}">
                            <div class="toggle-slider"></div>
                        </div>
                        <button class="btn-delete">×</button>
                    </div>
                </div>
                <div class="task-info">
                    <span class="task-time">⏱️ ${formattedTime}</span>
                    <span class="task-status ${statusClass}">${statusText}</span>
                </div>
            </div>
        `;
  }

  calculateTaskTime(task) {
    let time = task.totalTime;
    if (task.isActive && task.startTime) {
      time += Date.now() - task.startTime;
    }
    return time;
  }

  formatTime(milliseconds) {
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
  }

  updateDayStats(day) {
    const dayCard = document.querySelector(`[data-day="${day}"]`);
    const tasks = this.tasks[day] || [];

    const totalTime = tasks.reduce(
      (sum, task) => sum + this.calculateTaskTime(task),
      0
    );
    const taskCount = tasks.length;

    const timeSpan = dayCard.querySelector(".day-time");
    const countSpan = dayCard.querySelector(".day-count");

    timeSpan.textContent = this.formatTime(totalTime);
    countSpan.textContent = `${taskCount} task${taskCount !== 1 ? "s" : ""}`;
  }

  updateSummary() {
    let totalTasks = 0;
    let completedTasks = 0;
    let activeTasks = 0;
    let totalTime = 0;

    Object.values(this.tasks).forEach((dayTasks) => {
      dayTasks.forEach((task) => {
        totalTasks++;
        if (!task.isActive && task.totalTime > 0) {
          completedTasks++;
        }
        if (task.isActive) {
          activeTasks++;
        }
        totalTime += this.calculateTaskTime(task);
      });
    });

    document.getElementById("totalTasks").textContent = totalTasks;
    document.getElementById("completedTasks").textContent = completedTasks;
    document.getElementById("activeTasks").textContent = activeTasks;
    document.getElementById("totalTime").textContent =
      this.formatTime(totalTime);
  }

  renderAllDays() {
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    days.forEach((day) => this.renderDay(day));
  }

  startTimerUpdates() {
    setInterval(() => {
      const days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];
      days.forEach((day) => {
        const tasks = this.tasks[day] || [];
        const hasActiveTasks = tasks.some((t) => t.isActive);

        if (hasActiveTasks) {
          this.renderDay(day);
        }
      });
      this.updateSummary();
    }, 1000);
  }

  clearAllTasks() {
    this.tasks = {};
    this.activeTimers = {};
    this.saveToStorage();
    this.renderAllDays();
    this.updateSummary();
  }

  exportReport() {
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    let report = "=== WEEKLY TASK TRACKER REPORT ===\n\n";
    report += `Generated: ${new Date().toLocaleString()}\n\n`;

    let weeklyTotal = 0;
    let weeklyTaskCount = 0;

    days.forEach((day) => {
      const tasks = this.tasks[day] || [];
      if (tasks.length > 0) {
        report += `\n${day.toUpperCase()}\n`;
        report += "-".repeat(40) + "\n";

        let dayTotal = 0;
        tasks.forEach((task, index) => {
          const time = this.calculateTaskTime(task);
          dayTotal += time;
          weeklyTaskCount++;
          report += `${index + 1}. ${task.name}\n`;
          report += `   Time: ${this.formatTime(time)}\n`;
          report += `   Status: ${task.isActive ? "Active" : "Completed"}\n`;
        });

        report += `\nDay Total: ${this.formatTime(dayTotal)}\n`;
        report += `Tasks: ${tasks.length}\n`;
        weeklyTotal += dayTotal;
      }
    });

    report += "\n\n=== WEEKLY SUMMARY ===\n";
    report += `Total Tasks: ${weeklyTaskCount}\n`;
    report += `Total Time: ${this.formatTime(weeklyTotal)}\n`;
    report += `Average per Task: ${
      weeklyTaskCount > 0
        ? this.formatTime(weeklyTotal / weeklyTaskCount)
        : "0s"
    }\n`;

    // Download as text file
    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-tracker-report-${
      new Date().toISOString().split("T")[0]
    }.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  saveToStorage() {
    localStorage.setItem("taskTrackerData", JSON.stringify(this.tasks));
  }

  loadFromStorage() {
    const data = localStorage.getItem("taskTrackerData");
    return data ? JSON.parse(data) : {};
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new TaskTracker();
});
