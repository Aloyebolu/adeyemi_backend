# `fetchDataHelper` Documentation

## Overview
This is a comprehensive MongoDB data fetching utility that provides flexible querying, population, transformation, and pagination capabilities for Mongoose models. It supports both standard `find()` operations and complex aggregation pipelines based on query complexity.

## Features

### Core Features
- **Dynamic Query Building**: Builds MongoDB queries from request payloads with support for filtering, searching, and sorting
- **Smart Population**: Handles nested population with automatic conflict detection
- **Dual Query Engine**: Automatically chooses between `find()` and `aggregate()` based on query complexity
- **Data Transformation**: Apply custom transformations to fetched data
- **Pagination**: Built-in pagination with configurable limits
- **Performance Logging**: Optional performance tracking with detailed timing
- **Security**: Input sanitization and validation

### Advanced Features
- **Custom Field Mapping**: Map database fields to custom output fields
- **Field Exclusion**: Remove sensitive fields from responses
- **Search Optimization**: Smart search across multiple fields with fallbacks
- **File Export Support**: (Currently commented out) Export data as files
- **Rate Limiting**: Configurable limits for exports and queries

## Configuration Constants

### Debug & Performance
```javascript
const ENABLE_PERFORMANCE_LOG = false;  // Enable detailed performance logging
const DEBUG = true;                     // Enable debug console logging
const SCHOOL_ID_MANDATORY = false;      // Require school ID in requests
```

### Rate Limits
```javascript
const RATE_LIMITS = {
  maxExportSize: 10000,    // Maximum records for export
  maxQueryDepth: 5,        // Maximum query nesting depth
  maxSearchFields: 10      // Maximum fields for search
};
```

## Key Functions

### 1. `fetchDataHelper` (Main Export)
The primary function to handle HTTP requests for data fetching.

**Parameters:**
- `req`: Express request object
- `res`: Express response object  
- `Model`: Mongoose model
- `options`: Configuration options

**Options:**
```javascript
{
  enablePagination: true,      // Enable/disable pagination
  custom_fields: {},           // Custom field mappings
  populate: [],               // Population configuration
  configMap: {},              // Data transformation map
  sort: { createdAt: -1 },    // Default sort
  maxLimit: 100,              // Maximum items per page
  forceFind: false,           // Force use of find() instead of aggregate()
  returnType: 'response'      // 'response' or 'object'
}
```

**Usage:**
```javascript
import fetchDataHelper from './fetchDataHelper.js';

// In route handler
app.get('/users', async (req, res) => {
  await fetchDataHelper(req, res, UserModel, {
    populate: ['profile', 'posts'],
    custom_fields: {
      fullName: 'profile.name',
      email: 'contact.email'
    }
  });
});
```

### 2. `applyTransformations`
Transforms data using a configuration map.

**Parameters:**
- `data`: Array of documents
- `configMap`: Transformation configuration

**Transform Types:**
- **Function**: `async (doc, models) => transformedValue`
- **Path Resolution**: `'this.path.to.field'` or `'this.path1||this.path2'` (with fallbacks)
- **Reference**: `'reference.field'`
- **Static**: Static value

**Example:**
```javascript
const configMap = {
  displayName: 'profile.name',
  age: (doc) => calculateAge(doc.birthDate),
  status: 'active'
};
```

### 3. `validateCustomFieldsPopulate`
Validates that custom field paths are covered by populate configuration and warns about missing paths.

**Parameters:**
- `customFields`: Object mapping custom field names to paths
- `populateConfig`: Array of populate configurations

**Purpose:** Ensures that fields referenced in `custom_fields` will be available after population to prevent undefined values.

## Query Building

### Request Payload Structure
```javascript
{
  page: 1,                    // Page number
  limit: 20,                  // Items per page
  fields: ['name', 'email'],  // Fields to search
  search_term: 'john',        // Search term
  filter: { status: 'active' }, // Filter criteria
  sort: { name: 1 },          // Sort order
  extraParams: {              // Additional parameters
    asFile: false,
    excludeFields: ['password'],
    includeQueryInfo: false
  }
}
```

### Custom Field Configuration
```javascript
custom_fields: {
  // Simple string path
  userName: 'profile.name',
  
  // Object with path and fallback
  userEmail: {
    path: 'contact.email',
    fallback: 'backup.email'
  },
  
  // Dot notation for nested fields
  departmentName: 'department.info.name'
}
```

