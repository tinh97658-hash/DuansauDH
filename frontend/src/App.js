import "./App.css";
import React, { Suspense } from "react";
import { lazyPage } from "./utils/lazyPage";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box, CircularProgress } from "@mui/material";
import theme from "./theme";
import ProtectedRoute from "./components/ProtectedRoute";

const PageLoader = () => (
  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
    <CircularProgress size={32} sx={{ color: "#0788B8" }} />
  </Box>
);

const Login = lazyPage(() => import("./pages/loginPage"), ["/login"]);
const UserProfile = lazyPage(() => import("./pages/userProfile"), ["/profile"]);
const UserProfileView = lazyPage(() => import("./pages/userProfileView"), ["/profileView"]);
const ReviewTable = lazyPage(() => import("./pages/reviewTablePage"), ["/reviewTable"]);
const Submission = lazyPage(() => import("./pages/submissionDashboard"), ["/submission"]);
const Admin = lazyPage(() => import("./pages/adminPage"), ["/admin"]);
const ProcedurePage = lazyPage(() => import("./pages/procedurePage"), ["/procedure"]);
const FormatPage = lazyPage(() => import("./pages/formatPage"), ["/format"]);
const ProgressReviewPage = lazyPage(() => import("./pages/progressReviewPage"), ["/progressReview"]);
const AppointmentPage = lazyPage(() => import("./pages/appointmentPage"), ["/appointment"]);
const ReviewerDashboard = lazyPage(() => import("./pages/reviewDashboard"), ["/reviewer"]);
const FileUploader = lazyPage(() => import("./pages/fileUploadPage"), ["/fileUpload"]);
const ViewLoggedPage = lazyPage(() => import("./pages/viewLogged"), ["/","/viewLogged"]);
const StudentDashBoardPage = lazyPage(() => import("./pages/studentDashboard"), ["/studentDashboard"]);

// ===== HỆ THỐNG =====
const UnitInfo = lazyPage(() => import("./pages/system/unitInfo"), ["/system/unit-info"]);
const License = lazyPage(() => import("./pages/system/license"), ["/system/license"]);
const ChangePassword = lazyPage(() => import("./pages/system/changePassword"), ["/system/change-password"]);
const Accounts = lazyPage(() => import("./pages/system/accounts"), ["/system/accounts"]);
const Roles = lazyPage(() => import("./pages/system/roles"), ["/system/roles"]);
const AuditLogs = lazyPage(() => import("./pages/system/auditLogs"), ["/system/audit-logs"]);
const Ethnicities = lazyPage(() => import("./pages/system/ethnicities"), ["/system/ethnicities"]);
const Nationalities = lazyPage(() => import("./pages/system/nationalities"), ["/system/nationalities"]);
const Wards = lazyPage(() => import("./pages/system/wards"), ["/system/wards"]);
const Cities = lazyPage(() => import("./pages/system/cities"), ["/system/cities"]);
const Lecturers = lazyPage(() => import("./pages/system/lecturers"), ["/system/lecturers"]);
const Units = lazyPage(() => import("./pages/system/units"), ["/system/units"]);
const Rooms = lazyPage(() => import("./pages/system/rooms"), ["/system/rooms"]);
const Disciplines = lazyPage(() => import("./pages/system/disciplines"), ["/system/disciplines"]);
const TrainingModeGroups = lazyPage(() => import("./pages/system/trainingModeGroups"), ["/system/training-mode-groups"]);
const TrainingModes = lazyPage(() => import("./pages/system/trainingModes"), ["/system/training-modes"]);
const Majors = lazyPage(() => import("./pages/system/majors"), ["/system/majors"]);
const TrainingLevels = lazyPage(() => import("./pages/system/trainingLevels"), ["/system/training-levels"]);
const StudyStatuses = lazyPage(() => import("./pages/system/studyStatuses"), ["/system/study-statuses"]);
const BridgeKnowledge = lazyPage(() => import("./pages/system/bridgeKnowledge"), ["/system/bridge-knowledge"]);
const CheckUpdate = lazyPage(() => import("./pages/system/checkUpdate"), ["/system/check-update"]);

