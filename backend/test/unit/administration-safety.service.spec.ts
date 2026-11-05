import { ConflictException } from "@nestjs/common";
import { AdministrationSafetyService, ADMINISTRATION_PERMISSIONS } from "../../src/auth/administration-safety.service.js";
import {workingProfileStorage} from '../../src/auth/profile-context.js';

describe("AdministrationSafetyService", () => {
  const build = () => {
    const sequelize = { query: jest.fn() };
    return { sequelize, service: new AdministrationSafetyService(sequelize as any) };
  };
  it("serializes mutations with a transaction scoped lock", async () => {
    const { service, sequelize } = build();
    const transaction = {} as any;
    await service.lock(transaction);
    expect(sequelize.query).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock(74621901)", { transaction });
  });
  it("accepts an effective administrator independent of role code", async () => {
    const { service, sequelize } = build();
    sequelize.query.mockResolvedValue([{ id: "custom-role-member" }]);
    await expect(service.assertRetained({} as any)).resolves.toBeUndefined();
    const [sql, options] = sequelize.query.mock.calls[0];
    expect(sql).toContain("COUNT(DISTINCT p.code)");
    expect(sql).not.toContain("is_superadmin");
    expect(options.replacements.codes).toEqual(ADMINISTRATION_PERMISSIONS);
  });
  it("rejects mutations leaving no active staff with all administration permissions", async () => {
    const { service, sequelize } = build();
    sequelize.query.mockResolvedValue([]);
    await expect(service.assertRetained({} as any)).rejects.toThrow(ConflictException);
  });
  it('prevents losing management access from the active profile even if another administrator exists',async()=>{
    const {service,sequelize}=build();sequelize.query.mockResolvedValue([]);
    await workingProfileStorage.run({staffId:'actor',roleId:'profile',selectionRequired:false},async()=>{
      await expect(service.assertActorRetained('actor',{} as any)).rejects.toThrow(ConflictException);
    });
    expect(sequelize.query.mock.calls[0][1].replacements.roleId).toBe('profile');
  });
});
