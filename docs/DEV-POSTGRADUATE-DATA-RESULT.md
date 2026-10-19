# DEV postgraduate data: execution report

Applied successfully on 2026-10-18 (Asia/Bangkok).

Local DB: `127.0.0.1:55432/pgsms`; resolved environment `development`.
Docker Compose container `duansaudh-db-1` was verified before execution.

A read-only preflight and this report were prepared before deletion. A complete write rehearsal was rolled back before apply. Reset and reseed were committed together in one transaction.

## Master/reference data preserved

All preserved tables passed both row-count and full-row fingerprint comparisons inside the apply transaction.

| Table | Before | After | Fingerprint unchanged |
|---|---:|---:|---|
| admission_rounds | 1 | 1 | yes |
| admission_targets | 3 | 3 | yes |
| annual_fees | 6 | 6 | yes |
| bridge_knowledge_subjects | 4 | 4 | yes |
| cities | 18 | 18 | yes |
| course_grading_policies | 0 | 0 | yes |
| curriculum_blocks | 65 | 65 | yes |
| curriculum_elective_groups | 0 | 0 | yes |
| curriculum_subjects | 168 | 168 | yes |
| curriculums | 15 | 15 | yes |
| disciplines | 13 | 13 | yes |
| districts | 0 | 0 | yes |
| ethnicities | 15 | 15 | yes |
| lecturers | 96 | 96 | yes |
| majors | 16 | 16 | yes |
| nationalities | 12 | 12 | yes |
| rooms | 13 | 13 | yes |
| sequelize_meta | 63 | 63 | yes |
| sessions | 1 | 1 | yes |
| shared_grading_rules | 0 | 0 | yes |
| staff | 1 | 1 | yes |
| study_statuses | 8 | 8 | yes |
| subjects | 140 | 140 | yes |
| training_levels | 3 | 3 | yes |
| training_mode_groups | 5 | 5 | yes |
| training_modes | 5 | 5 | yes |
| training_plans | 3 | 3 | yes |
| training_programs | 3 | 3 | yes |
| units | 12 | 12 | yes |
| wards | 0 | 0 | yes |
| students (non-student system roles) | 0 | 0 | yes |

Intake plans, admission rounds/thresholds, quotas and fee definitions were preserved as input configuration. They are not admission results or tuition payments. Staff authentication and permissions were preserved.

## Transactional data deleted: actual FK order

| Order | Table | Before | Deleted | After reseed |
|---:|---|---:|---:|---:|
| 1 | admission_evaluation_history | 105 | 105 | 0 |
| 2 | admission_evaluations | 0 | 0 | 0 |
| 3 | class_group_electives | 13 | 13 | 0 |
| 4 | class_group_members | 320 | 320 | 0 |
| 5 | course_exam_gradebooks | 2 | 2 | 0 |
| 6 | course_offering_class_groups | 105 | 105 | 0 |
| 7 | course_offering_students | 3 | 3 | 0 |
| 8 | course_offering_withdrawals | 0 | 0 | 0 |
| 9 | doctoral_admission_scores | 0 | 0 | 0 |
| 10 | doctoral_defenses | 0 | 0 | 0 |
| 11 | doctoral_reviews | 0 | 0 | 0 |
| 12 | doctoral_thesis_topics | 0 | 0 | 0 |
| 13 | doctoral_workshops | 0 | 0 | 0 |
| 14 | english_certifications | 0 | 0 | 0 |
| 15 | english_exam_scores | 0 | 0 | 0 |
| 16 | exam_eligibilities | 0 | 0 | 0 |
| 17 | exam_results | 0 | 0 | 0 |
| 18 | graduation_records | 0 | 0 | 0 |
| 19 | masters_admission_scores | 0 | 0 | 0 |
| 20 | masters_bridge_courses | 0 | 0 | 0 |
| 21 | scheduling_retakes | 0 | 0 | 0 |
| 22 | staff_students | 0 | 0 | 0 |
| 23 | subject_recognitions | 0 | 0 | 0 |
| 24 | submissions | 0 | 0 | 0 |
| 25 | teaching_sessions | 286 | 286 | 0 |
| 26 | english_exam_sessions | 0 | 0 | 0 |
| 27 | exam_sessions | 0 | 0 | 0 |
| 28 | graduation_defenses | 0 | 0 | 0 |
| 29 | learner_subject_results | 0 | 0 | 0 |
| 30 | major_transfers | 3 | 3 | 0 |
| 31 | study_leaves | 0 | 0 | 0 |
| 32 | admission_records | 362 | 362 | 210 |
| 33 | class_groups | 31 | 31 | 0 |
| 34 | course_offerings | 80 | 80 | 0 |
| 35 | students | 0 | 0 | 0 |

`admission_records` was verified empty after deleting 362 old records, then 210 new records were inserted. All other lifecycle tables were verified empty. No FK disabling or TRUNCATE/CASCADE was used.

## New dataset

| Year | Admissions | Distinct majors |
|---|---:|---:|
| 2024 | 50 | 15 |
| 2025 | 70 | 15 |
| 2026 | 90 | 15 |

Total: **210**. Masters: **186**. Doctoral: **24**. Seed: `20261018`.

