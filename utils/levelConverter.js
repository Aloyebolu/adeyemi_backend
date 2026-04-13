// utils/levelConverter.js

/**
 * Converts numeric values to part/level format
 * @param {number} value - The numeric value to convert
 * @param {string} type - The type of conversion ('part', 'level', 'grade')
 * @returns {string} - Formatted string (e.g., "Part 1", "Level 2", etc.)
 */

function convertToPart(value) {
    // Handle different input types
    const num = parseInt(value);
    
    if (isNaN(num)) return 'Invalid input';
    
    // Convert to part (100 -> Part 1, 200 -> Part 2, etc.)
    const partNumber = Math.floor(num / 100);
    const romanNumerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
    const romanPart = romanNumerals[partNumber] || partNumber;
    return `Part ${romanPart}`;
    return `Part ${partNumber}`;
}


// Export all functions
export {
    convertToPart
};