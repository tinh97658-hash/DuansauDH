export const CODE_PERMISSIONS = [
  ['config.view','Xem cấu hình mã học viên'], ['config.manage','Cấu hình loại hồ sơ và quy tắc mã'],
  ['type.assign','Gán loại hồ sơ trước cấp mã'], ['preview','Xem trước mã học viên'],
  ['issue','Cấp mã học viên mới'], ['reissue','Đổi mã học viên đã cấp'],
  ['type.change','Đổi loại hồ sơ đã cấp mã'], ['counter.advance','Tăng số tiếp theo của bộ đếm'],
  ['history.view','Xem lịch sử mã học viên'],
].map(([suffix,name]) => ({ code: `learnercode.${suffix}`, name, group: 'Mã học viên',
  description: `${name}. Tuân theo hồ sơ làm việc và phạm vi dữ liệu được cấp.` }));
