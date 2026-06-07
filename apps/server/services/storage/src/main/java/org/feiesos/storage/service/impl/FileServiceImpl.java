package org.feiesos.storage.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import lombok.extern.slf4j.Slf4j;
import org.feiesos.api.storage.dto.FileResourceDTO;
import org.feiesos.storage.entity.FileNode;
import org.feiesos.storage.mapper.FileNodeMapper;
import org.feiesos.storage.service.FileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.channels.FileChannel;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class FileServiceImpl implements FileService {
    @Value("${minecloud.upload.path}")
    private String uploadPath;

    @Autowired
    private FileNodeMapper fileNodeMapper;

    /**
     * 核心私有方法：将路径字符串解析为数据库中的 ID
     */
    private Long resolvePathToId(String path) {
        if (path == null || path.equals("/") || path.isEmpty()) {
            return 0L;
        }

        Long currentId = 0L;
        String[] parts = path.replaceAll("^/|/$", "").split("/");

        for (String part : parts) {
            FileNode node = fileNodeMapper.selectOne(new LambdaQueryWrapper<FileNode>()
                    .eq(FileNode::getName, part)
                    .eq(FileNode::getParentId, currentId)
                    .eq(FileNode::getIsDir, true)
                    .eq(FileNode::getIsDeleted, false));

            if (node == null) {
                throw new RuntimeException("路径解析失败，找不到目录: " + part);
            }
            currentId = node.getId();
        }
        return currentId;
    }

    @Override
    public List<FileNode> listByPath(String path) {
        Long targetId = 0L; // 默认根目录

        if (path != null && !path.equals("/") && !path.isEmpty()) {
            // 1. 分割路径，去除首尾斜杠。例如 "/home/docs" -> ["home", "docs"]
            String[] parts = path.replaceAll("^/|/$", "").split("/");

            for (String part : parts) {
                FileNode node = fileNodeMapper.selectOne(new LambdaQueryWrapper<FileNode>()
                        .eq(FileNode::getName, part)
                        .eq(FileNode::getParentId, targetId)
                        .eq(FileNode::getIsDir, true)
                        .eq(FileNode::getIsDeleted, false));

                if (node == null) {
                    throw new RuntimeException("路径不存在: " + part);
                }
                targetId = node.getId();
            }
        }

        // 2. 根据最终确定的 targetId 查询其下的文件列表
        return fileNodeMapper.selectList(new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getParentId, targetId)
                .eq(FileNode::getIsDeleted, false)
                .orderByDesc(FileNode::getIsDir)
                .orderByDesc(FileNode::getCreateTime));
    }

    @Transactional // 开启事务
    @Override
    public FileNode upload(MultipartFile file, String path) throws IOException {
        // 基础检查
        String fileName = file.getOriginalFilename();

        // 物理存储
        // 实际开发用UUID等设置物理文件，防止同名覆盖，这里仅演示
        File targetFile = new File(uploadPath + fileName);
        if (!targetFile.getParentFile().exists()) targetFile.getParentFile().mkdirs();
        file.transferTo(targetFile);

        // 写入数据库
        FileNode node = new FileNode();
        node.setName(fileName);
        node.setParentId(resolvePathToId(path));
        node.setIsDir(false);
        node.setSize(file.getSize());
        node.setStoragePath(targetFile.getAbsolutePath());
        node.setCreateTime(LocalDateTime.now());

        fileNodeMapper.insert(node);
        return node;
    }

    @Override
    public void uploadChunk(MultipartFile file, String md5, Integer index) throws IOException {
        // 1. 严格使用 File 对象层级构建
        File storageRoot = new File(uploadPath);
        File tempDir = new File(new File(storageRoot, "temp"), md5);

        // 2. 打印绝对路径到控制台，去硬盘里搜这个路径！
        log.info("【分片上传】目标目录: {}", tempDir.getAbsolutePath());

        if (!tempDir.exists()) {
            boolean created = tempDir.mkdirs();
            log.info("【分片上传】目录不存在，创建结果: {}", created);
        }

        File chunkFile = new File(tempDir, String.valueOf(index));

        // 3. 换一种更稳健的写入方式，确保文件流关闭
        try (InputStream in = file.getInputStream();
             OutputStream out = new FileOutputStream(chunkFile)) {
            byte[] buffer = new byte[1024 * 8];
            int len;
            while ((len = in.read(buffer)) != -1) {
                out.write(buffer, 0, len);
            }
        }
        log.info("【分片上传】分片 {} 已保存到: {}", index, chunkFile.getAbsolutePath());
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public FileNode mergeChunks(String md5, String fileName, String path) throws IOException {
        Long parentId = resolvePathToId(path);

        // 统一路径获取逻辑
        File tempDir = new File(new File(uploadPath, "temp"), md5);

        if (!tempDir.exists() || !tempDir.isDirectory()) {
            throw new RuntimeException("合并失败：分片目录不存在 -> " + tempDir.getAbsolutePath());
        }

        File[] chunks = tempDir.listFiles();

        // --- 核心修复：防御 NPE ---
        if (chunks == null || chunks.length == 0) {
            log.error("目录存在但无法读取分片，路径: {}", tempDir.getAbsolutePath());
            throw new RuntimeException("无法读取分片文件，请检查磁盘权限或文件是否被占用");
        }

        // 排序
        Arrays.sort(chunks, Comparator.comparingInt(f -> Integer.parseInt(f.getName())));

        String physicalName = UUID.randomUUID().toString();
        File targetFile = new File(uploadPath, physicalName);

        // 使用 FileChannel 合并，性能比 RandomAccessFile 更好，且代码更整洁
        try (FileChannel destChannel = new FileOutputStream(targetFile).getChannel()) {
            for (File chunk : chunks) {
                try (FileChannel srcChannel = new FileInputStream(chunk).getChannel()) {
                    srcChannel.transferTo(0, srcChannel.size(), destChannel);
                }
                // 合并完立即删除，释放空间
                chunk.delete();
            }
        } catch (IOException e) {
            log.error("文件合并 IO 异常", e);
            throw e;
        }

        // 清理空的临时文件夹
        tempDir.delete();

        // 数据库记录
        FileNode node = new FileNode();
        node.setName(fileName);
        node.setParentId(parentId);
        node.setIsDir(false);
        node.setSize(targetFile.length());
        node.setStoragePath(targetFile.getAbsolutePath());
        node.setFileHash(md5);
        node.setIsDeleted(false); // 确保设置了逻辑删除初始值
        node.setCreateTime(LocalDateTime.now());

        fileNodeMapper.insert(node);
        return node;
    }

    @Override
    public FileResourceDTO download(Long id) throws IOException {
        // 从数据库查找记录
        FileNode node = fileNodeMapper.selectById(id);
        if (node == null || node.getIsDir()) {
            throw new RuntimeException("文件不存在或该路径为文件夹");
        }

        // 加载物理文件
        File file = new File(node.getStoragePath());
        if (!file.exists()) {
            throw new RuntimeException("物理文件已丢失");
        }

        Resource resource = new FileSystemResource(file);

        return new FileResourceDTO(resource, node.getName(), file.length());
    }

    @Transactional
    @Override
    public FileNode createDirectory(String name, String path) {
        Long parentId = resolvePathToId(path);
        System.out.println("=============");
        log.info(path); // debug
        System.out.println("=============");
        // 重名校验
        Long count = fileNodeMapper.selectCount(new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getParentId, parentId)
                .eq(FileNode::getName, name)
                .eq(FileNode::getIsDeleted, false));

        if (count > 0) {
            throw new RuntimeException("该目录下已存在同名文件或文件夹");
        }

        // 构造文件夹节点
        FileNode node = new FileNode();
        node.setName(name);
        node.setParentId(parentId);
        node.setIsDir(true); // 标记为文件夹
        node.setSize(0L); // 新建的目录大小为0
        node.setIsDeleted(false);
        node.setCreateTime(LocalDateTime.now());

        fileNodeMapper.insert(node);
        return node;
    }

    @Transactional
    @Override
    public void softDelete(Long id) {
        // 验证是否存在
        FileNode node = fileNodeMapper.selectById(id);
        if (node == null) {
            throw new RuntimeException("文件已不存在");
        }

        // 递归处理文件夹
        if (node.getIsDir()) {
            // TODO: 递归标记子文件为已删除
        }

        // 逻辑删除
        fileNodeMapper.deleteById(node);
        node.setDeleteTime(LocalDateTime.now());
        fileNodeMapper.updateById(node);

        log.info("文件{}已放入回收站", node.getStoragePath());
    }
}