import jwt from "jsonwebtoken";
import AppError from "../domain/errors/AppError.js";
// bootstrap.js
import dotenv from "dotenv";
dotenv.config();
const { TOKEN_KEY, TOKEN_EXPIRY } = process.env;

const createToken = async (
  tokenData,
  tokenKey = TOKEN_KEY,
  expiresIn = TOKEN_EXPIRY
) => {
  try {
    const token = await jwt.sign(tokenData, tokenKey, { expiresIn });
    return token;
  } catch (error) {
    throw error;
  }
};
export function generate_honeytoken(user_id) {
  const honeyToken = process.env.HONEYTOKEN_SECRET
  if(!honeyToken) { 
    throw new AppError("Missing HONEYTOKEN_SECRET in environment variables", 500);
  }
  if(!user_id){
    throw new AppError("User not found", 500)
  }
  return jwt.sign(
    {
      type: "honeytoken",
      uid: user_id,
      trap: true
    },
    honeyToken,
    { expiresIn: "7d" }
  );
}
export default createToken;
