package org.feiesos.auth.admin.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.feiesos.auth.entity.SysPermission;
import org.feiesos.auth.entity.SysRole;

import java.util.List;

@Mapper
public interface AdminMapper {

    @Select("SELECT r.* FROM sys_role r " +
            "JOIN sys_user_role ur ON r.id = ur.role_id " +
            "WHERE ur.user_id = #{userId} AND r.deleted = false")
    List<SysRole> selectRolesByUserId(@Param("userId") Long userId);

    @Select("SELECT p.* FROM sys_permission p " +
            "JOIN sys_role_permission rp ON p.id = rp.permission_id " +
            "WHERE rp.role_id = #{roleId} AND p.deleted = false")
    List<SysPermission> selectPermissionsByRoleId(@Param("roleId") Long roleId);

    @Select("SELECT COUNT(*) FROM sys_user_role ur " +
            "JOIN sys_role r ON ur.role_id = r.id AND r.deleted = false " +
            "WHERE ur.user_id = #{userId} AND r.code = 'ROLE_ADMIN'")
    int countAdminRole(@Param("userId") Long userId);

    @Select("SELECT COUNT(*) FROM sys_user_role ur " +
            "JOIN sys_role r ON ur.role_id = r.id AND r.deleted = false " +
            "JOIN sys_role_permission rp ON ur.role_id = rp.role_id " +
            "JOIN sys_permission p ON rp.permission_id = p.id AND p.deleted = false " +
            "WHERE ur.user_id = #{userId} AND p.code = #{permissionCode}")
    int countPermission(@Param("userId") Long userId, @Param("permissionCode") String permissionCode);

    @Select("SELECT COUNT(*) FROM sys_user WHERE deleted = false")
    long countTotalUsers();

    @Select("SELECT COALESCE(SUM(size), 0) FROM file_node WHERE is_deleted = false")
    long sumTotalFileSize();

    @Select("SELECT COUNT(*) FROM file_node WHERE is_deleted = false AND is_dir = false")
    long countTotalFiles();

    @Select("SELECT COUNT(*) FROM file_node WHERE is_deleted = true")
    long countTotalRecycled();
}
