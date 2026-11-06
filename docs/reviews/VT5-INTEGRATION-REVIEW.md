# vt5 integration review — 2026-10-19

The integration is resolved and staged for review. The merge is **not committed**. Live database/session verification remains pending because the configured DEV PostgreSQL connection refuses connections and Docker Desktop's Linux engine is unavailable. No database changes were made.

## Checkpoint and Git base

- Branch: `nguyentrang9` (tracking configuration remains `origin/vt4`).
- Original HEAD and merge-base before checkpoint: `5398b124c01bd7b4055d5ddac8c7d08800944783`.
- The original tree was dirty: 17 modified tracked files and additional untracked Dashboard, Grouping, test, documentation, and DEV fixture files.
- Authorized local checkpoint: `957e5c509936aafd962567229ed499fc1b0df2e4`.
- Exact message: `checkpoint: preserve local dashboard and grouping work before vt5 integration`.
- Checkpoint contained all original local work (48 files changed); its working tree was clean before merging.
- Fetched and verified `origin/vt5`: `f20282bfd753106c1009e548fd318d86645105f3`.
- Executed `git merge --no-commit --no-ff origin/vt5`.
- HEAD remains the checkpoint; MERGE_HEAD is the verified vt5 SHA. No final merge commit, push, stash, reset, revert, or destructive restore was used.

## vt5 adopted

Adopted vt5 RBAC, effective permission/session infrastructure, accounts, roles, permission catalog, audit/change logs, academic lifecycle and gradebook workflows, scheduling, admission, study leave, reporting, performance changes, database models/migrations, lazy page loading, global theme (including severity-aware Alert icons), ribbon, filters, and global table styles.

`backend/package.json` and `frontend/package-lock.json` match vt5. No protected feature required additional dependencies; no install was necessary with the installed dependencies.

The unrelated local DEV data/reset/seed feature was excluded from the integration result: three `dev-postgraduate-*` source files, its unit test, two DEV data documents, and its npm scripts. These remain recoverable in the checkpoint. No seed/reset command was executed. Existing Dashboard/Grouping design and QA documentation remains available as history.

## All 12 overlapping files

| File | Git conflict? | Resolution and reason |
|---|---|---|
| `backend/package.json` | Yes | **VT5**. Competing additions to the script list. Retain vt5 auth/VMU scripts; omit unrelated local DEV tooling. Dependencies already cover Dashboard. |
| `backend/src/app.module.ts` | No | **MANUAL review of automatic combination**. Verified vt5 Accounts, Roles, RBAC, Audit modules and audit middleware coexist with the local DashboardModule. No duplicate imports or registrations. |
| `backend/src/scheduling/scheduling.service.ts` | No | **MANUAL combination**. vt5 service plus the local exact incomplete-offering ID needed by Dashboard grade deep links. No other local scheduling behavior retained. |
| `backend/test/unit/scheduling.service.spec.ts` | No | **MANUAL combination**. vt5 tests plus the assertion for Dashboard's exact incomplete-offering ID. |
| `frontend/src/features/scheduling/Schedule.jsx` | No | **MANUAL combination**. vt5 scheduling UI plus Dashboard URL year/major/discipline scope, unscheduled/pending queue filters, and scoped pending-drawer entry. These are protected Dashboard link consumers. |
| `frontend/src/pages/masters/assignClassGroups.css` | No | **MANUAL semantic combination**. Preserve every local layout rule; integrate vt5's three sticky action-column token changes. Reviewed the automatic merge; no whole-file side selection. |
| `frontend/src/pages/masters/assignClassGroups.jsx` | Yes | **LOCAL functionality + VT5 icon imports**. Resolve competing selection-bar/table/filter hunks to the local Summary, assignment, five-column table and full-selection behavior. Avoid duplicate scope definitions. Retain local DOB display, required by the protected regression suite. |
| `frontend/src/pages/masters/createClassGroups.jsx` | Yes | **MANUAL combination**. Local shared dialog and existing scope/return behavior plus vt5 `masters.manage` effective permission check, direct icon imports, and loading guard. Conflict overlapped local quick-create scope declarations with vt5 majors-loading state; both are needed. Assignment itself continues to create in place. |
| `frontend/src/pages/masters/examLists.jsx` | Yes | **MANUAL combination**. vt5 grade workflow, loading, and effective-permission behavior plus only Dashboard's validated gradebook scope initialization. Remove stale local auth/role state references. |
| `frontend/src/test/integration/AssignClassGroups.test.jsx` | Yes | **LOCAL**. vt5's older nine-column assertions/fixtures conflict with current protected coverage. Final file is identical to the checkpoint, including all 53 cases. |
| `frontend/src/test/integration/CreateClassGroups.test.jsx` | Yes | **LOCAL cases + VT5 permission setup**. Preserve all 11 cases, render with effective `masters.manage`, and wait for vt5's loading guard to enable Add before clicking. No assertions were removed or weakened. |
| `frontend/src/test/integration/ExamLists.test.jsx` | Yes | **VT5 + protected Dashboard regression**. Keep vt5 workflow/approval suite and permission provider; add router setup and the local exact Dashboard URL scope regression. Unrelated local test fixture overrides were not retained. |

