import axios from "axios";

export const API_BASE_URL = (process.env.REACT_APP_API_URL || "/api").replace(/\/$/, "");
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;


// Both legacy relative endpoints and explicitly prefixed endpoints are used.
axios.interceptors.request.use((config) => {
  if (API_BASE_URL.startsWith("/") && config.baseURL === API_BASE_URL &&
      (config.url === API_BASE_URL || config.url?.startsWith(API_BASE_URL + "/"))) {
    config.baseURL = "";
  }
  return config;
});
