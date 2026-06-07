package org.feiesos.common.result;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class R<T> implements Serializable {
    private int code;          // 业务状态码 (200: 成功, 其它: 失败)
    private String msg;        // 提示消息
    private T data;            // 业务数据内容
    private long timestamp;    // 服务器响应时间戳

    public static <T> R<T> ok(T data) {
        return R.<T>builder()
                .code(200)
                .msg("OK")
                .data(data)
                .timestamp(System.currentTimeMillis())
                .build();
    }

    public static <T> R<T> ok() {
        return ok(null);
    }

    public static <T> R<T> fail(int code, String msg) {
        return R.<T>builder()
                .code(code)
                .msg(msg)
                .timestamp(System.currentTimeMillis())
                .build();
    }

    public static <T> R<T> fail(String msg) {
        return fail(500, msg);
    }
}