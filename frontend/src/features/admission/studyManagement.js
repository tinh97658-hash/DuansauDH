export const STUDY_STATUS_OPTIONS = [
  'Nộp hồ sơ đầu vào',
  'Đang học',
  'Thôi học',
  'Bảo lưu',
  'Đã tốt nghiệp',
  'Xoá tên',
];

export const studyManagementStatuses = [
  'Bảo lưu', 'Đang bảo lưu', 'Bảo lưu quá hạn', 'Thôi học', 'Tạm hoãn', 'Từ chối',
];

export const isStudyManagementStatus = status => studyManagementStatuses.includes(status) || status === 'Đã thôi học';
export const studyManagementStatusLabel = status => status === 'Đã thôi học' ? 'Thôi học' : status;
