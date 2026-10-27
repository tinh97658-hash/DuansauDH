import { extname } from "node:path";
import multer from "multer";
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor, HttpException } from "@nestjs/common";
import { finalize } from "rxjs";

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
  storage: multer.memoryStorage(),
  fileFilter: (_request: any, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    const ext = safeExtension(file.originalname);
    if (ALLOWED_DOCUMENT_EXTENSIONS.has(ext) && (ALLOWED_DOCUMENT_MIMES.has(file.mimetype) || file.mimetype === "application/octet-stream")) {
      return callback(null, true);
    }
    return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
  limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 4, parts: 5 },
};

export const photoUploadOptions = {
  storage: multer.memoryStorage(),
  fileFilter: (_request: any, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    const ext = safeExtension(file.originalname);
    if (ALLOWED_PHOTO_MIMES.has(file.mimetype) && ALLOWED_PHOTO_EXTENSIONS.has(ext)) {
      return callback(null, true);
    }
    return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, parts: 3 },
};

@Injectable()
export class UploadAdmissionInterceptor implements NestInterceptor {
  private static readonly active = new Set<string>();
  intercept(context: ExecutionContext, next: CallHandler) {
    const id = String(context.switchToHttp().getRequest().user.id);
    if (UploadAdmissionInterceptor.active.has(id) || UploadAdmissionInterceptor.active.size >= 4) {
      throw new HttpException("Đang xử lý tệp. Vui lòng thử lại sau.", 429);
    }
    UploadAdmissionInterceptor.active.add(id);
    try { return next.handle().pipe(finalize(() => UploadAdmissionInterceptor.active.delete(id))); }
    catch (error) { UploadAdmissionInterceptor.active.delete(id); throw error; }
  }
}
