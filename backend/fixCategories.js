const mongoose = require("mongoose");
const Task = require("./models/Task");
const Category = require("./models/Category");
require("dotenv").config();

const fixCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Find all tasks
    const tasks = await Task.find({});
    console.log(`Found ${tasks.length} tasks`);

    let fixed = 0;
    let skipped = 0;

    for (const task of tasks) {
      // Check if category is an ObjectId (24 hex characters)
      if (task.category && task.category.match(/^[0-9a-fA-F]{24}$/)) {
        console.log(`Task ${task._id} has category ID: ${task.category}`);

        // Try to find the category
        const category = await Category.findById(task.category);
        if (category) {
          console.log(`  -> Converting to: ${category.name}`);
          task.category = category.name;
          await task.save();
          fixed++;
        } else {
          console.log(`  -> Category not found, setting to "Uncategorized"`);
          task.category = "Uncategorized";
          await task.save();
          fixed++;
        }
      } else {
        skipped++;
      }
    }

    console.log(`\nFixed: ${fixed} tasks`);
    console.log(`Skipped: ${skipped} tasks (already correct)`);

    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

fixCategories();
