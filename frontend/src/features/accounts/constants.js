/** Nhãn hiển thị dùng chung cho module tài khoản & phân quyền. */

export const ROLE_LABELS = {
  admin: "Quản trị hệ thống",
  supervisor: "Giảng viên hướng dẫn",
  examiner: "Giám khảo chấm thi",
  student: "Học viên",
};

export const ACCOUNT_STATUS_LABELS = {
  active: "Đang hoạt động",
  disabled: "Đã khóa",
};

export const AUDIT_ACTION_LABELS = {
  "account.create": "Tạo tài khoản",
  "account.update": "Cập nhật tài khoản",
  "account.disable": "Khóa tài khoản",
  "account.enable": "Mở khóa tài khoản",
  "account.password.reset": "Đặt lại mật khẩu",
  "account.password.change": "Đổi mật khẩu",
  "account.sessions.revoke": "Buộc đăng xuất",
  "role.create": "Tạo vai trò",
  "role.update": "Cập nhật vai trò",
  "role.permissions.update": "Cập nhật quyền vai trò",
  "role.delete": "Xóa vai trò",
};

export const roleLabel = (code, name) => name || ROLE_LABELS[code] || code || "—";

export const auditActionLabel = (action) => AUDIT_ACTION_LABELS[action] || action || "—";
