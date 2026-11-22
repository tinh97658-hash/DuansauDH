import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import React from "react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import {
  Box, Button, Chip, IconButton, MenuItem, Paper, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, Typography,
} from "@mui/material";
import theme from "../../theme";
import FilterSearchField from "../../components/FilterSearchField";
import FilterSelectField from "../../components/FilterSelectField";
import Footer from "../../components/footer";
import AppDialog from "../../components/AppDialog";

const browser = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((file) => file && fs.existsSync(file));

const cssFiles = [
  "node_modules/bootstrap/dist/css/bootstrap.css",
  "src/index.css",
  "src/styles/tables.css",
  "src/styles/dialogs.css",
  "src/styles/dropdowns.css",
  "src/styles/ribbon-header.css",
  "src/components/pageExport.css",
  "src/components/documentExportMenu.css",
  "src/features/dashboard/operationalDashboard.css",
  "src/features/scheduling/workspace.css",
  "src/features/exams/examSchedule.css",
  "src/pages/masters/assignClassGroups.css",
  "src/styles/appearance.css",
  "src/styles/adaptive-layout.css",
  "src/styles/toolbars.css",
];

function ScaledUiProbe() {
  return (
    <MemoryRouter>
      <Box data-feature-main="true" sx={{ p: "10px 16px 20px", width: "100%", maxWidth: 1440, mx: "auto" }}>
        <h1 data-probe-h1="true">Kế hoạch đào tạo</h1>
        <h2 data-probe-h2="true">Chương trình đào tạo theo khóa</h2>
        <h4 data-probe-h4="true">Chi tiết học phần</h4>

        <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="flex-end" justifyContent="space-between" sx={{ flexWrap: "wrap" }}>
            <FilterSelectField label="Trình độ" value="masters" onChange={() => {}} sx={{ flex: "1 1 160px", minWidth: 160 }}>
              <MenuItem value="masters">Thạc sĩ</MenuItem>
            </FilterSelectField>
            <FilterSearchField label="Tìm kiếm" placeholder="Tìm..." value="" onChange={() => {}} sx={{ flex: "1 1 240px" }} />
            <Box className="app-action-toolbar" sx={{ display: "flex", gap: 1 }}>
              <Button data-probe-toolbar-btn="true" variant="contained">Thao tác một dòng</Button>
              <div className="page-export-inline">
                <button type="button" className="document-export-trigger" data-probe-export-btn="true">Xuất báo cáo</button>
              </div>
            </Box>
          </Stack>
        </Paper>

        <Box sx={{ borderBottom: "1px solid #DFE4E8", mb: 2 }}>
          <Tabs value={1}>
            <Tab label="1. Danh mục học phần chuyên ngành (29 môn)" />
            <Tab label="2. Chương trình đào tạo theo khóa (1 khóa · 3 CTĐT)" />
          </Tabs>
        </Box>

        {/* Updated TrainingPlan Tab 2 layout */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(340px, 34%) minmax(0, 1fr)" },
            gap: 1.25,
            alignItems: "stretch",
          }}
        >
          <Box sx={{ minWidth: 0, display: "flex" }}>
            <Paper data-probe-left-paper="true" variant="outlined" sx={{ p: 1.25, width: "100%", minWidth: 0 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" justifyContent="space-between" sx={{ mb: 1, rowGap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 12 }}>
                  CTĐT theo từng khóa
                </Typography>
                <Button data-probe-card-btn="true" size="small" variant="contained" sx={{ minHeight: 28, fontSize: 12 }}>
                  Lập CTĐT mới
                </Button>
              </Stack>
              <TableContainer data-probe-left-scroll="true">
                <Table size="small" aria-label="CTĐT">
                  <TableHead>
                    <TableRow>
                      <TableCell>Chương trình đào tạo</TableCell>
                      <TableCell sx={{ width: "9.5em" }}>Lớp áp dụng</TableCell>
                      <TableCell data-probe-left-delete-th="true" sx={{ width: "3.5em", textAlign: "center" }}>Xóa</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ gap: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>CT-2026-001</Typography>
                          <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>· 61 TC</Typography>
                        </Stack>
                        <Typography variant="caption">Chương trình đào tạo Công nghệ thông tin - Khóa 2026</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip data-probe-chip="true" size="small" label="1 lớp: CNTT 2026.1.1" sx={{ height: "auto", minHeight: 22, maxWidth: "100%", fontSize: 10.5 }} />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton data-probe-left-delete-btn="true" size="small" aria-label="Xóa">X</IconButton>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          <Box sx={{ minWidth: 0, display: "flex" }}>
            <Paper data-probe-right-paper="true" variant="outlined" sx={{ p: 1.25, width: "100%", minWidth: 0 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" justifyContent="space-between" sx={{ mb: 0.75, rowGap: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ minWidth: 0, flex: "1 1 280px" }}>
                  <Typography variant="subtitle2" sx={{ fontSize: 14, fontWeight: 700 }}>
                    Chương trình đào tạo Công nghệ thông tin - Khóa 2026
                  </Typography>
                  <Chip size="small" label="CT-2026-001" sx={{ minHeight: 24, fontSize: 11 }} />
                  <Chip size="small" label="Khóa 2026" sx={{ minHeight: 24, fontSize: 11 }} />
                </Stack>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" alignItems="center" sx={{ maxWidth: "100%", rowGap: 0.75 }}>
                  <Button data-probe-wrap-btn="true" size="small" variant="contained" sx={{ minHeight: 32, px: 1.5, fontSize: 11.5 }}>
                    Thêm học phần từ danh mục
                  </Button>
                  <Button size="small" variant="outlined" sx={{ minHeight: 32, px: 1.5, fontSize: 11.5 }}>
                    Làm sạch CTĐT
                  </Button>
                </Stack>
              </Stack>

              <Stack direction={{ xs: "column", lg: "row" }} flexWrap="wrap" justifyContent="space-between" sx={{ mb: 0.75, gap: 1 }}>
                <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.75, minWidth: 0 }}>
                  <Chip size="small" label="Bắt buộc: 35 TC" sx={{ minHeight: 24, fontSize: 11 }} />
                  <Chip size="small" label="Tự chọn: 26 TC" sx={{ minHeight: 24, fontSize: 11 }} />
                  <Chip size="small" label="Tổng: 61 TC" sx={{ minHeight: 24, fontSize: 11 }} />
                  <Chip size="small" label="27 học phần" sx={{ minHeight: 24, fontSize: 11 }} />
                </Stack>
                <Stack data-probe-search-wrap="true" direction="row" alignItems="center" justifyContent="flex-end" sx={{ flex: "1 1 260px", maxWidth: { xs: "100%", lg: 420 }, minWidth: 0, ml: "auto" }}>
                  <FilterSearchField
                    label=""
                    inputLabel="Tìm kiếm học phần"
                    placeholder="Tìm kiếm theo Mã HP và Tên học phần...."
                    value=""
                    onChange={() => {}}
                    sx={{ width: "100%", "& .MuiOutlinedInput-root": { minHeight: 32 } }}
                  />
                </Stack>
              </Stack>

              <TableContainer>
                <Table data-probe-curriculum-table="true" size="small" sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell data-probe-stt="true" sx={{ width: "3.5em", textAlign: "center" }}>STT</TableCell>
                      <TableCell sx={{ width: "6.5em" }}>Mã HP</TableCell>
                      <TableCell sx={{ minWidth: "14em" }}>Tên học phần</TableCell>
                      <TableCell data-probe-tc="true" sx={{ width: "3.5em", textAlign: "center" }}>TC</TableCell>
                      <TableCell sx={{ minWidth: "12em" }}>Nhóm kiến thức</TableCell>
                      <TableCell sx={{ minWidth: "11em", textAlign: "center" }}>Loại học phần</TableCell>
                      <TableCell sx={{ width: "4em", textAlign: "center" }}>Xóa</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell align="center">1</TableCell>
                      <TableCell>ITIS</TableCell>
                      <TableCell>An toàn bảo mật thông tin nâng cao</TableCell>
                      <TableCell align="center">2</TableCell>
                      <TableCell>Kiến thức chuyên ngành</TableCell>
                      <TableCell align="center">Bắt buộc</TableCell>
                      <TableCell align="center"><IconButton size="small">X</IconButton></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        </Box>

        {/* Representative multi-pane & dashboard structures */}
        <Box data-probe-roles-grid="true" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, gap: 2, mt: 2 }}>
          <Paper data-probe-roles-left="true" variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle2">DANH SÁCH VAI TRÒ</Typography>
          </Paper>
          <Paper data-probe-roles-right="true" variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
              <FilterSearchField label="" placeholder="Tìm quyền..." value="" onChange={() => {}} sx={{ width: "min(420px, 65%)" }} />
              <Button variant="contained">Lưu thay đổi</Button>
            </Stack>
          </Paper>
        </Box>

        <section className="operational-dashboard" data-probe-dashboard="true" style={{ marginTop: 16 }}>
          <div className="od-panel">
            <div className="od-panel-heading">
              <h2 className="od-panel-title"><span className="od-panel-title-text">Công việc cần xử lý theo bộ phận đào tạo</span></h2>
              <span>Cập nhật liên tục</span>
            </div>
          </div>
        </section>

        <TableContainer sx={{ mt: 2 }}>
          <Table size="small">
            <colgroup><col style={{ width: 220 }} /></colgroup>
            <TableHead>
              <TableRow>
                <TableCell data-probe-resizable-th="true">
                  Tiêu đề cột co giãn
                  <Box role="slider" tabIndex={0} aria-label="Độ rộng" />
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow><TableCell>Nội dung</TableCell></TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <section className="assignment-page" data-probe-assignment="true" style={{ marginTop: 16 }}>
          <Paper variant="outlined" className="assignment-summary">
            <Box className="assignment-summary-heading">
              <Typography variant="subtitle1">Tổng quan phân nhóm học viên</Typography>
              <span className="assignment-summary-total">24 học viên</span>
            </Box>
            <Box component="ul" className="assignment-summary-list">
              <li className="assignment-discipline-card">
                <div className="assignment-summary-discipline">
                  <strong>8480201 — Công nghệ thông tin</strong>
                  <span className="assignment-discipline-total">24 HV</span>
                </div>
                <ul className="assignment-summary-list">
                  <li>
                    <button type="button" className="assignment-summary-major">
                      <span className="assignment-summary-name">Công nghệ thông tin — Khoa Công nghệ thông tin</span>
                      <span className="assignment-summary-action">
                        <span className="assignment-summary-count">24 HV</span>
                      </span>
                    </button>
                  </li>
                </ul>
              </li>
            </Box>
          </Paper>
          <Box className="assignment-selection-bar" data-probe-assignment-bar="true" sx={{ mt: 1 }}>
            <Typography variant="body2">Đã chọn 12 học viên</Typography>
            <Button data-probe-assignment-btn="true" variant="contained">Thêm vào lớp đã chọn</Button>
          </Box>
        </section>

        <div className="scheduling-v20 v20-workspace v20-create-workspace" data-probe-scheduling="true" style={{ marginTop: 16 }}>
          <section className="sl-workspace sl-create-mode sl-create-figma">
            <aside className="sl-left" data-probe-sl-left="true">
              <div className="sl-scope"><div className="sl-eyebrow">PHẠM VI LÀM VIỆC</div></div>
            </aside>
            <div className="sl-right" data-probe-sl-right="true">
              <div className="sl-create-main">
                <div className="sl-create-picker" data-probe-create-picker="true">
                  <section className="sl-create-groups" data-probe-create-groups="true">
                    <div className="sl-create-section-title">Nhóm / lớp</div>
                  </section>
                  <section className="sl-create-students" data-probe-create-students="true">
                    <div className="sl-create-section-title">Danh sách học viên</div>
                  </section>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="scheduling-v20 exam-planner sl-workspace" data-probe-exam-planner="true" style={{ marginTop: 16 }}>
          <div className="sl-schedule-head" data-probe-exam-head="true">
            <div className="ep-heading-actions"><div className="sl-actions"><button type="button" className="sl-btn">Xuất</button></div></div>
            <div className="ep-week-navigation">Tuần 12</div>
            <div className="sl-actions"><button type="button" className="sl-btn sl-btn-primary">Lưu</button></div>
          </div>
          <div className="ep-session-toolbar" data-probe-ep-toolbar="true">
            <strong>Thông tin buổi thi</strong>
            <button type="button" className="sl-btn sl-btn-primary">Chỉnh sửa buổi thi</button>
          </div>
        </section>

        <AppDialog
          open
          disablePortal
          maxWidth="sm"
          title="Xác nhận điều chỉnh cấu trúc chương trình đào tạo theo khóa"
          onConfirm={() => {}}
          onClose={() => {}}
          confirmText="Xác nhận lưu thay đổi"
          cancelText="Đóng cửa sổ"
          data-probe-app-dialog="true"
        >
          <Typography>Nội dung kiểm tra hộp thoại ở mức thu phóng chữ 150%.</Typography>
        </AppDialog>

        <section className="report-preview" data-preserve-font-size="true">
          <p data-probe-preserved="true" style={{ fontSize: "12px" }}>Bản in giữ nguyên cỡ chữ</p>
        </section>

        <Footer />
      </Box>
    </MemoryRouter>
  );
}

