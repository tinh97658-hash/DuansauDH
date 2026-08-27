import { BRAND } from "../../config/branding";

describe("branding configuration", () => {
  it("exposes a stable, immutable application identity", () => {
    expect(BRAND.shortName).toBe("PGSMS");
    expect(BRAND.systemName).toBeTruthy();
    expect(Object.isFrozen(BRAND)).toBe(true);
  });
});
