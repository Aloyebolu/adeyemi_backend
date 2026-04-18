import mongoose from "mongoose";
import { deleteRegistry } from "./delete.registry.js";
import AppError from "../shared/errors/AppError.js";

export async function scanDependencies({ modelName, documentId }) {
  const config = deleteRegistry[modelName];
  if (!config) {
    throw new AppError(`${modelName} domain not available for deletion`, 400);
  }

  const results = [];

  for (const dep of config.dependencies) {
    const DepModel = mongoose.model(dep.model);

    const count = await DepModel.countDocuments({
      [dep.foreignKey]: documentId,
      deletedAt: null
    });

    if (count > 0) {
      results.push({
        model: dep.model,
        count,
        severity: dep.severity
      });
    }
  }

  const hasBlockers = results.some(r => r.severity === "block" || !r.severity);
  const hasWarnings = results.some(r => r.severity === "warn");

  return {
    canDelete: !hasBlockers,
    requiresConfirmation: hasWarnings,
    affectedRelations: results
  };
}
