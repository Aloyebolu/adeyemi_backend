import mongoose from "mongoose";
import { scanDependencies } from "./scanDependencies.js";

export async function softDeleteService({
    modelName,
    documentId,
    mode, // "scan" | "commit"
    user,
    reason
}) {
    const scanResult = await scanDependencies({
        modelName,
        documentId
    });
    
    // Phase 1: Scan only
    if (mode === "scan") {
        return {
            phase: "scan",
            ...scanResult
        };
    }
    const Model = mongoose.model(modelName);
    const doc = await Model.findById(documentId)
        .setOptions({ archiveMode: "all" });

    if (!doc) {
        throw new Error("Document not found");
    }

    if (doc.deletedAt) {
        throw new Error("Document is already archived");
    }





    // Phase 2: Commit
    if (!scanResult.canDelete) {
        throw new Error("Delete blocked due to active dependencies");
    }

    if (scanResult.requiresConfirmation && !reason) {
        throw new Error("Delete requires confirmation reason");
    }

    doc.deletedAt = new Date();
    doc.deletedBy = user.id;
    doc.deleteReason = reason || null;

    await doc.save();

    return {
        phase: "commit",
        success: true
    };
}