Seven files had Git content conflicts. All seven are resolved; the other five overlapping files were reviewed even though Git combined them automatically.

## Protected Grouping

Retained Summary work queue, pending-major filtering, ID-based identity, browser history/refresh behavior, two-pane Assignment, ResizableSplit, deterministic auto-target and manual target preservation, hidden selection during search, visible select-all, scope reset, target switching, removal draft handling, exact capacity and overflow warning/disabled Assign without truncation.

Retained in-place `+ Tạo mới`, shared `ClassGroupCreateDialog.jsx`, form retry, Cancel draft/search/target/URL preservation, successful group reload and usable target selection, smaller-capacity overflow, unusable/multiple group handling, and POST-success/reload-failure handling that prevents a duplicate POST.

Retained candidate columns: checkbox, Mã học viên, Họ tên, Ngày sinh, Học phí nhập học; missing code remains `Chưa có`. No old nine-column candidate definition or `.slice(0, remainingCapacity)` selection truncation was introduced. `createClassGroups.logic.*`, `groupingMajorLabels.js`, and the local split component remain intact.

### Table style port

In `assignClassGroups.css`:

- Sticky member action separator: `#d8e5ef` → `var(--table-row-border-color)`.
- Sticky member action header: `#edf4fa` → `var(--table-header-bg)`.
- Hovered sticky member action cell: `#f5fafe` → `var(--table-hover-bg)`.

The local five-column, sticky identity, Summary cards, split, alert and contextual-create layout rules remain. Existing token-based summary focus/hover and shared ResizableTable styling work with vt5's global table rules. Intentional Dashboard/Summary product colors remain.

Browser computed tokens: row border `#718292`, header `#DCE7F1`, hover `#EAF2F8`; candidate header computed to `rgb(220, 231, 241)`.

## Protected Dashboard and RBAC

`frontend/src/features/dashboard/` and `frontend/src/pages/viewLogged.js` are byte-for-byte unchanged relative to the checkpoint. `backend/src/dashboard/` remains registered in the merged AppModule. Four compact cards, operational queues, warnings/preview limit, training overview, and deep links remain.

DashboardService now injects vt5 RbacService and reads `effectiveAccess(user).permissions` per request. It no longer reads removed role metadata or uses `role === "admin"` for authorization:

- Grouping action queue: `masters.view` and `masters.manage`.
- Grade entry queue: `gradebook.view` and `gradebook.submit`.
- Scheduling/progress action queues: `scheduling.view`, `scheduling.write`, and the existing scheduling-assignment guard.
- Read-only training overview: `scheduling.view`.

The vt5 endpoint guards, scheduling organization/assignment permissions, grade submission/approval, account/role authorization and session infrastructure remain authoritative. Custom grants and revocation of a legacy admin's permissions are explicitly tested; users without access receive no unauthorized queue data/actions. The create-group list uses vt5 effective `masters.manage` instead of `/auth/isStaff`.