// ===== KẾ HOẠCH KHÓA MỚI =====
const TrainingPlan = lazyPage(() => import("./pages/plan/trainingPlan"), ["/plan/training-plan"]);
const AdmissionTargets = lazyPage(() => import("./pages/plan/admissionTargets"), ["/plan/admission-targets"]);
const AnnualFees = lazyPage(() => import("./pages/plan/annualFees"), ["/plan/annual-fees"]);
const AdmissionRecords = lazyPage(() => import("./pages/plan/admissionRecords"), ["/plan/admission-records"]);
const AdmissionRecordDetail = lazyPage(() => import("./pages/plan/admissionRecordDetail"), ["/plan/admission-records/:id","/plan/admission-records/detail/:id","/masters/admitted-records/:id","/masters/study-leaves/:id"]);
const AdmissionPreview = lazyPage(() => import("./features/admission/AdmissionPreview"), ["/plan/admission-records/preview"]);

// ===== ĐÀO TẠO THẠC SĨ =====
const MastersBridgeCourse = lazyPage(() => import("./pages/masters/bridgeCourse"), ["/masters/bridge-course"]);
const MastersAdmittedRecords = lazyPage(() => import("./pages/masters/admittedRecords"), ["/masters/admitted-records"]);
const MastersAdmissionScores = lazyPage(() => import("./pages/masters/admissionScores"), ["/masters/admission-scores"]);
const MastersCreateClassGroups = lazyPage(() => import("./pages/masters/createClassGroups"), ["/masters/create-class-groups"]);
const MastersAssignClassGroups = lazyPage(() => import("./pages/masters/assignClassGroups"), ["/masters/assign-class-groups"]);
const ClassCourseHistory = lazyPage(() => import("./pages/masters/classCourseHistory"), ["/masters/class-course-history"]);
const MastersCourseOfferings = lazyPage(() => import("./pages/masters/courseOfferings"), ["/masters/course-offerings"]);
const MastersSchedule = lazyPage(() => import("./pages/masters/schedule"), ["/masters/schedule"]);
const SchedulePreview = lazyPage(() => import("./features/scheduling/SchedulePreview"), ["/masters/schedule/preview"]);
const GradebookPreview = lazyPage(() => import("./features/exams/GradebookPreview"), ["/masters/exam-lists/preview"]);
const MastersCourseMatrix = lazyPage(() => import("./pages/masters/courseMatrix"), ["/masters/course-matrix"]);
const MastersExamEligibility = lazyPage(() => import("./pages/masters/examEligibility"), ["/masters/exam-eligibility"]);
const MastersExamLists = lazyPage(() => import("./pages/masters/examLists"), ["/masters/exam-lists"]);
const MastersExamSchedule = lazyPage(() => import('./pages/masters/examSchedule'), ['/masters/exam-schedule']);
const EnglishExam = lazyPage(() => import("./pages/masters/englishExam"), ["/masters/english-exam"]);
const EnglishScores = lazyPage(() => import("./pages/masters/englishScores"), ["/masters/english-scores"]);
const EnglishCertification = lazyPage(() => import("./pages/masters/englishCertification"), ["/masters/english-certification"]);
const FinalDefense = lazyPage(() => import("./pages/masters/finalDefense"), ["/masters/final-defense"]);
const MastersGraduationDocs = lazyPage(() => import("./pages/masters/graduationDocs"), ["/masters/graduation-docs"]);

// ===== ĐÀO TẠO TIẾN SĨ =====
const DoctoralAdmissionScores = lazyPage(() => import("./pages/doctoral/admissionScores"), ["/doctoral/admission-scores"]);
const DoctoralCreateClassGroups = lazyPage(() => import("./pages/doctoral/createClassGroups"), ["/doctoral/create-class-groups"]);
const DoctoralAssignClassGroups = lazyPage(() => import("./pages/doctoral/assignClassGroups"), ["/doctoral/assign-class-groups"]);
const DoctoralExamEligibility = lazyPage(() => import("./pages/doctoral/examEligibility"), ["/doctoral/exam-eligibility"]);
const ExamScores = lazyPage(() => import("./pages/doctoral/examScores"), ["/doctoral/exam-scores"]);
const DoctoralExamLists = lazyPage(() => import("./pages/doctoral/examLists"), ["/doctoral/exam-lists"]);
const OverviewTopics = lazyPage(() => import("./pages/doctoral/overviewTopics"), ["/doctoral/overview-topics"]);
const UniversityWorkshops = lazyPage(() => import("./pages/doctoral/universityWorkshops"), ["/doctoral/university-workshops"]);
const FacultyDefense = lazyPage(() => import("./pages/doctoral/facultyDefense"), ["/doctoral/faculty-defense"]);
const ClosedReview = lazyPage(() => import("./pages/doctoral/closedReview"), ["/doctoral/closed-review"]);
const UniversityDefense = lazyPage(() => import("./pages/doctoral/universityDefense"), ["/doctoral/university-defense"]);
const DoctoralGraduationDocs = lazyPage(() => import("./pages/doctoral/graduationDocs"), ["/doctoral/graduation-docs"]);

