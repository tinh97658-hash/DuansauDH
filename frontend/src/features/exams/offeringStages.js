export const stageGroups = [
  'ĐANG GIẢNG DẠY', 'ĐIỂM THÀNH PHẦN & TƯ CÁCH THI',
  'THI & NHẬP ĐIỂM THI', 'DUYỆT & HOÀN TẤT', 'CẦN RÀ SOÁT',
];
export const offeringStages = {
  teaching: { group: 0, order: 0, label: 'Đang giảng dạy', tone: 'teal' },
  components_missing: { group: 1, order: 1, label: 'Thiếu điểm TP', tone: 'warm' },
  eligibility_ready: { group: 1, order: 2, label: 'Chờ gửi duyệt tư cách', tone: 'neutral' },
  eligibility_pending: { group: 1, order: 3, label: 'Chờ duyệt tư cách', tone: 'blue' },
  awaiting_exam: { group: 2, order: 4, label: 'Chờ xếp lịch / tổ chức thi', tone: 'warm' },
  exam_missing: { group: 2, order: 5, label: 'Thiếu điểm thi', tone: 'warm' },
  result_ready: { group: 3, order: 6, label: 'Chờ gửi duyệt kết quả', tone: 'neutral' },
  result_pending: { group: 3, order: 7, label: 'Chờ duyệt / khóa điểm', tone: 'warm' },
  completed: { group: 3, order: 8, label: 'Đã hoàn tất', tone: 'green' },
  review: { group: 4, order: 9, label: 'Cần rà soát', tone: 'neutral' },
};
export const stageOf = offering => offeringStages[offering.gradebookStage]
  || (offering.status === 'active' ? offeringStages.teaching : offeringStages.review);
const names = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
export const sortOfferingChoices = choices => [...choices].sort((a, b) =>
  stageOf(a.offering).order - stageOf(b.offering).order
  || names.compare(a.offering.name || a.subject?.name || '', b.offering.name || b.subject?.name || '')
  || names.compare(a.group.code || a.group.name || '', b.group.code || b.group.name || '')
  || String(a.offering.id).localeCompare(String(b.offering.id)));
