import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listUsers, updateUser, assignUserRoles, listRoles, type AdminUser, type AdminRole } from '../api/admin';
import { logout } from '../api/auth';
import AppHeader from '../components/AppHeader';
import './AdminPage.css';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editEnabled, setEditEnabled] = useState<boolean | null>(null);
  const [assigningRoles, setAssigningRoles] = useState<AdminUser | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const initializedRef = useRef(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listUsers(page, 20, keyword || undefined);
      setUsers(data.records);
      setTotalPages(data.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  const loadRoles = useCallback(async () => {
    try {
      const data = await listRoles();
      setRoles(data);
    } catch (err) {
      console.error('加载角色失败', err);
    }
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      loadUsers();
      loadRoles();
    }
  }, [loadUsers, loadRoles]);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleSearch() {
    setKeyword(searchInput);
    setPage(1);
  }

  function startEdit(user: AdminUser) {
    setEditingUser(user);
    setEditNickname(user.nickname || '');
    setEditEmail(user.email || '');
    setEditEnabled(user.enabled);
  }

  async function saveEdit() {
    if (!editingUser) return;
    try {
      await updateUser(editingUser.id, {
        nickname: editNickname || undefined,
        email: editEmail || undefined,
        enabled: editEnabled ?? undefined,
      });
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失败');
    }
  }

  function startAssignRoles(user: AdminUser) {
    setAssigningRoles(user);
    setSelectedRoleIds(user.roles.map(r => r.id));
  }

  async function saveRoles() {
    if (!assigningRoles) return;
    try {
      await assignUserRoles(assigningRoles.id, selectedRoleIds);
      setAssigningRoles(null);
      loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '分配失败');
    }
  }

  function toggleRole(roleId: number) {
    if (selectedRoleIds.includes(roleId)) {
      setSelectedRoleIds(selectedRoleIds.filter(id => id !== roleId));
    } else {
      setSelectedRoleIds([...selectedRoleIds, roleId]);
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
            <h1>用户管理</h1>
            <div className="admin-search">
              <input
                type="text"
                placeholder="搜索用户名/昵称/邮箱"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button onClick={handleSearch}>搜索</button>
            </div>
          </div>

          <div className="admin-nav">
            <a href="/admin" className="admin-nav-link">仪表盘</a>
            <a href="/admin/users" className="admin-nav-link active">用户管理</a>
            <a href="/admin/roles" className="admin-nav-link">角色管理</a>
            <a href="/admin/permissions" className="admin-nav-link">权限管理</a>
          </div>

          {error && <div className="admin-error-msg">{error}</div>}

          {loading ? (
            <div className="admin-loading">加载中...</div>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>用户名</th>
                    <th>昵称</th>
                    <th>邮箱</th>
                    <th>状态</th>
                    <th>角色</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>{user.nickname || '-'}</td>
                      <td>{user.email || '-'}</td>
                      <td>
                        <span className={`status-badge ${user.enabled ? 'enabled' : 'disabled'}`}>
                          {user.enabled ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td>
                        {user.roles.map(r => (
                          <span key={r.id} className="role-tag">{r.name}</span>
                        ))}
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <button className="btn-edit" onClick={() => startEdit(user)}>编辑</button>
                        <button className="btn-assign" onClick={() => startAssignRoles(user)}>分配角色</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="admin-pagination">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
                  <span>第 {page} / {totalPages} 页</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
                </div>
              )}
            </>
          )}

          {/* 编辑用户弹窗 */}
          {editingUser && (
            <div className="admin-modal">
              <div className="admin-modal-content">
                <h2>编辑用户</h2>
                <div className="form-group">
                  <label>昵称</label>
                  <input type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>邮箱</label>
                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>状态</label>
                  <select value={editEnabled === null ? '' : editEnabled ? 'true' : 'false'} onChange={(e) => setEditEnabled(e.target.value === '' ? null : e.target.value === 'true')}>
                    <option value="">不修改</option>
                    <option value="true">启用</option>
                    <option value="false">禁用</option>
                  </select>
                </div>
                <div className="admin-modal-actions">
                  <button className="btn-cancel" onClick={() => setEditingUser(null)}>取消</button>
                  <button className="btn-save" onClick={saveEdit}>保存</button>
                </div>
              </div>
            </div>
          )}

          {/* 分配角色弹窗 */}
          {assigningRoles && (
            <div className="admin-modal">
              <div className="admin-modal-content">
                <h2>分配角色 - {assigningRoles.username}</h2>
                <div className="role-list">
                  {roles.map(role => (
                    <label key={role.id} className="role-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedRoleIds.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                      />
                      <span>{role.name} ({role.code})</span>
                    </label>
                  ))}
                </div>
                <div className="admin-modal-actions">
                  <button className="btn-cancel" onClick={() => setAssigningRoles(null)}>取消</button>
                  <button className="btn-save" onClick={saveRoles}>保存</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}