## Migrations

New files from vt5:

```text
061-academic-lifecycle.ts
061-study-leave-enrolled-attempts.ts
062-account-management-rbac.ts
063-db-change-logs.ts
064-unified-role-permissions.ts
```

No duplicate complete migration filenames were introduced. Existing baseline migrations already share prefixes `045`, `046`, and `047`. vt5 itself contains two distinct migrations sharing numeric prefix `061`; the integration preserves their upstream names. Umzug discovers complete filenames, so they are distinct migration identities. The academic-lifecycle migration adds history/views/gradebook workflow tables and columns; the other 061 changes stored study-leave snapshots. They were not executed.

`node backend/dist/database/migrate.js status` was attempted after backend typecheck. DEV connection could not be established; a separate read-only PostgreSQL connection check confirmed `ECONNREFUSED`. Docker inspection also confirmed that its Linux engine pipe was unavailable. Thus the executed/pending database migration set is unknown.

When the existing DEV database is available, inspect with `npm run db:migrate:status --prefix backend`, then apply the project's normal `npm run db:migrate --prefix backend` workflow after reviewing pending migrations. No migration, reset, reseed, or operational-data write ran in this integration.

## Tests and builds

Commands were executed from the repository root. Installed dependencies were sufficient.

```powershell
npm test --prefix frontend -- src/test/integration/AssignClassGroups.test.jsx src/test/integration/CreateClassGroups.test.jsx src/test/unit/createClassGroups.logic.test.js src/test/integration/OperationalDashboard.test.jsx src/test/integration/DashboardScheduleLinks.test.jsx src/test/integration/ExamLists.test.jsx src/test/unit/dashboardNavigation.test.js src/test/unit/schedulingNavigation.test.js --maxWorkers=2

npm test --prefix frontend -- src/test/integration/AssignClassGroups.test.jsx src/test/integration/CreateClassGroups.test.jsx src/test/unit/createClassGroups.logic.test.js src/test/integration/SchedulingPages.test.jsx src/test/integration/ScheduleCalendar.test.jsx src/test/integration/Accounts.test.jsx src/test/integration/Roles.test.jsx src/test/integration/ProtectedRoute.test.jsx --maxWorkers=2

npm test --prefix frontend -- src/test/integration/CreateClassGroups.test.jsx --maxWorkers=2

npm test --prefix backend -- test/unit/dashboard.service.spec.ts test/unit/scheduling.service.spec.ts test/unit/scheduling-write.guard.spec.ts test/unit/permissions.guard.spec.ts test/unit/rbac.service.spec.ts

npm run build --prefix frontend
npm run build --prefix backend
npm run typecheck --prefix backend
git diff --check
git diff --cached --check
```

| Suite | Final verified result |
|---|---|
| AssignClassGroups | 53 passed |
| CreateClassGroups | 11 passed |
| createClassGroups.logic | 13 passed |
| OperationalDashboard | 13 passed |
| DashboardScheduleLinks | 2 passed |
| dashboardNavigation | 3 passed |
| schedulingNavigation | 9 passed |
| ExamLists | 31 passed |
| SchedulingPages | 14 passed |
| ScheduleCalendar | 34 passed |
| Accounts | 5 passed |
| Roles | 4 passed |
| ProtectedRoute | 4 passed |
| Backend focused suites | 81 passed in 5 suites |

The three Grouping suites total **77 passed**. Across the frontend suite files above, **196 distinct tests passed** in their final runs. Backend: **81 passed**. These counts aggregate the listed targeted runs, not one clean combined run.

Initial frontend run: 126 passed / 9 failed (one protected date display expectation, eight create-page clicks during loading). The protected local date display was restored. A second run passed Assignment and the additional vt5 suites but still showed eight create timing failures; after correcting the actual shared test helper, the final CreateClassGroups run passed all 11. No tests were weakened.

