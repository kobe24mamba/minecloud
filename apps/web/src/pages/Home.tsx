import { useNavigate, Link } from 'react-router-dom';
import { logout } from '../api/auth';
import AppHeader from '../components/AppHeader';
import DirIcon from '../components/DirIcon';
import FileIcon from '../components/FileIcon';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
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
        </div>
      </main>
    </div>
  );
}
