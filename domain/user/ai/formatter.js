/**
 * AI Response Formatter
 * Formats execution results into structured Markdown
 * Returns both markdown and optional actions
 */
class ResponseFormatter {
  /**
   * Format execution result for AI response
   * @param {Object} result - Execution result from tool
   * @param {string} toolName - Name of the executed tool
   * @param {Object} context - Additional context
   * @returns {Object} - { markdown: string, action?: { tool: string, payload: object } }
   */
  format(result, toolName, context = {}) {
    if (!result.success) {
      return this.formatError(result);
    }
    
    const formatter = this.formatters[toolName];
    if (formatter) {
      return formatter(result.data, context);
    }
    
    // Default formatter
    return this.formatGeneric(result.data);
  }
  
  /**
   * Formatters for specific tools
   */
  formatters = {
    get_user_profile: this.formatUserProfile.bind(this),
    get_user_by_id: this.formatUserProfile.bind(this),
    update_user_profile: this.formatUpdateResult.bind(this),
    upload_user_avatar: this.formatUploadResult.bind(this),
    list_users: this.formatUserList.bind(this),
    delete_user: this.formatDeleteResult.bind(this),
    get_profile_update_options: this.formatUpdateOptions.bind(this),
  };
  
  /**
   * Format user profile (single user)
   */
  formatUserProfile(user, context) {
    if (!user) {
      return this.formatError({ error: 'User not found' });
    }
    
    let markdown = `# User Profile\n\n`;
    
    // Basic info
    markdown += `## Basic Information\n`;
    markdown += `| Field | Value |\n`;
    markdown += `|-------|-------|\n`;
    markdown += `| **Name** | ${user.name || `${user.first_name} ${user.last_name}`} |\n`;
    markdown += `| **Email** | ${user.email} |\n`;
    markdown += `| **Role** | ${this.capitalize(user.role)} |\n`;
    markdown += `| **Title** | ${user.title ? this.capitalize(user.title) : 'Not set'} |\n`;
    markdown += `| **Phone** | ${user.phone || 'Not set'} |\n`;
    
    if (user.bio) {
      markdown += `| **Bio** | ${user.bio} |\n`;
    }
    
    if (user.chat_availability !== undefined) {
      markdown += `| **Chat Availability** | ${user.chat_availability ? 'Available' : 'Unavailable'} |\n`;
    }
    
    markdown += `| **Last Seen** | ${this.formatDate(user.last_seen)} |\n`;
    markdown += `| **Member Since** | ${this.formatDate(user.createdAt)} |\n\n`;
    
    // Avatar
    if (user.avatar) {
      markdown += `## Avatar\n`;
      markdown += `![Avatar](${user.avatar})\n\n`;
    }
    
    // Role-specific information
    if (user.role === 'student' && (user.matric_no || user.level || user.programme)) {
      markdown += `## Student Information\n`;
      markdown += `| Field | Value |\n`;
      markdown += `|-------|-------|\n`;
      if (user.matric_no) markdown += `| **Matric Number** | ${user.matric_no} |\n`;
      if (user.level) markdown += `| **Level** | ${user.level} |\n`;
      if (user.programme) markdown += `| **Programme** | ${user.programme} |\n`;
      if (user.department) markdown += `| **Department** | ${user.department} |\n`;
      if (user.faculty) markdown += `| **Faculty** | ${user.faculty} |\n`;
      if (user.session) markdown += `| **Session** | ${user.session} |\n`;
      markdown += `\n`;
    }
    
    if (['lecturer', 'hod', 'dean', 'admin'].includes(user.role) && (user.staff_id || user.department)) {
      markdown += `## Staff Information\n`;
      markdown += `| Field | Value |\n`;
      markdown += `|-------|-------|\n`;
      if (user.staff_id) markdown += `| **Staff ID** | ${user.staff_id} |\n`;
      if (user.department) markdown += `| **Department** | ${user.department} |\n`;
      markdown += `\n`;
    }
    
    // Password status (if available)
    if (user.passwordStatus) {
      markdown += `## Security Information\n`;
      markdown += `| Field | Value |\n`;
      markdown += `|-------|-------|\n`;
      markdown += `| **Password Last Changed** | ${this.formatDate(user.lastPasswordChange)} |\n`;
      markdown += `| **Password Age** | ${user.passwordAgeDays} days |\n`;
      markdown += `| **Password Expires** | ${user.passwordExpiryDays} days |\n`;
      markdown += `| **Password Strength** | ${user.passwordStrength || 'N/A'} |\n\n`;
    }
    
    // Actions
    const actions = [];
    if (context.user && context.user._id === user._id) {
      actions.push({
        label: 'Edit Profile',
        tool: 'update_user_profile',
        payload: { updates: {} },
      });
      
      actions.push({
        label: 'Upload Avatar',
        tool: 'upload_user_avatar',
        payload: { avatar_url: '' },
      });
    }
    
    if (context.user && context.user.role === 'admin' && user._id !== context.user._id) {
      actions.push({
        label: 'Delete User',
        tool: 'delete_user',
        payload: { user_id: user._id },
      });
    }
    
    if (actions.length > 0) {
      markdown += `## Available Actions\n`;
      actions.forEach(action => {
        markdown += `- **${action.label}**\n`;
      });
    }
    
    return { markdown };
  }
  
