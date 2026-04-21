import mongoose from "mongoose";
// import { securityUtils } from "../domain/fetchdata/sec.fetchdata.js";
import AppError from "../shared/errors/AppError.js";
import { validateObjectId } from "./validator.js";
import securityUtils from "./securityUtils.js";

// const ENABLE_PERFORMANCE_LOG = true;
const ENABLE_PERFORMANCE_LOG = false;

const DEBUG = true;
const SCHOOL_ID_MANDATORY = false;

// Rate limiting configuration
const RATE_LIMITS = {
  maxExportSize: 10000,
  maxQueryDepth: 5,
  maxSearchFields: 10
};

console.log = DEBUG ? console.log : () => { };

// Simple in-memory cache for counts (optional)
const countCache = new Map();

// ==================== HELPER FUNCTIONS ====================

const logWithTime = (message, startTime = null) => {
  if (ENABLE_PERFORMANCE_LOG) {
    const timestamp = new Date().toISOString();
    if (startTime) {
      const duration = Date.now() - startTime;
      console.log(`⏱️ [${timestamp}] ${message} - ${duration}ms`);
      return duration;
    } else {
      console.log(`⏱️ [${timestamp}] ${message}`);
      return Date.now();
    }
  }
};

const getPathFromFieldDef = (fieldDef) => {
  if (!fieldDef) return '';
  if (typeof fieldDef === 'string') return fieldDef;
  if (fieldDef.path) return fieldDef.path;
  return '';
};

const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// ==================== APPLY TRANSFORMATIONS ====================

export const applyTransformations = async (data, configMap) => {
  if (!configMap || !Array.isArray(data)) return data;

  const models = mongoose.models;

  const resolvePath = (obj, path) => {
    return path.split('.').reduce((o, k) => (o ? o[k] : null), obj);
  };

  return Promise.all(
    data.map(async (doc) => {
      const transformed = {};

      for (const [key, value] of Object.entries(configMap)) {
        if (typeof value === 'function') {
          // Function transformation
          transformed[key] = await value(doc, models);
        } else if (typeof value === 'string') {
          if (value.startsWith('this.')) {
            // Dot notation path resolution
            try {
              if (value.includes('||')) {
                // Multiple fallback paths
                const paths = value
                  .split('||')
                  .map(v => v.trim().replace(/^this\./, '').replace(/\?/g, ''));

                for (const p of paths) {
                  const val = resolvePath(doc, p);
                  if (val !== undefined && val !== null) {
                    transformed[key] = val;
                    break;
                  }
                }
              } else {
                // Single path
                transformed[key] = resolvePath(doc, value.replace(/^this\./, '').replace(/\?/g, ''));
              }
            } catch {
              transformed[key] = null;
            }
          } else if (value.includes('.')) {
            // Simple dot notation
            const [ref, refField] = value.split('.');
            transformed[key] = doc[ref]?.[refField] ?? null;
          } else {
            // Static value
            transformed[key] = value;
          }
        } else {
          // Other value types
          transformed[key] = value;
        }
      }

      return transformed;
    })
  );
};

// ==================== QUERY BUILDER ====================

