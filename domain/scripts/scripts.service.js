import { getScript, listScripts, scriptExists } from './tasks/index.js';
import { SCRIPT_MESSAGES } from './scripts.constants.js';
import AppError from '../errors/AppError.js';

/**
 * Service for managing script execution
 */
class ScriptsService {
  constructor(models, services) {
    this.models = models;
    this.services = services;
  }

  /**
   * Get all available scripts
   * @returns {Array} List of scripts
   */
  getAllScripts() {
    return listScripts();
  }

  /**
   * Get a specific script by name
   * @param {string} scriptName - Name of the script
   * @returns {Object|null} Script object
   */
  getScript(scriptName) {
    return getScript(scriptName);
  }

  /**
   * Execute a script
   * @param {string} scriptName - Name of the script to execute
   * @param {Object} params - Parameters for the script
   * @returns {Promise<Object>} Execution result
   */
  async executeScript(scriptName, params = {}) {
    // Check if script exists
    if (!scriptExists(scriptName)) {
      throw new Error(SCRIPT_MESSAGES.SCRIPT_NOT_FOUND);
    }

    const script = getScript(scriptName);

    try {
      // Execute the script with dependencies
      const result = await script.run(
        { models: this.models, services: this.services },
        params
      );

      return {
        success: true,
        message: SCRIPT_MESSAGES.SCRIPT_EXECUTED,
        result
      };
    } catch (error) {
      throw new AppError(`${SCRIPT_MESSAGES.SCRIPT_FAILED}: ${error.message}`, error.statusCode || 500, error);
    }
  }

  /**
   * Validate script parameters
   * @param {string} scriptName - Name of the script
   * @param {Object} params - Parameters to validate
   * @returns {boolean} True if valid
   */
  validateScriptParams(scriptName, params) {
    // Add specific validation logic per script if needed
    const script = getScript(scriptName);
    
    if (!script) {
      return false;
    }

    // Basic validation - can be extended based on script requirements
    return typeof params === 'object' && params !== null;
  }
}

export default ScriptsService;