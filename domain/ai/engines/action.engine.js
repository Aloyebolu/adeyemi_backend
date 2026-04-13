// src/modules/ai/engines/action.engine.js

class ActionEngine {
  constructor() {
    this.actionRegistry = new Map();
    this.registerDefaultActions();
  }
  
  /**
   * Register an action
   */
  registerAction(actionName, config) {
    this.actionRegistry.set(actionName, config);
  }
  
  /**
   * Generate action from intent
   */
  async generateAction(intent, entities, context = {}) {
    const actionType = intent.action || this.determineActionType(intent);
    const actionConfig = this.actionRegistry.get(actionType);
    
    if (!actionConfig) {
      return this.getDefaultAction(intent, entities);
    }
    
    // Build payload from entities
    const payload = this.buildPayload(actionConfig, entities, context);
    
    // Determine if confirmation is needed
    const needsConfirmation = this.needsConfirmation(actionType, intent, context);
    
    // Build action object
    const action = {
      endpoint: actionConfig.endpoint,
      method: actionConfig.method || 'POST',
      payload,
      label: this.buildLabel(actionConfig, entities),
      description: this.buildDescription(actionConfig, entities),
      confirmation: {
        required: needsConfirmation,
        message: this.buildConfirmationMessage(actionConfig, entities, payload),
      },
      undoable: actionConfig.undoable || false,
      preview: this.buildPayloadPreview(payload),
    };
    
    return action;
  }
  
  /**
   * Register default actions for the system
   */
  registerDefaultActions() {
    // Student actions
    this.registerAction('terminate_student', {
      endpoint: '/api/students/terminate',
      method: 'POST',
      requiredFields: ['student_id', 'reason'],
      labelTemplate: 'Terminate {{name}}',
      descriptionTemplate: 'Terminate student {{name}} ({{matric}})',
      confirmationTemplate: `This will permanently remove {{name}} from the system. 
Their records will be archived and access will be revoked.
Matric Number: {{matric}}
Department: {{department}}
Reason: {{reason}}

This action cannot be undone.`,
      undoable: false,
    });
    
    this.registerAction('update_student', {
      endpoint: '/api/students/update',
      method: 'PUT',
      requiredFields: ['student_id'],
      labelTemplate: 'Update {{name}}',
      descriptionTemplate: 'Update student {{name}}\'s information',
      confirmationTemplate: `Update student {{name}} ({{matric}})
Fields to update: {{fields}}

Please review before confirming.`,
      undoable: true,
    });
    
    this.registerAction('suspend_student', {
      endpoint: '/api/students/suspend',
      method: 'POST',
      requiredFields: ['student_id', 'reason', 'duration'],
      labelTemplate: 'Suspend {{name}}',
      descriptionTemplate: 'Suspend {{name}} for {{duration}}',
      confirmationTemplate: `Suspend {{name}} ({{matric}})
Duration: {{duration}}
Reason: {{reason}}

The student will lose portal access during suspension.`,
      undoable: true,
    });
    
    // Lecturer actions
    this.registerAction('promote_lecturer', {
      endpoint: '/api/lecturers/promote',
      method: 'POST',
      requiredFields: ['lecturer_id', 'new_role'],
      labelTemplate: 'Promote {{name}}',
      descriptionTemplate: 'Promote {{name}} to {{new_role}}',
      confirmationTemplate: `Promote {{name}} ({{staffId}}) to {{new_role}}.
Current role: {{current_role}}

This will grant additional permissions.`,
      undoable: false,
    });
    
    // User actions
    this.registerAction('reset_password', {
      endpoint: '/api/users/reset-password',
      method: 'POST',
      requiredFields: ['user_id'],
      labelTemplate: 'Reset Password for {{name}}',
      descriptionTemplate: 'Send password reset email to {{name}}',
      confirmationTemplate: `Send password reset email to {{name}} ({{email}}).
The user will receive instructions to create a new password.`,
      undoable: true,
    });
    
    // Bulk actions
    this.registerAction('bulk_export', {
      endpoint: '/api/exports/create',
      method: 'POST',
      requiredFields: ['query', 'format'],
      labelTemplate: 'Export Data',
      descriptionTemplate: 'Export {{count}} records as {{format}}',
      confirmationTemplate: `Export {{count}} records as {{format}}.
This may take a few minutes for large datasets.
You will receive a download link when ready.`,
      undoable: false,
    });
  }
  
