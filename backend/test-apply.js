const mongoose = require("mongoose");
const TaskTemplate = require("./models/TaskTemplate");
const Task = require("./models/Task");
require("dotenv").config({ path: ".env.development" });

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");
  
  // Find a user and their template
  const template = await TaskTemplate.findOne({ name: "Starter Week" });
  if (!template) return console.log("Template not found");
  
  console.log("Found template:", template.name, "for user:", template.user);
  
  const year = "2026";
  const month = "4"; // May
  const weekNumber = "2"; // 8th to 14th
  
  const startDay = 1 + (parseInt(weekNumber) - 1) * 7;
  const startDate = new Date(parseInt(year), parseInt(month), startDay);
  const startDayOfWeek = startDate.getDay();
  
  console.log("Start Date:", startDate, "Start Day of Week:", startDayOfWeek);
  
  const dayToWeekday = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  
  for (const templateTask of template.tasks) {
    const targetWeekday = dayToWeekday[templateTask.day];
    let dayOffset = targetWeekday - startDayOfWeek;
    if (dayOffset < 0) dayOffset += 7;
    
    const dayOfMonth = startDay + dayOffset;
    const taskDate = new Date(parseInt(year), parseInt(month), dayOfMonth, 12, 0, 0, 0);
    
    if (taskDate.getMonth() !== parseInt(month)) {
      console.log("Skipping", templateTask.name, "- out of month");
      continue;
    }
    
    const yearStr = taskDate.getFullYear();
    const monthStr = String(taskDate.getMonth() + 1).padStart(2, "0");
    const dayStr = String(taskDate.getDate()).padStart(2, "0");
    const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
    
    console.log(`Task: ${templateTask.name} (${templateTask.day}) -> Maps to ${dateStr}`);
  }
  
  mongoose.disconnect();
}

test().catch(console.error);
