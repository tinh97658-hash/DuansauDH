// Memory-only uploads: enrollment/probe images must never be written to disk.

import multer from "multer";

const ATTENDANCE_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

const imageFilter: multer.Options["fileFilter"] = (_request, file, callback) => {
  if (!ATTENDANCE_IMAGE_MIMES.has(file.mimetype)) {
    return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  }
  return callback(null, true);
};

export const attendanceEnrollmentUploadOptions: multer.Options = {
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
};

export const attendanceProbeUploadOptions: multer.Options = {
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
};
