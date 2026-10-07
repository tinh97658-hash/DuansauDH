/* Local PostgreSQL + browser smoke test. Creates and removes only its own fixtures.
 * Run with backend and frontend started after migrations:
 * node backend/test/manual/admission-browser.cjs
 * Set PLAYWRIGHT_MODULE when Playwright is installed outside this project.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");
const dotenv = require("../../../frontend/node_modules/dotenv");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const env = dotenv.parse(fs.readFileSync(path.resolve(__dirname, "../../../.env")));
const api = `http://localhost:${env.PORT}`;
const web = `http://localhost:${env.WEB_PORT}`;
const tag = `QA-XT-${randomUUID().slice(0, 8)}`;
const fixtures = { recordIds: [], roundIds: [] };
const excelFile = path.join(process.env.TEMP || ".", `${tag}-diem.xlsx`);
const client = new Client({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.POSTGRES_DB, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD });

(async () => {
  let browser, page;
  await client.connect();
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${web}/login`, { waitUntil: "domcontentloaded" });
    await page.locator("#login-email").fill(env.ADMIN_EMAIL);
    await page.locator("#login-password").fill(env.ADMIN_PASSWORD);
    const loginResponse = page.waitForResponse((response) => response.url().endsWith("/user/login"));
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    assert.equal((await loginResponse).status(), 200);
    await page.waitForURL((url) => url.pathname !== "/login", { waitUntil: "commit" });
    const request = async (method, endpoint, data, expected = 200) => {
      const response = await context.request[method](`${api}${endpoint}`, { data });
      const body = await response.json();
      assert.equal(response.status(), expected, `${method} ${endpoint}: ${JSON.stringify(body)}`);
      return body;
    };
    const catalog = await request("get", "/system/majors");
    const major = (Array.isArray(catalog) ? catalog : catalog.data || []).find((entry) => entry.program === "masters" && entry.active !== false);
    assert(major, "Requires an active masters major");
    await page.goto(`${web}/masters/admission-scores`);
    await page.getByRole("button", { name: "Tạo đợt xét tuyển", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Năm tuyển sinh").fill("2098");
    await dialog.getByLabel("Tên đợt xét tuyển").fill(tag);
    assert.equal(await dialog.getByLabel("Chỉ tiêu", { exact: true }).count(), 0);
    const roundResponse = page.waitForResponse((response) => response.url().endsWith("/plan/admission-rounds") && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "Lưu đợt xét tuyển" }).click();
    const created = await roundResponse;
    const round = await created.json();
    assert.equal(created.status(), 201); fixtures.roundIds.push(round.id);
    assert(!Object.prototype.hasOwnProperty.call(round, "quota"));
    await dialog.waitFor({ state: "hidden" });
    await page.getByLabel(`Điểm ngưỡng ${major.name}`, { exact: true }).fill("15");
    const thresholdResponse = page.waitForResponse((response) => response.url().endsWith(`/admission-rounds/${round.id}`) && response.request().method() === "PUT");
    await page.getByRole("button", { name: "Lưu điểm ngưỡng các ngành" }).click();
    assert.equal((await thresholdResponse).status(), 200);
    await page.getByRole("button", { name: "Lưu điểm ngưỡng các ngành" }).waitFor();
    for (let index = 0; index < 3; index++) {
      const record = await request("post", "/plan/admission-records", { code: `${tag}-${index}`, fullName: `${tag} Hồ sơ ${index + 1}`, majorId: major.id, trainingLevel: "Thạc sĩ", academicYear: "2098", documents: {} }, 201);
      fixtures.recordIds.push(record.id);
    }
    await page.getByRole("button", { name: "Tải lại", exact: true }).click();
    await page.getByText(`${tag}-0`, { exact: true }).waitFor();
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Tải file Excel mẫu" }).click();
    await (await downloadEvent).saveAs(excelFile);
    const ExcelJS = require("../../../frontend/node_modules/exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFile);
    const worksheet = workbook.getWorksheet("Điểm hồ sơ");
    worksheet.eachRow((row, index) => {
      if (index > 1) row.getCell(8).value = row.getCell(1).value === `${tag}-2` ? 14.5 : 15;
    });
    await workbook.xlsx.writeFile(excelFile);
    await page.getByLabel("Chọn file Excel nhập điểm").setInputFiles(excelFile);
    await page.getByText(/Đã import và lưu điểm 3 hồ sơ/).waitFor();
    const before = await request("get", `/plan/admission-rounds/${round.id}/ranking`);
    assert.equal(before.admittedCount, 0);
    await page.getByRole("button", { name: "Xét tuyển", exact: true }).click();
    const review = page.getByRole("dialog");
    await review.getByLabel(`Duyệt ${tag}-0`).waitFor();
    assert(await review.getByLabel(`Duyệt ${tag}-0`).isChecked());
    assert(await review.getByLabel(`Duyệt ${tag}-1`).isChecked());
    assert.equal(await review.getByLabel(`Duyệt ${tag}-2`).count(), 0);
    const approvalResponse = page.waitForResponse((response) => response.url().endsWith(`/admission-rounds/${round.id}/confirm`));
    await review.getByRole("button", { name: "Đồng ý duyệt" }).click();
    assert.equal((await approvalResponse).status(), 201);
    await page.getByText(/Đã duyệt 2 hồ sơ sang trạng thái/).waitFor();
    const after = await request("get", `/plan/admission-rounds/${round.id}/ranking`);
    assert.equal(after.admittedCount, 2);
    await request("put", `/plan/admission-rounds/${round.id}/scores`, { rows: [{ admissionRecordId: fixtures.recordIds[0], score: 17, version: 2 }] }, 409);
    await page.screenshot({ path: path.join(process.env.TEMP || ".", "sdh-admission-threshold.png"), fullPage: true });
    assert.deepEqual(errors, []);
    console.log("PASS: shared round, Excel template download/import, inclusive cutoff, all tied candidates admitted, immutable approved scores.");
  } finally {
    if (fs.existsSync(excelFile)) fs.unlinkSync(excelFile);
    for (const id of fixtures.recordIds) {
      await client.query("DELETE FROM admission_evaluation_history WHERE admission_record_id = $1", [id]);
      await client.query("DELETE FROM admission_records WHERE id = $1", [id]);
    }
    for (const id of fixtures.roundIds) await client.query("DELETE FROM admission_rounds WHERE id = $1", [id]);
    await browser?.close(); await client.end();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
