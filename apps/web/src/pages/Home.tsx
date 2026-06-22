import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { logout } from '../api/auth';
import { getDashboard } from '../api/admin';
import AppHeader from '../components/AppHeader';
import DirIcon from '../components/DirIcon';
import FileIcon from '../components/FileIcon';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const initializedRef = useRef(false);

  const checkAdminAccess = useCallback(async () => {
    try {
      const data = await getDashboard();
      console.log('Dashboard data:', data);
      setIsAdmin(true);
    } catch (err) {
      // 不是管理员，打印错误信息
      console.log('Admin check failed:', err);
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      checkAdminAccess();
    }
  }, [checkAdminAccess]);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="home">
      <AppHeader onLogout={handleLogout} />
      <main className="home-body">
        <div className="home-cards">
          <Link to="/files" className="home-card">
            <FileIcon name="file.bin" size={32} />
            <h3>文件管理</h3>
            <p>浏览、上传、下载和管理你的文件</p>
          </Link>
          <Link to="/shares" className="home-card">
            <DirIcon size={32} />
            <h3>分享管理</h3>
            <p>查看和管理已分享的文件链接</p>
          </Link>
          {isAdmin && (
            <Link to="/admin" className="home-card admin-card">
              <DirIcon size={32} />
              <h3>管理后台</h3>
              <p>用户管理、角色管理、权限管理</p>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}