const queryBuilder = (payload = {}, options = {}) => {
  const {
    page = 1,
    fields = [],
    search_term = "",
    filter = {},
    filters = {},
    sort = { createdAt: -1 },
    extraParams = {},
    cursor,               // new: cursor for pagination
    cursorField = '_id',  // new: field to use for cursor (default _id)
  } = payload;


  let limit = payload.limit;

  const enablePagination = options.enablePagination !== false;
  const additionalFilters = options.additionalFilters || {};
  const customFields = options.custom_fields || {};
  const defaultSort = options.sort || { createdAt: -1 };
  const maxLimit = options.maxLimit || 100;

  // Validate page
  let currentPage = parseInt(page);
  if (isNaN(currentPage) || currentPage < 1) currentPage = 1;

  // Validate limit
  const defaultItemsPerPage = 20;
  let itemsPerPage = Math.min(
    Math.max(parseInt(limit) || defaultItemsPerPage, 1),
    maxLimit
  );

  let skip = (currentPage - 1) * itemsPerPage;

  // Handle cursor-based pagination if enabled and cursor is provided
  const enableCursor = options.enableCursorPagination !== false && cursor !== undefined;
  if (enableCursor) {
    // Override skip for cursor mode
    skip = 0;
    // We'll modify the query later
  }

  const mergedFilters = Object.entries({ ...filter, ...filters }).reduce((acc, [key, value]) => {
    // Skip if value is exactly "*" (treat as "All")
    if (value === "*") {
      return acc;
    }

    // If value starts with "\*", remove the escape character
    if (typeof value === 'string' && value.startsWith("\\*")) {
      acc[key] = value.substring(1); // Remove the backslash
    } else {
      acc[key] = value;
    }

    return acc;
  }, {});

  // Build base query
  let query = { deletedAt: null, ...mergedFilters, ...additionalFilters };

  // Handle archive mode
  switch (payload.archiveMode ?? "exclude") {
    case "exclude":
      // Only active documents
      query.deletedAt = null;
      break;

    case "only":
      // Only archived documents
      query.deletedAt = { $ne: null };
      break;

    case "all":
      // Active + archived (no filter)
      break;

    default:
      // Safe fallback
      query.deletedAt = null;
  }

  // Apply cursor condition if enabled
  if (enableCursor) {
    const cursorCondition = {};
    cursorCondition[cursorField] = { $gt: cursor };
    query = { $and: [query, cursorCondition] };
  }

  // Handle search with custom field guidance
  if (fields.length && search_term) {
    const fieldArray = Array.isArray(fields) ? fields : String(fields).split(",");
    const regex = { $regex: search_term, $options: "i" };
    const orArray = [];

    for (const field of fieldArray) {
      const trimmed = field.trim();
      const fieldDef = customFields[trimmed];

      if (fieldDef) {
        // Use custom field path for search
        const path = getPathFromFieldDef(fieldDef);
        if (path) {
          orArray.push({ [path]: regex });
          // Add fallback if specified
          if (fieldDef.fallback) {
            orArray.push({ [fieldDef.fallback]: regex });
          }
        }
      } else {
        // Use field directly
        orArray.push({ [trimmed]: regex });
      }
    }

    // Remove duplicates
    if (orArray.length > 0) {
      const seen = new Set();
      query.$or = orArray.filter(cond => {
        const key = Object.keys(cond)[0];
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  }

  const finalSort = sort || defaultSort;
  detectIdTypeMismatch(query);

  ENABLE_PERFORMANCE_LOG && console.log("Final query: ", JSON.stringify(query))
  return {
    query,
    finalSort,
    skip,
    itemsPerPage,
    enablePagination,
    extraParams,
    currentPage,
    enableCursor,
    cursorField,
  };
};

// ==================== POPULATE MANAGEMENT ====================

/**
 * Build nested populate configuration from populate array.
 * Merges populateSelect mapping for selective fields.
 */
const buildPopulateConfig = (Model, populate = [], populateSelect = {}, options = {}) => {
  if (!populate || populate.length === 0) return [];

  const config = [];
  const processedPaths = new Set();

  const normalizePopulate = (p) => {
    if (typeof p === 'string') return { path: p };
    if (typeof p === 'object') return p;
    return null;
  };

  const buildNestedPopulate = (path, model) => {
    const parts = path.split('.');
    let currentModel = model;
    let currentConfig = null;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!currentModel || !currentModel.schema) break;

      const schemaPath = currentModel.schema.path(part);
      if (!schemaPath) break;

      const refModelName = schemaPath.options?.ref;

      if (i === 0) {
        // Top-level populate
        const existing = config.find(p => p.path === part);
        if (existing) {
          currentConfig = existing;
        } else {
          currentConfig = {
            path: part,
            populate: []
          };
          config.push(currentConfig);
          processedPaths.add(part);
        }
      } else if (currentConfig) {
        // Nested populate
        let nestedConfig = currentConfig.populate.find(p => p.path === part);
        if (!nestedConfig) {
          nestedConfig = {
            path: part,
            populate: []
          };
          currentConfig.populate.push(nestedConfig);
        }
        currentConfig = nestedConfig;
      }

      // Apply select if present in populateSelect for this path
      if (isLast && populateSelect[path]) {
        currentConfig.select = populateSelect[path];
      }

      // Move to referenced model for next level
      if (refModelName) {
        currentModel = mongoose.models[refModelName];
      } else {
        break;
      }
    }
  };

  // Process all populate entries
  for (const p of populate) {
    const normalized = normalizePopulate(p);
    if (!normalized) continue;

    const path = normalized.path;
    if (!processedPaths.has(path)) {
      buildNestedPopulate(path, Model);
    }

    // Merge options from populate config
    const existingConfig = config.find(c => c.path === path);
    if (existingConfig) {
      Object.assign(existingConfig, normalized);
    }
  }

  return config;
};

// ==================== QUERY EXECUTION ====================

/**
 * Execute find query with proper populate
 */
const executeFindQuery = async (Model, query, sort, populateConfig, pagination, cursorField, enableCursor, archiveMode) => {
  let dataQuery = Model.find(query)
    .setOptions({ archiveMode }) // 👈 add this
    .sort(sort);

  // Apply populate
  for (const p of populateConfig) {
    dataQuery = dataQuery.populate(p);
  }

  // Apply pagination: cursor mode uses skip=0 but we already filtered by cursor
  if (pagination.enablePagination && !pagination.extraParams?.asFile) {
    if (enableCursor) {
      // In cursor mode, we still limit, but skip is 0
      dataQuery = dataQuery.limit(pagination.itemsPerPage);
    } else {
      dataQuery = dataQuery.skip(pagination.skip).limit(pagination.itemsPerPage);
    }
  }

  return dataQuery.lean();
};

/**
 * Convert populate config to aggregation $lookup stages.
 * New: supports unwindArrays option (default true) and selective projection.
 */
const populateConfigToLookups = (Model, populateConfig, additionalFilters = {}, options = {}) => {
  const lookups = [];
  const unwindArrays = options.unwindArrays !== false; // default true

  const processPopulate = (config, parentPath = '', parentModel = Model) => {
    const { path, select, options = {}, populate = [] } = config;
    const fullPath = parentPath ? `${parentPath}.${path}` : path;

    const schemaPath = parentModel.schema.path(path);
    if (!schemaPath) return;

    const refModelName = schemaPath.options?.ref;
    if (!refModelName) return;

    const refModel = mongoose.model(refModelName);
    const from = refModel.collection.name;

    const isArray = schemaPath.instance === 'Array';

    // Build $lookup stage with optional pipeline for select
    const pipeline = [];
    if (select) {
      const project = {};
      select.split(' ').forEach(f => {
        if (f.startsWith('-')) project[f.slice(1)] = 0;
        else project[f] = 1;
      });
      pipeline.push({ $project: project });
    }

    lookups.push({
      $lookup: {
        from,
        localField: fullPath,
        foreignField: '_id',
        as: fullPath,
        ...(pipeline.length > 0 && { pipeline })
      }
    });

    // Add $unwind only for single references or if explicitly requested for arrays
    if (!isArray || unwindArrays) {
      lookups.push({
        $unwind: { path: `$${fullPath}`, preserveNullAndEmptyArrays: true }
      });
    }

    // Recursively process nested populate
    for (const nested of populate) {
      processPopulate(nested, fullPath, refModel);
    }
  };

  for (const config of populateConfig) {
    processPopulate(config);
  }

  return lookups;
};

/**
 * Execute aggregation query with optimized stage order: $match first.
 */
const executeAggregationQuery = async (Model, query, sort, populateConfig, pagination, lookups = [], options = {}) => {
  let pipeline = [];



  // 2. Build populate lookups
  const populateStages = populateConfigToLookups(Model, populateConfig, query, options);
  pipeline.push(...populateStages);
  // 3. Add custom lookups
  if (lookups.length) {
    pipeline.push(...buildLookupStages(lookups));
  }
  // 1. Match main collection FIRST
  pipeline.push({ $match: query });

  // 4. Sorting
  pipeline.push({ $sort: sort });

  // 5. Pagination (skip/limit or cursor)
  if (pagination.enablePagination && !pagination.extraParams?.asFile) {
    if (pagination.enableCursor) {
      // For cursor mode, we already have the $match with cursor condition,
      // but we need to limit. Skip is already 0.
      pipeline.push({ $limit: pagination.itemsPerPage });
    } else {
      pipeline.push({ $skip: pagination.skip });
      pipeline.push({ $limit: pagination.itemsPerPage });
    }
  }


  if (ENABLE_PERFORMANCE_LOG) {
    console.log('📊 Aggregation pipeline:', JSON.stringify(pipeline, null, 2));
  }

  analyzePipelineForBugs(pipeline);

  // Allow disk use for large datasets
  return Model.aggregate(pipeline).allowDiskUse(true);
};

/**
 * Determine whether to use aggregation based on query complexity.
 * Also respects new flag 'forceAggregation' if provided.
 */
const shouldUseAggregation = (query, customFields, populateConfig, options) => {
  if (options?.forceAggregation) return true;
  if (options?.forceFind) return false;

  if (query.$or || query.$and) return true;

  if (options.lookups) return true;
  const hasNestedPaths = Object.keys(query).some(key => key.includes('.'));
  if (hasNestedPaths) return true;

  const customFieldPaths = Object.values(customFields || {}).map(getPathFromFieldDef);
  const hasComplexCustomFields = customFieldPaths.some(path => path && path.includes('.'));
  if (hasComplexCustomFields) return true;

  const hasIllegalIdPopulate = (populateConfig || []).some(p => {
    const checkPath = pop => {
      if (pop.path === "_id") return true;
      if (Array.isArray(pop.populate)) {
        return pop.populate.some(checkPath);
      }
      return false;
    };
    return checkPath(p);
  });

  if (hasIllegalIdPopulate) return true;

  return false;
};

// ==================== POST-PROCESSING ====================

/**
 * Post-process data with transformations and field removal.
 * If server-side transform is possible (only path mappings), we skip this step.
 */
const postProcessData = async (data, options, extraParams, serverSideTransformApplied = false) => {
  if (!Array.isArray(data) || data.length === 0) return data;

  let processedData = [...data];

  // Skip transformations if already done on server
  if (!serverSideTransformApplied && options.configMap) {
    processedData = await applyTransformations(processedData, options.configMap);
  }

  // Remove excluded fields
  if (Array.isArray(extraParams?.excludeFields)) {
    processedData = processedData.map(item => {
      const newItem = { ...item };
      extraParams.excludeFields.forEach(field => delete newItem[field]);
      return newItem;
    });
  }

  // Flatten custom fields for search result highlighting
  if (options.custom_fields) {
    processedData = processedData.map(item => {
      const newItem = { ...item };
      for (const [field, fieldDef] of Object.entries(options.custom_fields)) {
        const path = getPathFromFieldDef(fieldDef);
        if (path && path.includes('.')) {
          // Extract value from nested path for display
          const value = path.split('.').reduce((obj, key) => obj?.[key], item);
          if (value !== undefined) {
            newItem[field] = value;
          }
        }
      }
      return newItem;
    });
  }

  return processedData;
};

// ==================== CORE FETCHER ====================

const fetchData = async (payload, Model, options = {}) => {
  const {
    lookups = [],
    skipCount = false,
    countCacheTTL = 60000,
    useServerSideTransform = false,
    populateSelect = {},
    explain = false,
    unwindArrays = true,        // default true for backward compatibility
    forceAggregation = false,   // optional override
    forceFind = false,          // optional override
    enableCursorPagination = true, // default true to allow cursor if provided
  } = options;

  const overallStart = logWithTime(`🚀 Starting fetchData for ${Model.modelName}`);

  // Build query
  const queryResult = queryBuilder(payload, { ...options, enableCursorPagination });
  const {
    query,
    finalSort,
    skip,
    itemsPerPage,
    enablePagination,
    extraParams,
    currentPage,
    enableCursor,
    cursorField,
  } = queryResult;

  // Build populate config (from options.populate, not custom_fields)
  const populateConfig = buildPopulateConfig(Model, options.populate || [], populateSelect, options);
  validateCustomFieldsPopulate(options.custom_fields, populateConfig);

  // Decide query method
  const useAggregation = shouldUseAggregation(query, options.custom_fields, populateConfig, { forceAggregation, forceFind, lookups });

  let data;
  const queryStart = logWithTime(`📡 Executing database query`);

  try {
    if (useAggregation) {
      // Pass unwindArrays option to lookup builder
      const aggOptions = { unwindArrays };
      data = await executeAggregationQuery(
        Model,
        query,
        finalSort,
        populateConfig,
        {
          skip,
          itemsPerPage,
          enablePagination,
          extraParams,
          enableCursor,
        },
        lookups,
        aggOptions
      );
    } else {
      data = await executeFindQuery(
        Model,
        query,
        finalSort,
        populateConfig,
        {
          skip,
          itemsPerPage,
          enablePagination,
          extraParams,
        },
        cursorField,
        enableCursor,
        options.archiveMode || payload.archiveMode || "exclude"
      );
    }

    if (explain && ENABLE_PERFORMANCE_LOG) {
      // Get execution stats (only works with find, not aggregation easily)
      if (!useAggregation) {
        console.log('📊 Query explain plan:', JSON.stringify(query));
        const explainResult = await Model.find(query).sort(finalSort).explain('executionStats');
        console.log('📊 Query explain:', JSON.stringify(explainResult, null, 2));
      }
    }

    logWithTime(`✅ Database query completed`, queryStart);
  } catch (error) {
    logWithTime(`❌ Database query failed`, queryStart);
    throw error;
  }

  // Attempt server-side transformations if enabled and configMap is simple
  let serverSideTransformApplied = false;
  if (useServerSideTransform && options.configMap) {
    // Check if all transformations are simple path mappings
    const allSimple = Object.values(options.configMap).every(v =>
      typeof v === 'string' && v.startsWith('this.') && !v.includes('||')
    );
    if (allSimple && useAggregation) {
      // Add a $project stage after $lookup but before sorting/pagination? Actually we need to integrate into aggregation pipeline.
      // For simplicity, we'll note that it's possible but would require pipeline modification.
      // We'll skip for now and leave as future enhancement.
      // For now, we keep client-side transforms.
    }
  }

  // Post-process data (skip if server-side transforms were applied)
  const postProcessStart = logWithTime(`🔄 Post-processing data`);
  data = await postProcessData(data, options, extraParams, serverSideTransformApplied);
  logWithTime(`✅ Post-processing completed`, postProcessStart);

  // Pagination info
  let pagination = null;
  let nextCursor = null;

  if (enablePagination && !extraParams?.asFile) {
    if (skipCount) {
      // Use estimated count or skip entirely
      pagination = {
        current_page: currentPage,
        limit: itemsPerPage,
        total_pages: null,
        total_items: null,
        count_skipped: true,
      };
    } else {
      const countStart = logWithTime(`🔢 Counting total documents`);
      const totalItems = await getCachedCount(Model, query, countCacheTTL);
      logWithTime(`✅ Document count completed`, countStart);

      pagination = {
        current_page: currentPage,
        limit: itemsPerPage,
        total_pages: Math.ceil(totalItems / itemsPerPage),
        total_items: totalItems,
      };
    }

    // If cursor mode, determine next cursor from last document
    if (enableCursor && data.length === itemsPerPage) {
      const lastDoc = data[data.length - 1];
      nextCursor = lastDoc[cursorField];
    }
  }

  const totalTime = logWithTime(`🎉 fetchData completed for ${Model.modelName}`, overallStart);

  // Performance summary
  if (ENABLE_PERFORMANCE_LOG) {
    console.log(`\n📈 PERFORMANCE SUMMARY for ${Model.modelName}:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Records returned: ${data?.length || 0}`);
    console.log(`   Pagination enabled: ${enablePagination}`);
    console.log(`   Used aggregation: ${useAggregation}`);
    console.log(`   Cursor mode: ${enableCursor}`);
    if (enableCursor) console.log(`   Cursor field: ${cursorField}`);
    console.log(`   Current page: ${currentPage}`);
    console.log(`   Page size: ${itemsPerPage}\n`);
  }

  return {
    data,
    pagination,
    nextCursor, // only set if cursor mode
    queryInfo: {
      query,
      finalSort,
      currentPage,
      itemsPerPage,
      performance: {
        totalTime,
        recordsReturned: data?.length || 0,
        usedAggregation: useAggregation
      }
    }
  };
};

// Cached count helper
const getCachedCount = async (Model, query, ttl) => {
  const key = `${Model.modelName}:${JSON.stringify(query)}`;
  const now = Date.now();
  const cached = countCache.get(key);
  if (cached && (now - cached.timestamp) < ttl) {
    return cached.count;
  }
  const count = await Model.countDocuments(query);
  countCache.set(key, { count, timestamp: now });
  return count;
};

// ==================== MAIN HELPER ====================
/**
 * 
 * @param {*} req 
 * @param {*} res 
 * @param {*} Model 
 * @param {{returnType:'response'|'object', singleResponse: Boolean}} options 
 * @returns {Promise<{data:Object;pagination:Object}>}
 */
export const fetchDataHelper = async (req, res, Model, options = {}) => {
  try {
    const schoolId = req?.school?._id;

    if (!schoolId && SCHOOL_ID_MANDATORY) {
      throw new AppError("❌ school_id missing from request context");
    }

    // Prepare payload
    const rawPayload = req.method === "GET" ? req.query : req.body;
    const payload = rawPayload || {};

    // Sanitize search term
    if (payload.search_term) {
      payload.search_term = securityUtils.sanitizeSearchTerm(payload.search_term);
    }

    // Validate school ID
    if (schoolId && !securityUtils.isValidObjectId(schoolId, false)) {
      // Handle invalid school ID (commented out as per original)
    }

    const { returnType = 'response', singleResponse = false, ...fetchOptions } = options;

    // Add school filter
    if (payload.filter?.school_id) {
      delete payload.filter.school_id;
    }

    payload.filter = {
      ...(payload.filter || {}),
      // school_id: schoolId || { $exists: false }
    };

    payload.archiveMode = req.archiveMode || "exclude";

    // Fetch data
    const result = await fetchData(payload, Model, fetchOptions);
    const { data: resultData, pagination, nextCursor, queryInfo } = result;

    let data;
    if (singleResponse) {
      data = resultData[0] || null;
    } else {
      data = resultData;
    }

    const extraParams = payload?.extraParams || {};
    if (extraParams.asFile) {
      if (returnType === 'object') {
        throw new AppError('File export is only available with returnType: "response"');
      }
      // Export handler would be called here
      throw new AppError('Export functionality commented out as requested');
    }

    // Return based on type
    if (returnType === 'object') {
      return {
        data,
        ...(pagination && { pagination }),
        ...(nextCursor && { nextCursor }),
        ...(extraParams.includeQueryInfo && { queryInfo })
      };
    }

    // Default response
    const response = {
      message: `${Model.modelName} data fetched successfully`,
      ...(pagination ? { pagination } : {}),
      ...(nextCursor ? { nextCursor } : {}),
      data,
    };

    if (extraParams.includeMetadata) {
      response.metadata = {
        timestamp: new Date().toISOString(),
        model: Model.modelName,
        version: '1.0'
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    throw error;
  }
};

/**
 * Validates that all custom_fields paths are covered by the provided populate config.
 * Logs strong warnings if a path is missing.
 * Supports nested populate structures.
 *
 * @param {Object} customFields - { fieldKey: "path.to.field" }
 * @param {Array} populateConfig - Array of populate configs (can be nested)
 */
export const validateCustomFieldsPopulate = (customFields, populateConfig) => {
  if (!customFields || !populateConfig) return;

  const getAllPopulatePaths = (populates, parent = '') => {
    const paths = [];
    for (const p of populates) {
      const path = typeof p === 'string' ? p : p.path;
      if (!path) continue;
      const fullPath = parent ? `${parent}.${path}` : path;
      paths.push(fullPath);
      if (p.populate && Array.isArray(p.populate)) {
        paths.push(...getAllPopulatePaths(p.populate, fullPath));
      }
    }
    return paths;
  };

  const availablePaths = getAllPopulatePaths(populateConfig);
  const missingPaths = [];

  for (const [key, pathDef] of Object.entries(customFields)) {
    const path = typeof pathDef === 'string' ? pathDef : pathDef.path;
    if (!path) continue;

    const topLevel = path.split('.')[0];
    const isCovered = availablePaths.some(p => p.startsWith(topLevel));
    if (!isCovered) {
      missingPaths.push({ field: key, path });
    }
  }

  if (missingPaths.length > 0) {
    console.trace(
      `⚠️ WARNING: Some custom_fields paths are not covered by your populate configuration. ` +
      `These fields may not resolve correctly. Please update your populate config to include the necessary paths.\n\n` +
      missingPaths.map(m =>
        `  - custom_field: "${m.field}" (path: "${m.path}")\n` +
        `    → Suggested populate: { path: "${m.path.split('.').slice(0, -1).join('.') || m.path.split('.')[0]}" }`
      ).join('\n') +
      `\n\nTip: Ensure that every custom_field path has a corresponding populate entry, including nested paths if needed.`
    );
  }
};

const detectIdTypeMismatch = (query) => {
  if (!query || typeof query !== "object") return;

  const seen = new WeakSet();

  const checkPath = (obj, path = "") => {
    if (seen.has(obj)) return;
    seen.add(obj);

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;

      if (key.toLowerCase().includes("_id") || validateObjectId(value, false)) {
        if (typeof value === "string") {
          if (!mongoose.isValidObjectId(value)) {
            console.trace(
              `⚠️ Filter on "${fullPath}" is a string but not a valid ObjectId. This may cause aggregation or find queries to return empty results.`
            );
          } else {
            console.trace(
              `⚠️ Filter on "${fullPath}" is a string. Consider converting to mongoose.Types.ObjectId("${value}") to avoid issues.`
            );
          }
        }
        // Suggest index if missing
        if (ENABLE_PERFORMANCE_LOG && !mongoose.connection.db.collection('system.indexes')) {
          // Not feasible to check index existence here, but we can log a recommendation
          console.log(`🔍 Consider adding an index on ${fullPath} for better performance.`);
        }
      }

      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof mongoose.Types.ObjectId)
      ) {
        checkPath(value, fullPath);
      }
    }
  };

  checkPath(query);
};

