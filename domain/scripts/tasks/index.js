import recomputeResults from './recompute-results.js';
import fixMissingFields from './fix-missing-fields.js';
import rebuildMasterSheets from './rebuild-master-sheets.js';
import migrateData from './migrate-data.js';
import hardDelete from './hard-delete.js';
import recomputeDepartmentResults from './recompute-department-results.js';

// Registry of all available scripts
const scriptRegistry = {
    [recomputeResults.name]: recomputeResults,
    [fixMissingFields.name]: fixMissingFields,
    [rebuildMasterSheets.name]: rebuildMasterSheets,
    [migrateData.name]: migrateData,
    [hardDelete.name]: hardDelete,
    [recomputeDepartmentResults.name]: recomputeDepartmentResults,
};

/**
 * Get a script by name
 * @param {string} name - Script name
 * @returns {Object|null} Script object or null if not found
 */
export const getScript = (name) => {
    return scriptRegistry[name] || null;
};

/**
 * List all available scripts
 * @returns {Array} List of script metadata
 */
export const listScripts = () => {
    return Object.values(scriptRegistry).map(script => ({
        name: script.name,
        description: script.description
    }));
};

/**
 * Check if a script exists
 * @param {string} name - Script name
 * @returns {boolean} True if script exists
 */
export const scriptExists = (name) => {
    return name in scriptRegistry;
};

export default scriptRegistry;