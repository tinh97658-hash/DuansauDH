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

export const submissionUploadOptions = {
  storage: diskStorage("public/submissions/submitted", (request, file) =>
    `userDocs-${request.user.id}-${Date.now()}${extname(file.originalname)}`),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
};

export const photoUploadOptions = {
  storage: diskStorage("public/img/users", (request, file) =>
    `user-${request.user.id}-${Date.now()}${extname(file.originalname)}`),
  fileFilter: (_request: any, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith("image")) return callback(null, true);
    return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
};
