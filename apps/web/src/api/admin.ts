import { apiClient } from './client';

// 管理员仪表盘数据
export interface AdminDashboard {
  totalUsers: number;
  totalFiles: number;
  totalFileSize: number;
  totalRecycled: number;
  totalRoles: number;
  totalPermissions: number;
}

// 用户信息
export interface AdminUser {
  id: number;
  username: string;
  nickname: string | null;
  email: string | null;
  avatar: string | null;
  enabled: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: AdminRoleBrief[];
}

export interface AdminRoleBrief {
  id: number;
  code: string;
  name: string;
}

// 角色信息
export interface AdminRole {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  permissions: AdminPermissionBrief[];
}

export interface AdminPermissionBrief {
  id: number;
  code: string;
  name: string;
}

// 权限信息
export interface AdminPermission {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// 分页响应
export interface PageResponse<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

// 获取仪表盘数据
export async function getDashboard(): Promise<AdminDashboard> {
  return apiClient<AdminDashboard>('/admin/dashboard');
}

// 获取用户列表
export async function listUsers(page: number = 1, size: number = 20, keyword?: string): Promise<PageResponse<AdminUser>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (keyword) params.append('keyword', keyword);
  return apiClient<PageResponse<AdminUser>>(`/admin/users?${params}`);
}

// 获取用户详情
export async function getUser(id: number): Promise<AdminUser> {
  return apiClient<AdminUser>(`/admin/users/${id}`);
}

// 更新用户
export async function updateUser(id: number, data: { nickname?: string; email?: string; enabled?: boolean }): Promise<void> {
  await apiClient<void>(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// 分配用户角色
export async function assignUserRoles(id: number, roleIds: number[]): Promise<void> {
  await apiClient<void>(`/admin/users/${id}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ roleIds }),
  });
}

// 获取角色列表
export async function listRoles(): Promise<AdminRole[]> {
  return apiClient<AdminRole[]>('/admin/roles');
}

// 创建角色
export async function createRole(code: string, name: string): Promise<AdminRole> {
  return apiClient<AdminRole>('/admin/roles', {
    method: 'POST',
    body: JSON.stringify({ code, name }),
  });
}

// 更新角色
export async function updateRole(id: number, code?: string, name?: string): Promise<AdminRole> {
  return apiClient<AdminRole>(`/admin/roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ code, name }),
  });
}

// 删除角色
export async function deleteRole(id: number): Promise<void> {
  await apiClient<void>(`/admin/roles/${id}`, { method: 'DELETE' });
}

// 分配角色权限
export async function assignRolePermissions(id: number, permissionIds: number[]): Promise<void> {
  await apiClient<void>(`/admin/roles/${id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissionIds }),
  });
}

// 获取权限列表
export async function listPermissions(): Promise<AdminPermission[]> {
  return apiClient<AdminPermission[]>('/admin/permissions');
}

// 创建权限
export async function createPermission(code: string, name: string): Promise<AdminPermission> {
  return apiClient<AdminPermission>('/admin/permissions', {
    method: 'POST',
    body: JSON.stringify({ code, name }),
  });
}

// 更新权限
export async function updatePermission(id: number, code?: string, name?: string): Promise<AdminPermission> {
  return apiClient<AdminPermission>(`/admin/permissions/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ code, name }),
  });
}

// 删除权限
export async function deletePermission(id: number): Promise<void> {
  await apiClient<void>(`/admin/permissions/${id}`, { method: 'DELETE' });
}