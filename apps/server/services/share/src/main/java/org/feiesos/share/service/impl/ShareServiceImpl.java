package org.feiesos.share.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.extern.slf4j.Slf4j;
import org.feiesos.common.exception.BusinessException;
import org.feiesos.share.dto.*;
import org.feiesos.share.entity.FileShare;
import org.feiesos.share.mapper.FileShareMapper;
import org.feiesos.share.service.ShareService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class ShareServiceImpl implements ShareService {

    private final FileShareMapper fileShareMapper;
    private final RestClient storageRestClient;

    @Value("${minecloud.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    public ShareServiceImpl(FileShareMapper fileShareMapper, RestClient storageRestClient) {
        this.fileShareMapper = fileShareMapper;
        this.storageRestClient = storageRestClient;
    }

    @Override
    @Transactional
    public ShareResponse createShare(CreateShareRequest request, Long userId) {
        String shareToken = generateShareToken();

        FileShare fileShare = new FileShare();
        fileShare.setShareToken(shareToken);
        fileShare.setFileNodeId(request.getFileNodeId());
        fileShare.setOwnerId(userId);
        fileShare.setAccessPassword(request.getAccessPassword());
        fileShare.setExpireAt(request.getExpireAt());
        fileShare.setMaxDownloads(request.getMaxDownloads() != null ? request.getMaxDownloads() : -1);
        fileShare.setDownloadCount(0);
        fileShare.setRemark(request.getRemark());
        fileShare.setDeleted(false);

        fileShareMapper.insert(fileShare);

        return toResponse(fileShare);
    }

    @Override
    public List<ShareResponse> listUserShares(Long userId) {
        LambdaQueryWrapper<FileShare> wrapper = new LambdaQueryWrapper<FileShare>()
                .eq(FileShare::getOwnerId, userId)
                .eq(FileShare::getDeleted, false)
                .orderByDesc(FileShare::getCreatedAt);

        List<FileShare> shares = fileShareMapper.selectList(wrapper);
        return shares.stream().map(this::toResponse).toList();
    }

    @Override
    public ShareResponse getShareDetail(Long shareId, Long userId) {
        FileShare fileShare = fileShareMapper.selectById(shareId);
        if (fileShare == null || Boolean.TRUE.equals(fileShare.getDeleted())) {
            throw new BusinessException("分享不存在");
        }
        if (!fileShare.getOwnerId().equals(userId)) {
            throw new BusinessException(403, "无权查看此分享");
        }
        return toResponse(fileShare);
    }

    @Override
    @Transactional
    public ShareResponse updateShare(Long shareId, CreateShareRequest request, Long userId) {
        FileShare fileShare = fileShareMapper.selectById(shareId);
        if (fileShare == null || Boolean.TRUE.equals(fileShare.getDeleted())) {
            throw new BusinessException("分享不存在");
        }
        if (!fileShare.getOwnerId().equals(userId)) {
            throw new BusinessException(403, "无权修改此分享");
        }

        if (request.getAccessPassword() != null) {
            fileShare.setAccessPassword(request.getAccessPassword());
        }
        if (request.getExpireAt() != null) {
            fileShare.setExpireAt(request.getExpireAt());
        }
        if (request.getMaxDownloads() != null) {
            fileShare.setMaxDownloads(request.getMaxDownloads());
        }
        if (request.getRemark() != null) {
            fileShare.setRemark(request.getRemark());
        }

        fileShareMapper.updateById(fileShare);
        return toResponse(fileShare);
    }

    @Override
    @Transactional
    public void deleteShare(Long shareId, Long userId) {
        FileShare fileShare = fileShareMapper.selectById(shareId);
        if (fileShare == null || Boolean.TRUE.equals(fileShare.getDeleted())) {
            throw new BusinessException("分享不存在");
        }
        if (!fileShare.getOwnerId().equals(userId)) {
            throw new BusinessException(403, "无权删除此分享");
        }

        LambdaUpdateWrapper<FileShare> wrapper = new LambdaUpdateWrapper<FileShare>()
                .eq(FileShare::getId, shareId)
                .set(FileShare::getDeleted, true);
        fileShareMapper.update(null, wrapper);
    }

    @Override
    public PublicShareInfoResponse getShareByToken(String shareToken) {
        FileShare fileShare = findByToken(shareToken);
        if (fileShare == null) {
            throw new BusinessException("分享不存在或已失效");
        }

        return PublicShareInfoResponse.builder()
                .shareToken(fileShare.getShareToken())
                .fileNodeId(fileShare.getFileNodeId())
                .needPassword(fileShare.getAccessPassword() != null && !fileShare.getAccessPassword().isEmpty())
                .expireAt(fileShare.getExpireAt())
                .expired(isExpired(fileShare))
                .maxDownloads(fileShare.getMaxDownloads())
                .downloadCount(fileShare.getDownloadCount())
                .remark(fileShare.getRemark())
                .build();
    }

    @Override
    public FileShare validateAccess(String shareToken, String password) {
        FileShare fileShare = findByToken(shareToken);
        if (fileShare == null) {
            throw new BusinessException("分享不存在或已失效");
        }

        if (isExpired(fileShare)) {
            throw new BusinessException("分享已过期");
        }

        if (fileShare.getMaxDownloads() != null && fileShare.getMaxDownloads() > 0
                && fileShare.getDownloadCount() >= fileShare.getMaxDownloads()) {
            throw new BusinessException("分享下载次数已达上限");
        }

        if (fileShare.getAccessPassword() != null && !fileShare.getAccessPassword().isEmpty()) {
            if (password == null || !password.equals(fileShare.getAccessPassword())) {
                throw new BusinessException(403, "访问密码错误");
            }
        }

        return fileShare;
    }

    @Override
    @Transactional
    public void incrementDownloadCount(String shareToken) {
        LambdaUpdateWrapper<FileShare> wrapper = new LambdaUpdateWrapper<FileShare>()
                .eq(FileShare::getShareToken, shareToken)
                .eq(FileShare::getDeleted, false)
                .setSql("download_count = download_count + 1");
        fileShareMapper.update(null, wrapper);
    }

    @Override
    public Long getSharedFileNodeId(String shareToken) {
        FileShare fileShare = findByToken(shareToken);
        if (fileShare == null) {
            throw new BusinessException("分享不存在");
        }
        return fileShare.getFileNodeId();
    }

    @Override
    public ResponseEntity<Resource> downloadSharedFile(FileShare fileShare) {
        Long fileId = fileShare.getFileNodeId();
        Long ownerId = fileShare.getOwnerId();

        ResponseEntity<Resource> storageResponse = storageRestClient.get()
                .uri("/api/v1/files/download/{id}", fileId)
                .header("X-User-Id", String.valueOf(ownerId))
                .retrieve()
                .toEntity(Resource.class);

        if (!storageResponse.getStatusCode().is2xxSuccessful() || storageResponse.getBody() == null) {
            throw new BusinessException("文件下载失败");
        }

        String filename = extractFilename(storageResponse);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(storageResponse.getHeaders().getContentType() != null
                        ? storageResponse.getHeaders().getContentType()
                        : MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(storageResponse.getHeaders().getContentLength())
                .body(storageResponse.getBody());
    }

    private String extractFilename(ResponseEntity<Resource> response) {
        String disposition = response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION);
        if (disposition != null && disposition.contains("filename=")) {
            int idx = disposition.indexOf("filename=");
            String name = disposition.substring(idx + 9);
            if (name.startsWith("\"") && name.endsWith("\"")) {
                name = name.substring(1, name.length() - 1);
            }
            return name;
        }
        return "download";
    }

    private FileShare findByToken(String shareToken) {
        LambdaQueryWrapper<FileShare> wrapper = new LambdaQueryWrapper<FileShare>()
                .eq(FileShare::getShareToken, shareToken)
                .eq(FileShare::getDeleted, false);
        return fileShareMapper.selectOne(wrapper);
    }

    private String generateShareToken() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return uuid.substring(0, 16);
    }

    private boolean isExpired(FileShare fileShare) {
        if (fileShare.getExpireAt() == null) {
            return false;
        }
        return OffsetDateTime.now().isAfter(fileShare.getExpireAt());
    }

    private ShareResponse toResponse(FileShare fileShare) {
        return ShareResponse.builder()
                .id(fileShare.getId())
                .shareToken(fileShare.getShareToken())
                .fileNodeId(fileShare.getFileNodeId())
                .ownerId(fileShare.getOwnerId())
                .needPassword(fileShare.getAccessPassword() != null && !fileShare.getAccessPassword().isEmpty())
                .expireAt(fileShare.getExpireAt())
                .expired(isExpired(fileShare))
                .maxDownloads(fileShare.getMaxDownloads())
                .downloadCount(fileShare.getDownloadCount())
                .remark(fileShare.getRemark())
                .createdAt(fileShare.getCreatedAt())
                .shareUrl(frontendUrl + "/s/" + fileShare.getShareToken())
                .build();
    }
}