Both production builds and backend typecheck pass. Frontend build retains the large-chunk warning (>500 kB). Tests emit React `act(...)` and `useFlexGap` DOM-prop warnings, MUI disabled-button Tooltip warnings, and fixture select out-of-range warnings; logs retain them. A vt5 trailing blank line in `backend/test/README.md` was removed for the whitespace check. The initial frontend invocation required elevated execution after sandbox `spawn EPERM` from esbuild; its successful reruns used the same test commands.

Logs: `.tmp/vt5-focused-frontend.log`, `.tmp/vt5-frontend-recheck.log`, `.tmp/vt5-create-final.log`, `.tmp/vt5-focused-backend.log`, `.tmp/vt5-frontend-build-final.log`, `.tmp/vt5-backend-build-final.log`, `.tmp/vt5-backend-typecheck.log`.

## Browser verification

Ran a real headless Microsoft Edge against the current local Vite frontend at **1440×900**, using isolated API fixtures because DEV PostgreSQL is unavailable. This verifies rendered UI behavior, not live login, real session serialization, database-backed authorization, or migrations.

18 browser assertions pass: Summary/ribbon, five columns, separate code/name/tuition, no default candidate horizontal scroll, hidden search selection, target switching/overflow with disabled Assign, split keyboard and pointer resizing, narrow-pane sticky checkbox/code/name, vt5 tokens, in-place create pathname, Cancel draft preservation, local Dashboard cards/queues/warnings/overview, no Dashboard viewport overflow, grouping deep link, vt5 accounts/roles with a custom effective-permission fixture, and no runtime exceptions. Screenshots were visually inspected for Summary, Assignment, Dashboard and the settled create dialog; no global theme/ribbon break was observed.

The create dialog fixture intentionally lacks a curriculum/major code, so validation is visible; browser coverage here opens/cancels it without creating data. Success/failure/retry/reload behavior is covered by the protected integration tests.

Command: `node .tmp/vt5-browser.cjs`. Results: `.tmp/vt5-browser/result.json`. Screenshots: `.tmp/vt5-browser/{summary,assignment-overflow,create-dialog,dashboard,accounts,roles}.png`.

Live login/session, live permission-protected endpoints and database-backed accounts/roles smoke remain **unverified**, pending the existing DEV database becoming available.

## Final Git review

All integration resolutions are staged, with no unmerged paths. The appended inventory lists all changed/staged paths relative to the checkpoint. No final merge commit was made; nothing was pushed. The original work remains recoverable at the checkpoint.

### Staged path inventory

`M` = modified, `A` = added, `D` = deleted relative to the checkpoint; all entries below are staged. No unmerged or unstaged paths.

