/**
 * Ignore this file except you have a deep understanding of the role system
 */
import connectToDB from "#config/db.js";
import userModel from "#domain/user/user.model.js";
await connectToDB()
export const migrateRole = async (
  role_to_replace,
  replacement_role = null
) => {
    try {
        // CASE 1: full role replacement (base_role swap)
        console.log(2)
        if (replacement_role) {
      const result= await userModel.updateMany(
        {
          role: role_to_replace
        },
        {
          $set: { role: replacement_role },
          $addToSet: {
            extra_roles: role_to_replace
          }
        }
      );
      console.log(result)

      return
    }

    // CASE 2: only move role into extra_roles
    return await userModel.updateMany(
      {
        base_role: role_to_replace
      },
      {
        $addToSet: {
          extra_roles: role_to_replace
        }
      }
    );

  } catch (error) {
    throw error;
  }
};

await migrateRole("vc", "lecturer")
await migrateRole("dean", "lecturer")

