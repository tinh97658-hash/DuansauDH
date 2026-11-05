import ExcelJS from 'exceljs';
import { createReportExcel, normalizeReport } from '../../utils/reportExport';

it('preserves NT lecturer payment values in the VT Excel form engine', async () => {
  const report = normalizeReport({ title: 'Báo cáo tài chính', sections: [{
    headers: ['STT', 'Giảng viên', 'Lớp học phần', 'Số buổi', 'Ngày hoàn thành', 'Đã thanh toán'],
    rows: [[1, 'Nguyễn An', 'Lớp CNTT — Quản trị dữ liệu', 3, '03/11/2026', 'Đã thanh toán'],
      [2, 'Trần Bình', 'Lớp QTKD', 0, '02/11/2026', 'Chưa thanh toán']],
  }] });
  const blob = await createReportExcel(report);
  const bytes = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob);
  });
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes);
  expect(book.worksheets.map(sheet => sheet.name)).toEqual(['Báo cáo']);
  const values = new Set();
  book.worksheets[0].eachRow(row => row.eachCell(cell => { if (cell.type !== ExcelJS.ValueType.Merge) values.add(String(cell.value)); }));
  for (const value of ['Nguyễn An', 'Trần Bình', 'Lớp CNTT — Quản trị dữ liệu', '3', '0', '03/11/2026', 'Đã thanh toán', 'Chưa thanh toán']) expect(values.has(value)).toBe(true);
});
