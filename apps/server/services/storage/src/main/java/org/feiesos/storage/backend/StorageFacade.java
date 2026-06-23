package org.feiesos.storage.backend;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import org.feiesos.common.exception.BusinessException;
import org.feiesos.storage.config.StorageProperties;
import org.feiesos.storage.entity.FileNode;
import org.feiesos.storage.dto.StorageObject;
import org.feiesos.storage.mapper.FileNodeMapper;
import org.feiesos.storage.service.AuthzService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.io.SequenceInputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Component
public class StorageFacade {

    private static final Logger log = LoggerFactory.getLogger(StorageFacade.class);

    private final AuthzService authzService;
    private final StorageRouter router;
    private final FileNodeMapper fileNodeMapper;
    private final StorageProperties storageProperties;

    public StorageFacade(AuthzService authzService, StorageRouter router,
                         FileNodeMapper fileNodeMapper, StorageProperties storageProperties) {
        this.authzService = authzService;
        this.router = router;
        this.fileNodeMapper = fileNodeMapper;
        this.storageProperties = storageProperties;
    }

    public Long resolvePathToId(String path, Long userId) {
        if (path == null || path.equals("/") || path.isEmpty()) {
            return 0L;
        }
        Long currentId = 0L;
        String[] parts = path.replaceAll("^/|/$", "").split("/");
        for (String part : parts) {
            if (part.isEmpty()) {
                continue;
            }
            FileNode node = fileNodeMapper.selectOne(new LambdaQueryWrapper<FileNode>()
                    .eq(FileNode::getName, part)
                    .eq(FileNode::getParentId, currentId)
                    .eq(FileNode::getIsDir, true)
                    .eq(FileNode::getOwnerId, userId)
                    .eq(FileNode::getIsDeleted, false));
            if (node == null) {
                throw new BusinessException("路径解析失败，找不到目录: " + part);
            }
            currentId = node.getId();
        }
        return currentId;
    }

