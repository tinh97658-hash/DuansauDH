import { snapshotReport } from "../../utils/reportSnapshot";

afterEach(() => { document.body.innerHTML = ""; });

it("exports table values while excluding selections, actions, hidden tables and password fields", () => {
  const root = document.createElement("main"); document.body.appendChild(root);
  root.innerHTML = `<input aria-label="Tìm kiếm" value="Nguyễn"><input type="password" aria-label="Mật khẩu" value="secret">
    <table aria-label="Học viên"><thead><tr><th>Chọn tất cả</th><th>Mã HV</th><th>Ngày sinh</th><th>Điểm</th><th>Thao tác</th></tr></thead>
    <tbody><tr><td><input type="checkbox"></td><td>001</td><td>1995-02-03</td><td><input value="0"></td><td><button>Xóa</button></td></tr></tbody></table>
    <table style="display:none"><thead><tr><th>Bí mật</th></tr></thead><tbody><tr><td>hidden</td></tr></tbody></table>
    <span data-export-pagination>Hiển thị 1–15 trên 30 bản ghi</span>`;
  const report = snapshotReport(root, "Học viên");
  expect(report.sections).toHaveLength(1);
  expect(report.sections[0].headers).toEqual(["Mã HV", "Ngày sinh", "Điểm"]);
  expect(report.sections[0].rows).toEqual([["001", "03/02/1995", "0"]]);
  expect(report.metadata).toContainEqual(["Tìm kiếm", "Nguyễn"]);
  expect(report.metadata).toContainEqual(["Trang", "Hiển thị 1–15 trên 30 bản ghi"]);
  expect(JSON.stringify(report)).not.toMatch(/secret|Mật khẩu|hidden|Xóa/);
});

it("retains multi-row table headings and live selection values", () => {
  const root = document.createElement("main"); document.body.appendChild(root);
  root.innerHTML = `<table><thead><tr><th rowspan="2">Học viên</th><th colspan="2">Điểm</th></tr><tr><th>Kiểm tra</th><th>Thi</th></tr></thead>
    <tbody><tr><td>Nguyễn An</td><td><select><option>A</option><option selected>B</option></select></td><td>0</td></tr></tbody></table>`;
  const section = snapshotReport(root, "Điểm").sections[0];
  expect(section.headers).toEqual(["Học viên", "Điểm / Kiểm tra", "Điểm / Thi"]);
  expect(section.rows[0]).toEqual(["Nguyễn An", "B", "0"]);
});

it("retains every single-column row and expands merged body cells without losing values", () => {
  const root = document.createElement("main"); document.body.appendChild(root);
  root.innerHTML = `<table><thead><tr><th>Ghi chú đầy đủ</th></tr></thead><tbody><tr><td>Nội dung thứ nhất</td></tr><tr><td>Nội dung cuối cùng</td></tr></tbody></table>
    <table><thead><tr><th>Nhóm</th><th>Học phần</th><th>Điểm</th></tr></thead><tbody><tr><td rowspan="2">CNTT26</td><td>Toán</td><td>0</td></tr><tr><td>Văn</td><td>9</td></tr></tbody></table>`;
  const report = snapshotReport(root, "Kế hoạch");
  expect(report.sections[0].rows).toEqual([["Nội dung thứ nhất"], ["Nội dung cuối cùng"]]);
  expect(report.sections[1].rows).toEqual([["CNTT26", "Toán", "0"], ["CNTT26", "Văn", "9"]]);
});
