// src/modules/ai/formatters/markdown.formatter.js

class MarkdownFormatter {
    /**
     * Format data as markdown table
     */
    formatAsTable(data, options = {}) {
        if (!data || data.length === 0) {
            return '*No data found*';
        }

        const { compact = false, maxColumns = 10, maxCellLength = 100 } = options;

        // Get all unique keys from data
        let keys = this.extractKeys(data);

        // Limit columns if too many
        if (keys.length > maxColumns) {
            keys = keys.slice(0, maxColumns);
        }

        // Build header
        let table = '| ' + keys.map(k => this.formatHeader(k)).join(' | ') + ' |\n';
        table += '|' + keys.map(() => '---').join('|') + '|\n';

        // Build rows
        for (const row of data) {
            const cells = keys.map(key => {
                let value = this.getNestedValue(row, key);
                value = this.formatCellValue(value, maxCellLength);
                return value;
            });
            table += '| ' + cells.join(' | ') + ' |\n';
        }

        // Add metadata
        if (!compact) {
            table += `\n*${data.length} record(s) shown*\n`;
        }

        return table;
    }

    async streamTable(session, data, options = {}) {
        if (!data || data.length === 0) {
            session.sendContent('*No data found*\n');
            return;
        }

        const { compact = false, maxColumns = 10, maxCellLength = 100 } = options;

        // 🔑 Extract keys
        let keys = this.extractKeys(data);

        if (keys.length > maxColumns) {
            keys = keys.slice(0, maxColumns);
        }

        // 🧱 HEADER
        session.sendContent(
            '| ' + keys.map(k => this.formatHeader(k)).join(' | ') + ' |\n'
        );

        session.sendContent(
            '|' + keys.map(() => '---').join('|') + '|\n'
        );

        // 🧬 STREAM ROWS
        for (const row of data) {
            const cells = keys.map(key => {
                let value = this.getNestedValue(row, key);
                return this.formatCellValue(value, maxCellLength);
            });

            session.sendContent(`| ${cells.join(' | ')} |\n`);

            //  micro delay = real streaming feel
            await new Promise(r => setTimeout(r, 50));
        }

        // 📊 METADATA
        if (!compact) {
            session.sendContent(`\n*${data.length} record(s) shown*\n`);
        }
    }
    /**
     * Format as summary
     */
    formatAsSummary(data, options = {}) {
        if (!data || data.length === 0) {
            return '*No data found*';
        }

        const { sampleSize = 5 } = options;
        const keys = this.extractKeys(data);

        let summary = `## 📊 Summary\n\n`;
        summary += `**Total Records:** ${data.length}\n`;
        summary += `**Fields:** ${keys.join(', ')}\n\n`;

        // Add statistics for numeric fields
        const numericStats = this.calculateNumericStats(data, keys);
        if (Object.keys(numericStats).length > 0) {
            summary += `### Numeric Statistics\n\n`;
            summary += this.formatNumericStats(numericStats);
            summary += '\n';
        }

        // Add sample data
        if (sampleSize > 0) {
            summary += `### Sample Data (first ${Math.min(sampleSize, data.length)} records)\n\n`;
            summary += this.formatAsTable(data.slice(0, sampleSize), { compact: true });
        }

        return summary;
    }

    /**
     * Format list of items
     */
    formatAsList(items, options = {}) {
        const { type = 'unordered', maxItems = 50 } = options;

        if (!items || items.length === 0) {
            return '*No items found*';
        }

        const displayItems = items.slice(0, maxItems);
        let list = '';

        if (type === 'ordered') {
            list = displayItems.map((item, i) => `${i + 1}. ${this.formatListItem(item)}`).join('\n');
        } else {
            list = displayItems.map(item => `- ${this.formatListItem(item)}`).join('\n');
        }

        if (items.length > maxItems) {
            list += `\n\n*... and ${items.length - maxItems} more items*`;
        }

        return list;
    }

    /**
     * Format key-value pairs
     */
    formatKeyValue(obj, options = {}) {
        const { excludeKeys = [], includeKeys = null, compact = false } = options;

        let output = '';

        for (const [key, value] of Object.entries(obj)) {
            // Filter keys
            if (excludeKeys.includes(key)) continue;
            if (includeKeys && !includeKeys.includes(key)) continue;

            const formattedKey = this.formatHeader(key);
            const formattedValue = this.formatCellValue(value, 200);

            if (compact) {
                output += `**${formattedKey}:** ${formattedValue}  \n`;
            } else {
                output += `| **${formattedKey}** | ${formattedValue} |\n`;
            }
        }

        if (!compact) {
            output = '| Field | Value |\n|-------|-------|\n' + output;
        }

        return output;
    }

    /**
     * Format error message
     */
    formatError(error, details = null) {
        let output = `## ❌ Error\n\n`;
        output += `${error.message || error}\n\n`;

        if (details) {
            output += `**Details:**\n\`\`\`\n${JSON.stringify(details, null, 2)}\n\`\`\`\n\n`;
        }

        output += `*Please check your request and try again.*`;

        return output;
    }

