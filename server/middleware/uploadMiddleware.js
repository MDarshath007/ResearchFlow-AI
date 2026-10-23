import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const cleanExt = path.extname(file.originalname).toLowerCase();
    const sanitizedBase = path.basename(file.originalname, cleanExt)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${sanitizedBase}-${uniqueSuffix}${cleanExt}`);
  },
});

// Block dangerous executable binaries and scripts
const DANGEROUS_EXTS = new Set([
  '.exe', '.bat', '.cmd', '.msi', '.vbs', '.com', '.scr', '.ps1', '.pif', '.dll'
]);

const baseFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (DANGEROUS_EXTS.has(ext)) {
    return cb(new Error(`File type "${ext}" is not permitted for upload.`));
  }
  cb(null, true);
};

// General safe uploader (50MB limit)
const upload = multer({
  storage: storage,
  fileFilter: baseFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10,
  },
});

// Avatar image uploader (5MB limit, strictly image types)
const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const avatarFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  if (!ALLOWED_IMAGE_EXTS.has(ext) || !mime.startsWith('image/')) {
    return cb(new Error('Only image files (PNG, JPG, JPEG, WEBP, GIF, SVG) are allowed for avatars.'));
  }
  cb(null, true);
};

export const uploadAvatarMiddleware = multer({
  storage: storage,
  fileFilter: avatarFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Codebase ZIP uploader (50MB limit, strictly ZIP archives)
const ALLOWED_ZIP_EXTS = new Set(['.zip']);
const zipFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_ZIP_EXTS.has(ext)) {
    return cb(new Error('Only ZIP archives (.zip) are allowed for codebase assessment scans.'));
  }
  cb(null, true);
};

export const uploadZipMiddleware = multer({
  storage: storage,
  fileFilter: zipFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Reproducibility configs uploader (25MB limit per file, max 5 files)
const ALLOWED_REPRO_EXTS = new Set([
  '.txt', '.json', '.yml', '.yaml', '.ipynb', '.env', '.example', '.sample',
  '.toml', '.cfg', '.ini', '.py', '.md', '.dockerfile', '.cff', '.lock'
]);
const reproFileFilter = (req, file, cb) => {
  const name = (file.originalname || '').toLowerCase();
  const ext = path.extname(name);
  if (
    ALLOWED_REPRO_EXTS.has(ext) ||
    name.includes('dockerfile') ||
    name.includes('.env') ||
    name.includes('requirements') ||
    name.includes('package')
  ) {
    return cb(null, true);
  }
  return cb(new Error(`File "${file.originalname}" is not an accepted environment manifest or configuration file.`));
};

export const uploadReproducibilityMiddleware = multer({
  storage: storage,
  fileFilter: reproFileFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
});

// Safe cleanup helper to delete temporary files without throwing unhandled exceptions
export const safeUnlink = (filePath) => {
  try {
    if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`Failed to clean up temporary file ${filePath}:`, err.message);
  }
};

export default upload;
