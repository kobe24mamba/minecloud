package org.feiesos.storage.controller;

import lombok.extern.slf4j.Slf4j;
import org.feiesos.api.storage.dto.FileResourceDTO;
import org.feiesos.common.result.R;
import org.feiesos.storage.entity.FileNode;
import org.feiesos.storage.mapper.FileNodeMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.feiesos.storage.service.FileService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/files")
@CrossOrigin(origins = "*") // 暂时允许跨域，后期交给网关
public class FileController {

    private final FileNodeMapper fileNodeMapper;
    private final FileService fileService;

    public FileController(FileNodeMapper fileNodeMapper, FileService fileService) {
        this.fileNodeMapper = fileNodeMapper;
        this.fileService = fileService;
    }

    @Value("${minecloud.upload.path}")
    private String uploadPath;

    /**
     * 查询文件列表 =======测试=======
     * @param parentId
     * @return
     */
    @GetMapping("/list")
    public R<List<FileNode>> list(@RequestParam(defaultValue = "0") Long parentId) {
        // 查询指定父目录下的所有文件/文件夹
        List<FileNode> list = fileNodeMapper.selectList(
                new LambdaQueryWrapper<FileNode>()
                        .eq(FileNode::getParentId, parentId)
                        .eq(FileNode::getIsDeleted, false)
                        .orderByDesc(FileNode::getIsDir) // 文件夹排在前面
                        .orderByDesc(FileNode::getCreateTime)
        );
        return R.ok(list);
    }

    /**
     * 根据路径查询文件列表
     * @param path 路径字符串，如 "/" 或 "/work/projectA"
     */
    @GetMapping("/browse")
    public R<List<FileNode>> browse(@RequestParam(value = "path", defaultValue = "/") String path) {
        try {
            // 规范化路径：确保以 / 开头
            if (!path.startsWith("/")) {
                path = "/" + path;
            }
            List<FileNode> list = fileService.listByPath(path);
            return R.ok(list);
        } catch (Exception e) {
            log.warn("浏览目录失败: {}", e.getMessage());
            return R.fail(e.getMessage());
        }
    }

    /**
     * 上传文件接口
     * @param file Spring 自动封装的上传文件对象
     * @param path 文件的父目录 ID，如果不传则默认为 0 (根目录)
     */
    @PostMapping("/upload")
    public R<FileNode> upload(@RequestParam("file") MultipartFile file,
                              @RequestParam(value = "path", defaultValue = "/") String path) throws IOException {
        // 基础校验
        if (file.isEmpty()) {
            return R.fail("上传失败：文件内容不能为空");
        }

        try {
            // 执行
            log.info("开始接收上传文件: {}, 大小: {} bytes", file.getOriginalFilename(), file.getSize());
            FileNode node = fileService.upload(file, path);

            // 返回成功及文件元数据
            return R.ok(node);
        } catch (IOException e) {
            log.error("文件存储发生 I/O 异常: ", e);
            return R.fail("服务器磁盘写入异常，请检查存储路径权限");
        } catch (Exception e) {
            log.error("文件上传系统异常: ", e);
            return R.fail("系统繁忙: " + e.getMessage());
        }
    }

    @PostMapping("/chunk")
    public R<String> uploadChunk(@RequestParam("file") MultipartFile file,
                                 @RequestParam("md5") String md5,
                                 @RequestParam("index") Integer index) throws IOException {
        fileService.uploadChunk(file, md5, index);
        return R.ok("分片 " + index + " 上传成功");
    }

    @PostMapping("/merge")
    public R<FileNode> merge(@RequestParam("md5") String md5,
                             @RequestParam("fileName") String fileName,
                             @RequestParam("path") String path) throws IOException {
        return R.ok(fileService.mergeChunks(md5, fileName, path));
    }

    /**
     * 新建文件夹
     * @param name 文件夹名称
     * @param path 父目录ID
     */
    @PostMapping("/mkdir")
    public R<FileNode> createDirectory(@RequestParam(value = "name") String name,
                                       @RequestParam(value = "path", defaultValue = "/") String path) {
        if (name == null || name.trim().isEmpty()) {
            return R.fail("文件夹名称不能为空");
        }

        try {
            FileNode node = fileService.createDirectory(name, path);
            return R.ok(node);
        } catch (Exception e) {
            log.error("新建文件夹失败", e);
            return R.fail("新建文件夹失败：" + e.getMessage());
        }
    }

    /**
     * 下载文件
     * @param id 文件记录的 ID
     */
    @GetMapping("/download/{id}")
    public ResponseEntity<Resource> download(@PathVariable("id") Long id) {
        try {
            // 获取文件资源和元数据
            FileResourceDTO fileResource = fileService.download(id);

            // 设置响应头
            // Content-Disposition: attachment; filename="文件名"
            String contentDisposition = "attachment; filename=\"" +
                    java.net.URLEncoder.encode(fileResource.getFileName(), "UTF-8") + "\"";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition)
                    .contentType(MediaType.APPLICATION_OCTET_STREAM) // 二进制流
                    .contentLength(fileResource.getFileSize())
                    .body(fileResource.getResource());

        } catch (Exception e) {
            log.error("下载文件失败, id: {}", id, e);
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * 将文件移入回收站
     * @param id 文件ID
     */
    @DeleteMapping("/{id}")
    public R<String> delete(@PathVariable("id") Long id) {
        try {
            fileService.softDelete(id);
            return R.ok("已移入回收站");
        } catch (Exception e) {
            log.error("删除文件异常, id: {}", id, e);
            return R.fail("删除失败: " + e.getMessage());
        }
    }
}