/**
 * Catalog quyền (RBAC) — nguồn duy nhất định nghĩa mã quyền và bộ quyền mặc định
 * cho các vai trò hệ thống.
 *
 * - `PERMISSIONS` được seed vào bảng `permissions` (migration 062) để UI tick chọn.
 * - `SYSTEM_ROLES` là 3 vai trò dựng sẵn, không cho xóa/đổi mã.
 * - `DEFAULT_ROLE_PERMISSIONS` tái lập đúng hành vi phân quyền cũ (theo `@Roles`)
 *   cho tới khi ma trận quyền được admin tùy chỉnh.
 */

export interface PermissionDefinition {
  code: string;
  name: string;
  group: string;
  description?: string;
}

export interface RoleDefinition {
  code: string;
  name: string;
  description?: string;
}

export const SYSTEM_ROLES: RoleDefinition[] = [
  {
    code: "admin",
    name: "Quản trị hệ thống",
    description: "Toàn quyền hệ thống, quản lý tài khoản và phân quyền.",
  },
  {
    code: "supervisor",
    name: "Giảng viên hướng dẫn",
    description: "Theo dõi, xem học vụ và hướng dẫn học viên.",
  },
  {
    code: "examiner",
    name: "Giám khảo chấm thi",
    description: "Chấm thi, duyệt điểm và xem học vụ.",
  },
];

export const PERMISSIONS: PermissionDefinition[] = [
  // ===== Tài khoản & phân quyền =====
  { code: "account.view", group: "Tài khoản & phân quyền", name: "Xem tài khoản nhân sự" },
  { code: "account.manage", group: "Tài khoản & phân quyền", name: "Quản lý tài khoản nhân sự" },
  { code: "account.password.reset", group: "Tài khoản & phân quyền", name: "Đặt lại mật khẩu nhân sự" },
  { code: "role.view", group: "Tài khoản & phân quyền", name: "Xem vai trò" },
  { code: "role.manage", group: "Tài khoản & phân quyền", name: "Quản lý vai trò và ma trận quyền" },
  { code: "audit.view", group: "Tài khoản & phân quyền", name: "Xem nhật ký thao tác" },

  // ===== Danh mục dùng chung =====
  { code: "catalog.view", group: "Danh mục dùng chung", name: "Xem danh mục" },
  { code: "catalog.manage", group: "Danh mục dùng chung", name: "Quản lý danh mục" },

  // ===== Kế hoạch & chương trình đào tạo =====
  { code: "plan.view", group: "Kế hoạch & chương trình đào tạo", name: "Xem kế hoạch, CTĐT" },
  { code: "plan.manage", group: "Kế hoạch & chương trình đào tạo", name: "Quản lý kế hoạch, CTĐT" },

  // ===== Tuyển sinh =====
  { code: "admission.view", group: "Tuyển sinh", name: "Xem hồ sơ, điểm xét tuyển" },
  { code: "admission.manage", group: "Tuyển sinh", name: "Xét tuyển, xác nhận kết quả" },

  // ===== Đào tạo Thạc sĩ =====
  { code: "masters.view", group: "Đào tạo Thạc sĩ", name: "Xem nghiệp vụ Thạc sĩ" },
  { code: "masters.manage", group: "Đào tạo Thạc sĩ", name: "Quản lý nghiệp vụ Thạc sĩ" },

  // ===== Đào tạo Tiến sĩ =====
  { code: "doctoral.view", group: "Đào tạo Tiến sĩ", name: "Xem nghiệp vụ Tiến sĩ" },
  { code: "doctoral.manage", group: "Đào tạo Tiến sĩ", name: "Quản lý nghiệp vụ Tiến sĩ" },

  // ===== Lớp học phần & xếp lịch =====
  { code: "scheduling.view", group: "Lớp học phần & xếp lịch", name: "Xem lớp học phần, lịch học" },
  { code: "scheduling.organize", group: "Lớp học phần & xếp lịch", name: "Tổ chức lớp học phần" },
  { code: "scheduling.write", group: "Lớp học phần & xếp lịch", name: "Tạo lớp, xếp và sửa lịch" },
  { code: "scheduling.assign", group: "Lớp học phần & xếp lịch", name: "Phân công người quản lý lịch đào tạo" },

  // ===== Thi & điểm =====
  { code: "gradebook.view", group: "Thi & điểm", name: "Xem danh sách thi, bảng điểm" },
  { code: "gradebook.submit", group: "Thi & điểm", name: "Nhập và gửi duyệt điểm" },
  { code: "gradebook.approve", group: "Thi & điểm", name: "Duyệt, khóa và mở lại điểm" },
  { code: "gradebook.policy", group: "Thi & điểm", name: "Cấu hình quy chế chấm điểm" },
  { code: "studyleave.manage", group: "Thi & điểm", name: "Quản lý bảo lưu" },

  // ===== Báo cáo & thống kê =====
  { code: "reports.view", group: "Báo cáo & thống kê", name: "Xem báo cáo" },
  { code: "reports.export", group: "Báo cáo & thống kê", name: "Phát hành, xuất báo cáo" },

  // ===== Hướng dẫn & phản biện =====
  { code: "supervision.review", group: "Hướng dẫn & phản biện", name: "Duyệt hồ sơ được phân công" },
];

export const PERMISSION_CODES: string[] = PERMISSIONS.map((permission) => permission.code);

const VIEW_PERMISSIONS = ["catalog.view", "plan.view", "admission.view", "masters.view", "doctoral.view", "scheduling.view", "gradebook.view", "reports.view"];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: PERMISSION_CODES,
  supervisor: [...VIEW_PERMISSIONS, "supervision.review", "scheduling.write"],
  examiner: [...VIEW_PERMISSIONS, "scheduling.write", "gradebook.submit", "gradebook.policy"],
};