    /**
     * Format success message
     */
    formatSuccess(message, data = null) {
        let output = `## ✅ Success\n\n`;
        output += `${message}\n\n`;

        if (data) {
            if (Array.isArray(data) && data.length > 0) {
                output += this.formatAsTable(data, { compact: true });
            } else if (typeof data === 'object') {
                output += this.formatKeyValue(data);
            }
        }

        return output;
    }

    /**
     * Format action confirmation
     */
    formatActionConfirmation(action, details) {
        let output = `## ⚠️ Confirm Action\n\n`;
        output += `${action.description}\n\n`;

        output += `**Details:**\n`;
        output += this.formatKeyValue(details, { compact: true });
        output += `\n\n`;

        output += `*Please confirm this action by clicking the button below.*`;

        return output;
    }

    /**
     * Format analysis results
     */
    formatAnalysis(analysis, data = null) {
        let output = `## 📈 Analysis Results\n\n`;

        // Insights
        if (analysis.insights && analysis.insights.length > 0) {
            output += `### Key Insights\n\n`;
            output += analysis.insights.map(i => `- ${i}`).join('\n');
            output += `\n\n`;
        }

        // Patterns
        if (analysis.patterns && analysis.patterns.length > 0) {
            output += `### Patterns Detected\n\n`;
            output += analysis.patterns.map(p => `- ${p}`).join('\n');
            output += `\n\n`;
        }

        // Recommendations
        if (analysis.recommendations && analysis.recommendations.length > 0) {
            output += `### Recommendations\n\n`;
            output += analysis.recommendations.map(r => `- ${r}`).join('\n');
            output += `\n\n`;
        }

        // Data sample
        if (data && data.length > 0) {
            output += `### Data Sample\n\n`;
            output += this.formatAsTable(data.slice(0, 5), { compact: true });
        }

        return output;
    }

    /**
     * Format export offer
     */
    formatExportOffer(dataCount, format, exportUrl) {
        let output = `## 📁 Export Available\n\n`;
        output += `Found **${dataCount}** records. This dataset is too large to display in chat.\n\n`;
        output += `**Export Options:**\n`;
        output += `- [Download ${format.toUpperCase()}](${exportUrl})\n\n`;
        output += `**Preview (first 10 records):**\n\n`;
        output += `*Click download to view all ${dataCount} records.*`;

        return output;
    }

    // Helper methods

    extractKeys(data) {
        const keys = new Set();

        for (const item of data) {
            Object.keys(item).forEach(key => keys.add(key));
        }

        return Array.from(keys);
    }

    formatHeader(key) {
        return key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    formatCellValue(value, maxLength = 100) {
        if (value === null || value === undefined) {
            return '-';
        }

        if (typeof value === 'object') {
            // Handle MongoDB ObjectId
            if (value._bsontype === 'ObjectId' || (value.toString && value.toString().match(/^[0-9a-fA-F]{24}$/))) {
                return value.toString().slice(-8);
            }
            // Handle Date
            if (value instanceof Date) {
                return this.formatDate(value);
            }
            // Handle arrays
            if (Array.isArray(value)) {
                if (value.length === 0) return '[]';
                if (value.length <= 3) {
                    return value.map(v => this.formatCellValue(v, 30)).join(', ');
                }
                return `[${value.length} items]`;
            }
            // Handle objects
            const str = JSON.stringify(value);
            if (str.length > maxLength) {
                return str.slice(0, maxLength) + '...';
            }
            return str;
        }

        let str = String(value);
        if (str.length > maxLength) {
            str = str.slice(0, maxLength) + '...';
        }

        return str;
    }

    formatListItem(item) {
        if (typeof item === 'object') {
            // Try to extract name or title
            if (item.name) return item.name;
            if (item.title) return item.title;
            if (item.email) return item.email;
            return JSON.stringify(item).slice(0, 50);
        }
        return String(item);
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }

    calculateNumericStats(data, keys) {
        const stats = {};

        for (const key of keys) {
            const numbers = data
                .map(row => this.getNestedValue(row, key))
                .filter(v => typeof v === 'number' && !isNaN(v));

            if (numbers.length > 0) {
                stats[key] = {
                    count: numbers.length,
                    min: Math.min(...numbers),
                    max: Math.max(...numbers),
                    avg: numbers.reduce((a, b) => a + b, 0) / numbers.length,
                    sum: numbers.reduce((a, b) => a + b, 0),
                };
            }
        }

        return stats;
    }

    formatNumericStats(stats) {
        let output = '| Field | Min | Max | Average | Sum |\n';
        output += '|-------|-----|-----|---------|-----|\n';

        for (const [field, stat] of Object.entries(stats)) {
            output += `| ${this.formatHeader(field)} | ${stat.min} | ${stat.max} | ${stat.avg.toFixed(2)} | ${stat.sum} |\n`;
        }

        return output;
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

export default new MarkdownFormatter();