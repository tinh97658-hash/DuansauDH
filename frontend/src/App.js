import "./App.css";
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box, CircularProgress } from "@mui/material";
import theme from "./theme";
import ProtectedRoute from "./components/ProtectedRoute";

const PageLoader = () => (
  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
    <CircularProgress size={32} sx={{ color: "#0788B8" }} />
  </Box>
);

const Login = lazy(() => import("./pages/loginPage"));
const UserProfile = lazy(() => import("./pages/userProfile"));
const UserProfileView = lazy(() => import("./pages/userProfileView"));
const ReviewTable = lazy(() => import("./pages/reviewTablePage"));
const Submission = lazy(() => import("./pages/submissionDashboard"));
const Admin = lazy(() => import("./pages/adminPage"));
const ProcedurePage = lazy(() => import("./pages/procedurePage"));
const FormatPage = lazy(() => import("./pages/formatPage"));
const ProgressReviewPage = lazy(() => import("./pages/progressReviewPage"));
const AppointmentPage = lazy(() => import("./pages/appointmentPage"));
const AddStaffPage = lazy(() => import("./pages/addStaffPage"));
const ReviewerDashboard = lazy(() => import("./pages/reviewDashboard"));
const FileUploader = lazy(() => import("./pages/fileUploadPage"));
const ViewLoggedPage = lazy(() => import("./pages/viewLogged"));
const StudentDashBoardPage = lazy(() => import("./pages/studentDashboard"));

// ===== HỆ THỐNG =====
const UnitInfo = lazy(() => import("./pages/system/unitInfo"));
const License = lazy(() => import("./pages/system/license"));
const ChangePassword = lazy(() => import("./pages/system/changePassword"));
const Users = lazy(() => import("./pages/system/users"));
const Ethnicities = lazy(() => import("./pages/system/ethnicities"));
const Nationalities = lazy(() => import("./pages/system/nationalities"));
const Wards = lazy(() => import("./pages/system/wards"));
const Cities = lazy(() => import("./pages/system/cities"));
const Lecturers = lazy(() => import("./pages/system/lecturers"));
const Units = lazy(() => import("./pages/system/units"));
const Rooms = lazy(() => import("./pages/system/rooms"));
const Disciplines = lazy(() => import("./pages/system/disciplines"));
const TrainingModeGroups = lazy(() => import("./pages/system/trainingModeGroups"));
const TrainingModes = lazy(() => import("./pages/system/trainingModes"));
const Majors = lazy(() => import("./pages/system/majors"));
const TrainingLevels = lazy(() => import("./pages/system/trainingLevels"));
const StudyStatuses = lazy(() => import("./pages/system/studyStatuses"));
const BridgeKnowledge = lazy(() => import("./pages/system/bridgeKnowledge"));
const CheckUpdate = lazy(() => import("./pages/system/checkUpdate"));

// ===== KẾ HOẠCH KHÓA MỚI =====
const TrainingPlan = lazy(() => import("./pages/plan/trainingPlan"));
const AdmissionTargets = lazy(() => import("./pages/plan/admissionTargets"));
const AnnualFees = lazy(() => import("./pages/plan/annualFees"));
const AdmissionRecords = lazy(() => import("./pages/plan/admissionRecords"));
const AdmissionRecordDetail = lazy(() => import("./pages/plan/admissionRecordDetail"));
const AdmissionPreview = lazy(() => import("./features/admission/AdmissionPreview"));

