import React from "react";
import { Card, CardContent } from "@mui/material";
const Format = () => <Card sx={{ width: "100%", maxWidth: 1000 }}><CardContent sx={{ p: 4 }}>
  <h1>Quy cách, nộp và đánh giá luận văn, luận án</h1>
  <ul className="mt-4">
    <li className="mb-3">Bản thảo phải tuân thủ mẫu trình bày, trích dẫn và danh mục tài liệu tham khảo do Nhà trường ban hành.</li>
    <li className="mb-3">Học viên nộp đúng phiên bản đã được giảng viên hướng dẫn xác nhận.</li>
    <li className="mb-3">Tệp điện tử phải rõ ràng, đầy đủ phụ lục và không chứa thông tin ngoài phạm vi được phép công bố.</li>
    <li className="mb-3">Kết quả đánh giá và yêu cầu chỉnh sửa được cập nhật trong hồ sơ đào tạo.</li>
  </ul>
</CardContent></Card>;
export default Format;
