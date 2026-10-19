# Home — information architecture and compact presentation

This pass supersedes the presentation described in `DASHBOARD-FINAL-VISUAL-DIRECTION.md`; the earlier report is retained as history.

## Files changed

- `frontend/src/features/dashboard/OperationalDashboard.jsx`
- `frontend/src/features/dashboard/operationalDashboard.css`
- `frontend/src/test/integration/OperationalDashboard.test.jsx`
- This report.

No commit, push or reset. Existing local changes from previous tasks are preserved.

## Final composition

Header → equal operational summary cards → work inbox / warnings → training status strip.

The “Phân bổ học viên chờ xử lý” component, its preview rollup, sidebar wrapper and all distribution/bar styling are removed. Raw-count bars in the left queue are also removed. Nothing replaces the duplicate visualization.

Cards are 108px high at all tested widths and workload states, down from 176px. The icon and title/state now share a horizontal body; pending count is 26px navy, with a small teal badge and Ocean text action in the compact footer. Healthy cards keep their feature icon, a small green check and slate description. No additional completion label, tall button or vertical icon block. Four permitted cards retain equal widths and heights; visibility rules for restricted accounts are unchanged. Existing outline icons and 40px tiles remain.

The main desktop grid is approximately 69/31, with content-driven heights and no filler on the right. The inbox supports grouping, scheduling and grade queues using their existing permissions and nonzero metrics; healthy queues are omitted. Rows have subtle dividers, aligned counts and outlined actions. The unnecessary column-label row was removed after visual review. Two-line work rows measure roughly 48px, without count charts or heavy gridlines.

The training overview is a compact strip with four inline label/number cells and vertical hairlines. At desktop it measures approximately 87px including the heading, down from the earlier taller metric layout. Existing labels, values and scope metadata are preserved.

## Warning strategy

- `WARNING_PREVIEW_LIMIT = 3` applies only to the Home presentation. The existing API prioritizes progress warnings by pending session count; the frontend preserves that order and takes its first three items. Backend definitions, totals and API preview remain unchanged.
- The badge retains the original count/unit (classes). When more items exist than are displayed, “Xem tất cả N lớp” uses the original pending-confirmation queue link and year. The existing link remains available for shorter lists.
- Titles and descriptions each have a two-line clamp. Complete text remains in the link's accessible label and individual `title` attributes; clicking opens the original handling route. CSS wrapping supports long words without horizontal overflow.
- Current warning semantics describe attention rather than a classified critical severity, so rows remain amber. No new severity threshold, warning type or red classification was invented.
- Zero-warning panel is 98px high in the tested desktop viewport. The small mint inset is content-driven and does not stretch to match the inbox.
- With five or twelve warnings and long descriptions, only three rows appear; the panel measured approximately 301px in the stress fixture. Description blocks measured 17–33px, bounded to two lines.

## Design and behavior retained

Existing scoped Navy / Ocean / Teal / Green / Amber / Cloud tokens, white surfaces, subtle borders/shadows, 9px panel radius, focus outlines and 150–160ms hover treatments remain. No library/font was added. Header, ribbon, year control and navigation behavior are preserved.

Responsive layout remains 4/2/1 cards and a stacked work/warnings area on narrow screens. The overview uses two columns on narrow screens. There is no backend, permission, metric, domain rule, route or year-filter change, and no database write.

## Verification

- Final targeted frontend tests: **20/20 passed** across OperationalDashboard, dashboardNavigation, FeatureLayout and ProtectedRoute. Covers multiple work categories, absence of distribution/count bars, unchanged learner total/deep links, permission/error states, stale-year protection and three-item warning previews for totals 5 and 12 with full accessible text.
- Final frontend production build passed (`vite build`, exit 0). The existing warning about chunks over 500kB remains; no compile error.
- Edge headless checked 1366×900, 1366×768, 1024×768 and 390×844. Asserted 4/2/1 grid, equal card dimensions in mixed/all-pending/healthy/error states, cards within 90–110px, overview within 75–95px desktop, two-line warning clamp and accessible full description. No page overflow or runtime exception; Enter opens `/masters/assign-class-groups?year=2026`.
- At 1366px, the four cards are approximately 321.5×108px and the inbox starts at y≈527, 68px earlier than before. The low desktop viewport shows all cards, the first three grouping rows and the compact warning state. Longer multi-queue work still scrolls naturally.
- Inspected mixed desktop/full page, zero-warning/zero-overview values, five/twelve-warning stress views and mobile. After inspection, removed redundant column labels and tightened work-row padding before the final checks.
- `git diff --check` passed; Git's LF/CRLF notice for the previously edited ResizableSplit file is unrelated to this pass.
- SHA256 baseline checks confirmed no changes to protected backend aggregation/controller/guard/scheduling files, frontend navigation, scheduling/grade pages, RibbonHeader, FeatureLayout or footer.

Local artifacts: `.tmp/dashboard-ia-browser/` contains `dashboard-mixed-full.png`, `dashboard-mixed-1366x768.png`, `dashboard-live-1366.png`, `dashboard-five-full.png`, `dashboard-twelve-full.png`, responsive/focus images and `result.json`. Mixed/pending/warning images use browser-only fixtures; the all-healthy image uses the previously captured read-only service snapshot. These are not new DB records.
