export default {
  name: "migrate-data",
  description: "Migrate data between collections or update schema",
  
  run: async (deps, params) => {
    const { models } = deps;
    const { fromCollection, toCollection, transform } = params;
    
    if (!fromCollection || !toCollection) {
      throw new Error("Source and destination collections are required");
    }
    
    const SourceModel = models[fromCollection];
    const DestModel = models[toCollection];
    
    if (!SourceModel || !DestModel) {
      throw new Error("Invalid collection names");
    }
    
    // Get all documents from source
    const documents = await SourceModel.find({});
    
    const migrated = [];
    const failed = [];
    
    for (const doc of documents) {
      try {
        // Apply transformation if provided
        let transformedData = doc.toObject();
        if (transform && typeof transform === 'object') {
          // Apply field mappings
          transformedData = Object.keys(transform).reduce((acc, key) => {
            acc[transform[key]] = doc[key];
            return acc;
          }, {});
        }
        
        // Remove _id to let MongoDB generate new one
        delete transformedData._id;
        
        // Create new document in destination
        const newDoc = new DestModel(transformedData);
        await newDoc.save();
        
        migrated.push({
          sourceId: doc._id,
          destinationId: newDoc._id
        });
      } catch (error) {
        failed.push({
          sourceId: doc._id,
          error: error.message
        });
      }
    }
    
    return {
      summary: {
        totalProcessed: documents.length,
        migrated: migrated.length,
        failed: failed.length
      },
      details: {
        migrated,
        failed
      }
    };
  }
};