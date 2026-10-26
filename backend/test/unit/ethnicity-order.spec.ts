import { SystemService } from "../../src/system/system.service.js";

it("orders cities by Vietnamese name regardless of manual sort order", async () => {
  const rows = [
    { name: "Hưng Yên", sortOrder: 0 },
    { name: "Hải Phòng", sortOrder: 1 },
    { name: "Đà Nẵng", sortOrder: 99 },
    { name: "Bình Dương", sortOrder: 2 },
  ];
  const context = { cities: {}, listAll: async () => rows };
  const result = await SystemService.prototype.listCities.call(context as any);
  expect(result.map((row: any) => row.name)).toEqual(["Bình Dương", "Đà Nẵng", "Hải Phòng", "Hưng Yên"]);
});

it("orders wards by Vietnamese name and retains district information", async () => {
  const district = { name: "Quận mẫu" };
  const rows = [
    { name: "Đông Hải", sortOrder: 0, district },
    { name: "An Biên", sortOrder: 99, district },
    { name: "Dư Hàng", sortOrder: 1, district },
  ];
  const context = { wards: { findAll: async () => rows } };
  const result = await SystemService.prototype.listWards.call(context as any);
  expect(result.map((row: any) => row.name)).toEqual(["An Biên", "Dư Hàng", "Đông Hải"]);
  expect(result.every((row: any) => row.district === district)).toBe(true);
});

it("orders nationalities by Vietnamese name regardless of manual sort order", async () => {
  const rows = [
    { name: "Việt Nam", sortOrder: 0 },
    { name: "Hàn Quốc", sortOrder: 2 },
    { name: "Hoa Kỳ", sortOrder: 1 },
    { name: "Campuchia", sortOrder: 99 },
  ];
  const context = { nationalities: {}, listAll: async () => rows };
  const result = await SystemService.prototype.listNationalities.call(context as any);
  expect(result.map((row: any) => row.name)).toEqual(["Campuchia", "Hàn Quốc", "Hoa Kỳ", "Việt Nam"]);
});

it("orders ethnicities by Vietnamese name regardless of manual sort order", async () => {
  const rows = [
    { name: "Kinh", sortOrder: 0 },
    { name: "Đan Lai", sortOrder: 1 },
    { name: "Ba Na", sortOrder: 99 },
    { name: "Dao", sortOrder: 2 },
  ];
  const context = { ethnicities: {}, listAll: async () => rows };
  const result = await SystemService.prototype.listEthnicities.call(context as any);
  expect(result.map((row: any) => row.name)).toEqual(["Ba Na", "Dao", "Đan Lai", "Kinh"]);
});
