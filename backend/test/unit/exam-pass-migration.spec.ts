import { jest } from "@jest/globals";
import { up, down } from "../../src/database/migrations/053-exam-pass-conditions.js";

it("never rewrites saved outcomes when migrating or rolling back pass conditions", async () => {
  const query = jest.fn<any>();
  const transaction = jest.fn<any>();
  const context = { sequelize: { query, transaction } };
  await up({ context });
  await down({ context });
  expect(query).not.toHaveBeenCalled();
  expect(transaction).not.toHaveBeenCalled();
});
