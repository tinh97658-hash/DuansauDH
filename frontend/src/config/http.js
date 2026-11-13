import axios from "axios";

const configuredApiUrl = process.env.REACT_APP_API_URL || "/api";
// Resolve same-origin configuration once: prefixed callers use an absolute URL,
// while legacy relative callers still resolve against the same API base.
export const API_BASE_URL = new URL(configuredApiUrl, window.location.origin).href.replace(/\/$/, "");
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;

