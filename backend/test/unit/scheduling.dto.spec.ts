import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CourseOfferingCandidatesQueryDto,
  CreateTeachingSessionDto,
  ListTeachingSessionsQueryDto,
  PreviewCourseOfferingParticipantsDto,
} from "../../src/scheduling/dto/scheduling.dto.js";
import { CreateRoomDto, UpdateRoomDto } from "../../src/system/dto/catalog.dto.js";

describe("CourseOfferingCandidatesQueryDto", () => {
  const baseQuery = {
    program: "masters",
    majorId: "8525f8d4-892f-4f9d-88f2-0c7680a879b8",
  };

  it("trims and accepts a non-empty academic year", async () => {
    const dto = plainToInstance(CourseOfferingCandidatesQueryDto, {
      ...baseQuery,
      academicYear: " 2026 ",
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.academicYear).toBe("2026");
  });

  it.each(["", "   "])("rejects an empty academic year after trim: %p", async (academicYear) => {
    const dto = plainToInstance(CourseOfferingCandidatesQueryDto, { ...baseQuery, academicYear });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});

describe("PreviewCourseOfferingParticipantsDto", () => {
  const id = "8525f8d4-892f-4f9d-88f2-0c7680a879b8";
  it("accepts a non-empty array of unique UUIDs", async () => {
    expect(await validate(plainToInstance(PreviewCourseOfferingParticipantsDto, { classGroupIds: [id] }))).toHaveLength(0);
  });
  it.each([undefined, [], id, [id, id], ["invalid"]])("rejects invalid group ids: %p", async (classGroupIds) => {
    expect(await validate(plainToInstance(PreviewCourseOfferingParticipantsDto, { classGroupIds }))).not.toHaveLength(0);
  });
});

describe("TeachingSession DTOs", () => {
  const sessionInput = {
    courseOfferingId: "8525f8d4-892f-4f9d-88f2-0c7680a879b8",
    sessionDate: "2026-09-12",
    startTime: "08:00",
    endTime: "10:30",
    period: "MORNING",
    lecturerId: "f953af83-36b6-431c-a348-da68463c21c8",
    roomId: "613bcf56-69c6-4986-ae21-f5f46671a9c0",
  };

  it("accepts real date and time-range fields", async () => {
    const dto = plainToInstance(CreateTeachingSessionDto, sessionInput);
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(["MORNING", "8:00", "24:00", "08:60"])("rejects a non-time slot value: %p", async (startTime) => {
    const dto = plainToInstance(CreateTeachingSessionDto, { ...sessionInput, startTime });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it("accepts only the two semantic teaching periods", async () => {
    const valid = plainToInstance(CreateTeachingSessionDto, { ...sessionInput, period: "AFTERNOON" });
    const invalid = plainToInstance(CreateTeachingSessionDto, { ...sessionInput, period: "EVENING" });
    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });

  it("requires a valid date range for calendar reads", async () => {
    const valid = plainToInstance(ListTeachingSessionsQueryDto, { from: "2026-09-01", to: "2026-09-30" });
    const invalid = plainToInstance(ListTeachingSessionsQueryDto, { from: "2026-09", to: "2026-09-30" });

    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});

describe("Room DTOs", () => {
  it("requires a positive integer capacity and a code starting with its floor digit", async () => {
    const valid = plainToInstance(CreateRoomDto, { code: "301", name: "Phòng 301", capacity: 40 });
    const missingCapacity = plainToInstance(CreateRoomDto, { code: "301", name: "Phòng 301" });
    const invalidCode = plainToInstance(CreateRoomDto, { code: "A301", name: "Phòng 301", capacity: 40 });
    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(missingCapacity)).not.toHaveLength(0);
    expect(await validate(invalidCode)).not.toHaveLength(0);
  });

  it("allows a legacy Room to receive capacity through update", async () => {
    const valid = plainToInstance(UpdateRoomDto, { capacity: 50 });
    const invalid = plainToInstance(UpdateRoomDto, { capacity: 0 });
    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
