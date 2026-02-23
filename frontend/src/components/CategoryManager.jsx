import React, { useState } from "react";
import ReactDOM from "react-dom";
import "./CategoryManager.css";

const CategoryManager = ({ categories, onAdd, onUpdate, onDelete, isAdding = false, updatingCategory = {}, deletingCategory = {} }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#6366f1",
    icon: "📋",
  });

  const popularIcons = [
    "💪",
    "📚",
    "💻",
    "🏃",
    "🎨",
    "📖",
    "🎯",
    "🧘",
    "🍎",
    "🎵",
    "📝",
    "🏋️",
    "🎮",
    "🏓",
    "⚽",
    "🏀",
    "🎾",
    "🏐",
    "🎸",
    "🎬",
    "📷",
    "🍳",
    "🧑‍💻",
    "📊",
    "🚴",
    "🏊",
  ];
  const popularColors = [
    "#6366f1",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
    "#14b8a6",
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCategory) {
      onUpdate(editingCategory._id, formData);
    } else {
      onAdd(formData);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: "", color: "#6366f1", icon: "📋" });
    setEditingCategory(null);
    setShowModal(false);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      color: category.color,
      icon: category.icon,
    });
    setShowModal(true);
  };

  // Modal rendered using Portal to escape parent container
  const modalContent = showModal ? ReactDOM.createPortal(
    <div className="category-modal-overlay" onClick={resetForm}>
      <div className="category-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{editingCategory ? "Edit Category" : "New Category"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Category Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Gym, DSA, Study"
              required
            />
          </div>

          <div className="form-group">
            <label>Icon</label>
            <div className="icon-picker">
              {popularIcons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`icon-option ${
                    formData.icon === icon ? "selected" : ""
                  }`}
                  onClick={() => setFormData({ ...formData, icon })}
                >
                  {icon}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) =>
                setFormData({ ...formData, icon: e.target.value })
              }
              placeholder="Or type your own emoji"
              maxLength="2"
            />
          </div>

          <div className="form-group">
            <label>Color</label>
            <div className="color-picker">
              {popularColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-option ${
                    formData.color === color ? "selected" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
            <div className="custom-color-picker">
              <span className="picker-label">🎨 Custom:</span>
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
              />
              <span className="color-preview" style={{ backgroundColor: formData.color }}></span>
            </div>
          </div>

          <div className="category-modal-actions">
            <button
              type="button"
              onClick={resetForm}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={isAdding || (editingCategory && updatingCategory[editingCategory._id])}>
              {editingCategory ? (updatingCategory[editingCategory._id] ? "Updating..." : "Update") : (isAdding ? "Creating..." : "Create")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="category-manager">
      <div className="category-header">
        <h3>📂 Categories</h3>
        <button onClick={() => setShowModal(true)} className="btn-add-category">
          + Add Category
        </button>
      </div>

      <div className="categories-list">
        {categories.length === 0 ? (
          <p className="no-categories">
            No categories yet. Create your first one!
          </p>
        ) : (
          categories.map((category) => (
            <div
              key={category._id}
              className="category-chip"
              style={{ borderColor: category.color }}
            >
              <span className="category-icon">{category.icon}</span>
              <span className="category-name">{category.name}</span>
              <div className="category-actions">
                <button
                  onClick={() => handleEdit(category)}
                  className="btn-edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Are you sure you want to delete the category "${category.name}"? This may affect tasks using this category.`
                      )
                    ) {
                      onDelete(category._id);
                    }
                  }}
                  className="btn-delete-cat"
                  disabled={deletingCategory[category._id]}
                >
                  {deletingCategory[category._id] ? "..." : "×"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalContent}
    </div>
  );
};

export default CategoryManager;
