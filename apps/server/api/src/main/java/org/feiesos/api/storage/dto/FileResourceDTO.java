package org.feiesos.api.storage.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import org.springframework.core.io.Resource;

@Data
@AllArgsConstructor
public class FileResourceDTO {
    private Resource resource;
    private String fileName;
    private long fileSize;
}
