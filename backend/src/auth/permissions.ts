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
  { code: "account.view", group: "Tài khoản & phân quyền", name: "Xem tài khoản nhân sự", description: "Xem danh sách và thông tin tài khoản nhân sự; không tự cho phép tạo, sửa hoặc khóa tài khoản." },
  { code: "account.manage", group: "Tài khoản & phân quyền", name: "Quản lý tài khoản nhân sự", description: "Tạo, sửa, khóa hoặc mở tài khoản và gán vai trò. Cấp thêm quyền xem tài khoản để sử dụng màn hình quản lý." },
  { code: "account.password.reset", group: "Tài khoản & phân quyền", name: "Đặt lại mật khẩu nhân sự", description: "Đặt lại mật khẩu cho nhân sự. Quyền này được cấp riêng với quyền sửa tài khoản." },
  { code: "role.view", group: "Tài khoản & phân quyền", name: "Xem vai trò", description: "Xem danh sách vai trò và các quyền đã được cấp cho từng vai trò." },
  { code: "role.manage", group: "Tài khoản & phân quyền", name: "Quản lý vai trò và ma trận quyền", description: "Tạo, sửa vai trò và thay đổi ma trận quyền. Thay đổi áp dụng cho tất cả nhân sự mang vai trò đó; cần thêm quyền xem vai trò để mở màn hình." },
  { code: "audit.view", group: "Tài khoản & phân quyền", name: "Xem nhật ký thao tác", description: "Xem lịch sử thao tác và thay đổi dữ liệu. Nhật ký toàn hệ thống bị chặn khi vai trò giới hạn xem theo nhóm." },

  // ===== Danh mục dùng chung =====
  { code: "catalog.view", group: "Danh mục dùng chung", name: "Xem danh mục", description: "Tra cứu các danh mục dùng chung như ngành, chuyên ngành, giảng viên và phòng học." },
  { code: "catalog.manage", group: "Danh mục dùng chung", name: "Quản lý danh mục", description: "Thêm, sửa và quản lý danh mục dùng chung. Cấp thêm quyền xem danh mục để mở các màn hình tương ứng." },

  // ===== Kế hoạch & chương trình đào tạo =====
  { code: "plan.view", group: "Kế hoạch & chương trình đào tạo", name: "Xem kế hoạch, CTĐT", description: "Xem kế hoạch đào tạo, chương trình đào tạo, danh mục học phần và lớp." },
  { code: "plan.manage", group: "Kế hoạch & chương trình đào tạo", name: "Quản lý kế hoạch, CTĐT", description: "Tạo, sửa kế hoạch, chương trình đào tạo, học phần và lớp. Cấp thêm quyền xem kế hoạch, CTĐT để thao tác trên giao diện." },

  // ===== Tuyển sinh =====
  { code: "admission.view", group: "Tuyển sinh", name: "Xem hồ sơ, điểm xét tuyển", description: "Xem hồ sơ tuyển sinh, hồ sơ học viên và kết quả xét tuyển trong phạm vi được phép." },
  { code: "admission.manage", group: "Tuyển sinh", name: "Xét tuyển, xác nhận kết quả", description: "Cập nhật hồ sơ, xử lý xét tuyển và xác nhận kết quả. Cấp thêm quyền xem hồ sơ; các khóa theo nhóm vẫn có hiệu lực." },

  { code: "groups.assign", group: "Nhóm học viên", name: "Phân công chuyên viên phụ trách nhóm", description: "Gán hoặc đổi chuyên viên phụ trách nhóm. Phân công không tự cấp quyền xem hay sửa; đổi người trong cửa sổ chỉnh sửa nhóm còn cần quyền quản lý nghiệp vụ Thạc sĩ." },

  // ===== Đào tạo Thạc sĩ =====
  { code: "masters.view", group: "Đào tạo Thạc sĩ", name: "Xem nghiệp vụ Thạc sĩ", description: "Xem các màn hình nghiệp vụ Thạc sĩ và danh sách nhóm; quyền xem điểm, hồ sơ và báo cáo được cấp riêng." },
  { code: "masters.manage", group: "Đào tạo Thạc sĩ", name: "Quản lý nghiệp vụ Thạc sĩ", description: "Tạo, sửa, xóa nhóm và phân học viên vào nhóm Thạc sĩ. Cần thêm quyền xem nghiệp vụ Thạc sĩ; việc sửa vẫn chịu các khóa theo nhóm." },

  // ===== Đào tạo Tiến sĩ =====
  { code: "doctoral.view", group: "Đào tạo Tiến sĩ", name: "Xem nghiệp vụ Tiến sĩ", description: "Xem các màn hình nghiệp vụ Tiến sĩ. Dữ liệu học viên liên quan vẫn chịu giới hạn xem theo nhóm." },
  { code: "doctoral.manage", group: "Đào tạo Tiến sĩ", name: "Quản lý nghiệp vụ Tiến sĩ", description: "Quyền quản lý nghiệp vụ Tiến sĩ; chỉ có tác dụng với các chức năng đã triển khai thao tác ghi và kiểm tra quyền này." },

  // ===== Lớp học phần & xếp lịch =====
  { code: "scheduling.view", group: "Lớp học phần & xếp lịch", name: "Xem lớp học phần, lịch học", description: "Xem lớp học phần, danh sách học viên và lịch học trong phạm vi được phép." },
  { code: "scheduling.organize", group: "Lớp học phần & xếp lịch", name: "Tổ chức lớp học phần", description: "Tạo, quản lý và xóa lớp học phần theo điều kiện nghiệp vụ. Không cần được phân công quản lý lịch; quyền sửa lịch học được cấp riêng." },
  { code: "scheduling.write", group: "Lớp học phần & xếp lịch", name: "Xếp, sửa và xác nhận lịch", description: "Tạo, sửa, xóa, xác nhận lịch học và xử lý lịch thi trong phạm vi được phép. Không cần cờ phân công quản lý lịch. Các khóa chỉ xem và giới hạn theo nhóm vẫn có hiệu lực." },
  { code: "scheduling.assign", group: "Lớp học phần & xếp lịch", name: "Phân công người quản lý lịch đào tạo", description: "Chọn người đầu mối phụ trách lịch đào tạo; phân công mới chuyển trách nhiệm từ người cũ. Không tự cấp quyền tạo lớp hoặc sửa lịch; các quyền nghiệp vụ được chọn riêng." },

  // ===== Thi & điểm =====
  { code: "gradebook.view", group: "Thi & điểm", name: "Xem danh sách thi, bảng điểm", description: "Xem danh sách thi và bảng điểm; không tự cho phép nhập điểm hoặc duyệt điểm." },
  { code: "gradebook.submit", group: "Thi & điểm", name: "Nhập và gửi duyệt điểm", description: "Nhập, lưu và gửi duyệt điểm. Cấp thêm quyền xem bảng điểm để thao tác trên giao diện; không bao gồm quyền duyệt hoặc mở lại điểm." },
  { code: "gradebook.approve", group: "Thi & điểm", name: "Duyệt, khóa và mở lại điểm", description: "Duyệt, khóa và mở lại điểm theo quy trình. Cấp thêm quyền xem bảng điểm; không thay thế quyền nhập và gửi duyệt." },
  { code: "gradebook.policy", group: "Thi & điểm", name: "Cấu hình quy chế chấm điểm", description: "Cấu hình quy chế tính điểm và điều kiện đạt. Cần quyền xem nghiệp vụ Thạc sĩ để mở phần cấu hình tương ứng." },
  { code: "studyleave.manage", group: "Thi & điểm", name: "Quản lý bảo lưu", description: "Tiếp nhận và xử lý yêu cầu bảo lưu, gia hạn hoặc kết thúc bảo lưu trong phạm vi được phép. Cấp thêm quyền xem kế hoạch, CTĐT để xem danh sách bảo lưu." },

  // ===== Báo cáo & thống kê =====
  { code: "reports.view", group: "Báo cáo & thống kê", name: "Xem báo cáo", description: "Xem báo cáo, bảng tổng hợp và bảng điểm cá nhân trong phạm vi dữ liệu được phép." },
  { code: "reports.export", group: "Báo cáo & thống kê", name: "Phát hành, xuất báo cáo", description: "Phát hành bảng điểm hoặc xuất báo cáo. Cấp thêm quyền xem báo cáo để sử dụng giao diện; xuất dữ liệu vẫn tuân theo giới hạn nhóm." },

  // ===== Hướng dẫn & phản biện =====
  { code: "supervision.review", group: "Hướng dẫn & phản biện", name: "Duyệt hồ sơ được phân công", description: "Xem và xử lý hồ sơ được phân công hướng dẫn, phản biện. Quyền này khác với phụ trách nhóm và quản lý điểm thi." },

  // ===== Điểm danh =====
  { code: "attendance.view", group: "Điểm danh", name: "Xem điểm danh", description: "Xem bản ghi điểm danh, sự kiện nhận diện và hàng đợi duyệt của lớp được phân quyền." },
  { code: "attendance.enroll", group: "Điểm danh", name: "Đăng ký sinh trắc học", description: "Đăng ký hoặc thay thế template khuôn mặt cho học viên trong roster. Cần có consent hợp lệ." },
  { code: "attendance.record", group: "Điểm danh", name: "Ghi điểm danh", description: "Ghi hoặc sửa điểm danh thủ công và chạy nhận diện tại kiosk cho buổi học được phân quyền." },
  { code: "attendance.review", group: "Điểm danh", name: "Duyệt kết quả nhận diện", description: "Xử lý hàng đợi REVIEW/UNKNOWN: chấp nhận, gán người khác, từ chối hoặc bỏ qua." },
  { code: "attendance.export", group: "Điểm danh", name: "Xuất báo cáo điểm danh", description: "Xuất CSV báo cáo điểm danh của lớp được phân quyền." },
];

export const PERMISSION_CODES: string[] = PERMISSIONS.map((permission) => permission.code);

const VIEW_PERMISSIONS = [
  "catalog.view",
  "plan.view",
  "admission.view",
  "masters.view",
  "doctoral.view",
  "scheduling.view",
  "gradebook.view",
  "reports.view",
  "attendance.view",
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: PERMISSION_CODES,
  supervisor: [
    ...VIEW_PERMISSIONS,
    "supervision.review",
    "scheduling.write",
    "attendance.enroll",
    "attendance.record",
    "attendance.review",
    "attendance.export",
  ],
  examiner: [...VIEW_PERMISSIONS, "scheduling.write", "gradebook.submit", "gradebook.policy"],
};
