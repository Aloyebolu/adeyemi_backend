import { Types } from "mongoose";
/**
 * SYSTEM USER
 *
 * Purpose:
 *  - Represents the application itself as an actor
 *  - Used when actions are performed without a human user
 *
 * Important:
 *  - This user is NOT created via API
 *  - This user is NOT represented in the User schema
 *  - ID is hardcoded and MUST NOT change
 *
 * Rules:
 *  - Must exist in the database before app startup
 *  - Must never be deleted or modified
 *  - Referenced by ID, never queried dynamically
 *
 * ID:
 *  - 000000000000000000000001
 */
export const SYSTEM_USER_ID = new Types.ObjectId(
  "000000000000000000000001"
);

export const SYSTEM_USER_EMAIL = "system@internal";
export const SYSTEM_USER_FULL_NAME = "System User";
export const FRONTEND_URL = 'http://localhost:3000'