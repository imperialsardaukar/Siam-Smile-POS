import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, '..', 'frontend', 'dist');
const targetDir = path.join(__dirname, '..', 'backend', 'public');

async function copyBuild() {
  try {
    // Remove existing public folder if it exists
    try {
      await fs.rm(targetDir, { recursive: true, force: true });
      console.log('Removed existing backend/public folder');
    } catch (e) {
      // Folder might not exist, that's fine
    }

    // Check if source exists
    try {
      await fs.access(sourceDir);
    } catch {
      console.error('ERROR: frontend/dist folder not found. Run "npm run build" in frontend first.');
      process.exit(1);
    }

    // Copy new build
    await fs.cp(sourceDir, targetDir, { recursive: true });
    console.log('✅ Frontend build copied to backend/public');
    
    // List files copied
    const files = await fs.readdir(targetDir);
    console.log(`   Files copied: ${files.join(', ')}`);
  } catch (error) {
    console.error('ERROR copying build:', error.message);
    process.exit(1);
  }
}

copyBuild();
