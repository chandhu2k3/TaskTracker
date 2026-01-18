import React, { useState } from "react";
import "./CategoryManager.css";

const CategoryManager = ({ categories, onAdd, onUpdate, onDelete }) => {
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
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  {editingCategory ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManager;
