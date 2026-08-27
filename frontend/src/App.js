import "./App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "./theme";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/loginPage";
import UserProfile from "./pages/userProfile";
import UserProfileView from "./pages/userProfileView";
import ReviewTable from "./pages/reviewTablePage";
import Submission from "./pages/submissionDashboard";
import Admin from "./pages/adminPage";
import ProcedurePage from "./pages/procedurePage";
import FormatPage from "./pages/formatPage";
import ProgressReviewPage from "./pages/progressReviewPage";
import AppointmentPage from "./pages/appointmentPage";
import AddStaffPage from "./pages/addStaffPage";
import ReviewerDashboard from "./pages/reviewDashboard";
import FileUploader from "./pages/fileUploadPage";
import ViewLoggedPage from "./pages/viewLogged";
import StudentDashBoardPage from "./pages/studentDashboard";

// ===== HỆ THỐNG =====
import UnitInfo from "./pages/system/unitInfo";
import License from "./pages/system/license";
import ChangePassword from "./pages/system/changePassword";
import Users from "./pages/system/users";
import Ethnicities from "./pages/system/ethnicities";
import Nationalities from "./pages/system/nationalities";
import Wards from "./pages/system/wards";
import Cities from "./pages/system/cities";
import Lecturers from "./pages/system/lecturers";
import TrainingModeGroups from "./pages/system/trainingModeGroups";
import TrainingModes from "./pages/system/trainingModes";
import Majors from "./pages/system/majors";
import TrainingLevels from "./pages/system/trainingLevels";
import StudyStatuses from "./pages/system/studyStatuses";
import BridgeKnowledge from "./pages/system/bridgeKnowledge";
import CheckUpdate from "./pages/system/checkUpdate";

// ===== KẾ HOẠCH KHÓA MỚI =====
import TrainingPlan from "./pages/plan/trainingPlan";
import AdmissionTargets from "./pages/plan/admissionTargets";
import AnnualFees from "./pages/plan/annualFees";
import AdmissionRecords from "./pages/plan/admissionRecords";
import AdmissionRecordDetail from "./pages/plan/admissionRecordDetail";

// ===== ĐÀO TẠO THẠC SĨ =====
import MastersBridgeCourse from "./pages/masters/bridgeCourse";
import MastersAdmissionScores from "./pages/masters/admissionScores";
import MastersCreateClassGroups from "./pages/masters/createClassGroups";
import MastersAssignClassGroups from "./pages/masters/assignClassGroups";
import MastersExamEligibility from "./pages/masters/examEligibility";
import MastersExamLists from "./pages/masters/examLists";
import EnglishExam from "./pages/masters/englishExam";
import EnglishScores from "./pages/masters/englishScores";
import EnglishCertification from "./pages/masters/englishCertification";
import FinalDefense from "./pages/masters/finalDefense";
import MastersGraduationDocs from "./pages/masters/graduationDocs";

// ===== ĐÀO TẠO TIẾN SĨ =====
import DoctoralAdmissionScores from "./pages/doctoral/admissionScores";
import DoctoralCreateClassGroups from "./pages/doctoral/createClassGroups";
import DoctoralAssignClassGroups from "./pages/doctoral/assignClassGroups";
import DoctoralExamEligibility from "./pages/doctoral/examEligibility";
import ExamScores from "./pages/doctoral/examScores";
import DoctoralExamLists from "./pages/doctoral/examLists";
import OverviewTopics from "./pages/doctoral/overviewTopics";
import UniversityWorkshops from "./pages/doctoral/universityWorkshops";
import FacultyDefense from "./pages/doctoral/facultyDefense";
import ClosedReview from "./pages/doctoral/closedReview";
import UniversityDefense from "./pages/doctoral/universityDefense";
import DoctoralGraduationDocs from "./pages/doctoral/graduationDocs";

// ===== BÁO CÁO =====
import ClassLists from "./pages/reports/classLists";
import CourseScores from "./pages/reports/courseScores";
import ClassScoreSummary from "./pages/reports/classScoreSummary";
import MinisterialReport from "./pages/reports/ministerialReport";
import TempScoreMasters from "./pages/reports/tempScoreMasters";
import TempScoreDoctoral from "./pages/reports/tempScoreDoctoral";
import DiplomaAppendixMasters from "./pages/reports/diplomaAppendixMasters";
import DiplomaAppendixDoctoral from "./pages/reports/diplomaAppendixDoctoral";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
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
            <Route path="system/training-mode-groups" element={<TrainingModeGroups />} />
            <Route path="system/training-modes" element={<TrainingModes />} />
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
            <Route path="plan/admission-records/:id" element={<AdmissionRecordDetail />} />
            <Route path="plan/admission-records/detail/:id" element={<AdmissionRecordDetail />} />

            {/* ĐÀO TẠO THẠC SĨ */}
            <Route path="masters/bridge-course" element={<MastersBridgeCourse />} />
            <Route path="masters/admission-scores" element={<MastersAdmissionScores />} />
            <Route path="masters/create-class-groups" element={<MastersCreateClassGroups />} />
            <Route path="masters/assign-class-groups" element={<MastersAssignClassGroups />} />
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
            <Route path="reports/ministerial-report" element={<MinisterialReport />} />
            <Route path="reports/temp-score-masters" element={<TempScoreMasters />} />
            <Route path="reports/temp-score-doctoral" element={<TempScoreDoctoral />} />
            <Route path="reports/diploma-appendix-masters" element={<DiplomaAppendixMasters />} />
            <Route path="reports/diploma-appendix-doctoral" element={<DiplomaAppendixDoctoral />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
