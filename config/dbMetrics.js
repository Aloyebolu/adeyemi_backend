import mongoose from 'mongoose';
import client from "prom-client";

// 1. Better Buckets: Database queries are usually fast (1-50ms) or very slow (500ms+)
export const mongoQueryDuration = new client.Histogram({
  name: "mongo_query_duration_ms",
  help: "Duration of MongoDB operations in ms",
  labelNames: ["operation", "collection", "status"], // Added status (success/error)
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
});

// 2. Counter for total ops (useful for finding "hot" collections)
export const mongoQueryTotal = new client.Counter({
  name: "mongo_query_total",
  help: "Total number of MongoDB operations",
  labelNames: ["operation", "collection", "status"]
});

const monitorPlugin = (schema) => {
  // Broad list of query methods including Aggregations and Deletions
  const queryMethods = [
    'find', 'findOne', 'count', 'countDocuments', 
    'findOneAndUpdate', 'findByIdAndUpdate', 
    'deleteOne', 'deleteMany', 'aggregate'
  ];

  // --- QUERY HOOKS ---
  schema.pre(queryMethods, function() {
    this._startTime = Date.now();
  });

  schema.post(queryMethods, function(res, next) {
    const duration = Date.now() - this._startTime;
    const modelName = this.model?.modelName || "Aggregate";
    const operation = this.op || "aggregate";
    
    mongoQueryDuration.labels(operation, modelName, 'success').observe(duration);
    mongoQueryTotal.labels(operation, modelName, 'success').inc();
    next();
  });

  // --- DOCUMENT HOOKS (Save/Create/Update) ---
  schema.pre('save', function() {
    this._startTime = Date.now();
  });

  schema.post('save', function(doc, next) {
    const duration = Date.now() - this._startTime;
    const modelName = this.constructor.modelName;
    
    mongoQueryDuration.labels('save', modelName, 'success').observe(duration);
    mongoQueryTotal.labels('save', modelName, 'success').inc();
    next();
  });

  // --- ERROR HANDLING ---
  // This captures if the query fails (e.g. timeout, unique constraint)
  const handleError = function(error, doc, next) {
    const duration = this._startTime ? Date.now() - this._startTime : 0;
    const modelName = (this.model?.modelName || this.constructor?.modelName || "Unknown");
    const operation = this.op || "save";

    mongoQueryTotal.labels(operation, modelName, 'error').inc();
    if (duration > 0) {
      mongoQueryDuration.labels(operation, modelName, 'error').observe(duration);
    }
    next(error);
  };

  schema.post(queryMethods, handleError);
  schema.post('save', handleError);
};

// Apply globally
mongoose.plugin(monitorPlugin);

export default monitorPlugin;
