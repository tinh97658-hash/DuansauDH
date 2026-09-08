import axios from "axios";
import { API_BASE_URL } from "../../config/http";

describe("API URL composition", () => {
  it.each([
    ["/auth/session", "/api/auth/session"],
    ["/api/scheduling/course-offerings?program=masters", "/api/scheduling/course-offerings?program=masters"],
    ["https://example.test/api/health", "https://example.test/api/health"],
  ])("resolves %s without duplicating the API prefix", async (url, expected) => {
    expect(API_BASE_URL).toBe("/api");
    const response = await axios.get(url, {
      adapter: async (config) => ({ data: axios.getUri(config), status: 200, statusText: "OK", headers: {}, config }),
    });
    expect(response.data).toBe(expected);
    expect(response.config.withCredentials).toBe(true);
  });
});
