import express from 'express';
import ScriptsController from './scripts.controller.js';
import { runScriptValidation, listScriptsValidation } from './scripts.validation.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';

/**
 * Create scripts router
 * @param {Object} models - Database models
 * @returns {express.Router} Configured router
 */
const createScriptsRouter = (models, services) => {
  const router = express.Router();
  const scriptsController = new ScriptsController(models, services);

  // All routes require admin authentication
  router.use(authenticate('admin'));

  // GET /admin/scripts - List all available scripts
  router.get(
    '/',
    validate(listScriptsValidation),
    scriptsController.listScripts
  );

  // POST /admin/scripts/run - Execute a script
  router.post(
    '/run',
    validate(runScriptValidation),
    scriptsController.runScript
  );

  return router;
};

export default createScriptsRouter;