import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicShareInfo, verifyShareAccess, type PublicShareInfoResponse } from '../api/share';
import Logo from '../components/Logo';
import { formatExpireDate } from '../utils/format';
import './SharePage.css';

export default function SharedFile() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [shareInfo, setShareInfo] = useState<PublicShareInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const initializedRef = useRef(false);

  const loadShareInfo = useCallback(async () => {
    if (!shareToken) return;
    setLoading(true);
    setError('');
    try {
      const info = await getPublicShareInfo(shareToken);
      setShareInfo(info);
      if (info.expired) {
        setError('此分享链接已过期');
      } else if (info.maxDownloads > 0 && info.downloadCount >= info.maxDownloads) {
        setError('此分享链接下载次数已达上限');
      } else if (info.needPassword) {
        setNeedPassword(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '分享不存在或已失效');
    } finally {
      setLoading(false);
    }
  }, [shareToken]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      loadShareInfo();
    }
  }, [loadShareInfo]);

  async function handleVerifyPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError('请输入访问密码');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const success = await verifyShareAccess(shareToken!, password.trim());
      if (success) {
        setVerified(true);
        setNeedPassword(false);
      } else {
        setError('密码错误');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败');
    } finally {
      setVerifying(false);
    }
  }

  function handleDownload() {
    // 直接打开下载链接
    const downloadUrl = `/api/v1/share/public/${shareToken}/download`;
    if (needPassword && !verified) {
      // 需要密码验证后才能下载
      window.open(`${downloadUrl}?password=${encodeURIComponent(password)}`, '_blank');
    } else {
      window.open(downloadUrl, '_blank');
    }
  }

  if (loading) {
    return (
      <div className="share-public-page">
        <div className="share-public-wrapper">
          <Logo />
          <p className="share-loading">加载中...</p>
        </div>
      </div>
    );
  }

  if (error && !shareInfo) {
    return (
      <div className="share-public-page">
        <div className="share-public-wrapper">
          <Logo />
          <div className="share-public-error">
            <h2>分享不存在</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="share-public-page">
      <div className="share-public-wrapper">
        <div className="share-public-header">
          <Logo />
          <h1>Minecloud 文件分享</h1>
        </div>

        {needPassword && !verified ? (
          <div className="share-public-card">
            <p className="share-password-tip">此文件需要密码访问</p>
            <form onSubmit={handleVerifyPassword}>
              {error && <div className="share-error">{error}</div>}
              <div className="form-group">
                <label htmlFor="password">访问密码</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入访问密码"
                  autoFocus
                />
              </div>
              <button className="btn-primary" type="submit" disabled={verifying}>
                {verifying ? '验证中...' : '验证'}
              </button>
            </form>
          </div>
        ) : (
          <div className="share-public-card">
            {error && <div className="share-error">{error}</div>}
            
            <div className="share-public-info">
              <div className="share-info-row">
                <span className="share-label">分享码:</span>
                <span>{shareInfo?.shareToken}</span>
              </div>
              <div className="share-info-row">
                <span className="share-label">文件ID:</span>
                <span>{shareInfo?.fileNodeId}</span>
              </div>
              <div className="share-info-row">
                <span className="share-label">下载次数:</span>
                <span>{shareInfo?.downloadCount} / {shareInfo?.maxDownloads === -1 ? '无限制' : shareInfo?.maxDownloads}</span>
              </div>
              <div className="share-info-row">
                <span className="share-label">过期时间:</span>
                <span>{formatExpireDate(shareInfo?.expireAt)}</span>
              </div>
              {shareInfo?.remark && (
                <div className="share-info-row">
                  <span className="share-label">备注:</span>
                  <span>{shareInfo.remark}</span>
                </div>
              )}
            </div>

            <button className="btn-download" onClick={handleDownload}>
              下载文件
            </button>
          </div>
        )}
      </div>
    </div>
  );
}