package org.feiesos.share.controller;

import lombok.extern.slf4j.Slf4j;
import org.feiesos.common.exception.BusinessException;
import org.feiesos.common.result.R;
import org.feiesos.share.dto.AccessShareRequest;
import org.feiesos.share.dto.PublicShareInfoResponse;
import org.feiesos.share.entity.FileShare;
import org.feiesos.share.service.ShareService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 公开分享访问控制器（无需认证）
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/share/public")
public class PublicShareController {

    private final ShareService shareService;

    public PublicShareController(ShareService shareService) {
        this.shareService = shareService;
    }

    /**
     * 通过分享令牌获取分享信息
     */
    @GetMapping("/{shareToken}")
    public R<PublicShareInfoResponse> getShareInfo(@PathVariable String shareToken) {
        try {
            PublicShareInfoResponse response = shareService.getShareByToken(shareToken);
            return R.ok(response);
        } catch (BusinessException e) {
            return R.fail(e.getCode(), e.getMessage());
        } catch (Exception e) {
            log.error("获取分享信息失败, shareToken: {}", shareToken, e);
            return R.fail("获取分享信息失败: " + e.getMessage());
        }
    }

    /**
     * 验证分享访问权限（用于密码验证）
     */
    @PostMapping("/{shareToken}/verify")
    public R<String> verifyAccess(@PathVariable String shareToken,
                                   @RequestBody AccessShareRequest request) {
        try {
            shareService.validateAccess(shareToken, request.getPassword());
            return R.ok("验证成功");
        } catch (BusinessException e) {
            return R.fail(e.getCode(), e.getMessage());
        } catch (Exception e) {
            log.error("验证分享访问失败, shareToken: {}", shareToken, e);
            return R.fail("验证失败: " + e.getMessage());
        }
    }

    /**
     * 获取分享的文件ID（供内部服务调用）
     */
    @GetMapping("/{shareToken}/fileId")
    public R<Long> getSharedFileId(@PathVariable String shareToken) {
        try {
            Long fileId = shareService.getSharedFileNodeId(shareToken);
            return R.ok(fileId);
        } catch (BusinessException e) {
            return R.fail(e.getCode(), e.getMessage());
        } catch (Exception e) {
            log.error("获取分享文件ID失败, shareToken: {}", shareToken, e);
            return R.fail("获取失败: " + e.getMessage());
        }
    }

    /**
     * 通过分享令牌下载文件（支持密码验证）
     */
    @GetMapping("/{shareToken}/download")
    public ResponseEntity<Resource> downloadFile(@PathVariable String shareToken,
                                                  @RequestParam(required = false) String password) {
        try {
            FileShare fileShare = shareService.validateAccess(shareToken, password);
            shareService.incrementDownloadCount(shareToken);

            return shareService.downloadSharedFile(fileShare);
        } catch (BusinessException e) {
            log.warn("分享下载失败, shareToken: {}, msg: {}", shareToken, e.getMessage());
            return ResponseEntity.status(e.getCode() == 403 ? 403 : 404).build();
        } catch (Exception e) {
            log.error("分享下载异常, shareToken: {}", shareToken, e);
            return ResponseEntity.status(500).build();
        }
    }
}