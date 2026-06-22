import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import type { FileItem } from '../api/files';
import {
  listFiles,
  uploadFile,
  createDirectory,
  renameFile,
  deleteFile,
  getDownloadUrl,
} from '../api/files';
import AppHeader from '../components/AppHeader';
import DirIcon from '../components/DirIcon';
import FileIcon from '../components/FileIcon';
import LoadingSpinner from '../components/LoadingSpinner';
import PencilIcon from '../components/icons/PencilIcon';
import DownloadIcon from '../components/icons/DownloadIcon';
import TrashIcon from '../components/icons/TrashIcon';
import UploadIcon from '../components/icons/UploadIcon';
import PlusIcon from '../components/icons/PlusIcon';
import { formatSize, formatRelativeDate } from '../utils/format';
import './FileManager.css';

export default function FileManager() {
  const navigate = useNavigate();

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
      <AppHeader title="文件" onLogout={handleLogout} />

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
                {uploading ? '上传中…' : <><UploadIcon size={14} />上传文件</>}
              </button>
              <button className="fm-btn fm-btn-action" onClick={() => setShowNewFolder(true)}>
                <PlusIcon size={14} />新建文件夹
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
                        <td className="fm-cell-date">{formatRelativeDate(item.createTime)}</td>
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
                              <PencilIcon size={14} />
                            </button>
                            {!item.isDir && (
                              <a
                                className="fm-btn fm-btn-row"
                                title="下载"
                                href={getDownloadUrl(item.id)}
                                download={item.name}
                              >
                                <DownloadIcon size={14} />
                              </a>
                            )}
                            <button
                              className="fm-btn fm-btn-row fm-btn-row-danger"
                              title="删除"
                              disabled={deleting === item.id}
                              onClick={() => handleDelete(item.id)}
                            >
                              <TrashIcon size={14} />
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
