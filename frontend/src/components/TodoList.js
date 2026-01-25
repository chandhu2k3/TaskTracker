import React, { useState } from "react";
import "./TodoList.css";

const TodoList = ({ todos, onAddTodo, onToggleTodo, onDeleteTodo }) => {
  const [newTodo, setNewTodo] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newTodo.trim()) {
      onAddTodo(newTodo.trim());
      setNewTodo("");
    }
  };

  return (
    <div className="todo-list-container">
      <div className="todo-header">
        <h3>✓ Quick Todos</h3>
        <p className="todo-subtitle">Simple checklist for daily tasks</p>
      </div>

      <form onSubmit={handleSubmit} className="todo-input-form">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add a quick todo..."
          className="todo-input"
        />
        <button type="submit" className="todo-add-btn">
          + Add
        </button>
      </form>

      <div className="todo-items">
        {todos.length === 0 ? (
          <div className="todo-empty">
            <span>📝</span>
            <p>No todos yet. Add one above!</p>
          </div>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className={`todo-item ${todo.completed ? "completed" : ""}`}
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => onToggleTodo(todo.id)}
                className="todo-checkbox"
              />
              <span className="todo-text">{todo.text}</span>
              <button
                onClick={() => onDeleteTodo(todo.id)}
                className="todo-delete-btn"
                title="Delete todo"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {todos.length > 0 && (
        <div className="todo-stats">
          {todos.filter((t) => t.completed).length} of {todos.length} completed
        </div>
      )}
    </div>
  );
};

export default TodoList;
