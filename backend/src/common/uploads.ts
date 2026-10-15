import { mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import multer from "multer";

const uploadDirectory = (relativePath: string) => {
  const directory = resolve(process.cwd(), relativePath);
  mkdirSync(directory, { recursive: true });
  return directory;
};

const diskStorage = (directory: string, filename: (request: any, file: Express.Multer.File) => string) =>
  multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadDirectory(directory)),
    filename: (request, file, callback) => callback(null, filename(request, file)),
  });

const safeExtension = (originalname: string) =>
  extname(originalname).toLowerCase().replace(/[^a-z0-9.]/gi, "");

const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".rar", ".7z", ".jpg", ".jpeg", ".png",
]);

const ALLOWED_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "image/jpeg",
  "image/png",
]);

const ALLOWED_PHOTO_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_PHOTO_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

export const submissionUploadOptions = {
  storage: diskStorage("public/submissions/submitted", (request, file) =>
    `userDocs-${request.user.id}-${Date.now()}${safeExtension(file.originalname)}`),
  fileFilter: (_request: any, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    const ext = safeExtension(file.originalname);
    if (ALLOWED_DOCUMENT_EXTENSIONS.has(ext) && (ALLOWED_DOCUMENT_MIMES.has(file.mimetype) || file.mimetype === "application/octet-stream")) {
      return callback(null, true);
    }
    return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
};

export const photoUploadOptions = {
  storage: diskStorage("public/img/users", (request, file) =>
    `user-${request.user.id}-${Date.now()}${safeExtension(file.originalname)}`),
  fileFilter: (_request: any, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    const ext = safeExtension(file.originalname);
    if (ALLOWED_PHOTO_MIMES.has(file.mimetype) && ALLOWED_PHOTO_EXTENSIONS.has(ext)) {
      return callback(null, true);
    }
    return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
};
