package org.feiesos.auth.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.feiesos.auth.admin.dto.AdminDashboardVO;
import org.feiesos.auth.admin.dto.AdminPermissionVO;
import org.feiesos.auth.admin.dto.AdminRoleVO;
import org.feiesos.auth.admin.dto.AdminUserVO;
import org.feiesos.auth.admin.mapper.AdminMapper;
import org.feiesos.auth.admin.mapper.RoleMapper;
import org.feiesos.auth.mapper.RolePermissionMapper;
import org.feiesos.auth.mapper.SysPermissionMapper;
import org.feiesos.auth.mapper.UserRoleMapper;
import org.feiesos.auth.admin.service.AdminService;
import org.feiesos.auth.entity.RolePermission;
import org.feiesos.auth.entity.SysPermission;
import org.feiesos.auth.entity.SysRole;
import org.feiesos.auth.entity.SysUser;
import org.feiesos.auth.entity.UserRole;
import org.feiesos.auth.mapper.UserMapper;
import org.feiesos.common.exception.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminServiceImpl implements AdminService {

    private final AdminMapper adminMapper;
    private final UserMapper userMapper;
    private final RoleMapper roleMapper;
    private final SysPermissionMapper sysPermissionMapper;
    private final UserRoleMapper userRoleMapper;
    private final RolePermissionMapper rolePermissionMapper;

    public AdminServiceImpl(AdminMapper adminMapper,
                            UserMapper userMapper,
                            RoleMapper roleMapper,
                            SysPermissionMapper sysPermissionMapper,
                            UserRoleMapper userRoleMapper,
                            RolePermissionMapper rolePermissionMapper) {
        this.adminMapper = adminMapper;
        this.userMapper = userMapper;
        this.roleMapper = roleMapper;
        this.sysPermissionMapper = sysPermissionMapper;
        this.userRoleMapper = userRoleMapper;
        this.rolePermissionMapper = rolePermissionMapper;
    }

    @Override
    public void checkAdminAccess(Long userId) {
        if (adminMapper.countAdminRole(userId) == 0
                && adminMapper.countPermission(userId, "admin:access") == 0) {
            throw new BusinessException(403, "无权执行管理操作");
        }
    }

    @Override
    public IPage<AdminUserVO> listUsers(int page, int size, String keyword) {
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getDeleted, false);

        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like(SysUser::getUsername, keyword)
                    .or()
                    .like(SysUser::getNickname, keyword)
                    .or()
                    .like(SysUser::getEmail, keyword));
        }

        wrapper.orderByDesc(SysUser::getCreatedAt);

        IPage<SysUser> userPage = userMapper.selectPage(new Page<>(page, size), wrapper);
        return userPage.convert(this::toUserVO);
    }

    @Override
    public AdminUserVO getUserDetail(Long userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null || Boolean.TRUE.equals(user.getDeleted())) {
            throw new BusinessException("用户不存在");
        }
        return toUserVO(user);
    }

    @Override
    @Transactional
    public void updateUser(Long targetUserId, String nickname, String email, Boolean enabled) {
        SysUser user = userMapper.selectById(targetUserId);
        if (user == null || Boolean.TRUE.equals(user.getDeleted())) {
            throw new BusinessException("用户不存在");
        }

        if (nickname != null) user.setNickname(nickname);
        if (email != null) {
            SysUser existing = userMapper.findByEmail(email);
            if (existing != null && !existing.getId().equals(targetUserId)) {
                throw new BusinessException("邮箱已被其他用户使用");
            }
            user.setEmail(email);
        }
        if (enabled != null) user.setEnabled(enabled);

        userMapper.updateById(user);
    }

    @Override
    @Transactional
    public void assignUserRoles(Long targetUserId, List<Long> roleIds) {
        SysUser user = userMapper.selectById(targetUserId);
        if (user == null || Boolean.TRUE.equals(user.getDeleted())) {
            throw new BusinessException("用户不存在");
        }

        userRoleMapper.delete(new LambdaQueryWrapper<UserRole>()
                .eq(UserRole::getUserId, targetUserId));

        if (roleIds != null && !roleIds.isEmpty()) {
            for (Long roleId : roleIds) {
                UserRole ur = new UserRole();
                ur.setUserId(targetUserId);
                ur.setRoleId(roleId);
                userRoleMapper.insert(ur);
            }
        }
    }

    @Override
    public List<AdminRoleVO> listRoles() {
        return roleMapper.selectList(null).stream()
                .map(this::toRoleVO)
                .toList();
    }

    @Override
    @Transactional
    public AdminRoleVO createRole(String code, String name) {
        LambdaQueryWrapper<SysRole> wrapper = new LambdaQueryWrapper<SysRole>()
                .eq(SysRole::getCode, code)
                .eq(SysRole::getDeleted, false);
        if (roleMapper.selectCount(wrapper) > 0) {
            throw new BusinessException("角色编码已存在");
        }

        SysRole role = new SysRole();
        role.setCode(code);
        role.setName(name);
        roleMapper.insert(role);
        return toRoleVO(role);
    }

    @Override
    @Transactional
    public AdminRoleVO updateRole(Long roleId, String code, String name) {
        SysRole role = roleMapper.selectById(roleId);
        if (role == null || Boolean.TRUE.equals(role.getDeleted())) {
            throw new BusinessException("角色不存在");
        }

        if (code != null) {
            LambdaQueryWrapper<SysRole> wrapper = new LambdaQueryWrapper<SysRole>()
                    .eq(SysRole::getCode, code)
                    .ne(SysRole::getId, roleId)
                    .eq(SysRole::getDeleted, false);
            if (roleMapper.selectCount(wrapper) > 0) {
                throw new BusinessException("角色编码已存在");
            }
            role.setCode(code);
        }
        if (name != null) role.setName(name);
        roleMapper.updateById(role);
        return toRoleVO(roleMapper.selectById(roleId));
    }

    @Override
    @Transactional
    public void deleteRole(Long roleId) {
        SysRole role = roleMapper.selectById(roleId);
        if (role == null || Boolean.TRUE.equals(role.getDeleted())) {
            throw new BusinessException("角色不存在");
        }
        roleMapper.deleteById(roleId);
    }

    @Override
    @Transactional
    public void assignRolePermissions(Long roleId, List<Long> permissionIds) {
        SysRole role = roleMapper.selectById(roleId);
        if (role == null || Boolean.TRUE.equals(role.getDeleted())) {
            throw new BusinessException("角色不存在");
        }

        rolePermissionMapper.delete(new LambdaQueryWrapper<RolePermission>()
                .eq(RolePermission::getRoleId, roleId));

        if (permissionIds != null && !permissionIds.isEmpty()) {
            for (Long permId : permissionIds) {
                RolePermission rp = new RolePermission();
                rp.setRoleId(roleId);
                rp.setPermissionId(permId);
                rolePermissionMapper.insert(rp);
            }
        }
    }

    @Override
    public List<AdminPermissionVO> listPermissions() {
        return sysPermissionMapper.selectList(null).stream()
                .map(this::toPermissionVO)
                .toList();
    }

    @Override
    @Transactional
    public AdminPermissionVO createPermission(String code, String name) {
        LambdaQueryWrapper<SysPermission> wrapper = new LambdaQueryWrapper<SysPermission>()
                .eq(SysPermission::getCode, code)
                .eq(SysPermission::getDeleted, false);
        if (sysPermissionMapper.selectCount(wrapper) > 0) {
            throw new BusinessException("权限编码已存在");
        }

        SysPermission permission = new SysPermission();
        permission.setCode(code);
        permission.setName(name);
        sysPermissionMapper.insert(permission);
        return toPermissionVO(permission);
    }

    @Override
    @Transactional
    public AdminPermissionVO updatePermission(Long permissionId, String code, String name) {
        SysPermission permission = sysPermissionMapper.selectById(permissionId);
        if (permission == null || Boolean.TRUE.equals(permission.getDeleted())) {
            throw new BusinessException("权限不存在");
        }

        if (code != null) {
            LambdaQueryWrapper<SysPermission> wrapper = new LambdaQueryWrapper<SysPermission>()
                    .eq(SysPermission::getCode, code)
                    .ne(SysPermission::getId, permissionId)
                    .eq(SysPermission::getDeleted, false);
            if (sysPermissionMapper.selectCount(wrapper) > 0) {
                throw new BusinessException("权限编码已存在");
            }
            permission.setCode(code);
        }
        if (name != null) permission.setName(name);
        sysPermissionMapper.updateById(permission);
        return toPermissionVO(sysPermissionMapper.selectById(permissionId));
    }

    @Override
    @Transactional
    public void deletePermission(Long permissionId) {
        SysPermission permission = sysPermissionMapper.selectById(permissionId);
        if (permission == null || Boolean.TRUE.equals(permission.getDeleted())) {
            throw new BusinessException("权限不存在");
        }
        sysPermissionMapper.deleteById(permissionId);
    }

    @Override
    public AdminDashboardVO getDashboard() {
        return AdminDashboardVO.builder()
                .totalUsers(adminMapper.countTotalUsers())
                .totalFiles(adminMapper.countTotalFiles())
                .totalFileSize(adminMapper.sumTotalFileSize())
                .totalRecycled(adminMapper.countTotalRecycled())
                .totalRoles(roleMapper.selectCount(new LambdaQueryWrapper<SysRole>()
                        .eq(SysRole::getDeleted, false)))
                .totalPermissions(sysPermissionMapper.selectCount(new LambdaQueryWrapper<SysPermission>()
                        .eq(SysPermission::getDeleted, false)))
                .build();
    }

    private AdminUserVO toUserVO(SysUser user) {
        List<SysRole> roles = adminMapper.selectRolesByUserId(user.getId());
        return AdminUserVO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .nickname(user.getNickname())
                .email(user.getEmail())
                .avatar(user.getAvatar())
                .enabled(user.getEnabled())
                .verifiedAt(user.getVerifiedAt())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .roles(roles.stream()
                        .map(r -> AdminUserVO.AdminRoleBriefVO.builder()
                                .id(r.getId())
                                .code(r.getCode())
                                .name(r.getName())
                                .build())
                        .toList())
                .build();
    }

    private AdminRoleVO toRoleVO(SysRole role) {
        List<SysPermission> perms = adminMapper.selectPermissionsByRoleId(role.getId());
        return AdminRoleVO.builder()
                .id(role.getId())
                .code(role.getCode())
                .name(role.getName())
                .createdAt(role.getCreatedAt())
                .updatedAt(role.getUpdatedAt())
                .permissions(perms.stream()
                        .map(p -> AdminRoleVO.AdminPermissionBriefVO.builder()
                                .id(p.getId())
                                .code(p.getCode())
                                .name(p.getName())
                                .build())
                        .toList())
                .build();
    }

    private AdminPermissionVO toPermissionVO(SysPermission permission) {
        return AdminPermissionVO.builder()
                .id(permission.getId())
                .code(permission.getCode())
                .name(permission.getName())
                .createdAt(permission.getCreatedAt())
                .updatedAt(permission.getUpdatedAt())
                .build();
    }
}
