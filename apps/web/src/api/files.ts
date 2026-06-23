import { apiClient, apiUpload } from './client';
import { tokenStore } from './tokenStore';

const BASE_URL = '/api/v1';

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

export async function uploadFile(file: File, path = '/', md5?: string): Promise<FileItem> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('path', path);
  if (md5) fd.append('md5', md5);
  return apiUpload<FileItem>('/files/upload', fd);
}

export async function checkHash(md5: string): Promise<{ exists: boolean; size?: number }> {
  return apiClient<{ exists: boolean; size?: number }>(
    `/files/check-hash?md5=${encodeURIComponent(md5)}`,
  );
}

export async function quickUpload(
  md5: string,
  fileName: string,
  path = '/',
): Promise<FileItem> {
  const params = new URLSearchParams({ md5, fileName, path });
  return apiClient<FileItem>(`/files/quick-upload?${params}`, { method: 'POST' });
}

export async function uploadChunk(
  file: Blob,
  md5: string,
  index: number,
): Promise<void> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('md5', md5);
  fd.append('index', String(index));
  await apiUpload<void>(`/files/chunk`, fd);
}

export async function mergeChunks(
  md5: string,
  fileName: string,
  path = '/',
): Promise<FileItem> {
  const params = new URLSearchParams({ md5, fileName, path });
  return apiClient<FileItem>(`/files/merge?${params}`, { method: 'POST' });
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

export async function downloadFile(id: string, filename: string): Promise<void> {
  const token = tokenStore.getAccessToken();
  const res = await fetch(`${BASE_URL}/files/download/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? '需要授权' : '下载失败');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function fetchPreviewBlobUrl(id: string): Promise<string> {
  const token = tokenStore.getAccessToken();
  const res = await fetch(`${BASE_URL}/files/${id}/preview`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? '需要授权' : '预览加载失败');
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function fetchPreviewText(id: string): Promise<string> {
  const token = tokenStore.getAccessToken();
  const res = await fetch(`${BASE_URL}/files/${id}/preview`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? '需要授权' : '预览加载失败');
  }
  return res.text();
}

// ── Batch operations ──

type BatchIdsRequest = { ids: string[] };

export async function batchDelete(ids: string[]): Promise<void> {
  await apiClient<void>('/files/batch/delete', {
    method: 'POST',
    body: JSON.stringify({ ids } satisfies BatchIdsRequest),
  });
}

export async function batchMove(ids: string[], targetParentId: string): Promise<FileItem[]> {
  return apiClient<FileItem[]>('/files/batch/move', {
    method: 'POST',
    body: JSON.stringify({ ids, targetParentId }),
  });
}

export async function batchCopy(ids: string[], targetParentId: string): Promise<FileItem[]> {
  return apiClient<FileItem[]>('/files/batch/copy', {
    method: 'POST',
    body: JSON.stringify({ ids, targetParentId }),
  });
}