```text
M  BAO-CAO-LOGIC-VONG-DOI-HOC-VIEN.md
A  KE-HOACH-QUAN-LY-TAI-KHOAN-PHAN-QUYEN.md
M  NGHIEP-VU-KE-HOACH-DAO-TAO.md
M  README.md
M  backend/package.json
A  backend/src/accounts/accounts.controller.ts
A  backend/src/accounts/accounts.module.ts
A  backend/src/accounts/accounts.service.ts
A  backend/src/accounts/dto/account.dto.ts
M  backend/src/app.module.ts
A  backend/src/audit/audit-context.ts
A  backend/src/audit/audit.module.ts
A  backend/src/audit/audit.service.ts
A  backend/src/audit/change-log.service.ts
A  backend/src/auth/administration-safety.service.ts
M  backend/src/auth/auth.module.ts
M  backend/src/auth/auth.service.ts
A  backend/src/auth/permissions.ts
A  backend/src/auth/rbac.module.ts
A  backend/src/auth/rbac.service.ts
M  backend/src/auth/session.serializer.ts
M  backend/src/auth/user.controller.ts
M  backend/src/common/auth-user.ts
M  backend/src/common/course-offering-write.guard.ts
A  backend/src/common/permissions.decorator.ts
A  backend/src/common/permissions.guard.ts
D  backend/src/common/roles.guard.ts
A  backend/src/common/student.guard.ts
M  backend/src/dashboard/dashboard.service.ts
M  backend/src/database/database.module.ts
A  backend/src/database/migrations/061-academic-lifecycle.ts
A  backend/src/database/migrations/061-study-leave-enrolled-attempts.ts
A  backend/src/database/migrations/062-account-management-rbac.ts
A  backend/src/database/migrations/063-db-change-logs.ts
A  backend/src/database/migrations/064-unified-role-permissions.ts
A  backend/src/database/models/auth-audit-log.model.ts
A  backend/src/database/models/db-change-log.model.ts
A  backend/src/database/models/permission.model.ts
A  backend/src/database/models/role-permission.model.ts
A  backend/src/database/models/role.model.ts
A  backend/src/database/models/staff-role.model.ts
M  backend/src/database/models/staff.model.ts
M  backend/src/database/models/training/course-exam-gradebook.model.ts
M  backend/src/database/models/training/course-offering.model.ts
A  backend/src/database/seed-auth.ts
D  backend/src/database/seeds/dev-postgraduate-data.ts
D  backend/src/database/seeds/dev-postgraduate-fixture.ts
D  backend/src/database/seeds/dev-postgraduate-policy.ts
A  backend/src/database/seeds/seed-local-multi-major-unassigned.cjs
A  backend/src/database/seeds/seed-vmu-sample.ts
M  backend/src/doctoral/doctoral.controller.ts
D  backend/src/management/admin.controller.ts
M  backend/src/management/data.controller.ts
M  backend/src/management/management.module.ts
M  backend/src/masters/dto/exam-gradebook.dto.ts
M  backend/src/masters/exam-grade-calculation.ts
M  backend/src/masters/exam-gradebook.service.ts
M  backend/src/masters/grading-policy.service.ts
M  backend/src/masters/masters.controller.ts
M  backend/src/masters/masters.service.ts
M  backend/src/plan/admission-evaluation.controller.ts
A  backend/src/plan/admission-values.ts
M  backend/src/plan/class-group.service.ts
M  backend/src/plan/dto/plan.dto.ts
M  backend/src/plan/exam-outcomes.ts
M  backend/src/plan/learning-exam-results.ts
M  backend/src/plan/major-transfer.service.ts
A  backend/src/plan/membership-history.ts
M  backend/src/plan/plan.controller.ts
M  backend/src/plan/plan.module.ts
M  backend/src/plan/plan.service.ts
M  backend/src/plan/study-leave.controller.ts
M  backend/src/plan/study-leave.service.ts
M  backend/src/plan/subject-recognition.service.ts
M  backend/src/plan/training-structure-integrity.ts
A  backend/src/reports/academic-progress.ts
M  backend/src/reports/class-score-summary.service.ts
M  backend/src/reports/reports.controller.ts
A  backend/src/reports/transcript-snapshot.ts
A  backend/src/roles/dto/role.dto.ts
A  backend/src/roles/roles.controller.ts
A  backend/src/roles/roles.module.ts
A  backend/src/roles/roles.service.ts
M  backend/src/scheduling/retake-groups.ts
M  backend/src/scheduling/scheduling.controller.ts
M  backend/src/scheduling/scheduling.module.ts
M  backend/src/scheduling/scheduling.service.ts
D  backend/src/staff/dto/staff.dto.ts
M  backend/src/staff/staff.module.ts
M  backend/src/staff/staff.service.ts
M  backend/src/system/system.controller.ts
M  backend/src/system/system.module.ts
M  backend/src/system/system.service.ts
M  backend/test/README.md
M  backend/test/e2e/learner-data-access.e2e-spec.ts
A  backend/test/integration/accounts-roles-postgres.spec.ts
M  backend/test/integration/class-score-summary-postgres.spec.ts
M  backend/test/integration/exam-attempt-order-postgres.spec.ts
M  backend/test/integration/retake-groups-postgres.spec.ts
M  backend/test/integration/scheduling-postgres.spec.ts
M  backend/test/integration/study-leaves-postgres.spec.ts
M  backend/test/integration/training-structure-postgres.spec.ts
A  backend/test/unit/academic-lifecycle-values.spec.ts
A  backend/test/unit/academic-progress.spec.ts
A  backend/test/unit/accounts.service.spec.ts
A  backend/test/unit/administration-safety.service.spec.ts
A  backend/test/unit/change-log.service.spec.ts
M  backend/test/unit/dashboard.service.spec.ts
D  backend/test/unit/dev-postgraduate-data.spec.ts
M  backend/test/unit/exam-gradebook.service.spec.ts
M  backend/test/unit/major-transfer-admission.service.spec.ts
M  backend/test/unit/major-transfer.service.spec.ts
M  backend/test/unit/masters.assign.service.spec.ts
A  backend/test/unit/permissions.guard.spec.ts
A  backend/test/unit/rbac.service.spec.ts
A  backend/test/unit/roles.service.spec.ts
M  backend/test/unit/scheduling-write.guard.spec.ts
M  backend/test/unit/scheduling.service.spec.ts
A  backend/test/unit/study-leave-dates.spec.ts
M  backend/test/unit/system-room.service.spec.ts
M  backend/test/unit/transcript-batch.spec.ts
D  docs/DEV-POSTGRADUATE-DATA-RESULT.md
D  docs/DEV-POSTGRADUATE-DATA.md
A  docs/PERFORMANCE-NAVIGATION.md
A  docs/VT5-INTEGRATION-REVIEW.md
A  frontend-lifecycle-final-results.json
A  frontend-lifecycle-test-results.json
M  frontend/package-lock.json
A  frontend/public/images/vmu-login-banner-clean.png
A  frontend/public/images/vmu-login-campus.jpg
A  frontend/public/images/vmu-logo.png
M  frontend/src/App.js
D  frontend/src/components/AppLayout.jsx
M  frontend/src/components/CatalogManager.jsx
A  frontend/src/components/DateField.jsx
M  frontend/src/components/FilterSearchField.jsx
M  frontend/src/components/ProtectedRoute.jsx
M  frontend/src/components/RibbonHeader.jsx
D  frontend/src/components/addStaff.jsx
M  frontend/src/components/login.jsx
A  frontend/src/context/AuthSession.js
A  frontend/src/features/accounts/api.js
A  frontend/src/features/accounts/constants.js
A  frontend/src/features/accounts/rolesApi.js
A  frontend/src/features/accounts/usePermissions.js
M  frontend/src/features/admission/AdmissionEvaluationPanel.jsx
M  frontend/src/features/admission/AdmissionTuitionCheckbox.jsx
M  frontend/src/features/admission/BulkAdmissionWorkflow.jsx
M  frontend/src/features/admission/admissionDocument.js
A  frontend/src/features/admission/profileCategories.js
M  frontend/src/features/exams/gradebook.js
M  frontend/src/features/exams/gradebookExport.js
M  frontend/src/features/learners/LearnerScorecard.jsx
M  frontend/src/features/learners/StudyLeavePanel.jsx
M  frontend/src/features/learners/learnerTranscript.js
M  frontend/src/features/scheduling/CourseMatrix.jsx
M  frontend/src/features/scheduling/CreateOffering.jsx
A  frontend/src/features/scheduling/OfferingDeleteButton.jsx
M  frontend/src/features/scheduling/OfferingDetails.jsx
M  frontend/src/features/scheduling/Schedule.jsx
M  frontend/src/features/scheduling/SessionEditor.jsx
M  frontend/src/features/scheduling/Workspace.jsx
M  frontend/src/features/scheduling/scheduleExport.js
M  frontend/src/features/scheduling/workspace.css
M  frontend/src/index.css
D  frontend/src/pages/addStaffPage.js
M  frontend/src/pages/masters/admissionScores.jsx
M  frontend/src/pages/masters/assignClassGroups.css
M  frontend/src/pages/masters/assignClassGroups.jsx
M  frontend/src/pages/masters/bridgeCourse.jsx
M  frontend/src/pages/masters/classCourseHistory.css
M  frontend/src/pages/masters/classCourseHistory.jsx
M  frontend/src/pages/masters/createClassGroups.jsx
M  frontend/src/pages/masters/examLists.jsx
M  frontend/src/pages/masters/studyLeaves.jsx
M  frontend/src/pages/plan/admissionRecordDetail.jsx
M  frontend/src/pages/plan/admissionRecords.jsx
M  frontend/src/pages/plan/trainingPlan.jsx
M  frontend/src/pages/reports/classScoreSummaryExcel.js
A  frontend/src/pages/system/accounts.jsx
A  frontend/src/pages/system/auditLogs.jsx
M  frontend/src/pages/system/changePassword.jsx
A  frontend/src/pages/system/roles.jsx
M  frontend/src/pages/system/rooms.jsx
D  frontend/src/pages/system/users.jsx
M  frontend/src/styles/login-page.css
M  frontend/src/styles/ribbon-header.css
M  frontend/src/styles/tables.css
A  frontend/src/test/integration/Accounts.test.jsx
M  frontend/src/test/integration/AdmissionDocumentExport.test.jsx
M  frontend/src/test/integration/AdmissionRecordInteractions.test.jsx
A  frontend/src/test/integration/AdmissionRecordLoading.test.jsx
M  frontend/src/test/integration/AdmissionThresholds.test.jsx
M  frontend/src/test/integration/AdmissionTuitionBatch.test.jsx
A  frontend/src/test/integration/AuditLogs.test.jsx
M  frontend/src/test/integration/BulkAdmissionWorkflow.test.jsx
A  frontend/src/test/integration/CatalogPagination.test.jsx
A  frontend/src/test/integration/ChangePassword.test.jsx
M  frontend/src/test/integration/ClassScoreSummary.test.jsx
M  frontend/src/test/integration/CreateClassGroups.test.jsx
A  frontend/src/test/integration/DateField.test.jsx
M  frontend/src/test/integration/ExamLists.test.jsx
M  frontend/src/test/integration/GradeSettingsDialog.test.jsx
M  frontend/src/test/integration/LearnerScorecard.test.jsx
M  frontend/src/test/integration/LearnerTranscript.test.jsx
M  frontend/src/test/integration/LearnerTranscriptPreview.test.jsx
M  frontend/src/test/integration/LecturerUnits.test.jsx
M  frontend/src/test/integration/MajorCodeCatalog.test.jsx
M  frontend/src/test/integration/MajorTransfer.test.jsx
A  frontend/src/test/integration/OfferingDeletion.test.jsx
M  frontend/src/test/integration/ProtectedRoute.test.jsx
A  frontend/src/test/integration/Roles.test.jsx
M  frontend/src/test/integration/RoomsPage.test.jsx
M  frontend/src/test/integration/ScheduleCalendar.test.jsx
M  frontend/src/test/integration/ScheduleExport.test.jsx
M  frontend/src/test/integration/SchedulingPages.test.jsx
M  frontend/src/test/integration/StudyLeavePanel.test.jsx
M  frontend/src/test/integration/StudyLeaves.test.jsx
M  frontend/src/test/integration/SubjectRecognition.test.jsx
D  frontend/src/test/integration/SystemUsers.test.jsx
M  frontend/src/test/integration/TrainingPlanSubjectIdentity.test.jsx
M  frontend/src/test/integration/UnitsCatalog.test.jsx
A  frontend/src/test/renderWithPermissions.jsx
M  frontend/src/test/unit/classScoreSummaryExcel.test.js
A  frontend/src/test/unit/dateFormat.test.js
M  frontend/src/test/unit/gradebook.test.js
M  frontend/src/test/unit/gradebookExport.test.js
A  frontend/src/test/unit/lazyPage.test.js
M  frontend/src/test/unit/learnerTranscriptPdf.test.js
M  frontend/src/test/unit/themeTypography.test.js
A  frontend/src/test/unit/usePermissions.test.jsx
M  frontend/src/theme.js
A  frontend/src/utils/dateFormat.js
A  frontend/src/utils/lazyPage.js
M  frontend/src/utils/schedulingCalendar.js
M  frontend/vite.config.js
```

Final diff relative to checkpoint: 236 changed paths, including this review report.
