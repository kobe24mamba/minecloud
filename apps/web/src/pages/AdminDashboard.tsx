import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDashboard, type AdminDashboard } from '../api/admin';
import { logout } from '../api/auth';
import AppHeader from '../components/AppHeader';
import './AdminPage.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const initializedRef = useRef(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDashboard();
      setDashboard(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes('403')) {
        setError('无权限访问管理后台');
      } else {
        setError(err instanceof Error ? err.message : '加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      loadDashboard();
    }
  }, [loadDashboard]);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  if (loading) {
    return (
      <div className="admin-page">
        <AppHeader onLogout={handleLogout} />
        <main className="admin-body">
          <div className="admin-loading">加载中...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <AppHeader onLogout={handleLogout} />
        <main className="admin-body">
          <div className="admin-error">
            <h2>错误</h2>
            <p>{error}</p>
            <Link to="/" className="btn-back">返回首页</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AppHeader onLogout={handleLogout} />
      <main className="admin-body">
        <div className="admin-container">
          <h1>管理后台</h1>

          <div className="admin-nav">
            <Link to="/admin/users" className="admin-nav-link">用户管理</Link>
            <Link to="/admin/roles" className="admin-nav-link">角色管理</Link>
            <Link to="/admin/permissions" className="admin-nav-link">权限管理</Link>
          </div>

          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-value">{dashboard?.totalUsers ?? 0}</div>
              <div className="stat-label">用户总数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboard?.totalFiles ?? 0}</div>
              <div className="stat-label">文件总数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatFileSize(dashboard?.totalFileSize ?? 0)}</div>
              <div className="stat-label">存储总量</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboard?.totalRecycled ?? 0}</div>
              <div className="stat-label">回收站文件</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboard?.totalRoles ?? 0}</div>
              <div className="stat-label">角色总数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboard?.totalPermissions ?? 0}</div>
              <div className="stat-label">权限总数</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}