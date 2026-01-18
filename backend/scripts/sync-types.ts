import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_TYPES_PATH = path.join(__dirname, '../src/types/index.ts');
const FRONTEND_TYPES_PATH = path.join(__dirname, '../../../types.ts'); // Adjust based on user request "Frontend Type Definitions Duplicated" - previously reading types.ts in root as frontend types

// The user has 'types.ts' in root (as seen in context: C:\Users\Yash Bhardwaj\Downloads\powertrack-v2\types.ts)
// And backend types in backend/src/types/index.ts.

const syncTypes = () => {
    console.log('🔄 Synchronizing types...');

    if (!fs.existsSync(BACKEND_TYPES_PATH)) {
        console.error(`❌ Backend types not found at ${BACKEND_TYPES_PATH}`);
        process.exit(1);
    }

    const backendContent = fs.readFileSync(BACKEND_TYPES_PATH, 'utf-8');

    // Add DO NOT EDIT warning
    const warning = `/**
 * ⚠️ AUTO-GENERATED FROM BACKEND TYPES ⚠️
 * DO NOT EDIT DIRECTLY.
 * Run 'npm run sync-types' in backend to update.
 */
\n`;

    // Write to frontend
    try {
        fs.writeFileSync(FRONTEND_TYPES_PATH, warning + backendContent);
        console.log(`✅ Types synced to ${FRONTEND_TYPES_PATH}`);
    } catch (error) {
        console.error('❌ Failed to write frontend types:', error);
        process.exit(1);
    }
};

syncTypes();