function runBrowserProbe(fontSize, windowSize) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), `appearance-${fontSize}-`));
  const cache = createCache({ key: "css", speedy: false });
  const { container, unmount } = render(
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <ScaledUiProbe />
      </ThemeProvider>
    </CacheProvider>,
  );
  const emotionCss = [...cache.sheet.tags].map((tag) => tag.textContent).join("\n");
  const markup = container.innerHTML;
  unmount();

  const appCss = cssFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const htmlPath = path.join(folder, "probe.html");
  fs.writeFileSync(
    htmlPath,
    `<!doctype html>
    <html lang="vi" data-font-size="${fontSize}" data-ribbon-sidebar="true" style="--app-text-scale: ${fontSize / 100};">
      <head>
        <meta charset="utf-8" />
        <style>${appCss}\n${emotionCss}</style>
      </head>
      <body>
        <div id="root">${markup}</div>
        <script>
          const rightPaper = document.querySelector('[data-probe-right-paper]');
          const leftPaper = document.querySelector('[data-probe-left-paper]');
          const leftScroll = document.querySelector('[data-probe-left-scroll]');
          const leftDeleteTh = document.querySelector('[data-probe-left-delete-th]');
          const leftDeleteBtn = document.querySelector('[data-probe-left-delete-btn]');
          const searchWrap = document.querySelector('[data-probe-search-wrap]');
          const searchInput = searchWrap.querySelector('.MuiOutlinedInput-root');
          const curriculumTable = document.querySelector('[data-probe-curriculum-table]');
          const stt = document.querySelector('[data-probe-stt]');
          const tc = document.querySelector('[data-probe-tc]');
          const chip = document.querySelector('[data-probe-chip]');
          const wrapBtn = document.querySelector('[data-probe-wrap-btn]');
          const toolbarBtn = document.querySelector('[data-probe-toolbar-btn]');
          const exportBtn = document.querySelector('[data-probe-export-btn]');
          const resizableTh = document.querySelector('[data-probe-resizable-th]');
          const preserved = document.querySelector('[data-probe-preserved]');
          const filterLabel = document.querySelector('.app-filter-label');
          const footerCopy = document.querySelector('.app-footer p');
          const rolesLeft = document.querySelector('[data-probe-roles-left]');
          const rolesRight = document.querySelector('[data-probe-roles-right]');
          const assignmentSummary = document.querySelector('[data-probe-assignment] .assignment-summary');
          const assignmentBar = document.querySelector('[data-probe-assignment-bar]');
          const assignmentBtn = document.querySelector('[data-probe-assignment-btn]');
          const schedulingWrap = document.querySelector('[data-probe-scheduling]');
          const createGroups = document.querySelector('[data-probe-create-groups]');
          const createStudents = document.querySelector('[data-probe-create-students]');
          const examPlanner = document.querySelector('[data-probe-exam-planner]');
          const examHead = document.querySelector('[data-probe-exam-head]');
          const epToolbar = document.querySelector('[data-probe-ep-toolbar]');
          const dialogPaper = document.querySelector('[data-probe-app-dialog] .MuiDialog-paper');
          const dialogTitle = document.querySelector('[data-probe-app-dialog] .MuiDialogTitle-root');
          const dialogConfirmBtn = [...document.querySelectorAll('[data-probe-app-dialog] .MuiDialogActions-root button')].at(-1);
          const h1 = document.querySelector('[data-probe-h1]');
          const h2 = document.querySelector('[data-probe-h2]');
          const h4 = document.querySelector('[data-probe-h4]');
          const tabsScroller = document.querySelector('.MuiTabs-scroller');
          const result = {
            docOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            leftPaperInside: leftPaper.getBoundingClientRect().right <= window.innerWidth + 1,
            rightPaperInside: rightPaper.getBoundingClientRect().right <= window.innerWidth + 1,
            leftTableNoHScroll: leftScroll.scrollWidth <= leftScroll.clientWidth + 1,
            leftDeleteVisibleInsidePaper: leftDeleteBtn.getBoundingClientRect().right <= leftPaper.getBoundingClientRect().right + 1,
            leftDeleteThFits: leftDeleteTh.scrollWidth <= leftDeleteTh.clientWidth + 1,
            searchInsidePaper: searchInput.getBoundingClientRect().right <= rightPaper.getBoundingClientRect().right + 1,
            wrapBtnInsidePaper: wrapBtn.getBoundingClientRect().right <= rightPaper.getBoundingClientRect().right + 1,
            rolesInsideViewport: rolesLeft.getBoundingClientRect().right <= window.innerWidth + 1 && rolesRight.getBoundingClientRect().right <= window.innerWidth + 1,
            assignmentInsideViewport:
              assignmentSummary.getBoundingClientRect().right <= window.innerWidth + 1 &&
              assignmentSummary.scrollWidth <= assignmentSummary.clientWidth + 1 &&
              assignmentBar.getBoundingClientRect().right <= window.innerWidth + 1 &&
              assignmentBtn.getBoundingClientRect().right <= window.innerWidth + 1,
            schedulingInsideViewport:
              schedulingWrap.getBoundingClientRect().right <= window.innerWidth + 1 &&
              schedulingWrap.scrollWidth <= schedulingWrap.clientWidth + 1 &&
              createGroups.getBoundingClientRect().right <= window.innerWidth + 1 &&
              createStudents.getBoundingClientRect().right <= window.innerWidth + 1,
            examInsideViewport:
              examPlanner.getBoundingClientRect().right <= window.innerWidth + 1 &&
              examHead.getBoundingClientRect().right <= window.innerWidth + 1 &&
              epToolbar.getBoundingClientRect().right <= window.innerWidth + 1 &&
              epToolbar.scrollWidth <= epToolbar.clientWidth + 1,
            dialogContained:
              dialogPaper.getBoundingClientRect().right <= window.innerWidth + 1 &&
              dialogPaper.scrollWidth <= dialogPaper.clientWidth + 1 &&
              dialogTitle.scrollWidth <= dialogTitle.clientWidth + 1 &&
              dialogConfirmBtn.getBoundingClientRect().right <= dialogPaper.getBoundingClientRect().right + 1,
            dialogTitleFontSize: parseFloat(getComputedStyle(dialogTitle).fontSize),
            wrapBtnStyle: {
              whiteSpace: getComputedStyle(wrapBtn).whiteSpace,
              overflowWrap: getComputedStyle(wrapBtn).overflowWrap,
              wordBreak: getComputedStyle(wrapBtn).wordBreak,
              height: wrapBtn.getBoundingClientRect().height,
            },
            toolbarBtnStyle: {
              whiteSpace: getComputedStyle(toolbarBtn).whiteSpace,
              height: toolbarBtn.getBoundingClientRect().height,
            },
            exportBtnStyle: {
              whiteSpace: getComputedStyle(exportBtn).whiteSpace,
              height: exportBtn.getBoundingClientRect().height,
            },
            sttFits: stt.scrollWidth <= stt.clientWidth + 1,
            tcFits: tc.scrollWidth <= tc.clientWidth + 1,
            chipHeight: chip.getBoundingClientRect().height,
            chipMaxWidth: getComputedStyle(chip).maxWidth,
            filterLabelFontSize: parseFloat(getComputedStyle(filterLabel).fontSize),
            footerCopyFontSize: parseFloat(getComputedStyle(footerCopy).fontSize),
            footerCopyColor: getComputedStyle(footerCopy).color,
            resizableThWhiteSpace: getComputedStyle(resizableTh).whiteSpace,
            preservedFontSize: getComputedStyle(preserved).fontSize,
            headings: {
              h1: parseFloat(getComputedStyle(h1).fontSize),
              h2: parseFloat(getComputedStyle(h2).fontSize),
              h4: parseFloat(getComputedStyle(h4).fontSize),
            },
            tabsOverflowX: getComputedStyle(tabsScroller).overflowX,
          };
          document.body.insertAdjacentHTML('beforeend', '<pre id="checks">' + JSON.stringify(result) + '</pre>');
        </script>
      </body>
    </html>`,
    "utf8",
  );

  try {
    const dom = execFileSync(
      browser,
      ["--headless", "--disable-gpu", "--no-sandbox", `--window-size=${windowSize}`, "--dump-dom", `file:///${htmlPath.replaceAll("\\", "/")}`],
      { encoding: "utf8", windowsHide: true, timeout: 30000, stdio: ["ignore", "pipe", "ignore"] },
    );
    return JSON.parse([...dom.matchAll(/<pre id="checks">(.*?)<\/pre>/gs)].at(-1)[1]);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

const describeBrowser = browser ? describe : describe.skip;

describeBrowser("scaled appearance browser geometry", () => {
  it.each(["1366,768", "1280,720"])("keeps 150% layouts, left-pane actions, search inputs, filter labels and footer bounded without clipping at %s", (size) => {
    const checks = runBrowserProbe(150, size);
    expect(checks).toMatchObject({
      docOverflow: false,
      leftPaperInside: true,
      rightPaperInside: true,
      leftTableNoHScroll: true,
      leftDeleteVisibleInsidePaper: true,
      leftDeleteThFits: true,
      searchInsidePaper: true,
      wrapBtnInsidePaper: true,
      rolesInsideViewport: true,
      assignmentInsideViewport: true,
      schedulingInsideViewport: true,
      examInsideViewport: true,
      dialogContained: true,
    });
    expect(checks.dialogTitleFontSize).toBeGreaterThanOrEqual(20);
    expect(checks.wrapBtnStyle.whiteSpace).toBe("normal");
    expect(checks.wrapBtnStyle.overflowWrap).toBe("break-word");
    expect(checks.wrapBtnStyle.wordBreak).toBe("normal");
    expect(checks.wrapBtnStyle.height).toBeGreaterThanOrEqual(49);
    expect(checks.toolbarBtnStyle.whiteSpace).toBe("nowrap");
    expect(checks.toolbarBtnStyle.height).toBeGreaterThanOrEqual(49);
    expect(checks.exportBtnStyle.whiteSpace).toBe("nowrap");
    expect(checks.exportBtnStyle.height).toBeGreaterThanOrEqual(49);
    expect(checks.sttFits).toBe(true);
    expect(checks.tcFits).toBe(true);
    expect(checks.chipMaxWidth).toBe("100%");
    expect(checks.chipHeight).toBeGreaterThanOrEqual(24);
    expect(checks.filterLabelFontSize).toBeGreaterThanOrEqual(15);
    expect(checks.footerCopyFontSize).toBeGreaterThanOrEqual(15);
    expect(checks.footerCopyColor).toBe("rgb(82, 101, 118)");
    expect(checks.resizableThWhiteSpace).toBe("nowrap");
    expect(checks.preservedFontSize).toBe("12px");
    expect(checks.headings.h1).toBeGreaterThan(checks.headings.h2);
    expect(checks.headings.h2).toBeGreaterThan(checks.headings.h4);
    expect(checks.headings.h4).toBeGreaterThanOrEqual(18.75);
    expect(checks.tabsOverflowX).toBe("auto");
  });

  it("retains standard 40px single-line control geometry and 10.5px labels at 100%", () => {
    const checks = runBrowserProbe(100, "1366,768");
    expect(checks.wrapBtnStyle.whiteSpace).toBe("nowrap");
    expect(checks.wrapBtnStyle.height).toBeCloseTo(40, 0);
    expect(checks.toolbarBtnStyle.height).toBeCloseTo(40, 0);
    expect(checks.exportBtnStyle.height).toBeCloseTo(40, 0);
    expect(checks.filterLabelFontSize).toBeCloseTo(10.5, 1);
  });
});