const buildLookupStages = (lookups) => {
  if (!Array.isArray(lookups)) return [];

  const stages = [];

  lookups.forEach(lu => {
    stages.push({
      $lookup: {
        from: lu.from,
        localField: lu.localField,
        foreignField: lu.foreignField,
        as: lu.as
      }
    });

    stages.push({
      $unwind: {
        path: `$${lu.as}`,
        preserveNullAndEmptyArrays: true
      }
    });
  });

  return stages;
};

export default fetchDataHelper;
export { fetchData };

function analyzePipelineForBugs(pipeline, options = {}) {
  const warnings = [];
  const errors = [];

  // Track field state through the pipeline
  let fieldState = new Map(); // field -> { stageIndex, operation, overwritten }

  pipeline.forEach((stage, stageIndex) => {
    const stageName = Object.keys(stage)[0];
    const stageContent = stage[stageName];

    // Track $lookup stages that overwrite fields
    if (stageName === '$lookup') {
      const { as, from, localField } = stageContent;

      // Check if 'as' field already exists in current document state
      if (fieldState.has(as)) {
        const previousState = fieldState.get(as);
        warnings.push({
          type: 'FIELD_OVERWRITE',
          stage: stageIndex,
          operation: '$lookup',
          field: as,
          message: `Field "${as}" is being overwritten by $lookup from "${from}" at stage ${stageIndex}. Previous modification at stage ${previousState.stageIndex} (${previousState.operation}). Consider using a different 'as' name or note that original field will be replaced.`,
          severity: 'warning'
        });
      }

      // Update field state
      fieldState.set(as, {
        stageIndex,
        operation: '$lookup',
        overwritten: true,
        source: from,
        originalField: localField
      });
    }

    // Track $unwind stages
    else if (stageName === '$unwind') {
      const path = stageContent.path.replace(/^\$/, '');

      if (fieldState.has(path)) {
        const previousState = fieldState.get(path);
        warnings.push({
          type: 'FIELD_UNWIND',
          stage: stageIndex,
          operation: '$unwind',
          field: path,
          message: `Field "${path}" is being unwound at stage ${stageIndex}. This field was previously modified at stage ${previousState.stageIndex} (${previousState.operation}).`,
          severity: 'info'
        });
      }
    }

    // Track $match stages that filter on fields
    else if (stageName === '$match') {
      const matchConditions = stageContent;

      // Recursively analyze match conditions for field references
      const checkFieldReferences = (condition, currentPath = '') => {
        if (!condition || typeof condition !== 'object') return;

        for (const [key, value] of Object.entries(condition)) {
          const fullPath = currentPath ? `${currentPath}.${key}` : key;

          // Skip MongoDB operators
          if (key.startsWith('$')) {
            if (typeof value === 'object') {
              checkFieldReferences(value, currentPath);
            }
            continue;
          }

          // Check if this field exists in our fieldState
          if (fieldState.has(key)) {
            const state = fieldState.get(key);
            warnings.push({
              type: 'FILTER_ON_OVERWRITTEN_FIELD',
              stage: stageIndex,
              operation: '$match',
              field: key,
              message: `⚠️  FIELD OVERWRITE WARNING: Field "${key}" in $match at stage ${stageIndex} was overwritten by ${state.operation} at stage ${state.stageIndex} (from "${state.source || 'unknown'}"). The filter may not work as expected because the original field has been replaced.`,
              severity: 'warning',
              suggestion: `Consider using "${key}.fieldName" to access nested fields from the looked-up document, or move this $match before the ${state.operation} that overwrites "${key}".`
            });
          } else if (fullPath.includes('.')) {

            // DO nothing for now, as this is a common pattern and may not always indicate an issue. We could add more complex analysis here in the future to detect if the base field is overwritten.
            // Check for nested field references (like "department.name")
            // const baseField = fullPath.split('.')[0];
            // if (fieldState.has(baseField)) {
            //   const state = fieldState.get(baseField);
            //   warnings.push({
            //     type: 'FILTER_ON_NESTED_OVERWRITTEN_FIELD',
            //     stage: stageIndex,
            //     operation: '$match',
            //     field: fullPath,
            //     message: `⚠️  NESTED FIELD WARNING: Nested field "${fullPath}" in $match at stage ${stageIndex} references "${baseField}" which was overwritten by ${state.operation} at stage ${state.stageIndex}. The filter is being applied to the looked-up document.`,
            //     severity: 'info',
            //     note: `If you intended to filter on the original "${baseField}" field, move this $match before the ${state.operation} that overwrites it. If filtering on the looked-up document is intended, this is fine.`
            //   });
            // }
          }

          // Recursively check nested objects
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            checkFieldReferences(value, key);
          }
        }
      };

      checkFieldReferences(matchConditions);
    }

    // Track $project stages that might include or exclude fields
    else if (stageName === '$project') {
      const projectSpec = stageContent;

      for (const [field, value] of Object.entries(projectSpec)) {
        if (value === 0 && fieldState.has(field)) {
          // Field being explicitly excluded
          warnings.push({
            type: 'FIELD_EXCLUDED',
            stage: stageIndex,
            operation: '$project',
            field: field,
            message: `Field "${field}" is being excluded at stage ${stageIndex}. This field was previously modified at stage ${fieldState.get(field).stageIndex}.`,
            severity: 'info'
          });
        } else if (value === 1 && !fieldState.has(field)) {
          // Field being included for first time
          fieldState.set(field, {
            stageIndex,
            operation: '$project',
            overwritten: false
          });
        }
      }
    }

    // Track $addFields stages
    else if (stageName === '$addFields') {
      const addFieldsSpec = stageContent;

      for (const [field, value] of Object.entries(addFieldsSpec)) {
        if (fieldState.has(field)) {
          const previousState = fieldState.get(field);
          warnings.push({
            type: 'FIELD_OVERWRITE',
            stage: stageIndex,
            operation: '$addFields',
            field: field,
            message: `Field "${field}" is being overwritten by $addFields at stage ${stageIndex}. Previous modification at stage ${previousState.stageIndex} (${previousState.operation}).`,
            severity: 'warning'
          });
        }

        fieldState.set(field, {
          stageIndex,
          operation: '$addFields',
          overwritten: true
        });
      }
    }
  });

  // Additional analysis: check for lookup-join-unwind patterns that might cause issues
  const lookups = pipeline.reduce((acc, stage, idx) => {
    if (stage.$lookup) acc.push({ idx, ...stage.$lookup });
    return acc;
  }, []);

  const unwinds = pipeline.reduce((acc, stage, idx) => {
    if (stage.$unwind) acc.push({ idx, path: stage.$unwind.path });
    return acc;
  }, []);

  // Check for lookups without corresponding unwind on the same field
  lookups.forEach(lookup => {
    const hasUnwind = unwinds.some(unwind =>
      unwind.path === `$${lookup.as}` || unwind.path === lookup.as
    );

    if (!hasUnwind) {
      warnings.push({
        type: 'MISSING_UNWIND',
        field: lookup.as,
        message: `⚠️  MISSING UNWIND: $lookup on "${lookup.as}" at stage ${lookup.idx} creates an array field that is never unwound. This may cause unexpected behavior in subsequent stages that expect scalar values.`,
        severity: 'warning',
        suggestion: `Add an $unwind stage on "${lookup.as}" after the $lookup, or handle array logic in later stages.`
      });
    }
  });

  // Check for field naming conflicts that might cause data loss
  const fieldConflicts = [];
  pipeline.forEach((stage, idx) => {
    if (stage.$lookup) {
      const { localField, as } = stage.$lookup;
      if (localField === as) {
        fieldConflicts.push({
          stage: idx,
          localField,
          as,
          message: `⚠️  FIELD CONFLICT: $lookup at stage ${idx} uses the same name for localField ("${localField}") and as ("${as}"). This will overwrite the original field with the lookup result array.`,
          severity: 'warning'
        });
        warnings.push(fieldConflicts[fieldConflicts.length - 1]);
      }
    }
  });

  const allIssues = [...warnings];

  // LOG RELEVANT ISSUES IN A CLEAR FORMAT
  const relevantIssueTypes = [
    'FIELD_OVERWRITE',
    'FILTER_ON_OVERWRITTEN_FIELD',
    'FILTER_ON_NESTED_OVERWRITTEN_FIELD',
    'MISSING_UNWIND',
    'FIELD_CONFLICT'
  ];

  const hasRelevantIssues = warnings.some(warning =>
    relevantIssueTypes.includes(warning.type)
  );

  if (hasRelevantIssues) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 PIPELINE ANALYSIS REPORT');
    console.log('='.repeat(80));

    // Group warnings by type for better readability
    const groupedWarnings = {
      'FIELD_OVERWRITE': [],
      'FILTER_ON_OVERWRITTEN_FIELD': [],
      'FILTER_ON_NESTED_OVERWRITTEN_FIELD': [],
      'MISSING_UNWIND': [],
      'FIELD_CONFLICT': [],
      'FIELD_UNWIND': [],
      'FIELD_EXCLUDED': []
    };

    warnings.forEach(warning => {
      if (groupedWarnings[warning.type]) {
        groupedWarnings[warning.type].push(warning);
      }
    });

    // Critical issues (likely bugs)
    if (groupedWarnings['FILTER_ON_OVERWRITTEN_FIELD'].length > 0) {
      console.log('\n❌ CRITICAL ISSUES - Likely Bugs:');
      groupedWarnings['FILTER_ON_OVERWRITTEN_FIELD'].forEach(w => {
        console.log(`   • ${w.message}`);
        if (w.suggestion) console.log(`     💡 ${w.suggestion}`);
      });
    }

    if (groupedWarnings['FIELD_CONFLICT'].length > 0) {
      console.log('\n⚠️  FIELD CONFLICTS - Data Loss Risk:');
      groupedWarnings['FIELD_CONFLICT'].forEach(w => {
        console.log(`   • ${w.message}`);
      });
    }

    // Field overwrites
    if (groupedWarnings['FIELD_OVERWRITE'].length > 0) {
      console.log('\n📝 FIELD OVERWRITES:');
      groupedWarnings['FIELD_OVERWRITE'].forEach(w => {
        console.log(`   • ${w.message}`);
      });
    }

    // Nested field filters (might be intended)
    if (groupedWarnings['FILTER_ON_NESTED_OVERWRITTEN_FIELD'].length > 0) {
      console.log('\nℹ️  NESTED FIELD FILTERS - Review Intent:');
      groupedWarnings['FILTER_ON_NESTED_OVERWRITTEN_FIELD'].forEach(w => {
        console.log(`   • ${w.message}`);
        if (w.note) console.log(`     📌 ${w.note}`);
      });
    }

    // Missing unwinds
    if (groupedWarnings['MISSING_UNWIND'].length > 0) {
      console.log('\n🔄 MISSING UNWIND STAGES:');
      groupedWarnings['MISSING_UNWIND'].forEach(w => {
        console.log(`   • ${w.message}`);
        if (w.suggestion) console.log(`     💡 ${w.suggestion}`);
      });
    }

    // Other warnings
    if (groupedWarnings['FIELD_UNWIND'].length > 0 || groupedWarnings['FIELD_EXCLUDED'].length > 0) {
      console.log('\n📌 ADDITIONAL NOTES:');
      groupedWarnings['FIELD_UNWIND'].forEach(w => {
        console.log(`   • ${w.message}`);
      });
      groupedWarnings['FIELD_EXCLUDED'].forEach(w => {
        console.log(`   • ${w.message}`);
      });
    }

    // Summary
    console.log('\n' + '-'.repeat(80));
    console.log(`📊 Summary: ${allIssues.length} potential issue(s) detected`);
    console.trace('='.repeat(80) + '\n');

    // Return issues for programmatic use if needed
    return {
      hasIssues: true,
      issues: allIssues,
      summary: {
        totalStages: pipeline.length,
        lookups: lookups.length,
        unwinds: unwinds.length,
        criticalIssues: groupedWarnings['FILTER_ON_OVERWRITTEN_FIELD'].length + groupedWarnings['FIELD_CONFLICT'].length,
        totalIssues: allIssues.length
      }
    };
  }

  // No issues found - silent return
  return {
    hasIssues: false,
    issues: [],
    summary: {
      totalStages: pipeline.length,
      lookups: lookups.length,
      unwinds: unwinds.length,
      criticalIssues: 0,
      totalIssues: 0
    }
  };
}

// Usage - just call it once