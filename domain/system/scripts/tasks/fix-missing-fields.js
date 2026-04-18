export default {
  name: "fix-missing-fields",
  description: "Add missing fields to existing documents in a collection",
  
  run: async (deps, params) => {
    const { models } = deps;
    const { collection, fields, defaultValue = null } = params;
    
    if (!collection || !fields || !Array.isArray(fields)) {
      throw new Error("Collection name and fields array are required");
    }
    
    const Model = models[collection];
    if (!Model) {
      throw new Error(`Model ${collection} not found`);
    }
    
    const results = {
      updated: 0,
      failed: 0,
      details: []
    };
    
    // Process each field
    for (const field of fields) {
      try {
        // Find documents missing this field
        const query = {};
        query[field] = { $exists: false };
        
        const documents = await Model.find(query);
        
        if (documents.length > 0) {
          // Update each document
          for (const doc of documents) {
            doc[field] = defaultValue;
            await doc.save();
          }
          
          results.updated += documents.length;
          results.details.push({
            field,
            updatedCount: documents.length,
            defaultValue
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          field,
          error: error.message
        });
      }
    }
    
    return results;
  }
};