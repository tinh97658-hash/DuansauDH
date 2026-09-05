import { ROLES_KEY } from "../../src/common/auth-user.js";
import { SystemController } from "../../src/system/system.controller.js";
import { SystemService } from "../../src/system/system.service.js";
import { jest } from "@jest/globals";

const buildService = () => {
  const rooms = {
    findAll: jest.fn(),
    findOne: jest.fn().mockResolvedValue(null),
    findByPk: jest.fn(),
    create: jest.fn(),
  };
  const service = new SystemService(
    {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, rooms as never,
  );
  return { service, rooms };
};

describe("SystemService Room catalog", () => {
  it("lists only active shared rooms for authenticated Staff", async () => {
    const { service, rooms } = buildService();
    rooms.findAll.mockResolvedValue([{ id: "room-1", code: "301", capacity: 40, isActive: true }]);

    await expect(service.listRooms()).resolves.toEqual([{ id: "room-1", code: "301", capacity: 40, isActive: true }]);
    expect(rooms.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    expect(Reflect.getMetadata(ROLES_KEY, SystemController.prototype.rooms)).toEqual(["admin", "supervisor", "examiner"]);
  });

  it("allows the admin catalog view to include inactive rooms", async () => {
    const { service, rooms } = buildService();
    rooms.findAll.mockResolvedValue([{ id: "room-2", code: "302", capacity: null, isActive: false }]);

    await expect(service.listRooms(true)).resolves.toEqual([{ id: "room-2", code: "302", capacity: null, isActive: false }]);
    expect(rooms.findAll).toHaveBeenCalledWith({ order: [["code", "ASC"], ["name", "ASC"]] });
  });

  it("does not let a non-admin query expose inactive rooms", async () => {
    const listRooms = jest.fn().mockResolvedValue([]);
    const controller = new SystemController({ listRooms } as never);

    await controller.rooms({ role: "supervisor" }, "true");
    expect(listRooms).toHaveBeenCalledWith(false);

    await controller.rooms({ role: "admin" }, "true");
    expect(listRooms).toHaveBeenLastCalledWith(true);
  });

  it("creates a globally code-unique room through the admin catalog operation", async () => {
    const { service, rooms } = buildService();
    const created = { id: "room-1", code: "301", name: "Phòng 301", capacity: 40, isActive: true };
    rooms.create.mockResolvedValue(created);

    await expect(service.createRoom({ code: "301", name: "Phòng 301", capacity: 40, isActive: true })).resolves.toBe(created);
    expect(rooms.findOne).toHaveBeenCalledWith({ where: { code: "301" } });
    expect(rooms.create).toHaveBeenCalledWith({ code: "301", name: "Phòng 301", capacity: 40, isActive: true });
    expect(Reflect.getMetadata(ROLES_KEY, SystemController.prototype.createRoom)).toEqual(["admin"]);
  });

  it("updates and deactivates a room without deleting it", async () => {
    const { service, rooms } = buildService();
    const room = { id: "room-1", code: "301", update: jest.fn().mockResolvedValue(undefined) };
    rooms.findByPk.mockResolvedValue(room);

    await expect(service.updateRoom(room.id, { name: "Phòng học 101", isActive: false })).resolves.toBe(room);
    expect(room.update).toHaveBeenCalledWith({ name: "Phòng học 101", isActive: false });
    expect(Reflect.getMetadata(ROLES_KEY, SystemController.prototype.updateRoom)).toEqual(["admin"]);
  });

  it("rejects a duplicate room code", async () => {
    const { service, rooms } = buildService();
    rooms.findOne.mockResolvedValue({ id: "existing-room" });

    await expect(service.createRoom({ code: "301", name: "Trùng mã", capacity: 20 })).rejects.toThrow('Mã "301" đã tồn tại');
    expect(rooms.create).not.toHaveBeenCalled();
  });
});
