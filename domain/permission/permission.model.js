// permission/models/Permission.js
import { Schema, model } from 'mongoose';

const PermissionSchema = new Schema({
  permission_id: { type: String, required: true, unique: true },
  action: { type: String, required: true },
  granted_to: {
    id: { type: String, required: true },
    role: { type: String, required: true }
  },
  granted_by: {
    id: { type: String, required: true },
    role: { type: String, required: true }
  },
  scope: { type: Schema.Types.Mixed, default: {} },
  constraints: { type: Schema.Types.Mixed, default: {} },
  issued_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true },
  signature: { type: String, required: true }
});

export default model('Permission', PermissionSchema);