  /**
   * Format user list
   */
  formatUserList(data, context) {
    const { users, pagination, filters_applied, search_term } = data;
    
    let markdown = `# Users\n\n`;
    
    // Summary
    markdown += `**Total:** ${pagination.total} users\n`;
    markdown += `**Showing:** ${users.length} users (Page ${pagination.page} of ${pagination.pages})\n\n`;
    
    // Filters
    if (Object.keys(filters_applied).length > 0 || search_term) {
      markdown += `## Applied Filters\n`;
      if (search_term) markdown += `- **Search:** "${search_term}"\n`;
      Object.entries(filters_applied).forEach(([key, value]) => {
        markdown += `- **${key}:** ${value}\n`;
      });
      markdown += `\n`;
    }
    
    if (users.length === 0) {
      markdown += `No users found matching the criteria.\n`;
      return { markdown };
    }
    
    // Users table
    markdown += `## User List\n\n`;
    markdown += `| Name | Role | Email | Department | Status |\n`;
    markdown += `|------|------|-------|------------|--------|\n`;
    
    users.forEach(user => {
      const name = user.name || `${user.first_name} ${user.last_name}`;
      const role = this.capitalize(user.role);
      const email = user.email || 'N/A';
      const department = user.department || 'N/A';
      const status = user.is_deleted ? 'Deleted' : 'Active';
      
      markdown += `| ${this.escapeMarkdown(name)} | ${role} | ${email} | ${department} | ${status} |\n`;
    });
    
    markdown += `\n`;
    
    // Pagination info
    if (pagination.has_prev || pagination.has_next) {
      markdown += `## Navigation\n`;
      if (pagination.has_prev) {
        markdown += `- **Previous Page** (Page ${pagination.page - 1})\n`;
      }
      if (pagination.has_next) {
        markdown += `- **Next Page** (Page ${pagination.page + 1})\n`;
      }
      markdown += `\n`;
    }
    
    // Action to view specific user
    if (users.length === 1) {
      return {
        markdown,
        action: {
          tool: 'get_user_by_id',
          payload: { user_id: users[0]._id },
          label: 'View Full Profile',
        },
      };
    }
    
    return { markdown };
  }
  
  /**
   * Format update result
   */
  formatUpdateResult(data, context) {
    let markdown = `# Profile Updated Successfully\n\n`;
    
    if (data.user) {
      markdown += `✅ **${data.user.name || 'User'}** profile has been updated.\n\n`;
    } else {
      markdown += `✅ Profile has been updated successfully.\n\n`;
    }
    
    if (data.updatedFields && data.updatedFields.length > 0) {
      markdown += `## Fields Updated\n`;
      data.updatedFields.forEach(field => {
        markdown += `- ${this.formatFieldName(field)}\n`;
      });
      markdown += `\n`;
    }
    
    if (data.rejectedFields && data.rejectedFields.length > 0) {
      markdown += `## ⚠️ Fields Not Updated\n`;
      markdown += `The following fields could not be updated:\n\n`;
      data.rejectedFields.forEach(field => {
        markdown += `- ${this.formatFieldName(field)}\n`;
      });
      markdown += `\n`;
    }
    
    if (data.pendingApproval && data.pendingApproval.length > 0) {
      markdown += `## ⏳ Pending Approval\n`;
      markdown += `The following changes require administrator approval:\n\n`;
      data.pendingApproval.forEach(field => {
        markdown += `- ${this.formatFieldName(field)}\n`;
      });
      markdown += `\n`;
      markdown += `*You will be notified once approved.*\n\n`;
    }
    
    if (data.user) {
      markdown += `## Updated Profile\n`;
      markdown += `| Field | Value |\n`;
      markdown += `|-------|-------|\n`;
      markdown += `| **Name** | ${data.user.name || `${data.user.first_name} ${data.user.last_name}`} |\n`;
      markdown += `| **Email** | ${data.user.email} |\n`;
      markdown += `| **Role** | ${this.capitalize(data.user.role)} |\n`;
      markdown += `| **Phone** | ${data.user.phone || 'Not set'} |\n`;
      markdown += `\n`;
    }
    
    // Action to view full profile
    if (data.user) {
      return {
        markdown,
        action: {
          tool: 'get_user_profile',
          payload: {},
          label: 'View Full Profile',
        },
      };
    }
    
    return { markdown };
  }
  
