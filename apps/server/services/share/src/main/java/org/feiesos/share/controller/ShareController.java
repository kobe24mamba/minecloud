package org.feiesos.share.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.feiesos.common.exception.BusinessException;
import org.feiesos.common.result.R;
import org.feiesos.share.dto.*;
import org.feiesos.share.entity.FileShare;
import org.feiesos.share.service.AuthzService;
import org.feiesos.share.service.ShareService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 分享管理控制器（需要认证）
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/share")
public class ShareController {

    private final ShareService shareService;
    private final AuthzService authzService;

    public ShareController(ShareService shareService, AuthzService authzService) {
        this.shareService = shareService;
        this.authzService = authzService;
    }

    /**
     * 创建分享链接
     */
    @PostMapping("/create")
    public R<ShareResponse> createShare(@RequestBody CreateShareRequest request,
                                         HttpServletRequest httpRequest) {
        try {
            Long userId = getUserId(httpRequest);
            if (request.getFileNodeId() != null) {
                authzService.checkPermission(userId, "file:read");
            }
            ShareResponse response = shareService.createShare(request, userId);
            return R.ok(response);
        } catch (BusinessException e) {
            return R.fail(e.getCode(), e.getMessage());
        } catch (Exception e) {
            log.error("创建分享失败", e);
            return R.fail("创建分享失败: " + e.getMessage());
        }
    }

    /**
     * 获取用户的分享列表
     */
    @GetMapping("/list")
    public R<List<ShareResponse>> listShares(HttpServletRequest httpRequest) {
        try {
            Long userId = getUserId(httpRequest);
            List<ShareResponse> shares = shareService.listUserShares(userId);
            return R.ok(shares);
        } catch (BusinessException e) {
            return R.fail(e.getCode(), e.getMessage());
        } catch (Exception e) {
            log.error("获取分享列表失败", e);
            return R.fail("获取分享列表失败: " + e.getMessage());
        }
    }

    /**
     * 获取分享详情
     */
    @GetMapping("/{id}")
    public R<ShareResponse> getShareDetail(@PathVariable Long id,
                                            HttpServletRequest httpRequest) {
        try {
            Long userId = getUserId(httpRequest);
            ShareResponse response = shareService.getShareDetail(id, userId);
            return R.ok(response);
        } catch (BusinessException e) {
            return R.fail(e.getCode(), e.getMessage());
        } catch (Exception e) {
            log.error("获取分享详情失败", e);
            return R.fail("获取分享详情失败: " + e.getMessage());
        }
    }

    /**
     * 更新分享设置
     */
    @PutMapping("/{id}")
    public R<ShareResponse> updateShare(@PathVariable Long id,
                                         @RequestBody CreateShareRequest request,
                                         HttpServletRequest httpRequest) {
        try {
            Long userId = getUserId(httpRequest);
            authzService.checkPermission(userId, "file:read");
            ShareResponse response = shareService.updateShare(id, request, userId);
            return R.ok(response);
        } catch (BusinessException e) {
            return R.fail(e.getCode(), e.getMessage());
        } catch (Exception e) {
            log.error("更新分享失败", e);
            return R.fail("更新分享失败: " + e.getMessage());
        }
    }

    /**
     * 删除分享链接
     */
    @DeleteMapping("/{id}")
    public R<String> deleteShare(@PathVariable Long id,
                                  HttpServletRequest httpRequest) {
        try {
            Long userId = getUserId(httpRequest);
            shareService.deleteShare(id, userId);
            return R.ok("分享已删除");
        } catch (BusinessException e) {
            return R.fail(e.getCode(), e.getMessage());
        } catch (Exception e) {
            log.error("删除分享失败", e);
            return R.fail("删除分享失败: " + e.getMessage());
        }
    }

    private Long getUserId(HttpServletRequest request) {
        Object userId = request.getAttribute("currentUserId");
        if (userId == null) {
            throw new BusinessException(401, "未认证");
        }
        return (Long) userId;
    }
}