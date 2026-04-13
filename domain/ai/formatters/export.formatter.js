// src/modules/ai/formatters/export.formatter.js

import * as XLSX from 'xlsx';
import json2csv from 'json2csv';

class ExportFormatter {
  constructor() {
    this.tempFiles = new Map();
    this.fileExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }
  
  /**
   * Export data to Excel
   */
  async toExcel(data, options = {}) {
    const {
      sheetName = 'Data',
      includeHeaders = true,
      fileName = `export_${Date.now()}.xlsx`,
    } = options;
    
    // Prepare worksheet
    const worksheet = XLSX.utils.json_to_sheet(data, {
      header: includeHeaders ? Object.keys(data[0] || {}) : undefined,
    });
    
    // Auto-size columns
    this.autoSizeColumns(worksheet, data);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return this.saveTempFile(fileName, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  
  /**
   * Export data to CSV
   */
  async toCSV(data, options = {}) {
    const {
      fields = Object.keys(data[0] || {}),
      delimiter = ',',
      includeHeaders = true,
      fileName = `export_${Date.now()}.csv`,
    } = options;
    
    const parser = new json2csv.Parser({
      fields,
      delimiter,
      header: includeHeaders,
    });
    
    const csv = parser.parse(data);
    const buffer = Buffer.from(csv, 'utf-8');
    
    return this.saveTempFile(fileName, buffer, 'text/csv');
  }
  
  /**
   * Export data to JSON
   */
  async toJSON(data, options = {}) {
    const {
      pretty = true,
      fileName = `export_${Date.now()}.json`,
    } = options;
    
    const jsonString = pretty 
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
    
    const buffer = Buffer.from(jsonString, 'utf-8');
    
    return this.saveTempFile(fileName, buffer, 'application/json');
  }
  
  /**
   * Export data to multiple formats
   */
  async exportToFormats(data, formats, options = {}) {
    const exports = {};
    
    for (const format of formats) {
      switch (format) {
        case 'excel':
          exports.excel = await this.toExcel(data, options);
          break;
        case 'csv':
          exports.csv = await this.toCSV(data, options);
          break;
        case 'json':
          exports.json = await this.toJSON(data, options);
          break;
      }
    }
    
    return exports;
  }
  
  /**
   * Save temporary file
   */
  async saveTempFile(fileName, buffer, mimeType) {
    const fileId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileInfo = {
      id: fileId,
      name: fileName,
      buffer,
      mimeType,
      size: buffer.length,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.fileExpiry),
    };
    
    this.tempFiles.set(fileId, fileInfo);
    
    // Schedule cleanup
    setTimeout(() => {
      this.tempFiles.delete(fileId);
    }, this.fileExpiry);
    
    return {
      fileId,
      fileName,
      size: buffer.length,
      mimeType,
      url: `/api/ai/exports/${fileId}`,
    };
  }
  
  /**
   * Get temporary file
   */
  getTempFile(fileId) {
    return this.tempFiles.get(fileId);
  }
  
  /**
   * Auto-size Excel columns
   */
  autoSizeColumns(worksheet, data) {
    if (!data || data.length === 0) return;
    
    const columns = Object.keys(data[0]);
    const columnWidths = {};
    
    // Initialize with header length
    for (const col of columns) {
      columnWidths[col] = col.length;
    }
    
    // Calculate max width for each column
    for (const row of data) {
      for (const col of columns) {
        const value = String(row[col] || '');
        columnWidths[col] = Math.max(columnWidths[col], value.length);
      }
    }
    
    // Apply widths (Excel uses character units, roughly 1.2 per character)
    for (let i = 0; i < columns.length; i++) {
      const colLetter = XLSX.utils.encode_col(i);
      const width = Math.min(columnWidths[columns[i]] * 1.2, 50);
      worksheet['!cols'] = worksheet['!cols'] || [];
      worksheet['!cols'][i] = { width };
    }
  }
  
  /**
   * Format data for export with preview
   */
  prepareForExport(data, options = {}) {
    const {
      maxPreviewRows = 10,
      includeMetadata = true,
    } = options;
    
    const result = {
      totalRows: data.length,
      fields: data.length > 0 ? Object.keys(data[0]) : [],
      preview: data.slice(0, maxPreviewRows),
    };
    
    if (includeMetadata) {
      result.metadata = {
        exportedAt: new Date().toISOString(),
        dataTypes: this.inferDataTypes(data),
        statistics: this.calculateBasicStats(data),
      };
    }
    
    return result;
  }
  
  /**
   * Infer data types for each field
   */
  inferDataTypes(data) {
    if (data.length === 0) return {};
    
    const types = {};
    const sample = data[0];
    
    for (const [key, value] of Object.entries(sample)) {
      if (value === null || value === undefined) {
        types[key] = 'null';
      } else if (typeof value === 'number') {
        types[key] = 'number';
      } else if (typeof value === 'boolean') {
        types[key] = 'boolean';
      } else if (value instanceof Date) {
        types[key] = 'date';
      } else if (Array.isArray(value)) {
        types[key] = 'array';
      } else if (typeof value === 'object') {
        types[key] = 'object';
      } else {
        types[key] = 'string';
      }
    }
    
    return types;
  }
  
  /**
   * Calculate basic statistics for export metadata
   */
  calculateBasicStats(data) {
    const stats = {
      rowCount: data.length,
      columnCount: data.length > 0 ? Object.keys(data[0]).length : 0,
      estimatedSize: this.estimateSize(data),
    };
    
    return stats;
  }
  
  /**
   * Estimate data size in bytes
   */
  estimateSize(data) {
    const sample = JSON.stringify(data[0] || {});
    const avgRowSize = sample.length;
    return avgRowSize * data.length;
  }
  
  /**
   * Cleanup expired files (called periodically)
   */
  cleanup() {
    const now = Date.now();
    for (const [id, file] of this.tempFiles.entries()) {
      if (file.expiresAt.getTime() < now) {
        this.tempFiles.delete(id);
      }
    }
  }
}

// Run cleanup every hour
setInterval(() => {
  const exportFormatter = new ExportFormatter();
  exportFormatter.cleanup();
}, 60 * 60 * 1000);

export default new ExportFormatter();