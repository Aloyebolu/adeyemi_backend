import { asBlob } from 'html-docx-js';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function convertHtmlToDocx() {
    try {
        // Read the HTML file
        const htmlFilePath = join(__dirname, 'example.html');
        let htmlContent = readFileSync(htmlFilePath, 'utf8');
        
        // Inject page number in top left corner using CSS
        const htmlWithPageNumbers = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            @top-left {
                content: "Page " counter(page) " of " counter(pages);
                font-family: Arial, sans-serif;
                font-size: 10pt;
            }
        }
        ${htmlContent.includes('</head>') ? '' : '</head>'}
        <style>
            /* Your existing styles */
        </style>
    </style>
</head>
<body>
    ${htmlContent.replace(/<\/head>.*?<body>/s, '').replace(/<\/body>.*?<\/html>/s, '')}
</body>
</html>
        `;
        
        // Convert HTML to DOCX
        const docx = await asBlob(htmlWithPageNumbers);
        const buffer = await docx.arrayBuffer();
        
        // Save DOCX in the same folder
        const outputPath = join(__dirname, 'example.docx');
        writeFileSync(outputPath, Buffer.from(buffer));
        
        console.log(`Successfully converted ${htmlFilePath} to ${outputPath}`);
    } catch (error) {
        console.error('Error converting file:', error.message);
    }
}

convertHtmlToDocx();