  /**
   * Determine action type from intent
   */
  determineActionType(intent) {
    const intentText = intent.type?.toLowerCase() || '';
    
    if (intentText.includes('terminate')) return 'terminate_student';
    if (intentText.includes('delete')) return 'terminate_student';
    if (intentText.includes('update')) return 'update_student';
    if (intentText.includes('suspend')) return 'suspend_student';
    if (intentText.includes('promote')) return 'promote_lecturer';
    if (intentText.includes('reset') || intentText.includes('password')) return 'reset_password';
    if (intentText.includes('export')) return 'bulk_export';
    
    return 'default';
  }
  
  /**
   * Build payload from entities
   */
  buildPayload(actionConfig, entities, context) {
    const payload = {};
    
    // Add required fields from entities
    for (const field of actionConfig.requiredFields || []) {
      if (entities[field]) {
        payload[field] = entities[field];
      }
    }
    
    // Add user context
    payload.executed_by = context.userId;
    payload.timestamp = new Date().toISOString();
    
    // Add reason if available
    if (entities.reason) {
      payload.reason = entities.reason;
    }
    
    return payload;
  }
  
  /**
   * Build action label
   */
  buildLabel(actionConfig, entities) {
    let label = actionConfig.labelTemplate || 'Execute Action';
    
    // Replace placeholders
    for (const [key, value] of Object.entries(entities)) {
      label = label.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    return label;
  }
  
  /**
   * Build action description
   */
  buildDescription(actionConfig, entities) {
    let description = actionConfig.descriptionTemplate || actionConfig.labelTemplate || 'Execute action';
    
    for (const [key, value] of Object.entries(entities)) {
      description = description.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    return description;
  }
  
  /**
   * Build confirmation message
   */
  buildConfirmationMessage(actionConfig, entities, payload) {
    let message = actionConfig.confirmationTemplate || 'Please confirm this action.';
    
    // Replace entities
    for (const [key, value] of Object.entries(entities)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    // Add payload fields
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value !== 'object') {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }
    
    // Handle special templates
    if (message.includes('{{fields}}')) {
      const fields = Object.keys(payload).filter(k => k !== 'executed_by' && k !== 'timestamp');
      message = message.replace('{{fields}}', fields.join(', '));
    }
    
    return message;
  }
  
  /**
   * Build payload preview for user
   */
  buildPayloadPreview(payload) {
    const preview = {};
    
    // Only show non-sensitive fields
    const sensitiveFields = ['password', 'token', 'secret'];
    
    for (const [key, value] of Object.entries(payload)) {
      if (sensitiveFields.includes(key)) {
        preview[key] = '********';
      } else if (typeof value === 'object') {
        preview[key] = '[Object]';
      } else {
        preview[key] = value;
      }
    }
    
    return preview;
  }
  
  /**
   * Determine if action needs confirmation
   */
  needsConfirmation(actionType, intent, context) {
    // Always confirm destructive actions
    const destructiveActions = ['terminate_student', 'delete_user', 'suspend_student'];
    if (destructiveActions.includes(actionType)) {
      return true;
    }
    
    // Check user preferences
    if (context.userPreferences?.require_confirmation_for?.includes(actionType)) {
      return true;
    }
    
    // Check if intent has high confidence
    if (intent.confidence && intent.confidence < 0.8) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Get default action for unknown intents
   */
  getDefaultAction(intent, entities) {
    return {
      endpoint: '/api/actions/execute',
      method: 'POST',
      payload: {
        action: intent.type,
        ...entities,
      },
      label: `Execute ${intent.type || 'Action'}`,
      description: `Perform ${intent.type || 'action'} on selected item`,
      confirmation: {
        required: true,
        message: `Please confirm that you want to perform this action.`,
      },
      undoable: false,
      preview: entities,
    };
  }
  
  /**
   * Validate action payload
   */
  validateAction(action, requiredFields = []) {
    const missing = [];
    
    for (const field of requiredFields) {
      if (!action.payload[field]) {
        missing.push(field);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
    };
  }
  
  /**
   * Get all registered actions
   */
  getRegisteredActions() {
    const actions = [];
    for (const [name, config] of this.actionRegistry.entries()) {
      actions.push({
        name,
        endpoint: config.endpoint,
        method: config.method,
        requiredFields: config.requiredFields,
        undoable: config.undoable,
      });
    }
    return actions;
  }
}

export default new ActionEngine();