const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: ".env.development" });

async function createVerifiedUser() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const email = "tester@test.com";
  const password = "password123";
  const hashedPassword = await bcrypt.hash(password, 10);

  let user = await User.findOne({ email });
  if (user) {
    user.password = hashedPassword;
    user.emailVerified = true;
    user.onboardingComplete = true;
    await user.save();
    console.log("Updated existing user to verified status");
  } else {
    user = await User.create({
      name: "Tester",
      email,
      password: hashedPassword,
      authProvider: "local",
      emailVerified: true,
      onboardingComplete: true
    });
    console.log("Created new verified user");
  }

  console.log("Credentials:");
  console.log("Email:", email);
  console.log("Password:", password);

  await mongoose.disconnect();
}

createVerifiedUser().catch(console.error);
