package org.feiesos.share.service;

import org.feiesos.share.dto.*;
import org.feiesos.share.entity.FileShare;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;

import java.util.List;

/**
 * 分享服务接口
 */
public interface ShareService {

    /**
     * 创建分享链接
     */
    ShareResponse createShare(CreateShareRequest request, Long userId);

    /**
     * 获取用户的分享列表
     */
    List<ShareResponse> listUserShares(Long userId);

    /**
     * 获取分享详情（创建者视角）
     */
    ShareResponse getShareDetail(Long shareId, Long userId);

    /**
     * 更新分享设置
     */
    ShareResponse updateShare(Long shareId, CreateShareRequest request, Long userId);

    /**
     * 删除分享链接
     */
    void deleteShare(Long shareId, Long userId);

    /**
     * 通过分享令牌获取分享信息（公开访问）
     */
    PublicShareInfoResponse getShareByToken(String shareToken);

    /**
     * 验证分享访问权限
     */
    FileShare validateAccess(String shareToken, String password);

    /**
     * 增加下载次数
     */
    void incrementDownloadCount(String shareToken);

    /**
     * 获取分享的文件ID（验证后调用）
     */
    Long getSharedFileNodeId(String shareToken);

    /**
     * 下载分享文件（从存储服务代理）
     */
    ResponseEntity<Resource> downloadSharedFile(FileShare fileShare);
}