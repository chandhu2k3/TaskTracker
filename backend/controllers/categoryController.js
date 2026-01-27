const Category = require("../models/Category");

// @desc    Get all categories for user
// @route   GET /api/categories
// @access  Private
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ user: req.user._id }).sort({
      createdAt: 1,
    }).lean();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new category
// @route   POST /api/categories
// @access  Private
const createCategory = async (req, res) => {
  try {
    const { name, color, icon } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Please provide category name" });
    }

    const category = await Category.create({
      user: req.user._id,
      name: name.trim(),
      color: color || "#6366f1",
      icon: icon || "📋",
    });

    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Category already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private
const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (category.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (req.body.name) category.name = req.body.name.trim();
    if (req.body.color) category.color = req.body.color;
    if (req.body.icon) category.icon = req.body.icon;

    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (category.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    await category.deleteOne();
    res.json({ message: "Category removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