## Population System

### Populate Configuration
Supports both simple and nested population:
```javascript
// Simple population
populate: ['author', 'comments']

// Nested population  
populate: [
  { 
    path: 'author',
    populate: {
      path: 'profile'
    }
  }
]

// With options
populate: [
  {
    path: 'comments',
    select: 'content createdAt',
    options: { sort: { createdAt: -1 } }
  }
]
```

### Automatic Conflict Detection
The system detects when:
1. Additional filters target populated fields
2. Custom fields reference unpopulated paths
3. Illegal population of `_id` fields occurs

In such cases, it automatically switches to aggregation pipeline for proper handling.

## Query Execution Strategy

### Decision Logic for `find()` vs `aggregate()`
Uses `aggregate()` when:
- Query contains `$or` or `$and` operators
- Nested field paths in filters (e.g., `'profile.name'`)
- Custom fields reference nested paths
- Illegal `_id` population attempted
- `forceFind: false` (default) and complexity warrants it

Uses `find()` when:
- Simple queries without complex conditions
- `forceFind: true` is specified
- No nested path requirements

## Response Structure

### Successful Response
```javascript
{
  message: "ModelName data fetched successfully",
  pagination: {
    current_page: 1,
    limit: 20,
    total_pages: 5,
    total_items: 95
  },
  data: [...], // Transformed data
  metadata: {   // Optional
    timestamp: "ISO date",
    model: "ModelName",
    version: "1.0"
  }
}
```

### Object Return Type
When `returnType: 'object'`:
```javascript
{
  data: [...],
  pagination: {...},
  queryInfo: {
    query: {...},
    finalSort: {...},
    currentPage: 1,
    itemsPerPage: 20,
    performance: {
      totalTime: 150,
      recordsReturned: 20,
      usedAggregation: true
    }
  }
}
```

## Error Handling

### Custom Errors
- `AppError`: Custom error class for application errors
- Automatic error wrapping with context
- Development vs production error responses

### Validation
- School ID validation (when enabled)
- ObjectId format checking
- Search term sanitization
- Custom field population validation

## Performance Considerations

### Logging Levels
1. **Performance Logging**: Times individual operations (disabled by default)
2. **Debug Logging**: General debug info (enabled by default)
3. **Warning Logging**: Population validation warnings

### Optimization Features
- Query result caching (implied by Mongoose)
- Lean document returns
- Selective field projection
- Batched transformations

## Security Features

1. **Input Sanitization**: Search terms are sanitized
2. **Field Exclusion**: Sensitive fields can be excluded
3. **Rate Limiting**: Configurable limits on operations
4. **ID Validation**: ObjectId format validation

## Usage Examples

### Basic Usage
```javascript
import fetchDataHelper from './fetchDataHelper.js';
import User from '../models/User.js';

router.get('/users', async (req, res) => {
  await fetchDataHelper(req, res, User);
});
```

### With Custom Fields
```javascript
await fetchDataHelper(req, res, User, {
  custom_fields: {
    fullName: 'profile.firstName + " " + profile.lastName',
    department: 'department.name'
  },
  populate: ['profile', 'department']
});
```

### With Transformations
```javascript
await fetchDataHelper(req, res, Product, {
  configMap: {
    priceWithTax: async (doc) => doc.price * 1.08,
    inStock: 'inventory.count > 0'
  }
});
```

### Programmatic Usage (Return Object)
```javascript
const result = await fetchData(payload, ProductModel, {
  returnType: 'object',
  populate: ['category'],
  custom_fields: {
    categoryName: 'category.name'
  }
});

console.log(result.data);
console.log(result.pagination);
```

## Best Practices

1. **Always populate referenced fields** used in custom_fields
2. **Use configMap for complex transformations** rather than post-processing
3. **Enable performance logging** in development for optimization
4. **Validate custom field paths** using `validateCustomFieldsPopulate()`
5. **Set reasonable maxLimit** based on your use case
6. **Use excludeFields** for sensitive data removal

## Notes

- File export functionality is currently commented out
- School ID filtering logic is present but configurable
- All performance logging is disabled by default
- The system is designed to be extensible with additional hooks
- MongoDB aggregation is used for complex queries to ensure accuracy

This utility provides a robust foundation for building RESTful APIs with MongoDB, handling many common requirements out of the box while remaining flexible for customization.