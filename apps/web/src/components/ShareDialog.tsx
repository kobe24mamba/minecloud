import { useState } from 'react';
import { createShare } from '../api/share';
import './ShareDialog.css';

interface ShareDialogProps {
  fileIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShareDialog({ fileIds, onClose, onSuccess }: ShareDialogProps) {
  const [accessPassword, setAccessPassword] = useState('');
  const [expireAt, setExpireAt] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      for (const fileNodeId of fileIds) {
        const payload: Record<string, unknown> = { fileNodeId: Number(fileNodeId) };
        if (accessPassword.trim()) payload.accessPassword = accessPassword.trim();
        if (expireAt.trim()) payload.expireAt = new Date(expireAt).toISOString();
        if (maxDownloads.trim()) payload.maxDownloads = Number(maxDownloads);
        if (remark.trim()) payload.remark = remark.trim();
        await createShare(payload as unknown as Parameters<typeof createShare>[0]);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建分享失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="share-dialog-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="share-dialog-title">
          分享 {fileIds.length} 个文件
        </h3>
        {error && <div className="share-dialog-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="share-dialog-field">
            <label>访问密码（可选）</label>
            <input
              className="share-dialog-input"
              type="text"
              value={accessPassword}
              onChange={(e) => setAccessPassword(e.target.value)}
              placeholder="留空表示公开分享"
            />
          </div>
          <div className="share-dialog-field">
            <label>过期时间（可选）</label>
            <input
              className="share-dialog-input"
              type="datetime-local"
              value={expireAt}
              onChange={(e) => setExpireAt(e.target.value)}
            />
          </div>
          <div className="share-dialog-field">
            <label>最大下载次数（可选，-1 无限制）</label>
            <input
              className="share-dialog-input"
              type="number"
              value={maxDownloads}
              onChange={(e) => setMaxDownloads(e.target.value)}
              placeholder="-1"
              min="-1"
            />
          </div>
          <div className="share-dialog-field">
            <label>备注（可选）</label>
            <input
              className="share-dialog-input"
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="备注说明"
            />
          </div>
          <div className="share-dialog-actions">
            <button className="share-dialog-btn share-dialog-btn-primary" type="submit" disabled={saving}>
              {saving ? '创建中…' : '创建分享'}
            </button>
            <button className="share-dialog-btn" type="button" onClick={onClose}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