| Major code | Major | 2024 | 2025 | 2026 | Total |
|---|---|---:|---:|---:|---:|
| KTTTTS | Kỹ thuật tàu thủy (Tiến sĩ) | 2 | 3 | 6 | 11 |
| KTMT | Kĩ thuật môi trường | 11 | 16 | 27 | 54 |
| QTKD | Quản trị kinh doanh | 8 | 15 | 19 | 42 |
| XDCTT | Xây dựng công trình thủy | 3 | 3 | 3 | 9 |
| TATM | Tiếng anh thương mại | 5 | 4 | 4 | 13 |
| KTHH2 | Khai thác hàng hải | 2 | 3 | 2 | 7 |
| KTHH | Khai thác hàng hải | 2 | 4 | 2 | 8 |
| DKTB | Điều khiển tàu biển | 3 | 4 | 3 | 10 |
| KTDDT | Kỹ thuật điện - Điện tử | 3 | 2 | 4 | 9 |
| KTVTB | Kinh tế vận tải biển | 3 | 4 | 1 | 8 |
| CNTT | Công nghệ thông tin | 2 | 3 | 2 | 7 |
| KTXDCTTBTS | Kỹ thuật xây dựng công trình thủy & biển (Tiến sĩ) | 1 | 2 | 4 | 7 |
| KTCK | Kỹ thuật cơ khí | 2 | 2 | 2 | 6 |
| KTDKTDHTS | Kỹ thuật điều khiển & Tự động hóa (Tiến sĩ) | 1 | 2 | 3 | 6 |
| KTKT | Kế toán kiểm toán | 2 | 3 | 8 | 13 |

Initial state: `pending / Nộp hồ sơ đầu vào`. No tuition confirmation, student accounts, class groups/memberships, offerings, sessions, schedules or grades were created. Admission codes and government identifiers remain null because they are optional; staff can supply official identifiers through the existing workflow.

### Ten generated names

1. Dương Thu Trang
2. Dương Thảo Nguyên
3. Phạm Đức Anh
4. Dương Hữu Phúc
5. Đinh Mai Phương
6. Hồ Quốc Huy
7. Lê Thanh Tùng
8. Bùi Minh Anh
9. Lý Hữu Phúc
10. Dương Minh Anh

## Commands added

- `npm run dev:data:preview`
- `npm run dev:data:reset`
- `npm run dev:data:seed`
- `npm run dev:data:reseed`

Exact applied commands (PowerShell in `backend`):

```powershell
$env:CONFIRM_DEV_DATA_RESET = 'YES'
$env:SEED_RANDOM = '20261018'
npm run dev:data:reseed -- --rollback --report=../.tmp/dev-postgraduate-rehearsal.json
npm run dev:data:reseed -- --report=../.tmp/dev-postgraduate-applied.json
```

## Verification results

- `npm run build`: passed.
- `npm test -- test/unit/dev-postgraduate-data.spec.ts`: 26 tests passed; no unrelated test suites.
- Live SQL rehearsal: all deletes, inserts, FK/unique constraints, preserved-row fingerprints and post-reset/post-seed invariants passed; rolled back.
- Read-only recheck after rehearsal: all table counts matched the original counts. Master/config/account fingerprints matched across reads; the live staff session naturally refreshed between separate transactions. All session fingerprints were unchanged within each locked operation.
- Apply: committed; exact preserved rows unchanged; unique IDs/emails/phones/names; admission-major-discipline joins yield exactly 210 rows.
- CLI without confirmation: refused before connecting/writing (exit 1).
- CLI production environment: refused before connecting/writing (exit 1).
- Standalone seed on a populated DB: refused; no append/overwrite (exit 1).
- Existing Nest application context boots successfully.
- Actual admission-list service: pagination 100/100/10, 210 distinct IDs; totals/statistics 210 = 186 + 24, no duplicates.
- Actual admission-detail service: loads a new pending record.
- Actual per-year admission service: 50/70/90 rows, with 50/70/90 unique IDs.
- Actual assignment services: no groups and no eligible learners in all three years, as expected before admission decisions.
- Frontend HTTP entry routes `/plan/admission-records` and `/masters/assign-class-groups`: 200 with application root.
- Backend `/health/ready`: 200, ready.
- Frontend checks cover HTTP entry loading and the services behind the views; no browser-driven visual test was performed.

## Schema/FK findings

- No blocking FK issue. Runtime topological ordering handles RESTRICT, nullable and CASCADE FKs explicitly, including SQL-only tables.
- SQL-only `masters_bridge_courses`, retakes, study-leave records and offering withdrawals are included, as are embedded grade/history payloads when their owning rows are deleted.
- Four ordinary reporting views remain defined; no materialized data needs refresh.
- Two pre-existing active majors share the name Khai thac hang hai, with different IDs/codes (`KTHH`, `KTHH2`). Both are preserved and seeded separately; no catalog correction was attempted.
- No separate religion/attendance/workflow/task tables were present in the audited schema.

## Files added/changed

- `backend/package.json`
- `backend/src/database/seeds/dev-postgraduate-data.ts`
- `backend/src/database/seeds/dev-postgraduate-policy.ts`
- `backend/src/database/seeds/dev-postgraduate-fixture.ts`
- `backend/test/unit/dev-postgraduate-data.spec.ts`
- `docs/DEV-POSTGRADUATE-DATA.md`
- `docs/DEV-POSTGRADUATE-DATA-RESULT.md`

Existing frontend working-tree changes were preserved. No business-rule changes, dependency installs, commit, push or working-tree reset.

Machine-readable audit reports are stored locally under `.tmp/dev-postgraduate-*.json` (ignored by Git).
