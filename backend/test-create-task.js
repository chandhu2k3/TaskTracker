const mongoose = require("mongoose");
const Task = require("./models/Task");
const Category = require("./models/Category");
const User = require("./models/User");
const tz = require("./utils/timezone");
require("dotenv").config({ path: ".env.development" });

async function testCreateTask() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const user = await User.findOne({ email: "bitsmtech26@gmail.com" });
  if (!user) {
      console.error("User not found");
      process.exit(1);
  }

  const category = await Category.findOne({ user: user._id });
  if (!category) {
      console.error("Category not found");
      process.exit(1);
  }

  const taskData = {
    user: user._id,
    name: "Debug Task " + Date.now(),
    category: category._id, // Sending ID like the frontend does
    date: "2026-05-16",
    plannedTime: 30 * 60 * 1000,
    isAutomated: false
  };

  // Mock req/res for the controller
  const req = {
      user,
      body: taskData,
      headers: { "x-timezone": "Asia/Kolkata" }
  };
  
  const res = {
      status: (code) => ({
          json: (data) => console.log(`Response ${code}:`, data)
      }),
      json: (data) => console.log("Response 200:", data)
  };

  const taskController = require("./controllers/taskController");
  
  try {
      await taskController.createTask(req, res);
  } catch (error) {
      console.error("Caught error in test script:", error);
  }

  await mongoose.disconnect();
}

testCreateTask().catch(console.error);
