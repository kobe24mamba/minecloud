import { useEffect, useState, startTransition } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyEmail } from '../api/auth';
import Logo from '../components/Logo';
import './AuthPage.css';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      startTransition(() => { setStatus('error'); setMessage('缺少验证令牌'); });
      return;
    }
    verifyEmail(token)
      .then(() => { setStatus('success'); setMessage('邮箱验证成功。'); })
      .catch((err) => { setStatus('error'); setMessage(err instanceof Error ? err.message : '验证失败'); });
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-wrapper">
        <div className="auth-wrapper-inner">
          <div className="auth-header">
            <Logo />
            <h1>邮箱验证</h1>
          </div>
          <div className="auth-card">
            {status === 'loading' && <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>验证中...</p>}
            {status === 'success' && <div className="auth-success" style={{ marginBottom: 0 }}>{message}</div>}
            {status === 'error' && <div className="auth-error" style={{ marginBottom: 0 }}>{message}</div>}
          </div>
          <Link to="/login" className="auth-link">返回登录</Link>
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
