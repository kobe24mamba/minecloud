import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import Logo from '../components/Logo';
import './AuthPage.css';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-wrapper">
        <div className="auth-wrapper-inner">
          <div className="auth-header">
            <Logo />
            <h1><b>登录 Minecloud</b></h1>
          </div>

          <div className="auth-card">
            <form onSubmit={handleSubmit}>
              {error && <div className="auth-error">{error}</div>}

              <div className="form-group">
                <label htmlFor="lf">用户名或邮箱</label>
                <input
                  id="lf"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <div className="password-label-row">
                  <label htmlFor="pf">密码</label>
                  <Link to="/forgot-password">忘记密码?</Link>
                </div>
                <input
                  id="pf"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? '登录中...' : '登录'}
              </button>
            </form>
          </div>

          <div className="auth-switch">
            新用户? <Link to="/register">创建账号</Link>
          </div>
        </div>
      </div>

      <div className="auth-footer">
        <ul>
          <li><a href="#">条款</a></li>
          <li><a href="#">隐私</a></li>
          <li><a href="#">文档</a></li>
          <li><a href="#">联系</a></li>
        </ul>
      </div>
    </div>
  );
}
