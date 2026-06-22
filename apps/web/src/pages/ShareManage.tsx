import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listShares, deleteShare, type ShareResponse } from '../api/share';
import { logout } from '../api/auth';
import AppHeader from '../components/AppHeader';
import { formatExpireDate } from '../utils/format';
import './SharePage.css';

export default function ShareManage() {
  const navigate = useNavigate();
  const [shares, setShares] = useState<ShareResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadShares();
  }, []);

  async function loadShares() {
    setLoading(true);
    setError('');
    try {
      const data = await listShares();
      setShares(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(shareId: number) {
    if (!confirm('确定删除此分享链接？')) return;
    try {
      await deleteShare(shareId);
      setShares(shares.filter(s => s.id !== shareId));
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function copyShareUrl(url: string) {
    navigator.clipboard.writeText(url);
  }

  return (
    <div className="share-page">
      <AppHeader onLogout={handleLogout} />

      <main className="share-body">
        <div className="share-container">
          <div className="share-title">
            <h2>我的分享</h2>
            <button className="btn-refresh" onClick={loadShares}>
              {loading ? '加载中...' : '刷新'}
            </button>
          </div>

          {error && <div className="share-error">{error}</div>}

          {shares.length === 0 && !loading ? (
            <div className="share-empty">
              <p>暂无分享记录</p>
              <p className="share-empty-tip">在文件列表中选择文件创建分享</p>
            </div>
          ) : (
            <div className="share-list">
              {shares.map(share => (
                <div key={share.id} className="share-item">
                  <div className="share-item-header">
                    <span className="share-token">{share.shareToken}</span>
                    {share.expired && <span className="share-badge expired">已过期</span>}
                    {share.needPassword && <span className="share-badge password">密码保护</span>}
                  </div>
                  
                  <div className="share-item-info">
                    <div className="share-info-row">
                      <span className="share-label">文件ID:</span>
                      <span>{share.fileNodeId}</span>
                    </div>
                    <div className="share-info-row">
                      <span className="share-label">下载次数:</span>
                      <span>{share.downloadCount} / {share.maxDownloads === -1 ? '无限制' : share.maxDownloads}</span>
                    </div>
                    <div className="share-info-row">
                      <span className="share-label">过期时间:</span>
                      <span>{formatExpireDate(share.expireAt)}</span>
                    </div>
                    <div className="share-info-row">
                      <span className="share-label">创建时间:</span>
                      <span>{formatExpireDate(share.createdAt)}</span>
                    </div>
                    {share.remark && (
                      <div className="share-info-row">
                        <span className="share-label">备注:</span>
                        <span>{share.remark}</span>
                      </div>
                    )}
                  </div>

                  <div className="share-item-actions">
                    <button 
                      className="btn-copy" 
                      onClick={() => copyShareUrl(share.shareUrl)}
                    >
                      复制链接
                    </button>
                    <button 
                      className="btn-delete" 
                      onClick={() => handleDelete(share.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}