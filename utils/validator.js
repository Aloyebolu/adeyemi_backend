import mongoose from "mongoose";
import AppError from "../domain/errors/AppError.js";

export const validateObjectId = (objectId, strict = true) => {
    const ids = Array.isArray(objectId) ? objectId : [objectId];
    
    if (!ids.length || !ids.every(id => id && mongoose.Types.ObjectId.isValid(id))) {
        if(strict) console.log(JSON.stringify(objectId))
        if(strict) throw new AppError("Invalid ID provided", 400, {}, { objectId });
        return false;
    }
    return true;
}