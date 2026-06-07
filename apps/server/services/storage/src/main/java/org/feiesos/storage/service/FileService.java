package org.feiesos.storage.service;

import org.feiesos.api.storage.dto.FileResourceDTO;
import org.feiesos.storage.entity.FileNode;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

public interface FileService {
    /**
     * 根据路径查询文件列表
     * @param path
     * @return
     */
    public List<FileNode> listByPath(String path);

    /**
     * 上传文件
     * @param file SpringMVC 接收的文件对象
     * @param path 父文件夹ID
     */
    FileNode upload(MultipartFile file, String path) throws IOException;

    /**
     * 分片上传
     * @param file
     * @param md5
     * @param index
     * @throws IOException
     */
    void uploadChunk(MultipartFile file, String md5, Integer index) throws IOException;

    /**
     * 合并分片
     * @param md5
     * @param fileName
     * @param path
     * @return
     * @throws IOException
     */
    FileNode mergeChunks(String md5, String fileName, String path) throws IOException;

    /**
     * 下载文件
     * @param id
     * @return
     * @throws IOException
     */
    FileResourceDTO download(Long id) throws IOException;

    /**
     * 逻辑删除（放入回收站）
     * @param id
     */
    void softDelete(Long id);

    /**
     * 创建文件夹
     * @param name
     * @return
     */
    FileNode createDirectory(String name, String path);
}
