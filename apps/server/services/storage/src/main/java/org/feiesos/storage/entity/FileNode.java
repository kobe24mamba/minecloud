package org.feiesos.storage.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("file_node")
public class FileNode {
    @TableId
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;
    private String name;
    private Long parentId;
    private Boolean isDir;
    private Long size;
    private String fileHash;
    private String storagePath;
    private LocalDateTime createTime;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deleteTime;
}