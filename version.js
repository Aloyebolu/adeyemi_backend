import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// Paths
const packageJsonPath = path.resolve('./package.json'); // backend/package.json
const versionHistoryPath = path.resolve('./version-history.json'); // backend/version-history.json

// Read current version
let versionData = { version: '0.0.0', versionMessage: '' };
try {
  versionData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (err) {
  console.warn('Could not read package.json version:', err);
}

// /version route
router.get('/version', (req, res) => {
  res.json({
    version: versionData.version,
    description: versionData.versionMessage,
    timestamp: new Date().toISOString()
  });
});

// /version/history route
router.get('/version/history', (req, res) => {
  try {
    if (!fs.existsSync(versionHistoryPath)) {
      return res.json([]);
    }
    const history = JSON.parse(fs.readFileSync(versionHistoryPath, 'utf8'));
    res.json(history);
  } catch (err) {
    console.error('Failed to read version history:', err);
    res.status(500).json({ error: 'Failed to read version history' });
  }
});

export default router;