// ===== ĐÀO TẠO THẠC SĨ =====
const MastersBridgeCourse = lazy(() => import("./pages/masters/bridgeCourse"));
const MastersAdmittedRecords = lazy(() => import("./pages/masters/admittedRecords"));
const MastersAdmissionScores = lazy(() => import("./pages/masters/admissionScores"));
const MastersCreateClassGroups = lazy(() => import("./pages/masters/createClassGroups"));
const MastersAssignClassGroups = lazy(() => import("./pages/masters/assignClassGroups"));
const ClassCourseHistory = lazy(() => import("./pages/masters/classCourseHistory"));
const MastersCourseOfferings = lazy(() => import("./pages/masters/courseOfferings"));
const MastersSchedule = lazy(() => import("./pages/masters/schedule"));
const SchedulePreview = lazy(() => import("./features/scheduling/SchedulePreview"));
const GradebookPreview = lazy(() => import("./features/exams/GradebookPreview"));
const MastersCourseMatrix = lazy(() => import("./pages/masters/courseMatrix"));
const MastersExamEligibility = lazy(() => import("./pages/masters/examEligibility"));
const MastersExamLists = lazy(() => import("./pages/masters/examLists"));
const EnglishExam = lazy(() => import("./pages/masters/englishExam"));
const EnglishScores = lazy(() => import("./pages/masters/englishScores"));
const EnglishCertification = lazy(() => import("./pages/masters/englishCertification"));
const FinalDefense = lazy(() => import("./pages/masters/finalDefense"));
const MastersGraduationDocs = lazy(() => import("./pages/masters/graduationDocs"));

// ===== ĐÀO TẠO TIẾN SĨ =====
const DoctoralAdmissionScores = lazy(() => import("./pages/doctoral/admissionScores"));
const DoctoralCreateClassGroups = lazy(() => import("./pages/doctoral/createClassGroups"));
const DoctoralAssignClassGroups = lazy(() => import("./pages/doctoral/assignClassGroups"));
const DoctoralExamEligibility = lazy(() => import("./pages/doctoral/examEligibility"));
const ExamScores = lazy(() => import("./pages/doctoral/examScores"));
const DoctoralExamLists = lazy(() => import("./pages/doctoral/examLists"));
const OverviewTopics = lazy(() => import("./pages/doctoral/overviewTopics"));
const UniversityWorkshops = lazy(() => import("./pages/doctoral/universityWorkshops"));
const FacultyDefense = lazy(() => import("./pages/doctoral/facultyDefense"));
const ClosedReview = lazy(() => import("./pages/doctoral/closedReview"));
const UniversityDefense = lazy(() => import("./pages/doctoral/universityDefense"));
const DoctoralGraduationDocs = lazy(() => import("./pages/doctoral/graduationDocs"));

// ===== BÁO CÁO =====
const ClassLists = lazy(() => import("./pages/reports/classLists"));
const CourseScores = lazy(() => import("./pages/reports/courseScores"));
const ClassScoreSummary = lazy(() => import("./pages/reports/classScoreSummary"));
const LearnerTranscriptPreview = lazy(() => import("./features/learners/LearnerTranscriptPreview"));
const StudyLeaves = lazy(() => import("./pages/masters/studyLeaves"));
const MinisterialReport = lazy(() => import("./pages/reports/ministerialReport"));
const TempScoreMasters = lazy(() => import("./pages/reports/tempScoreMasters"));
const TempScoreDoctoral = lazy(() => import("./pages/reports/tempScoreDoctoral"));
const DiplomaAppendixMasters = lazy(() => import("./pages/reports/diplomaAppendixMasters"));
const DiplomaAppendixDoctoral = lazy(() => import("./pages/reports/diplomaAppendixDoctoral"));

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
              <Route path="addStaff" element={<AddStaffPage />} />
              <Route path="reviewer" element={<ReviewerDashboard />} />
              <Route path="reviewTable" element={<ReviewTable />} />
              <Route path="fileUpload" element={<FileUploader />} />
              <Route path="studentDashboard" element={<StudentDashBoardPage />} />

              {/* HỆ THỐNG */}
              <Route path="system/unit-info" element={<UnitInfo />} />
              <Route path="system/license" element={<License />} />
              <Route path="system/change-password" element={<ChangePassword />} />
              <Route path="system/users" element={<Users />} />
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