  /**
   * Format upload result
   */
  formatUploadResult(data, context) {
    let markdown = `# Avatar Uploaded Successfully\n\n`;
    markdown += `✅ ${data.message || 'Avatar has been updated.'}\n\n`;
    
    if (data.avatar_url) {
      markdown += `## Preview\n`;
      markdown += `![Avatar](${data.avatar_url})\n\n`;
    }
    
    return { markdown };
  }
  
  /**
   * Format delete result
   */
  formatDeleteResult(data, context) {
    let markdown = `# User Deleted\n\n`;
    markdown += `✅ ${data.message}\n\n`;
    markdown += `**User ID:** ${data.user_id}\n`;
    markdown += `**Deleted At:** ${this.formatDate(data.deleted_at)}\n\n`;
    
    markdown += `*Note: This user has been soft-deleted and can be restored by an administrator.*\n`;
    
    return { markdown };
  }
  
  /**
   * Format update options
   */
  formatUpdateOptions(data, context) {
    let markdown = `# Profile Update Options\n\n`;
    markdown += `**Role:** ${this.capitalize(data.role)}\n\n`;
    
    if (!data.updatableFields || data.updatableFields.length === 0) {
      markdown += `No updatable fields available for this role.\n`;
      return { markdown };
    }
    
    markdown += `## Fields You Can Update\n\n`;
    markdown += `| Field | Current Value | Type | Validation |\n`;
    markdown += `|-------|---------------|------|------------|\n`;
    
    data.updatableFields.forEach(field => {
      const currentValue = field.currentValue || 'Not set';
      const type = field.type || 'string';
      let validation = '';
      
      if (field.validation) {
        if (field.validation.minLength) validation += `min: ${field.validation.minLength} chars, `;
        if (field.validation.maxLength) validation += `max: ${field.validation.maxLength} chars, `;
        if (field.validation.pattern) validation += `pattern: ${field.validation.pattern}, `;
        if (field.enum) validation += `options: ${field.enum.join(', ')}`;
      }
      
      validation = validation.replace(/, $/, '');
      if (!validation) validation = '-';
      
      markdown += `| **${this.formatFieldName(field.name)}** | ${this.escapeMarkdown(String(currentValue))} | ${type} | ${validation} |\n`;
    });
    
    markdown += `\n`;
    
    if (data.requiresAdminApproval && data.requiresAdminApproval.length > 0) {
      markdown += `## ⚠️ Fields Requiring Admin Approval\n`;
      markdown += `The following fields require administrator approval to update:\n\n`;
      data.requiresAdminApproval.forEach(field => {
        markdown += `- ${this.formatFieldName(field)}\n`;
      });
      markdown += `\n`;
    }
    
    markdown += `## How to Update\n`;
    markdown += `Use the "update_user_profile" tool with the fields you want to change.\n\n`;
    markdown += `Example:\n\`\`\`json\n{\n  "updates": {\n    "first_name": "John",\n    "bio": "New bio here"\n  }\n}\n\`\`\`\n`;
    
    return { markdown };
  }
  
  /**
   * Format generic result
   */
  formatGeneric(data) {
    let markdown = `# Result\n\n`;
    markdown += `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
    return { markdown };
  }
  
  /**
   * Format error
   */
  formatError(error) {
    let markdown = `# Error\n\n`;
    markdown += `❌ **${error.error || 'An error occurred'}**\n\n`;
    
    if (error.details) {
      markdown += `**Details:** ${error.details}\n\n`;
    }
    
    if (error.statusCode) {
      markdown += `**Status Code:** ${error.statusCode}\n\n`;
    }
    
    markdown += `Please check your input and try again.\n`;
    
    return { markdown };
  }
  
  /**
   * Helper: Format date
   */
  formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  
  /**
   * Helper: Capitalize first letter
   */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  /**
   * Helper: Format field name for display
   */
  formatFieldName(field) {
    const fieldNames = {
      first_name: 'First Name',
      middle_name: 'Middle Name',
      last_name: 'Last Name',
      bio: 'Bio',
      chat_availability: 'Chat Availability',
      phone: 'Phone Number',
      title: 'Title',
      department: 'Department',
      matricNo: 'Matric Number',
      staffId: 'Staff ID',
      level: 'Level',
      session: 'Session',
      extra_roles: 'Extra Roles',
      avatar: 'Avatar',
    };
    
    return fieldNames[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  /**
   * Helper: Escape markdown special characters
   */
  escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
  }
}

export default new ResponseFormatter();

