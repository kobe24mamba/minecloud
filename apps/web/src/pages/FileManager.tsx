import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredUser, logout } from '../api/auth';
import type { FileItem } from '../api/files';
import {
  listFiles,
  uploadFile,
  createDirectory,
  renameFile,
  deleteFile,
  getDownloadUrl,
} from '../api/files';
import Logo from '../components/Logo';
import DirIcon from '../components/DirIcon';
import FileIcon from '../components/FileIcon';
import './FileManager.css';

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 86400000 * 7) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return '上周' + days[d.getDay()];
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function LoadingSpinner() {
  return (
    <div className="fm-loading">
      <div className="fm-spinner" />
    </div>
  );
}

export default function FileManager() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [items, setItems] = useState<FileItem[]>([]);
  const [error, setError] = useState('');
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([
    { id: '0', name: 'root' },
  ]);

  const [uploading, setUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const uploadRef = useRef<HTMLInputElement>(null);
  const newFolderRef = useRef<HTMLInputElement>(null);

  const currentParentId = breadcrumb[breadcrumb.length - 1].id;

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError('');
    listFiles(currentParentId).then((data) => {
      if (cancelled) return;
      setItems(data);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : '加载失败');
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentParentId]);

  useEffect(() => {
    if (showNewFolder) {
      newFolderRef.current?.focus();
    }
  }, [showNewFolder]);

  function navigateToDir(id: string, name: string) {
    setBreadcrumb((prev) => [...prev, { id, name }]);
  }

  function navigateBreadcrumb(index: number) {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  }

  async function reloadFiles() {
    try {
      const data = await listFiles(currentParentId);
      setItems(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const currentPath = '/' + breadcrumb.slice(1).map((s) => s.name).join('/');
      await createDirectory(name, currentPath);
      setNewFolderName('');
      setShowNewFolder(false);
      await reloadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const currentPath = '/' + breadcrumb.slice(1).map((s) => s.name).join('/');
      await uploadFile(file, currentPath);
      await reloadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) return;
    try {
      await renameFile(renaming.id, name);
      setRenaming(null);
      setRenameValue('');
      await reloadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '重命名失败');
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteFile(id);
      await reloadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(null);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="fm">
      <header className="fm-header">
        <div className="fm-header-left">
          <Logo />
          <span>minecloud</span>
        </div>
        <div className="fm-header-center">
          <span className="fm-header-title">文件</span>
        </div>
        <div className="fm-header-right">
          <span>{user?.nickname || user?.username}</span>
          <button className="fm-btn fm-btn-header" onClick={handleLogout}>
            退出
          </button>
        </div>
      </header>

      <div className="fm-body">
        <div className="fm-content">
          <div className="fm-breadcrumb-bar">
            <nav className="fm-breadcrumb">
              {breadcrumb.map((seg, i) => (
                <span key={i} className="fm-bc-segment">
                  {i > 0 && <span className="fm-bc-sep">/</span>}
                  {i === breadcrumb.length - 1 ? (
                    <span className="fm-bc-current">{seg.name}</span>
                  ) : (
                    <button className="fm-bc-link" onClick={() => navigateBreadcrumb(i)}>
                      {seg.name}
                    </button>
                  )}
                </span>
              ))}
            </nav>

            <div className="fm-actions">
              <button
                className="fm-btn fm-btn-action"
                onClick={() => uploadRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? '上传中…' : '上传文件'}
              </button>
              <button className="fm-btn fm-btn-action" onClick={() => setShowNewFolder(true)}>
                新建文件夹
              </button>
              <input
                ref={uploadRef}
                type="file"
                className="fm-hidden-input"
                onChange={handleUpload}
              />
            </div>
          </div>

          {error && <div className="fm-error">{error}</div>}

          {isLoading ? (
            <LoadingSpinner />
          ) : items.length === 0 && !showNewFolder ? (
            <div className="fm-empty">
              <DirIcon className="fm-empty-icon" fill="#8b949e" />
              <p className="fm-empty-text">此目录为空</p>
            </div>
          ) : (
            <>
              {showNewFolder && (
                <form className="fm-new-folder" onSubmit={handleCreateFolder}>
                  <DirIcon />
                  <input
                    ref={newFolderRef}
                    className="fm-input-inline"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="文件夹名称"
                    onBlur={() => {
                      if (!newFolderName.trim()) setShowNewFolder(false);
                    }}
                  />
                  <button className="fm-btn fm-btn-primary-sm" type="submit">
                    创建
                  </button>
                  <button
                    className="fm-btn fm-btn-link"
                    type="button"
                    onClick={() => setShowNewFolder(false)}
                  >
                    取消
                  </button>
                </form>
              )}

              <div className="fm-table-wrap">
                <table className="fm-table">
                  <thead>
                    <tr>
                      <th className="fm-th-name">名称</th>
                      <th className="fm-th-size">大小</th>
                      <th className="fm-th-date">修改时间</th>
                      <th className="fm-th-action" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="fm-row">
                        <td className="fm-cell-name">
                          {item.isDir ? (
                            <button
                              className="fm-name-link"
                              onClick={() => navigateToDir(item.id, item.name)}
                            >
                              {item.isDir ? <DirIcon /> : <FileIcon name={item.name} />}
                              <span>{item.name}</span>
                            </button>
                          ) : (
                            <a
                              className="fm-name-link"
                              href={getDownloadUrl(item.id)}
                              download={item.name}
                            >
                              {item.isDir ? <DirIcon /> : <FileIcon name={item.name} />}
                              <span>{item.name}</span>
                            </a>
                          )}
                        </td>
                        <td className="fm-cell-size">{item.isDir ? '—' : formatSize(item.size)}</td>
                        <td className="fm-cell-date">{formatDate(item.createTime)}</td>
                        <td className="fm-cell-action">
                          <div className="fm-row-actions">
                            <button
                              className="fm-btn fm-btn-row"
                              title="重命名"
                              onClick={() => {
                                setRenaming({ id: item.id, name: item.name });
                                setRenameValue(item.name);
                              }}
                            >
                              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                                <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L3.42 10.14a.25.25 0 00-.088.167l-.508 1.777 1.777-.508a.25.25 0 00.168-.089l8.608-8.61a.25.25 0 000-.354l-1.086-1.086z" />
                              </svg>
                            </button>
                            {!item.isDir && (
                              <a
                                className="fm-btn fm-btn-row"
                                title="下载"
                                href={getDownloadUrl(item.id)}
                                download={item.name}
                              >
                                <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                                  <path d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14H2.75zM8 1a.75.75 0 01.75.75v7.19l1.72-1.72a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06l1.72 1.72V1.75A.75.75 0 018 1z" />
                                </svg>
                              </a>
                            )}
                            <button
                              className="fm-btn fm-btn-row fm-btn-row-danger"
                              title="删除"
                              disabled={deleting === item.id}
                              onClick={() => handleDelete(item.id)}
                            >
                              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                                <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5H8V1.75C8 .784 7.216 0 6.25 0h-2.5C2.784 0 2 .784 2 1.75V3H.75a.75.75 0 000 1.5h.652l.922 8.968A1.75 1.75 0 004.066 15h7.868a1.75 1.75 0 001.742-1.532l.922-8.968h.652a.75.75 0 000-1.5H11V1.75zM3.678 4.572l.876 8.527a.25.25 0 00.249.227h7.394a.25.25 0 00.249-.227l.876-8.527H3.678z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {renaming && (
        <div className="fm-overlay" onClick={() => setRenaming(null)}>
          <form
            className="fm-modal"
            onSubmit={handleRename}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="fm-modal-title">重命名</h3>
            <input
              className="fm-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            <div className="fm-modal-actions">
              <button className="fm-btn fm-btn-primary" type="submit">
                确定
              </button>
              <button
                className="fm-btn"
                type="button"
                onClick={() => setRenaming(null)}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
