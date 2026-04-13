# **Database Management Domain Documentation**

## **Overview**

The Database Management Domain allows managing MongoDB databases directly from your backend. It includes:

* Creating backups of databases
* Listing all backups
* Restoring a backup to a target database
* Deleting backups
* Tracking metadata of backups (timestamp, size, status)
* Supporting multiple databases

The domain uses Express for routing and MongoDB for storing metadata about backups.

---

## **Directory Structure**

```bash
database/
├── database.controller.js    # Handles HTTP requests
├── database.service.js       # Business logic for backup/restore
├── database.model.js         # MongoDB model for backup metadata
├── database.routes.js        # Express routes
└── index.js                  # Exports router for Express app
```

---

## **Database Model**

### **database.model.js**

Tracks backups and their metadata.

| Field      | Type   | Description                                  |
| ---------- | ------ | -------------------------------------------- |
| database   | String | Name of the database                         |
| backupPath | String | Path where the backup is stored              |
| timestamp  | Date   | When the backup was created                  |
| status     | String | `"pending"`, `"completed"`, `"failed"`       |
| size       | String | Human-readable size of the backup (optional) |

---

## **Database Service**

### **database.service.js**

**Methods:**

| Method                        | Description                                                             |
| ----------------------------- | ----------------------------------------------------------------------- |
| `createBackup(dbName)`        | Creates a backup of a configured database using `mongodump`.            |
| `listBackups(filter)`         | Lists backups, optionally filtered by database name.                    |
| `restoreBackup(id, targetDb)` | Restores a backup to a configured target database using `mongorestore`. |
| `deleteBackup(id)`            | Deletes a backup and removes the record from the DB.                    |

**Notes:**

* Multiple databases are configured in the `databases` object in the service.
* Backups are stored in `./backups` by default.
* Each backup has its own timestamped folder.
* Uses `child_process.exec` to call `mongodump`/`mongorestore`.

---

## **Database Controller**

### **database.controller.js**

* Handles HTTP requests and responses.
* Calls `DatabaseService` methods.
* Returns JSON with `success`, `backup`/`backups`, or `result`.

---

## **API Endpoints**

### **Base URL**

```
/api/database
```

---

### **1. Create Backup**

**Endpoint:**

```
POST /api/database/create
```

**Request Body:**

```json
{
  "database": "voixa"
}
```

**Response Example:**

```json
{
  "success": true,
  "backup": {
    "_id": "6456c2f7e7b3a0a8c9f8c2a1",
    "database": "voixa",
    "backupPath": "/app/backups/voixa-2026-03-20T15-45-00-000Z",
    "status": "completed",
    "timestamp": "2026-03-20T15:45:00.000Z",
    "size": "240 KB"
  }
}
```

---

### **2. List Backups**

**Endpoint:**

```
GET /api/database/list?database=voixa
```

**Query Params:**

| Parameter | Type   | Optional | Description                |
| --------- | ------ | -------- | -------------------------- |
| database  | String | Yes      | Filter backups by database |

**Response Example:**

```json
{
  "success": true,
  "backups": [
    {
      "_id": "6456c2f7e7b3a0a8c9f8c2a1",
      "database": "voixa",
      "backupPath": "/app/backups/voixa-2026-03-20T15-45-00-000Z",
      "status": "completed",
      "timestamp": "2026-03-20T15:45:00.000Z",
      "size": "240 KB"
    }
  ]
}
```

---

### **3. Restore Backup**

**Endpoint:**

```
POST /api/database/restore
```

**Request Body:**

```json
{
  "backupId": "6456c2f7e7b3a0a8c9f8c2a1",
  "targetDb": "voixa"
}
```

**Response Example:**

```json
{
  "success": true,
  "result": {
    "message": "Database restored to voixa from backup 6456c2f7e7b3a0a8c9f8c2a1"
  }
}
```

---

### **4. Delete Backup**

**Endpoint:**

```
DELETE /api/database/:backupId
```

**Response Example:**

```json
{
  "success": true,
  "result": {
    "message": "Backup deleted successfully"
  }
}
```

---

## **Usage Notes**

1. **Multiple Databases Support**
   Configure additional databases in `database.service.js` under `databases` object:

   ```js
   const databases = {
     voixa: process.env.MONGO_URI_VOIXA,
     analytics: process.env.MONGO_URI_ANALYTICS,
   };
   ```

2. **Backup Path**
   By default, backups are stored under `./backups`. You can change `BACKUP_DIR` in the service.

3. **Permissions**
   Ensure the Node process has read/write access to the backup directory.

4. **Security**
   Only authenticated/admin users should access these endpoints. Protect via JWT or session middleware.

5. **Size Limit & Performance**
   For very large databases, `mongodump` may take time. Consider running backups asynchronously and tracking `status` in the database.

---

## **Frontend Integration Example**

* **Backup creation:** POST `/api/database/create` with `{ database: "voixa" }`.
* **Restore backup:** POST `/api/database/restore` with `{ backupId, targetDb }`.
* **List backups:** GET `/api/database/list`.
* **Delete backup:** DELETE `/api/database/:backupId`.
* Display backup metadata: database name, timestamp, status, size.
* Optional: show progress using `status` from backup metadata (`pending` → `completed` → `failed`).

---

This documentation fully describes the **Database Management domain**, its **API**, and usage instructions for frontend or other services.