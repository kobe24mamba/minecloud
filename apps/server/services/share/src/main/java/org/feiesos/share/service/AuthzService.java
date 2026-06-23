package org.feiesos.share.service;

import org.feiesos.common.exception.BusinessException;
import org.feiesos.common.result.R;
import org.feiesos.share.client.AuthClient;
import org.springframework.stereotype.Service;

@Service
public class AuthzService {

    private final AuthClient authClient;

    public AuthzService(AuthClient authClient) {
        this.authClient = authClient;
    }

    public void checkPermission(Long userId, String permissionCode) {
        if (userId == null) {
            throw new BusinessException(401, "未认证");
        }
        R<Boolean> result = authClient.checkPermission(userId, permissionCode);
        if (result.getCode() != 200 || !Boolean.TRUE.equals(result.getData())) {
            throw new BusinessException(403, "无权限执行该操作: " + permissionCode);
        }
    }
}
