import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { TrainingPlan } from "./training-plan.model.js";
import { Major } from "../common/major.model.js";
import { TrainingMode } from "../common/training-mode.model.js";
import { Student } from "../student.model.js";

@Table({ tableName: "admission_records", underscored: true, timestamps: true })
export class AdmissionRecord extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @ForeignKey(() => TrainingPlan)
  @Column({ type: DataType.UUID, allowNull: true })
  declare planId: string | null;

  @BelongsTo(() => TrainingPlan)
  declare plan: any;

  @ForeignKey(() => Student)
  @Column({ type: DataType.UUID, allowNull: true })
  declare studentId: string | null;

  @BelongsTo(() => Student)
  declare student: any;

  // 1. THÔNG TIN CÁ NHÂN
  @Column({ type: DataType.STRING(50), allowNull: true })
  declare code: string | null; // Mã HV / Số báo danh

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare lastName: string | null; // Họ đệm

  @Column({ type: DataType.STRING(50), allowNull: true })
  declare firstName: string | null; // Tên

  @Column({ type: DataType.STRING(150), allowNull: false })
  declare fullName: string;

  @Column({ type: DataType.STRING(30), allowNull: true })
  declare dob: string | null; // Ngày sinh

  @Column({ type: DataType.STRING(30), allowNull: true })
  declare idCard: string | null; // Số CMND / CCCD

  @Default("Nam")
  @Column({ type: DataType.STRING(10), allowNull: true })
  declare gender: string | null; // Giới tính

  @Column({ type: DataType.STRING(150), allowNull: true })
  declare email: string;

  @Column({ type: DataType.STRING(30), allowNull: true })
  declare phone: string | null;

  @Column({ type: DataType.STRING(150), allowNull: true })
  declare pob: string | null; // Nơi sinh

  @Column({ type: DataType.STRING(50), allowNull: true })
  declare receiptType: string | null; // Hình thức nhận hồ sơ (Trực tiếp, Bưu điện, Trực tuyến...)

  @Column({ type: DataType.STRING(50), allowNull: true })
  declare profileCategory: string | null; // Phân loại hồ sơ

  @Column({ type: DataType.STRING(30), allowNull: true })
  declare admissionDate: string | null; // Ngày nhập học

  @Column({ type: DataType.TEXT, allowNull: true })
  declare photo: string | null; // Ảnh học viên 3x4 (URL hoặc base64)

  // 2. THỂ THỨC ĐÀO TẠO
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare isExemptForeignLanguage: boolean; // Miễn thi ngoại ngữ

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare trainingModeGroup: string | null; // Nhóm HT đào tạo (Chính quy...)

  @Default("Thạc sĩ")
  @Column({ type: DataType.STRING(50), allowNull: true })
  declare trainingLevel: string | null; // Trình độ đào tạo (Thạc sĩ / Tiến sĩ)

  @ForeignKey(() => TrainingMode)
  @Column({ type: DataType.UUID, allowNull: true })
  declare trainingModeId: string | null;

  @BelongsTo(() => TrainingMode)
  declare trainingMode: any;

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare trainingModeName: string | null; // Tên hình thức đào tạo

  @ForeignKey(() => Major)
  @Column({ type: DataType.UUID, allowNull: true })
  declare majorId: string | null;

  @BelongsTo(() => Major)
  declare major: any;

  @Column({ type: DataType.STRING(150), allowNull: true })
  declare majorName: string | null;

  @Default("Tiếng Việt")
  @Column({ type: DataType.STRING(50), allowNull: true })
  declare language: string | null; // Ngôn ngữ đào tạo

  @Default("Nộp hồ sơ đầu vào")
  @Column({ type: DataType.STRING(50), allowNull: true })
  declare studyStatus: string | null; // Trạng thái học

  @Default("2026")
  @Column({ type: DataType.STRING(10), allowNull: true })
  declare academicYear: string | null; // Năm tuyển sinh

  // 3. THÔNG TIN CHỖ Ở
  @Default("Việt Nam")
  @Column({ type: DataType.STRING(100), allowNull: true })
  declare nationality: string | null; // Quốc tịch

  @Default("Kinh")
  @Column({ type: DataType.STRING(50), allowNull: true })
  declare ethnicity: string | null; // Dân tộc

  @Default("Không")
  @Column({ type: DataType.STRING(50), allowNull: true })
  declare religion: string | null; // Tôn giáo

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare city: string | null; // Thành phố

  @Column({ type: DataType.STRING(150), allowNull: true })
  declare ward: string | null; // Phường xã / Địa chỉ

  // 4. GIẤY TỜ BỔ SUNG
  @Default({})
  @Column({ type: DataType.JSON, allowNull: true })
  declare documents: Record<string, boolean> | null;

  // 5. VĂN BẰNG ĐẠI HỌC (NĂNG LỰC ĐẦU VÀO)
  @Column({ type: DataType.STRING(100), allowNull: true })
  declare priorityObject: string | null; // ĐT Ưu tiên

  @Column({ type: DataType.STRING(200), allowNull: true })
  declare workplace: string | null; // Nơi làm việc

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare job: string | null; // Nghề nghiệp

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare supplementSubjectsCount: number | null; // Số môn BSKT

  @Column({ type: DataType.STRING(200), allowNull: true })
  declare gradSchool: string | null; // Trường TN

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare gradDegreeType: string | null; // Hệ ĐT

  @Column({ type: DataType.STRING(10), allowNull: true })
  declare gradYear: string | null; // Năm TN

  @Column({ type: DataType.STRING(20), allowNull: true })
  declare gpa: string | null; // Điểm TB ĐH

  @Column({ type: DataType.STRING(150), allowNull: true })
  declare gradMajor: string | null; // Chuyên Ngành ĐH

  @Column({ type: DataType.STRING(50), allowNull: true })
  declare gradClassification: string | null; // Loại TN

  @Column({ type: DataType.STRING(50), allowNull: true })
  declare diplomaNumber: string | null; // Số Văn bằng

  @Column({ type: DataType.STRING(50), allowNull: true })
  declare registryBookNumber: string | null; // Số vào sổ gốc

  @Default("pending")
  @Column({ type: DataType.STRING(30), allowNull: false })
  declare status: string; // pending, approved, admitted, rejected

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE })
  declare submittedAt: Date;

  @Column(DataType.TEXT)
  declare note: string | null;

  @Default({})
  @Column({ type: DataType.JSON, allowNull: true })
  declare extraData: Record<string, any> | null;
}
