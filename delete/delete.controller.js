import AppError from "../domain/errors/AppError.js";
import { delay } from "../utils/helpers.js";
import { softDeleteService } from "./softDelete.service.js";

export async function scanDelete(req, res, next) {
  try {
    const { model, id } = req.params;

    const result = await softDeleteService({
      modelName: model,
      documentId: id,
      mode: "scan",
      user: req.user
    });

    res.json(result);
  } catch (err) {
    if(err.message.includes("hasn't been registered for model")){
        throw new AppError("Data not available for deletion", 400);
    }
    next(err);
  }
}

export async function confirmDelete(req, res, next) {
  try {
    const { model, id } = req.params;
    const { reason } = req.body;

    const result = await softDeleteService({
      modelName: model,
      documentId: id,
      mode: "commit",
      user: req.user,
      reason
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}
