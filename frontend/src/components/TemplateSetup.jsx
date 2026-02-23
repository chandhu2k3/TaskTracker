import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "./TemplateSetup.css";

const TemplateSetup = ({
  categories,
  templates = [],
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onApplyTemplate,
  isApplyingTemplate = false,
  isCreatingTemplate = false,
  updatingTemplate = {},
  deletingTemplate = {},
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [templateTasks, setTemplateTasks] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [draggedTaskIndex, setDraggedTaskIndex] = useState(null);
  const [selectedEditDay, setSelectedEditDay] = useState("monday"); // Track which day is being edited

  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0]._id);
    }
  }, [templates, selectedTemplateId]);

  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId);

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateTasks([]);
    setShowModal(true);
  };

  const openEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    // Ensure all tasks have isAutomated field, even if they don't in the database
    const tasksWithDefaults = (template.tasks || []).map((task) => ({
      ...task,
      isAutomated: task.isAutomated || false,
      completionCount: task.completionCount || 0,
      addToCalendar: task.addToCalendar || false,
      reminderMinutes: task.reminderMinutes || 0,
    }));
    setTemplateTasks(tasksWithDefaults);
    setShowModal(true);
  };

  const addTask = () => {
    if (categories.length === 0) {
      alert("Please create at least one category first!");
      return;
    }
    setTemplateTasks([
      ...templateTasks,
      {
        name: "",
        category: categories[0].name,
        day: selectedEditDay, // Add to currently selected day
        plannedTime: 0,
        isAutomated: false,
        scheduledStartTime: null,
        scheduledEndTime: null,
        addToCalendar: false,
        reminderMinutes: 0,
      },
    ]);
  };

  const updateTask = (index, field, value) => {
    console.log("Frontend - updateTask called:", {
      index,
      field,
      value,
      currentValue: templateTasks[index]?.[field],
    });
    const updated = [...templateTasks];
    updated[index][field] = value;
    setTemplateTasks(updated);
    console.log("Frontend - Task updated:", {
      field,
      newValue: updated[index][field],
    });
  };

  const removeTask = (index) => {
    setTemplateTasks(templateTasks.filter((_, i) => i !== index));
  };

  const handleDragStart = (e, index) => {
    setDraggedTaskIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (targetIndex) => {
    if (draggedTaskIndex === null || draggedTaskIndex === targetIndex) return;

    const reordered = [...templateTasks];
    const [removed] = reordered.splice(draggedTaskIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    setTemplateTasks(reordered);
    setDraggedTaskIndex(targetIndex); // Update index since item moved
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDraggedTaskIndex(null);
  };

  const handleSave = () => {
    if (!templateName.trim()) {
      alert("Please provide a template name!");
      return;
    }

    if (templateTasks.length === 0) {
      alert("Please add at least one task to your template!");
      return;
    }

    const validTasks = templateTasks.filter((t) => t.name.trim());
    if (validTasks.length === 0) {
      alert("Please provide names for your tasks!");
      return;
    }

    console.log("Frontend - Saving template with tasks:", validTasks);
    console.log(
      "Frontend - isAutomated values:",
      validTasks.map((t) => ({ name: t.name, isAutomated: t.isAutomated }))
    );

    const templateData = { name: templateName, tasks: validTasks };

    if (editingTemplate) {
      onUpdateTemplate(editingTemplate._id, templateData);
    } else {
      onCreateTemplate(templateData);
    }

    setShowModal(false);
  };

  const handleDelete = (templateId) => {
    if (window.confirm("Are you sure you want to delete this template?")) {
      onDeleteTemplate(templateId);
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
      }
    }
  };

  const getCategoryIcon = (categoryName) => {
    const category = categories.find((c) => c.name === categoryName);
    return category ? category.icon : "📋";
  };

  const getCategoryColor = (categoryName) => {
    const category = categories.find((c) => c.name === categoryName);
    return category ? category.color : "#6366f1";
  };

  const groupedTasks = selectedTemplate
    ? days.map((day) => ({
        day,
        tasks: selectedTemplate.tasks.filter((t) => t.day === day),
      }))
    : [];

  return (
    <div className="template-setup">
      <div className="template-header">
        <div>
          <h3>📅 Weekly Templates</h3>
          <p className="template-subtitle">
            {templates.length} template{templates.length !== 1 ? "s" : ""} saved
          </p>
        </div>
        <button onClick={openNewTemplate} className="btn-new-template">
          + New Template
        </button>
      </div>

      {templates.length > 0 && (
        <>
          <div className="template-selector">
            <label>Select Template:</label>
            <div className="template-select-row">
              <select
                value={selectedTemplateId || ""}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="template-dropdown"
              >
                {templates.map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.name} ({template.tasks.length} tasks)
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <div className="template-actions-inline">
                  <button
                    onClick={() => openEditTemplate(selectedTemplate)}
                    className="btn-edit-small"
                    title="Edit template"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(selectedTemplate._id)}
                    className="btn-delete-small"
                    title="Delete template"
                    disabled={deletingTemplate[selectedTemplate._id]}
                  >
                    {deletingTemplate[selectedTemplate._id] ? "..." : "🗑️"}
                  </button>
                  <button
                    onClick={() => onApplyTemplate(selectedTemplate._id)}
                    className="btn-apply-template"
                    disabled={isApplyingTemplate}
                  >
                    {isApplyingTemplate ? "Applying..." : "🔄 Apply to Week"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {selectedTemplate && (
            <div className="template-preview">
              {groupedTasks.map(
                ({ day, tasks }) =>
                  tasks.length > 0 && (
                    <div key={day} className="template-day">
                      <strong>
                        {day.charAt(0).toUpperCase() + day.slice(1)}:
                      </strong>
                      <div className="template-day-tasks">
                        {tasks.map((task, idx) => (
                          <span
                            key={idx}
                            className="template-task-badge"
                            style={{
                              borderColor: getCategoryColor(task.category),
                            }}
                          >
                            {getCategoryIcon(task.category)} {task.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
              )}
            </div>
          )}
        </>
      )}

      {templates.length === 0 && (
        <div className="no-templates">
          <p>No templates yet. Create your first weekly template!</p>
        </div>
      )}

      {showModal &&
        ReactDOM.createPortal(
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div
              className="modal-content large"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>
                  {editingTemplate ? "Edit Template" : "Create New Template"}
                </h3>
                <p className="modal-description">
                  Define your fixed weekly schedule. You can apply this template
                  to any week!
                </p>

                <div className="form-group">
                  <label>Template Name</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Work Week, Study Schedule, Gym Routine"
                  />
                </div>
              </div>

              <div className="modal-body">
                {/* Day selector tabs */}
                <div className="day-tabs">
                  {days.map((day) => (
                    <button
                      key={day}
                      className={`day-tab ${selectedEditDay === day ? "active" : ""}`}
                      onClick={() => setSelectedEditDay(day)}
                    >
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                      <span className="day-task-count">
                        ({templateTasks.filter(t => t.day === day).length})
                      </span>
                    </button>
                  ))}
                </div>

                <div className="template-tasks-list">
                  <div className="tasks-header">
                    <h4>{selectedEditDay.charAt(0).toUpperCase() + selectedEditDay.slice(1)} Tasks</h4>
                    <button onClick={addTask} className="btn-add-task">
                      + Add Task
                    </button>
                  </div>

                  {templateTasks.filter(t => t.day === selectedEditDay).length === 0 ? (
                    <p className="no-tasks">
                      No tasks for {selectedEditDay}. Add your first task!
                    </p>
                  ) : (
                    templateTasks.map((task, index) => 
                      task.day === selectedEditDay ? (
                      <div
                        key={index}
                        className={`template-task-row ${
                          draggedTaskIndex === index ? "dragging" : ""
                        }`}
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDragEnter={() => handleDragEnter(index)}
                        onDrop={handleDrop}
                      >
                        <span
                          className="drag-handle-template"
                          title="Drag to reorder"
                        >
                          ⋮⋮
                        </span>
                        <input
                          type="text"
                          value={task.name}
                          onChange={(e) =>
                            updateTask(index, "name", e.target.value)
                          }
                          placeholder="Task name"
                          className="task-name-input"
                        />
                        <select
                          value={task.category}
                          onChange={(e) =>
                            updateTask(index, "category", e.target.value)
                          }
                          className="task-category-select"
                        >
                          {categories.map((cat) => (
                            <option key={cat._id} value={cat.name}>
                              {cat.icon} {cat.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={
                            task.plannedTime ? task.plannedTime / 60000 : ""
                          }
                          onChange={(e) =>
                            updateTask(
                              index,
                              "plannedTime",
                              (parseInt(e.target.value) || 0) * 60000
                            )
                          }
                          placeholder="Min"
                          className="task-time-input"
                          min="0"
                        />
                        <label className="automated-checkbox-template">
                          <input
                            type="checkbox"
                            checked={task.isAutomated || false}
                            onChange={(e) =>
                              updateTask(index, "isAutomated", e.target.checked)
                            }
                          />
                          <span>🔄 Auto</span>
                        </label>
                        <label className="automated-checkbox-template calendar-toggle">
                          <input
                            type="checkbox"
                            checked={task.addToCalendar || false}
                            onChange={(e) =>
                              updateTask(index, "addToCalendar", e.target.checked)
                            }
                          />
                          <span>📅 Cal</span>
                        </label>
                        {task.addToCalendar && (
                          <select
                            value={task.reminderMinutes || 0}
                            onChange={(e) =>
                              updateTask(index, "reminderMinutes", parseInt(e.target.value))
                            }
                            className="task-reminder-select"
                            title="Reminder before task"
                          >
                            <option value={0}>No reminder</option>
                            <option value={5}>5 min</option>
                            <option value={10}>10 min</option>
                            <option value={15}>15 min</option>
                            <option value={30}>30 min</option>
                            <option value={60}>1 hour</option>
                          </select>
                        )}
                        <input
                          type="time"
                          value={task.scheduledStartTime || ""}
                          onChange={(e) =>
                            updateTask(index, "scheduledStartTime", e.target.value)
                          }
                          className="task-time-slot-input"
                          title="Start time (optional)"
                        />
                        <span className="time-slot-separator-template">→</span>
                        <input
                          type="time"
                          value={task.scheduledEndTime || ""}
                          onChange={(e) =>
                            updateTask(index, "scheduledEndTime", e.target.value)
                          }
                          className="task-time-slot-input"
                          title="End time (optional)"
                        />
                        <button
                          onClick={() => removeTask(index)}
                          className="btn-remove-task"
                        >
                          ×
                        </button>
                      </div>
                    ) : null
                    )
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  onClick={() => setShowModal(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button onClick={handleSave} className="btn-save" disabled={isCreatingTemplate || (editingTemplate && updatingTemplate[editingTemplate._id])}>
                  {editingTemplate ? (updatingTemplate[editingTemplate._id] ? "Updating..." : "Update Template") : (isCreatingTemplate ? "Creating..." : "Create Template")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default TemplateSetup;
