import axios from "axios";
import { API_BASE_URL } from "../../config/http";

/**
 * Tầng gọi API quản lý tài khoản nhân sự (RBAC).
 * Tách khỏi component để dễ kiểm thử; dùng chung axios toàn cục (baseURL + withCredentials).
 */
const url = (path) => `${API_BASE_URL}${path}`;
const config = (extra = {}) => ({ withCredentials: true, ...extra });

export const mePermissions = () => axios.get(url("/accounts/me/permissions"), config()).then(({ data }) => data);

export const listAccounts = (params = {}) => axios.get(url("/accounts"), config({ params })).then(({ data }) => data);

export const getAccount = (id) => axios.get(url(`/accounts/${id}`), config()).then(({ data }) => data);

export const createAccount = (payload) => axios.post(url("/accounts"), payload, config()).then(({ data }) => data);

export const updateAccount = (id, payload) => axios.put(url(`/accounts/${id}`), payload, config()).then(({ data }) => data);

export const updateAccountStatus = (id, status) =>
  axios.patch(url(`/accounts/${id}/status`), { status }, config()).then(({ data }) => data);

export const resetAccountPassword = (id, password) =>
  axios.post(url(`/accounts/${id}/reset-password`), password ? { password } : {}, config()).then(({ data }) => data);

export const revokeAccountSessions = (id) =>
  axios.post(url(`/accounts/${id}/revoke-sessions`), {}, config()).then(({ data }) => data);

export const changeOwnPassword = (payload) => axios.patch(url("/accounts/me/password"), payload, config()).then(({ data }) => data);

export const listAuditLogs = (params = {}) => axios.get(url("/accounts/audit-logs"), config({ params })).then(({ data }) => data);

export const assignScheduling = (staffId) => axios.put(url("/scheduling/assignee"), { staffId }, config()).then(({ data }) => data);
