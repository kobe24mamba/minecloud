import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listRoles, createRole, updateRole, deleteRole, assignRolePermissions, listPermissions, type AdminRole, type AdminPermission } from '../api/admin';
import { logout } from '../api/auth';
import AppHeader from '../components/AppHeader';
import './AdminPage.css';

export default function AdminRoles() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [assigningPermissions, setAssigningPermissions] = useState<AdminRole | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);

  useEffect(() => {
    loadRoles();
    loadPermissions();
  }, []);

  async function loadRoles() {
    setLoading(true);
    setError('');
    try {
      const data = await listRoles();
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadPermissions() {
    try {
      const data = await listPermissions();
      setPermissions(data);
    } catch (err) {
      console.error('加载权限失败', err);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  async function handleCreate() {
    if (!newCode.trim() || !newName.trim()) {
      alert('请填写角色编码和名称');
      return;
    }
    try {
      await createRole(newCode.trim(), newName.trim());
      setShowCreate(false);
      setNewCode('');
      setNewName('');
      loadRoles();
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败');
    }
  }

  function startEdit(role: AdminRole) {
    setEditingRole(role);
    setEditCode(role.code);
    setEditName(role.name);
  }

  async function saveEdit() {
    if (!editingRole) return;
    try {
      await updateRole(editingRole.id, editCode.trim(), editName.trim());
      setEditingRole(null);
      loadRoles();
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失败');
    }
  }

  async function handleDelete(role: AdminRole) {
    if (!confirm(`确定删除角色 "${role.name}"？`)) return;
    try {
      await deleteRole(role.id);
      loadRoles();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  }

  function startAssignPermissions(role: AdminRole) {
    setAssigningPermissions(role);
    setSelectedPermissionIds(role.permissions.map(p => p.id));
  }

  async function savePermissions() {
    if (!assigningPermissions) return;
    try {
      await assignRolePermissions(assigningPermissions.id, selectedPermissionIds);
      setAssigningPermissions(null);
      loadRoles();
    } catch (err) {
      alert(err instanceof Error ? err.message : '分配失败');
    }
  }

  function togglePermission(permissionId: number) {
    if (selectedPermissionIds.includes(permissionId)) {
      setSelectedPermissionIds(selectedPermissionIds.filter(id => id !== permissionId));
    } else {
      setSelectedPermissionIds([...selectedPermissionIds, permissionId]);
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
            <h1>角色管理</h1>
            <button className="btn-create" onClick={() => setShowCreate(true)}>创建角色</button>
          </div>

          <div className="admin-nav">
            <a href="/admin" className="admin-nav-link">仪表盘</a>
            <a href="/admin/users" className="admin-nav-link">用户管理</a>
            <a href="/admin/roles" className="admin-nav-link active">角色管理</a>
            <a href="/admin/permissions" className="admin-nav-link">权限管理</a>
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
                  <th>权限</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(role => (
                  <tr key={role.id}>
                    <td>{role.id}</td>
                    <td>{role.code}</td>
                    <td>{role.name}</td>
                    <td>
                      {role.permissions.map(p => (
                        <span key={p.id} className="permission-tag">{p.name}</span>
                      ))}
                    </td>
                    <td>{formatDate(role.createdAt)}</td>
                    <td>
                      <button className="btn-edit" onClick={() => startEdit(role)}>编辑</button>
                      <button className="btn-assign" onClick={() => startAssignPermissions(role)}>分配权限</button>
                      <button className="btn-delete" onClick={() => handleDelete(role)}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 创建角色弹窗 */}
          {showCreate && (
            <div className="admin-modal">
              <div className="admin-modal-content">
                <h2>创建角色</h2>
                <div className="form-group">
                  <label>编码</label>
                  <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="如: ROLE_EDITOR" />
                </div>
                <div className="form-group">
                  <label>名称</label>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如: 编辑者" />
                </div>
                <div className="admin-modal-actions">
                  <button className="btn-cancel" onClick={() => setShowCreate(false)}>取消</button>
                  <button className="btn-save" onClick={handleCreate}>创建</button>
                </div>
              </div>
            </div>
          )}

          {/* 编辑角色弹窗 */}
          {editingRole && (
            <div className="admin-modal">
              <div className="admin-modal-content">
                <h2>编辑角色</h2>
                <div className="form-group">
                  <label>编码</label>
                  <input type="text" value={editCode} onChange={(e) => setEditCode(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>名称</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="admin-modal-actions">
                  <button className="btn-cancel" onClick={() => setEditingRole(null)}>取消</button>
                  <button className="btn-save" onClick={saveEdit}>保存</button>
                </div>
              </div>
            </div>
          )}

          {/* 分配权限弹窗 */}
          {assigningPermissions && (
            <div className="admin-modal">
              <div className="admin-modal-content">
                <h2>分配权限 - {assigningPermissions.name}</h2>
                <div className="permission-list">
                  {permissions.map(permission => (
                    <label key={permission.id} className="permission-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedPermissionIds.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
                      />
                      <span>{permission.name} ({permission.code})</span>
                    </label>
                  ))}
                </div>
                <div className="admin-modal-actions">
                  <button className="btn-cancel" onClick={() => setAssigningPermissions(null)}>取消</button>
                  <button className="btn-save" onClick={savePermissions}>保存</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}