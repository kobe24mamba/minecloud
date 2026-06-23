package org.feiesos.share.client;

import org.feiesos.common.result.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "auth", url = "${minecloud.auth.url:http://localhost:8081}")
public interface AuthClient {

    @GetMapping("/api/v1/auth/permission/check")
    R<Boolean> checkPermission(@RequestParam("userId") Long userId,
                               @RequestParam("permissionCode") String permissionCode);
}
