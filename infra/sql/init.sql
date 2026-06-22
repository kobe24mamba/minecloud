SELECT current_database();

CREATE TABLE file_node (
    id              BIGINT PRIMARY KEY,                     -- 主键
    name            VARCHAR(500)  NOT NULL,                 -- 文件名/目录名
    parent_id       BIGINT,                                 -- 父节点ID，根节点为NULL
    is_dir          BOOLEAN       NOT NULL DEFAULT FALSE,   -- 是否目录
    size            BIGINT        NOT NULL DEFAULT 0,       -- 文件大小（字节）
    file_hash       VARCHAR(128),                           -- 文件哈希值
    storage_path    TEXT,                                   -- 存储路径
    create_time     TIMESTAMP     NOT NULL DEFAULT NOW(),   -- 创建时间
    is_deleted      BOOLEAN       NOT NULL DEFAULT FALSE,   -- 逻辑删除标识
    delete_time     TIMESTAMP                               -- 删除时间
);

-- 添加注释
COMMENT ON TABLE  file_node               IS '文件/目录节点表';
COMMENT ON COLUMN file_node.id            IS '主键ID';
COMMENT ON COLUMN file_node.name          IS '节点名称';
COMMENT ON COLUMN file_node.parent_id     IS '父节点ID';
COMMENT ON COLUMN file_node.is_dir        IS '是否为目录（true=目录，false=文件）';
COMMENT ON COLUMN file_node.size          IS '文件大小（字节），目录为0';
COMMENT ON COLUMN file_node.file_hash     IS '文件哈希值，目录为NULL';
COMMENT ON COLUMN file_node.storage_path  IS '物理存储路径';
COMMENT ON COLUMN file_node.create_time   IS '创建时间';
COMMENT ON COLUMN file_node.is_deleted    IS '逻辑删除标志';
COMMENT ON COLUMN file_node.delete_time   IS '删除时间';

-- 推荐索引
CREATE INDEX idx_file_node_parent_id ON file_node(parent_id);
CREATE INDEX idx_file_node_is_deleted ON file_node(is_deleted);

-- 变更
ALTER TABLE file_node ADD COLUMN owner_id BIGINT;                                                                                                                     
CREATE INDEX idx_file_node_owner_id ON file_node(owner_id); 
ALTER TABLE file_node ADD COLUMN storage_type VARCHAR(32) NOT NULL DEFAULT 'LOCAL';                                                                                                       
COMMENT ON COLUMN file_node.storage_type IS '存储后端类型: LOCAL/MOUNT/S3/AGENT';

---------------
-- 认证与授权
---------------
CREATE TABLE sys_user (
    id BIGSERIAL PRIMARY KEY,

    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    nickname VARCHAR(64),
    email VARCHAR(128) UNIQUE,
    avatar VARCHAR(255),

    verification_token VARCHAR(255),
    verified_at TIMESTAMPTZ,
    verification_token_expire_at TIMESTAMPTZ,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sys_user                                                                                                                                                  
ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),                                                                                                         
ADD COLUMN IF NOT EXISTS reset_password_token_expire_at TIMESTAMP WITH TIME ZONE; 

CREATE TABLE sys_role (
    id BIGSERIAL PRIMARY KEY,

    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(64) NOT NULL,

    deleted BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sys_permission (
    id BIGSERIAL PRIMARY KEY,

    code VARCHAR(128) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,

    deleted BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sys_user_role (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,

    PRIMARY KEY (user_id, role_id),

    CONSTRAINT fk_user_role_user
        FOREIGN KEY (user_id)
        REFERENCES sys_user(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_role_role
        FOREIGN KEY (role_id)
        REFERENCES sys_role(id)
        ON DELETE CASCADE
);

CREATE TABLE sys_role_permission (
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT fk_role_permission_role
        FOREIGN KEY (role_id)
        REFERENCES sys_role(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_permission_permission
        FOREIGN KEY (permission_id)
        REFERENCES sys_permission(id)
        ON DELETE CASCADE
);

-- refresh token 表
CREATE TABLE IF NOT EXISTS sys_refresh_token (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_token ON sys_refresh_token(token);
CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id ON sys_refresh_token(user_id);

-- 填充鉴权基础数据
INSERT INTO sys_role(code, name)
VALUES
('ROLE_ADMIN', '管理员'),
('ROLE_USER', '普通用户'),
('ROLE_GUEST', '游客');

INSERT INTO sys_permission(code, name)
VALUES
('file:read', '读取文件'),
('file:write', '写入文件'),
('file:upload', '上传文件'),
('file:delete', '删除文件'),
('user:manage', '用户管理');

-- 分配用户角色（admin，admin）
INSERT INTO sys_user (id, username, password_hash, nickname, email, enabled, verified_at) VALUES
(1, 'admin', '$2a$12$skuxiZagy/arecxKbZhfU.iU62eAVBhc8zAgo55.DaJQKnFIMxkvq', '管理员', 'admin@example.com', true, NOW());

-- admin -> ROLE_ADMIN
INSERT INTO sys_user_role (user_id, role_id) VALUES (1, 1);

-- 分配角色权限
-- ROLE_ADMIN: 所有权限
INSERT INTO sys_role_permission (role_id, permission_id) VALUES 
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5);

-- ROLE_USER: 基础文件操作（不含用户管理）
INSERT INTO sys_role_permission (role_id, permission_id) VALUES 
(2, 1), (2, 2), (2, 3), (2, 4);

-- ROLE_GUEST: 只读
INSERT INTO sys_role_permission (role_id, permission_id) VALUES 
(3, 1);

---------------
-- 分享
---------------
-- file_share
CREATE TABLE IF NOT EXISTS file_share (
    id              BIGINT PRIMARY KEY,                     -- 雪花算法 ID
    share_token     VARCHAR(16) NOT NULL UNIQUE,            -- 分享令牌（16位短码）
    file_node_id    BIGINT NOT NULL,                        -- 被分享的文件/目录 ID
    owner_id        BIGINT NOT NULL,                        -- 分享者用户 ID
    access_password VARCHAR(255),                           -- 访问密码（空=公开）
    expire_at       TIMESTAMPTZ,                            -- 过期时间（空=永不过期）
    max_downloads   INTEGER DEFAULT -1,                     -- 最大下载次数（-1=无限）
    download_count  INTEGER DEFAULT 0,                      -- 已下载次数
    remark          TEXT,                                   -- 备注
    created_at      TIMESTAMPTZ DEFAULT NOW(),              -- 创建时间（NOT NULL 已移除，因为 MyBatis-Plus 的 FieldFill.INSERT 无 MetaObjectHandler 时会发 NULL）
    deleted         BOOLEAN DEFAULT FALSE                   -- 逻辑删除
);

CREATE INDEX IF NOT EXISTS idx_file_share_owner   ON file_share(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_share_token ON file_share(share_token);