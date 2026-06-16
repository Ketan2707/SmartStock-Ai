import multer from 'multer';
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
];
export const billUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter(_req, file, cb) {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Use JPEG, PNG, or WEBP.`));
        }
    },
});
export const screenshotUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter(_req, file, cb) {
        if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only JPEG and PNG screenshots are accepted.'));
        }
    },
});