// ===== BÁO CÁO =====
const ClassLists = lazyPage(() => import("./pages/reports/classLists"), ["/reports/class-lists"]);
const CourseScores = lazyPage(() => import("./pages/reports/courseScores"), ["/reports/course-scores"]);
const ClassScoreSummary = lazyPage(() => import("./pages/reports/classScoreSummary"), ["/reports/class-score-summary"]);
const LearnerTranscriptPreview = lazyPage(() => import("./features/learners/LearnerTranscriptPreview"), ["/reports/learner-transcript/preview"]);
const StudyLeaves = lazyPage(() => import("./pages/masters/studyLeaves"), ["/masters/study-leaves"]);
const MinisterialReport = lazyPage(() => import("./pages/reports/ministerialReport"), ["/reports/ministerial-report"]);
const TempScoreMasters = lazyPage(() => import("./pages/reports/tempScoreMasters"), ["/reports/temp-score-masters"]);
const TempScoreDoctoral = lazyPage(() => import("./pages/reports/tempScoreDoctoral"), ["/reports/temp-score-doctoral"]);
const DiplomaAppendixMasters = lazyPage(() => import("./pages/reports/diplomaAppendixMasters"), ["/reports/diploma-appendix-masters"]);
const DiplomaAppendixDoctoral = lazyPage(() => import("./pages/reports/diplomaAppendixDoctoral"), ["/reports/diploma-appendix-doctoral"]);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route index element={<ViewLoggedPage />} />
              <Route path="viewLogged" element={<ViewLoggedPage />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="profileView" element={<UserProfileView />} />
              <Route path="submission" element={<Submission />} />
              <Route path="admin" element={<Admin />} />
              <Route path="procedure" element={<ProcedurePage />} />
              <Route path="format" element={<FormatPage />} />
              <Route path="progressReview" element={<ProgressReviewPage />} />
              <Route path="appointment" element={<AppointmentPage />} />
              <Route path="reviewer" element={<ReviewerDashboard />} />
              <Route path="reviewTable" element={<ReviewTable />} />
              <Route path="fileUpload" element={<FileUploader />} />
              <Route path="studentDashboard" element={<StudentDashBoardPage />} />

              {/* HỆ THỐNG */}
              <Route path="system/unit-info" element={<UnitInfo />} />
              <Route path="system/license" element={<License />} />
              <Route path="system/change-password" element={<ChangePassword />} />
              <Route path="system/accounts" element={<Accounts />} />
              <Route path="system/roles" element={<Roles />} />
              <Route path="system/audit-logs" element={<AuditLogs />} />
              <Route path="system/users" element={<Navigate to="/system/accounts" replace />} />
              <Route path="system/ethnicities" element={<Ethnicities />} />
              <Route path="system/nationalities" element={<Nationalities />} />
              <Route path="system/wards" element={<Wards />} />
              <Route path="system/cities" element={<Cities />} />
              <Route path="system/lecturers" element={<Lecturers />} />
              <Route path="system/units" element={<Units />} />
              <Route path="system/rooms" element={<Rooms />} />
              <Route path="system/training-mode-groups" element={<TrainingModeGroups />} />
              <Route path="system/training-modes" element={<TrainingModes />} />
              <Route path="system/disciplines" element={<Disciplines />} />
              <Route path="system/majors" element={<Majors />} />
              <Route path="system/training-levels" element={<TrainingLevels />} />
              <Route path="system/study-statuses" element={<StudyStatuses />} />
              <Route path="system/bridge-knowledge" element={<BridgeKnowledge />} />
              <Route path="system/check-update" element={<CheckUpdate />} />

              {/* KẾ HOẠCH KHÓA MỚI */}
              <Route path="plan/training-plan" element={<TrainingPlan />} />
              <Route path="plan/admission-targets" element={<AdmissionTargets />} />
              <Route path="plan/annual-fees" element={<AnnualFees />} />
              <Route path="plan/admission-records" element={<AdmissionRecords />} />
              <Route path="plan/admission-records/preview" element={<AdmissionPreview />} />
              <Route path="plan/admission-records/:id" element={<AdmissionRecordDetail />} />
              <Route path="plan/admission-records/detail/:id" element={<AdmissionRecordDetail />} />

              {/* ĐÀO TẠO THẠC SĨ */}
              <Route path="masters/admitted-records" element={<MastersAdmittedRecords />} />
              <Route path="masters/study-leaves" element={<StudyLeaves />} />
              <Route path="masters/study-leaves/:id" element={<AdmissionRecordDetail returnPath="/masters/study-leaves" />} />
              <Route path="masters/admitted-records/:id" element={<AdmissionRecordDetail returnPath="/masters/admitted-records" />} />
              <Route path="masters/bridge-course" element={<MastersBridgeCourse />} />
              <Route path="masters/admission-scores" element={<MastersAdmissionScores />} />
              <Route path="masters/create-class-groups" element={<MastersCreateClassGroups />} />
              <Route path="masters/assign-class-groups" element={<MastersAssignClassGroups />} />
              <Route path="masters/class-course-history" element={<ClassCourseHistory />} />
              <Route path="masters/course-offerings" element={<MastersCourseOfferings />} />
              <Route path="masters/schedule" element={<MastersSchedule />} />
              <Route path="masters/schedule/preview" element={<SchedulePreview />} />
              <Route path="masters/exam-lists/preview" element={<GradebookPreview />} />
              <Route path="masters/course-matrix" element={<MastersCourseMatrix />} />
              <Route path="masters/exam-eligibility" element={<MastersExamEligibility />} />
              <Route path="masters/exam-lists" element={<MastersExamLists />} />
              <Route path="masters/exam-schedule" element={<MastersExamSchedule />} />
              <Route path="masters/english-exam" element={<EnglishExam />} />
              <Route path="masters/english-scores" element={<EnglishScores />} />
              <Route path="masters/english-certification" element={<EnglishCertification />} />
              <Route path="masters/final-defense" element={<FinalDefense />} />
              <Route path="masters/graduation-docs" element={<MastersGraduationDocs />} />

              {/* ĐÀO TẠO TIẾN SĨ */}
              <Route path="doctoral/admission-scores" element={<DoctoralAdmissionScores />} />
              <Route path="doctoral/create-class-groups" element={<DoctoralCreateClassGroups />} />
              <Route path="doctoral/assign-class-groups" element={<DoctoralAssignClassGroups />} />
              <Route path="doctoral/exam-eligibility" element={<DoctoralExamEligibility />} />
              <Route path="doctoral/exam-scores" element={<ExamScores />} />
              <Route path="doctoral/exam-lists" element={<DoctoralExamLists />} />
              <Route path="doctoral/overview-topics" element={<OverviewTopics />} />
              <Route path="doctoral/university-workshops" element={<UniversityWorkshops />} />
              <Route path="doctoral/faculty-defense" element={<FacultyDefense />} />
              <Route path="doctoral/closed-review" element={<ClosedReview />} />
              <Route path="doctoral/university-defense" element={<UniversityDefense />} />
              <Route path="doctoral/graduation-docs" element={<DoctoralGraduationDocs />} />

              {/* BÁO CÁO */}
              <Route path="reports/class-lists" element={<ClassLists />} />
              <Route path="reports/course-scores" element={<CourseScores />} />
              <Route path="reports/class-score-summary" element={<ClassScoreSummary />} />
              <Route path="reports/learner-transcript/preview" element={<LearnerTranscriptPreview />} />
              <Route path="reports/ministerial-report" element={<MinisterialReport />} />
              <Route path="reports/temp-score-masters" element={<TempScoreMasters />} />
              <Route path="reports/temp-score-doctoral" element={<TempScoreDoctoral />} />
              <Route path="reports/diploma-appendix-masters" element={<DiplomaAppendixMasters />} />
              <Route path="reports/diploma-appendix-doctoral" element={<DiplomaAppendixDoctoral />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
