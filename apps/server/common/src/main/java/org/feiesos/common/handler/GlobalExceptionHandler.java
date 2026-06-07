package org.feiesos.common.handler;

import lombok.extern.slf4j.Slf4j;
import org.feiesos.common.result.R;
import org.feiesos.common.exception.BusinessException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 处理自定义业务异常
     */
    @ExceptionHandler(BusinessException.class)
    public R<?> handleServiceException(BusinessException e) {
        return R.fail(e.getCode(), e.getMessage());
    }

    /**
     * 处理未知系统异常
     */
    @ExceptionHandler(Exception.class)
    public R<?> handleException(Exception e) {
        return R.fail(500, "系统繁忙，请稍后再试");
    }
}
