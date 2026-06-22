import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPermissions, createPermission, updatePermission, deletePermission, type AdminPermission } from '../api/admin';
import { logout } from '../api/auth';
import AppHeader from '../components/AppHeader';
import './AdminPage.css';

export default function AdminPermissions() {
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [editingPermission, setEditingPermission] = useState<AdminPermission | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadPermissions();
  }, []);

  async function loadPermissions() {
    setLoading(true);
    setError('');
    try {
      const data = await listPermissions();
      setPermissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  async function handleCreate() {
    if (!newCode.trim() || !newName.trim()) {
      alert('请填写权限编码和名称');
      return;
    }
    try {
      await createPermission(newCode.trim(), newName.trim());
      setShowCreate(false);
      setNewCode('');
      setNewName('');
      loadPermissions();
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败');
    }
  }

  function startEdit(permission: AdminPermission) {
    setEditingPermission(permission);
    setEditCode(permission.code);
    setEditName(permission.name);
  }

  async function saveEdit() {
    if (!editingPermission) return;
    try {
      await updatePermission(editingPermission.id, editCode.trim(), editName.trim());
      setEditingPermission(null);
      loadPermissions();
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失败');
    }
  }

  async function handleDelete(permission: AdminPermission) {
    if (!confirm(`确定删除权限 "${permission.name}"？`)) return;
    try {
      await deletePermission(permission.id);
      loadPermissions();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  }

  return (
    <div className="admin-page">
      <AppHeader onLogout={handleLogout} />
      <main className="admin-body">
        <div className="admin-container">
          <div className="admin-header">
            <h1>权限管理</h1>
            <button className="btn-create" onClick={() => setShowCreate(true)}>创建权限</button>
          </div>

          <div className="admin-nav">
            <a href="/admin" className="admin-nav-link">仪表盘</a>
            <a href="/admin/users" className="admin-nav-link">用户管理</a>
            <a href="/admin/roles" className="admin-nav-link">角色管理</a>
            <a href="/admin/permissions" className="admin-nav-link active">权限管理</a>
          </div>

          {error && <div className="admin-error-msg">{error}</div>}

          {loading ? (
            <div className="admin-loading">加载中...</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>编码</th>
                  <th>名称</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map(permission => (
                  <tr key={permission.id}>
                    <td>{permission.id}</td>
                    <td>{permission.code}</td>
                    <td>{permission.name}</td>
                    <td>{formatDate(permission.createdAt)}</td>
                    <td>
                      <button className="btn-edit" onClick={() => startEdit(permission)}>编辑</button>
                      <button className="btn-delete" onClick={() => handleDelete(permission)}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 创建权限弹窗 */}
          {showCreate && (
            <div className="admin-modal">
              <div className="admin-modal-content">
                <h2>创建权限</h2>
                <div className="form-group">
                  <label>编码</label>
                  <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="如: file:read" />
                </div>
                <div className="form-group">
                  <label>名称</label>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如: 读取文件" />
                </div>
                <div className="admin-modal-actions">
                  <button className="btn-cancel" onClick={() => setShowCreate(false)}>取消</button>
                  <button className="btn-save" onClick={handleCreate}>创建</button>
                </div>
              </div>
            </div>
          )}

          {/* 编辑权限弹窗 */}
          {editingPermission && (
            <div className="admin-modal">
              <div className="admin-modal-content">
                <h2>编辑权限</h2>
                <div className="form-group">
                  <label>编码</label>
                  <input type="text" value={editCode} onChange={(e) => setEditCode(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>名称</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="admin-modal-actions">
                  <button className="btn-cancel" onClick={() => setEditingPermission(null)}>取消</button>
                  <button className="btn-save" onClick={saveEdit}>保存</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}