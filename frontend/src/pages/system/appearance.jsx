import React from "react";
import { Alert, Button, FormControl, FormControlLabel, FormLabel, Paper, Radio, RadioGroup } from "@mui/material";
import FeatureLayout from "../../components/FeatureLayout";
import { FONT_SIZE_OPTIONS, useAppearanceSettings } from "../../context/AppearanceSettings";
import "./appearance.css";

export default function Appearance() {
  const { fontSize, setFontSize, storageError } = useAppearanceSettings();
  return <FeatureLayout title="Cài đặt giao diện" group="Cài đặt hệ thống" exportConfig={false}>
    <Paper variant="outlined" className="appearance-settings" component="section" aria-labelledby="appearance-title">
      <h1 id="appearance-title">Cài đặt giao diện</h1>
      <p>Điều chỉnh cỡ chữ để đọc và thao tác thuận tiện hơn.</p>
      <FormControl component="fieldset">
        <FormLabel component="legend" id="font-size-label">Cỡ chữ</FormLabel>
        <RadioGroup aria-labelledby="font-size-label" value={fontSize} onChange={event => setFontSize(event.target.value)}>
          {FONT_SIZE_OPTIONS.map(option => <FormControlLabel key={option.value} value={option.value} control={<Radio size="small" />} label={option.label} />)}
        </RadioGroup>
      </FormControl>
      <p role="status">Đang áp dụng: {FONT_SIZE_OPTIONS.find(option => option.value === fontSize).label}.</p>
      {storageError && <Alert severity="warning">Trình duyệt không cho lưu cài đặt. Cỡ chữ chỉ được áp dụng trong phiên hiện tại.</Alert>}
      <section className="appearance-preview" aria-label="Xem trước cỡ chữ">
        <h2>Xem trước</h2>
        <div className="appearance-preview-scroll">
          <table><colgroup><col style={{ width: "30%" }} /><col /></colgroup><thead><tr><th>Mã học viên</th><th>Họ tên / Chuyên ngành</th></tr></thead>
            <tbody><tr><td>HV20260001</td><td>Nguyễn Thị Minh Anh — Quản lý kinh tế và tổ chức vận tải biển</td></tr></tbody>
          </table>
        </div>
      </section>
      <Button variant="outlined" disabled={fontSize === 100} onClick={() => setFontSize(100)}>Khôi phục mặc định</Button>
      <p className="appearance-note">Thay đổi có hiệu lực ngay và được lưu trên trình duyệt này. Nội dung dài được xuống dòng trong ô; vùng một dòng giữ giới hạn hiển thị. Cỡ chữ của biểu mẫu in và tệp xuất được giữ theo mẫu.</p>
    </Paper>
  </FeatureLayout>;
}
