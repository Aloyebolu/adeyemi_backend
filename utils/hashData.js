import bcrypt from "bcrypt";
import AppError from "../domain/errors/AppError.js";


export const verifyHashedData = async (unhashed, hashed) => {
  if(!unhashed){
    throw new AppError(null, 500, "Unhashed password missing")
  }else if(!hashed){
    throw new AppError(null, 500, "Hashed password missing")
  }
  try {
    const match = await bcrypt.compare(unhashed, hashed);
    return match;
  } catch (error) {
    throw error;
  }
};

export const hashData = async (data, saltRounds = 10) => {
  try {
    const hashedData = await bcrypt.hash(data, saltRounds);
    return hashedData;
  } catch (error) {
    throw error;
  }
};


