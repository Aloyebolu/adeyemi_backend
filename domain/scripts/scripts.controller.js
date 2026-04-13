import ScriptsService from './scripts.service.js';
import { SCRIPT_ACTIONS, SCRIPT_ENTITIES } from './scripts.constants.js';

/**
 * Controller for script management endpoints
 */
class ScriptsController {
  constructor(models, services) {
    this.scriptsService = new ScriptsService(models, services);
  }

  /**
   * GET /admin/scripts
   * List all available scripts
   */
  listScripts = async (req, res, next) => {
    try {
      const scripts = this.scriptsService.getAllScripts();
      
      res.status(200).json({
        success: true,
        data: scripts
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /admin/scripts/run
   * Execute a specific script
   */
  runScript = async (req, res, next) => {
    try {
      const { script, params = {} } = req.body;
      
      // Validate input
      if (!script) {
        return res.status(400).json({
          success: false,
          message: "Script name is required"
        });
      }

      // Validate script parameters
      if (!this.scriptsService.validateScriptParams(script, params)) {
        return res.status(400).json({
          success: false,
          message: "Invalid script parameters"
        });
      }

      // Execute script
      const result = await this.scriptsService.executeScript(script, params);

      // Set audit context for logging
      req.auditContext = {
        userId: req.user._id,
        action: SCRIPT_ACTIONS.RUN_SCRIPT,
        entity: SCRIPT_ENTITIES.SYSTEM_SCRIPT,
        entityId: script,
        newData: { params },
        context: {
          ipAddress: req.ip,
          endpoint: req.originalUrl,
          method: req.method,
          requestId: req.requestId
        },
        reason: "Admin executed system script",
        metadata: {
          script: script,
          success: result.success
        }
      };

      res.status(200).json(result);
    } catch (error) {
      // Set audit context for failed execution
      req.auditContext = {
        userId: req.user?._id,
        action: SCRIPT_ACTIONS.RUN_SCRIPT,
        entity: SCRIPT_ENTITIES.SYSTEM_SCRIPT,
        entityId: req.body?.script,
        newData: { params: req.body?.params },
        context: {
          ipAddress: req.ip,
          endpoint: req.originalUrl,
          method: req.method,
          requestId: req.requestId
        },
        reason: "Admin executed system script (failed)",
        metadata: {
          script: req.body?.script,
          error: error.message
        }
      };
      
      next(error);
    }
  };
}

export default ScriptsController;