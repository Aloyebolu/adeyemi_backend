// routes/validation.route.js
import express from 'express';
import {
    validateProgramme,
    validateAllProgrammes,
    quickValidate,
    autoFixIssues,
    getPaginatedIssues,
    getValidationSummary
} from '../controllers/validation.controller.js';

const router = express.Router();

router.get('/programme/:programmeId', validateProgramme);
router.get('/all', validateAllProgrammes);


router.get('/quick/:programmeId', quickValidate);

router.post('/auto-fix/:programmeId', autoFixIssues);

router.get('/issues/:programmeId/:issueType', getPaginatedIssues);

router.get('/summary', getValidationSummary);

export default router;