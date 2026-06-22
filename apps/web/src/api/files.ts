import { apiClient, apiUpload } from './client';

export interface FileItem {
  id: string;
  name: string;
  parentId: string | null;
  isDir: boolean;
  size: number;
  fileHash: string | null;
  createTime: string;
  deleteTime: string | null;
}

export async function listFiles(parentId?: string): Promise<FileItem[]> {
  return apiClient<FileItem[]>(`/files/list?parentId=${parentId ?? '0'}`);
}

export async function browse(path: string): Promise<FileItem[]> {
  return apiClient<FileItem[]>(`/files/browse?path=${encodeURIComponent(path)}`);
}

export async function getFileDetail(id: string): Promise<FileItem> {
  return apiClient<FileItem>(`/files/${id}`);
}

export async function uploadFile(file: File, path = '/'): Promise<FileItem> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('path', path);
  return apiUpload<FileItem>('/files/upload', fd);
}

export async function createDirectory(name: string, path = '/'): Promise<FileItem> {
  return apiClient<FileItem>(
    `/files/mkdir?name=${encodeURIComponent(name)}&path=${encodeURIComponent(path)}`,
    { method: 'POST' },
  );
}

export async function renameFile(id: string, name: string): Promise<FileItem> {
  return apiClient<FileItem>(`/files/${id}/rename`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function moveFile(id: string, targetParentId: string): Promise<FileItem> {
  return apiClient<FileItem>(`/files/${id}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetParentId }),
  });
}

export async function copyFile(id: string, targetParentId: string): Promise<FileItem> {
  return apiClient<FileItem>(`/files/${id}/copy`, {
    method: 'POST',
    body: JSON.stringify({ targetParentId }),
  });
}

export async function deleteFile(id: string): Promise<void> {
  await apiClient<void>(`/files/${id}`, { method: 'DELETE' });
}

export function getDownloadUrl(id: string): string {
  return `/api/v1/files/download/${id}`;
}

export function getPreviewUrl(id: string): string {
  return `/api/v1/files/preview/${id}`;
}
