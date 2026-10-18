import axios from "axios";
import { API_BASE_URL } from "../../config/http";

/** Tầng gọi API vai trò và ma trận quyền. */
const url = (path) => `${API_BASE_URL}${path}`;
const config = (extra = {}) => ({ withCredentials: true, ...extra });

export const listRoles = () => axios.get(url("/roles"), config()).then(({ data }) => data);

export const listPermissionCatalog = () => axios.get(url("/roles/permissions"), config()).then(({ data }) => data);

export const getRole = (id) => axios.get(url(`/roles/${id}`), config()).then(({ data }) => data);

export const createRole = (payload) => axios.post(url("/roles"), payload, config()).then(({ data }) => data);

export const updateRole = (id, payload) => axios.put(url(`/roles/${id}`), payload, config()).then(({ data }) => data);

export const setRolePermissions = (id, permissionIds) =>
  axios.put(url(`/roles/${id}/permissions`), { permissionIds }, config()).then(({ data }) => data);

export const deleteRole = (id) => axios.delete(url(`/roles/${id}`), config()).then(({ data }) => data);