    public List<FileNode> listByParent(Long parentId, Long userId) {
        authzService.checkPermission(userId, "file:read");
        return fileNodeMapper.selectList(new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getParentId, parentId)
                .eq(FileNode::getOwnerId, userId)
                .eq(FileNode::getIsDeleted, false)
                .orderByDesc(FileNode::getIsDir)
                .orderByDesc(FileNode::getCreateTime));
    }

    public List<FileNode> browse(String path, Long userId) {
        authzService.checkPermission(userId, "file:read");
        Long targetId = resolvePathToId(path, userId);
        return fileNodeMapper.selectList(new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getParentId, targetId)
                .eq(FileNode::getOwnerId, userId)
                .eq(FileNode::getIsDeleted, false)
                .orderByDesc(FileNode::getIsDir)
                .orderByDesc(FileNode::getCreateTime));
    }

    public StorageObject download(Long fileId, Long userId) {
        authzService.checkPermission(userId, "file:read");
        FileNode node = fileNodeMapper.selectById(fileId);
        if (node == null || node.getIsDir()) {
            throw new BusinessException("文件不存在或该路径为文件夹");
        }
        if (!userId.equals(node.getOwnerId())) {
            throw new BusinessException(403, "无权访问该文件");
        }
        ensureAncestorsAccessible(node, userId);
        StorageBackend backend = router.route(node);
        return backend.read(node.getStoragePath());
    }

    @Transactional
    public FileNode upload(String name, Long parentId, Long userId, InputStream data, long size) {
        return upload(name, parentId, userId, data, size, null);
    }

    @Transactional
    public FileNode upload(String name, Long parentId, Long userId, InputStream data, long size, String md5) {
        authzService.checkPermission(userId, "file:write");

        Long count = fileNodeMapper.selectCount(new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getParentId, parentId)
                .eq(FileNode::getName, name)
                .eq(FileNode::getIsDeleted, false));
        if (count > 0) {
            throw new BusinessException("该目录下已存在同名文件: " + name);
        }

        if (md5 != null) {
            FileNode existing = fileNodeMapper.selectOne(new LambdaQueryWrapper<FileNode>()
                    .eq(FileNode::getFileHash, md5)
                    .eq(FileNode::getOwnerId, userId)
                    .eq(FileNode::getIsDir, false)
                    .eq(FileNode::getIsDeleted, false)
                    .last("LIMIT 1"));
            if (existing != null) {
                StorageBackend backend = router.route(existing);
                StorageObject obj = backend.read(existing.getStoragePath());
                String newStoragePath = UUID.randomUUID().toString() + "_" + name;
                try {
                    backend.write(newStoragePath, obj.getInputStream(), obj.getSize());
                } finally {
                    try { obj.close(); } catch (IOException ignored) {}
                }

                FileNode node = new FileNode();
                node.setName(name);
                node.setParentId(parentId);
                node.setIsDir(false);
                node.setSize(existing.getSize());
                node.setFileHash(md5);
                node.setStoragePath(newStoragePath);
                node.setStorageType(backend.type().name());
                node.setOwnerId(userId);
                node.setCreateTime(LocalDateTime.now());
                fileNodeMapper.insert(node);
                return node;
            }
        }

        String storagePath = UUID.randomUUID().toString() + "_" + name;
        StorageBackend backend = router.defaultBackend();
        try {
            backend.write(storagePath, data, size);
        } finally {
            try { data.close(); } catch (IOException ignored) {}
        }

        FileNode node = new FileNode();
        node.setName(name);
        node.setParentId(parentId);
        node.setIsDir(false);
        node.setSize(size);
        node.setStoragePath(storagePath);
        node.setStorageType(backend.type().name());
        if (md5 != null) {
            node.setFileHash(md5);
        }
        node.setOwnerId(userId);
        node.setCreateTime(LocalDateTime.now());
        fileNodeMapper.insert(node);
        return node;
    }

    public FileNode findByHash(String md5, Long userId) {
        return fileNodeMapper.selectOne(new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getFileHash, md5)
                .eq(FileNode::getOwnerId, userId)
                .eq(FileNode::getIsDir, false)
                .eq(FileNode::getIsDeleted, false)
                .last("LIMIT 1"));
    }

    @Transactional
    public FileNode quickUpload(String md5, String fileName, Long parentId, Long userId) {
        authzService.checkPermission(userId, "file:write");

        FileNode existing = fileNodeMapper.selectOne(new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getFileHash, md5)
                .eq(FileNode::getOwnerId, userId)
                .eq(FileNode::getIsDir, false)
                .eq(FileNode::getIsDeleted, false)
                .last("LIMIT 1"));
        if (existing == null) {
            return null;
        }

        Long count = fileNodeMapper.selectCount(new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getParentId, parentId)
                .eq(FileNode::getName, fileName)
                .eq(FileNode::getIsDeleted, false));
        if (count > 0) {
            throw new BusinessException("该目录下已存在同名文件: " + fileName);
        }

        StorageBackend backend = router.route(existing);
        StorageObject obj = backend.read(existing.getStoragePath());
        String newStoragePath = UUID.randomUUID().toString() + "_" + fileName;
        try {
            backend.write(newStoragePath, obj.getInputStream(), obj.getSize());
        } finally {
            try { obj.close(); } catch (IOException ignored) {}
        }

        FileNode node = new FileNode();
        node.setName(fileName);
        node.setParentId(parentId);
        node.setIsDir(false);
        node.setSize(existing.getSize());
        node.setFileHash(md5);
        node.setStoragePath(newStoragePath);
        node.setStorageType(backend.type().name());
        node.setOwnerId(userId);
        node.setCreateTime(LocalDateTime.now());
        fileNodeMapper.insert(node);
        return node;
    }

    public void uploadChunk(String md5, int index, Long userId, InputStream data, long size) {
        authzService.checkPermission(userId, "file:write");
        String chunkPath = chunkTempDir(userId) + "/" + md5 + "/" + index;
        try {
            router.defaultBackend().write(chunkPath, data, size);
        } finally {
            try { data.close(); } catch (IOException ignored) {}
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public FileNode mergeChunks(String md5, String fileName, Long parentId, Long userId) {
        authzService.checkPermission(userId, "file:write");

        String tempPrefix = chunkTempDir(userId) + "/" + md5;
        StorageBackend backend = router.defaultBackend();

        if (!backend.exists(tempPrefix)) {
            throw new BusinessException("合并失败：分片目录不存在");
        }

        List<String> chunkPaths = backend.list(tempPrefix);
        if (chunkPaths.isEmpty()) {
            throw new BusinessException("合并失败：未找到任何分片");
        }

        chunkPaths = chunkPaths.stream()
                .sorted(Comparator.comparingInt(p -> {
                    String name = p.substring(p.lastIndexOf('/') + 1);
                    try {
                        return Integer.parseInt(name);
                    } catch (NumberFormatException e) {
                        log.warn("分片名称非数字，跳过: {}", name);
                        return Integer.MAX_VALUE;
                    }
                }))
                .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);

        if (chunkPaths.isEmpty()) {
            throw new BusinessException("合并失败：无有效分片");
        }

        String finalPath = UUID.randomUUID().toString() + "_" + fileName;

        List<InputStream> streams = new ArrayList<>();
        long totalSize = 0;
        try {
            for (String chunkPath : chunkPaths) {
                StorageObject chunk = backend.read(chunkPath);
                streams.add(chunk.getInputStream());
                totalSize += chunk.getSize();
            }
            SequenceInputStream combined = new SequenceInputStream(Collections.enumeration(streams));
            try {
                backend.write(finalPath, combined, totalSize);
            } finally {
                try { combined.close(); } catch (IOException ignored) {}
            }
        } finally {
            for (InputStream is : streams) {
                try { is.close(); } catch (IOException ignored) {}
            }
        }

        backend.deleteDirectory(tempPrefix);

        FileNode node = new FileNode();
        node.setName(fileName);
        node.setParentId(parentId);
        node.setIsDir(false);
        node.setSize(totalSize);
        node.setStoragePath(finalPath);
        node.setStorageType(backend.type().name());
        node.setFileHash(md5);
        node.setOwnerId(userId);
        node.setCreateTime(LocalDateTime.now());
        fileNodeMapper.insert(node);
        return node;
    }

    @Transactional
    public void delete(Long fileId, Long userId) {
        authzService.checkPermission(userId, "file:delete");
        FileNode node = fileNodeMapper.selectById(fileId);
        if (node == null) {
            throw new BusinessException("文件已不存在");
        }
        if (!userId.equals(node.getOwnerId())) {
            throw new BusinessException(403, "无权删除该文件");
        }

        if (node.getIsDir()) {
            deleteChildrenRecursively(node.getId());
        } else {
            StorageBackend backend = router.route(node);
            backend.delete(node.getStoragePath());
        }

        fileNodeMapper.update(null,
                new LambdaUpdateWrapper<FileNode>()
                        .eq(FileNode::getId, node.getId())
                        .set(FileNode::getIsDeleted, true)
                        .set(FileNode::getDeleteTime, LocalDateTime.now()));
    }

    private void deleteChildrenRecursively(Long parentId) {
        List<FileNode> children = fileNodeMapper.selectList(new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getParentId, parentId)
                .eq(FileNode::getIsDeleted, false));
        for (FileNode child : children) {
            if (child.getIsDir()) {
                deleteChildrenRecursively(child.getId());
            } else {
                StorageBackend backend = router.route(child);
                backend.delete(child.getStoragePath());
            }
            fileNodeMapper.update(null,
                    new LambdaUpdateWrapper<FileNode>()
                            .eq(FileNode::getId, child.getId())
                            .set(FileNode::getIsDeleted, true)
                            .set(FileNode::getDeleteTime, LocalDateTime.now()));
        }
    }

    @Transactional
    public FileNode createDirectory(String name, Long parentId, Long userId) {
        authzService.checkPermission(userId, "file:write");
        Long count = fileNodeMapper.selectCount(new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getParentId, parentId)
                .eq(FileNode::getName, name)
                .eq(FileNode::getIsDeleted, false));
        if (count > 0) {
            throw new BusinessException("该目录下已存在同名文件或文件夹");
        }

        FileNode node = new FileNode();
        node.setName(name);
        node.setParentId(parentId);
        node.setIsDir(true);
        node.setSize(0L);
        node.setOwnerId(userId);
        node.setCreateTime(LocalDateTime.now());
        fileNodeMapper.insert(node);
        return node;
    }

    public FileNode getFileDetail(Long fileId, Long userId) {
        authzService.checkPermission(userId, "file:read");
        FileNode node = fileNodeMapper.selectById(fileId);
        if (node == null) {
            throw new BusinessException("文件不存在");
        }
        if (!userId.equals(node.getOwnerId())) {
            throw new BusinessException(403, "无权访问该文件");
        }
        return node;
    }

    @Transactional
    public FileNode move(Long fileId, Long targetParentId, Long userId) {
        authzService.checkPermission(userId, "file:write");

        FileNode node = fileNodeMapper.selectById(fileId);
        if (node == null) {
            throw new BusinessException("文件不存在");
        }
        assertOwnership(node, userId);

        validateTargetParent(targetParentId, userId);

        if (Boolean.TRUE.equals(node.getIsDir())) {
            if (Objects.equals(fileId, targetParentId)) {
                throw new BusinessException("不能将目录移动到自身");
            }
            if (isDescendant(targetParentId, fileId)) {
                throw new BusinessException("不能将目录移动到其子目录中");
            }
        }

        checkNameConflict(node.getName(), targetParentId, fileId, userId);

        node.setParentId(targetParentId);
        fileNodeMapper.updateById(node);
        return fileNodeMapper.selectById(fileId);
    }

    @Transactional
    public FileNode copy(Long fileId, Long targetParentId, Long userId) {
        authzService.checkPermission(userId, "file:write");

        FileNode source = fileNodeMapper.selectById(fileId);
        if (source == null) {
            throw new BusinessException("文件不存在");
        }
        if (!userId.equals(source.getOwnerId())) {
            throw new BusinessException(403, "无权操作该文件");
        }

        validateTargetParent(targetParentId, userId);
        checkNameConflict(source.getName(), targetParentId, null, userId);

        if (Boolean.TRUE.equals(source.getIsDir())) {
            return copyDirectory(source, targetParentId, userId);
        }
        return copyFile(source, targetParentId, userId);
    }

    @Transactional
    public FileNode rename(Long fileId, String newName, Long userId) {
        authzService.checkPermission(userId, "file:write");

        FileNode node = fileNodeMapper.selectById(fileId);
        if (node == null) {
            throw new BusinessException("文件不存在");
        }
        assertOwnership(node, userId);

        checkNameConflict(newName, node.getParentId(), fileId, userId);

        node.setName(newName);
        fileNodeMapper.updateById(node);
        return fileNodeMapper.selectById(fileId);
    }

    @Transactional
    public void batchDelete(List<Long> fileIds, Long userId) {
        authzService.checkPermission(userId, "file:delete");
        for (Long id : fileIds) {
            FileNode node = fileNodeMapper.selectById(id);
            if (node == null) continue;
            if (!userId.equals(node.getOwnerId())) continue;
            if (node.getIsDir()) {
                deleteChildrenRecursively(node.getId());
            } else {
                StorageBackend backend = router.route(node);
                backend.delete(node.getStoragePath());
            }
            fileNodeMapper.update(null,
                    new LambdaUpdateWrapper<FileNode>()
                            .eq(FileNode::getId, node.getId())
                            .set(FileNode::getIsDeleted, true)
                            .set(FileNode::getDeleteTime, LocalDateTime.now()));
        }
    }

    @Transactional
    public List<FileNode> batchMove(List<Long> fileIds, Long targetParentId, Long userId) {
        authzService.checkPermission(userId, "file:write");
        validateTargetParent(targetParentId, userId);
        List<FileNode> moved = new ArrayList<>();
        for (Long id : fileIds) {
            FileNode node = fileNodeMapper.selectById(id);
            if (node == null) continue;
            if (!userId.equals(node.getOwnerId())) continue;
            if (Boolean.TRUE.equals(node.getIsDir())) {
                if (Objects.equals(id, targetParentId)) continue;
                if (isDescendant(targetParentId, id)) continue;
            }
            try {
                checkNameConflict(node.getName(), targetParentId, id, userId);
            } catch (BusinessException e) {
                continue;
            }
            node.setParentId(targetParentId);
            fileNodeMapper.updateById(node);
            moved.add(fileNodeMapper.selectById(id));
        }
        return moved;
    }

    @Transactional
    public List<FileNode> batchCopy(List<Long> fileIds, Long targetParentId, Long userId) {
        authzService.checkPermission(userId, "file:write");
        validateTargetParent(targetParentId, userId);
        List<FileNode> copied = new ArrayList<>();
        for (Long id : fileIds) {
            FileNode source = fileNodeMapper.selectById(id);
            if (source == null) continue;
            if (!userId.equals(source.getOwnerId())) continue;
            try {
                checkNameConflict(source.getName(), targetParentId, null, userId);
            } catch (BusinessException e) {
                continue;
            }
            if (Boolean.TRUE.equals(source.getIsDir())) {
                copied.add(copyDirectory(source, targetParentId, userId));
            } else {
                copied.add(copyFile(source, targetParentId, userId));
            }
        }
        return copied;
    }

    private void assertOwnership(FileNode node, Long userId) {
        if (!userId.equals(node.getOwnerId())) {
            throw new BusinessException(403, "无权操作该文件");
        }
    }

    private void validateTargetParent(Long parentId, Long userId) {
        if (parentId == 0L) return;
        FileNode parent = fileNodeMapper.selectById(parentId);
        if (parent == null) {
            throw new BusinessException("目标目录不存在");
        }
        if (!Boolean.TRUE.equals(parent.getIsDir())) {
            throw new BusinessException("目标路径不是目录");
        }
        if (!userId.equals(parent.getOwnerId())) {
            throw new BusinessException(403, "无权操作目标目录");
        }
    }

    private void checkNameConflict(String name, Long parentId, Long excludeId, Long userId) {
        LambdaQueryWrapper<FileNode> wrapper = new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getParentId, parentId)
                .eq(FileNode::getName, name)
                .eq(FileNode::getIsDeleted, false);
        if (excludeId != null) {
            wrapper.ne(FileNode::getId, excludeId);
        }
        if (fileNodeMapper.selectCount(wrapper) > 0) {
            throw new BusinessException("目标目录下已存在同名文件或文件夹");
        }
    }

    private boolean isDescendant(Long nodeId, Long potentialAncestorId) {
        Long currentId = nodeId;
        while (currentId != null && currentId != 0L) {
            if (currentId.equals(potentialAncestorId)) {
                return true;
            }
            FileNode node = fileNodeMapper.selectById(currentId);
            if (node == null) break;
            currentId = node.getParentId();
        }
        return false;
    }

    private FileNode copyFile(FileNode source, Long targetParentId, Long userId) {
        StorageBackend backend = router.route(source);
        StorageObject storageObj = backend.read(source.getStoragePath());

        String newStoragePath = UUID.randomUUID().toString() + "_" + source.getName();
        try {
            backend.write(newStoragePath, storageObj.getInputStream(), storageObj.getSize());
        } finally {
            try { storageObj.close(); } catch (IOException ignored) {}
        }

        FileNode copy = new FileNode();
        copy.setName(source.getName());
        copy.setParentId(targetParentId);
        copy.setIsDir(false);
        copy.setSize(source.getSize());
        copy.setFileHash(source.getFileHash());
        copy.setStoragePath(newStoragePath);
        copy.setStorageType(backend.type().name());
        copy.setOwnerId(userId);
        copy.setCreateTime(LocalDateTime.now());
        fileNodeMapper.insert(copy);
        return copy;
    }

    private FileNode copyDirectory(FileNode source, Long targetParentId, Long userId) {
        FileNode newDir = new FileNode();
        newDir.setName(source.getName());
        newDir.setParentId(targetParentId);
        newDir.setIsDir(true);
        newDir.setSize(0L);
        newDir.setOwnerId(userId);
        newDir.setCreateTime(LocalDateTime.now());
        fileNodeMapper.insert(newDir);

        List<FileNode> children = fileNodeMapper.selectList(new LambdaQueryWrapper<FileNode>()
                .eq(FileNode::getParentId, source.getId())
                .eq(FileNode::getIsDeleted, false));
        for (FileNode child : children) {
            if (Boolean.TRUE.equals(child.getIsDir())) {
                copyDirectory(child, newDir.getId(), userId);
            } else {
                copyFile(child, newDir.getId(), userId);
            }
        }
        return newDir;
    }

    private void ensureAncestorsAccessible(FileNode node, Long userId) {
        Long parentId = node.getParentId();
        while (parentId != null && parentId != 0L) {
            FileNode parent = fileNodeMapper.selectByIdIncludingDeleted(parentId);
            if (parent == null || Boolean.TRUE.equals(parent.getIsDeleted())) {
                throw new BusinessException("文件不存在");
            }
            if (!userId.equals(parent.getOwnerId())) {
                throw new BusinessException(403, "无权访问该文件");
            }
            parentId = parent.getParentId();
        }
    }

    private String chunkTempDir(Long userId) {
        String tempDir = storageProperties.getChunk().getTempDir();
        if (tempDir == null || tempDir.isEmpty()) {
            tempDir = "temp";
        }
        if (tempDir.endsWith("/")) {
            tempDir = tempDir.substring(0, tempDir.length() - 1);
        }
        return tempDir + "/" + userId;
    }
}
