/**
 * Computation Log Schema
 * This schema defines the structure for logging all operations performed during the computation process.
 * It captures details about the computation, including the model affected, the type of operation, and the data before and after the change.
 * This helps in a situation where the computation fails midway, allowing us to trace back the steps and identify where it went wrong, also reverse any partial changes if necessary.
 * It also serves as an audit trail for all computations performed in the system.
 */

const computationLogSchema = new mongoose.Schema({
  computationId: { type: String, required: true },
  model: { type: String, required: true },       // e.g., "Result"
  documentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  operation: { type: String, enum: ["insert", "update"], required: true },
  before: { type: Object, default: null },      // previous data (null for new insert)
  after: { type: Object, required: true },      // new data
  createdAt: { type: Date, default: Date.now },
});