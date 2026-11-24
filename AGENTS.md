# Quy tắc dự án — Bảo mật dữ liệu

- Mọi tác vụ liên quan đến dữ liệu (tạo/sửa model Sequelize, migration, DTO, controller/API, serializer, báo cáo/export hoặc audit log) **bắt buộc** đọc và tuân thủ skill `data-security-classification` tại `.agents/skills/data-security-classification/SKILL.md`.
- Không được trả về bất kỳ trường dữ liệu **Cấp 5 (Credentials/Secrets)** nào qua API hoặc ghi nguyên bản vào log; mọi trường bí mật mới phải được bổ sung vào `backend/src/audit/credential-redaction.ts`.
- Khi phân vân giữa hai cấp độ bảo mật cho một trường dữ liệu mới, luôn mặc định chọn cấp độ cao hơn.
