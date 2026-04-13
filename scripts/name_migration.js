import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../domain/user/user.model.js";
// dotenv.config();

dotenv.config({ path: "../.env" });

// import User from "./models/User.js"; // adjust path to your User model

const TITLES = ["Mr.", "Mrs.", "Miss.", "Dr.", "Prof.", "Rev."]; // extend as needed

async function migrateUserNames() {
  await mongoose.connect(process.env.MONGODB_URI2, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const users = await User.find({}).lean();

  for (const user of users) {
    if (!user.name || typeof user.name !== "string") {
      console.warn(`Skipping user ${user._id} (no name)`);
      continue;
    }

    const nameParts = user.name.trim().split(/\s+/);
    let title = null;

    // Detect title
    if (nameParts.length && TITLES.includes(nameParts[0])) {
      title = nameParts.shift();
    }

    let first_name = nameParts.shift() || null;
    let last_name = nameParts.pop() || null;
    let middle_name = nameParts.length ? nameParts.join(" ") : null;

    // Log for verification
    console.log(`Migrating user ${user._id}:`, {
      title,
      first_name,
      middle_name,
      last_name,
    });

    // Update user
    await User.updateOne(
      { _id: user._id },
      { $set: { title, first_name, middle_name, last_name } }
    );
  }

  console.log("Migration complete!");
  await mongoose.disconnect();
}

migrateUserNames().catch((err) => {
  console.error("Migration failed:", err);
  mongoose.disconnect();
});
