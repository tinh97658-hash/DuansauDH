# Home dashboard — final visual direction

## Files changed in this pass

- `frontend/src/features/dashboard/OperationalDashboard.jsx`: card composition, subtitle/level badge, queue bars/actions, warning presentation, workload distribution and sidebar composition.
- `frontend/src/features/dashboard/operationalDashboard.css`: scoped visual treatment and responsive behavior.
- `frontend/src/test/integration/OperationalDashboard.test.jsx`: new copy and distribution/permission/error coverage.
- This report. Existing local work is preserved; no commit/push/reset.

## Visual treatment

- Retain the scoped dashboard tokens: Cloud `#F5F8FB`, white surface, navy `#17324D`, Ocean `--primary-dark` (`#056A8F`), grouping teal `#087E86`, scheduling blue `#176EB5`, grades violet `#6953AA`, warning `--warning`, success `--success`, project border/hairline and low-opacity shadow tokens. Add semantic `--dashboard-work-tint` and `--dashboard-success-tint`, reusing the existing project success tint.
- Four permitted cards use identical columns, height 176px and padding in every workload state. No card expands because it has pending work. Permission-based visibility remains unchanged; fewer permitted features still use the existing grid behavior.
- Outline feature icons remain distinct in 40px pastel tiles with 21px icons. Pending uses navy count, small teal “Cần xử lý” badge, teal edge and Ocean CTA. Healthy retains feature icon identity, small green completion indicator, slate description and quiet text CTA. No full-card semantic fill or decorative illustration/pattern.
- Header retains its compact navy title and accent rule. Subtitle is now “Theo dõi các công việc cần xử lý và tình trạng nghiệp vụ theo năm tuyển sinh.” A compact “Thạc sĩ” badge sits beside the year control.
- Main area uses approximately 69/31 columns on desktop. Work queue stays left; warning and distribution stack on the right. White panel headers and cool hairlines replace table-like blocks.
- Grouping preview rows show major/discipline copy, thin teal comparative bars, right-aligned counts and an outlined action treatment inside the existing semantic link. Comparison bars normalize to the largest displayed count and are decorative; visible numeric counts remain unchanged. Scheduling/grade rows retain their own units and do not receive misleading learner bars.
- Warning healthy state uses a small mint box inside the white panel; actual warnings keep amber icon tiles and warm hover. Green only describes completion.
- Hover/focus remain 150–160ms with stronger Ocean border, small arrow movement, visible keyboard outlines and reduced-motion support. No scale animation or new dependencies.

## Distribution and data limits

“Phân bổ học viên chờ xử lý” uses only the existing grouping source and permission. Existing preview items are grouped by discipline ID from their existing deep links; labels use the existing discipline detail. Horizontal CSS bars use each count divided by the original total learner count.

The API returns at most five preview majors. Their displayed discipline totals must not be described as a complete breakdown when more majors exist. Any difference between the original total and displayed counts is explicitly shown as “Các chuyên ngành khác”, with a note giving the preview major count. No additional API or invented per-discipline counts are introduced. Failed/loading sources stay failed/loading; zero data gets a compact healthy state.

No changes to backend aggregation, original metrics, permissions, routes, year behavior or domain rules. No database writes.

## Verification and visual review

- 18/18 targeted tests passed: Home/dashboard integration, dashboard navigation helpers, FeatureLayout and ProtectedRoute. Added coverage for discipline rollup, undisplayed remainder, unchanged total/deep link, grouping permission independent of warnings and source failure not being presented as healthy.
- Final frontend production build passed (`vite build`, exit 0). The existing warning for chunks larger than 500kB remains; no compilation error.
- Edge headless: 1366×900, 1366×768, 1024×768 and 390×844. Grid is 4/2/1; equal card widths/heights asserted in mixed, all-pending, healthy, partial-error and truncated-preview states. No horizontal page overflow or runtime exception. Focus + Enter preserves `/masters/assign-class-groups?year=2026`.
- At desktop 1366, each card is approximately 321.5px × 176px and work panels start at y≈595 in mixed/all-pending/healthy states. The existing tall ribbon is unchanged; long operational content scrolls naturally.
- Inspected the mixed full-page view, all-pending viewport, healthy viewport and mobile screenshot. Counts/CTA form the focal point; healthy cards are quieter; queue actions align with count columns; warning and distribution provide context without a chart library.
- SHA256 checks confirm the protected backend dashboard/controller/guard/scheduling files, frontend navigation, Schedule, examLists, RibbonHeader, FeatureLayout and footer remain unchanged from their recorded baselines.
- `git diff --check` passed. Git only reports its LF/CRLF normalization notice for the previously edited ResizableSplit file.

Local screenshots in `.tmp/dashboard-final-direction-browser/`:

- `dashboard-mixed-full.png`: complete composition, one pending queue and three healthy cards.
- `dashboard-populated-1366.png`: all four queues pending.
- `dashboard-live-1366.png`: all healthy, using the prior read-only service snapshot.
- `dashboard-error-1366.png`, `dashboard-truncated-1366.png`.
- `dashboard-mixed-1366x768.png`, `dashboard-mixed-1024x768.png`, `dashboard-mixed-390x844.png`.
- `dashboard-keyboard-focus.png`.

Populated/mixed/error/truncated images use explicit browser-only fixtures; they are not live DB counts. Geometry and assertions are recorded in the same folder's `result.json`.
