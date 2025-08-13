-- CloudFlare ImgBed D1 Database Schema
-- 用于替代原有的KV存储

-- 1. 文件表 - 存储文件元数据
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,                    -- 文件ID (原KV的key)
    value TEXT,                            -- 文件值 (对于分块文件，存储实际内容)
    metadata TEXT NOT NULL,                -- 文件元数据 (JSON格式)
    file_name TEXT,                        -- 文件名 (从metadata中提取，便于查询)
    file_type TEXT,                        -- 文件类型 (从metadata中提取)
    file_size TEXT,                        -- 文件大小 (从metadata中提取)
    upload_ip TEXT,                        -- 上传IP (从metadata中提取)
    upload_address TEXT,                   -- 上传地址 (从metadata中提取)
    list_type TEXT,                        -- 列表类型 (从metadata中提取)
    timestamp INTEGER,                     -- 时间戳 (从metadata中提取，便于排序)
    label TEXT,                           -- 标签 (从metadata中提取)
    directory TEXT,                       -- 目录 (从metadata中提取，便于查询)
    channel TEXT,                         -- 渠道 (从metadata中提取)
    channel_name TEXT,                    -- 渠道名称 (从metadata中提取)
    tg_file_id TEXT,                      -- Telegram文件ID (从metadata中提取)
    tg_chat_id TEXT,                      -- Telegram聊天ID (从metadata中提取)
    tg_bot_token TEXT,                    -- Telegram Bot Token (从metadata中提取)
    is_chunked BOOLEAN DEFAULT FALSE,     -- 是否为分块文件
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 为文件表创建索引
CREATE INDEX IF NOT EXISTS idx_files_timestamp ON files(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_files_directory ON files(directory);
CREATE INDEX IF NOT EXISTS idx_files_channel ON files(channel);
CREATE INDEX IF NOT EXISTS idx_files_file_type ON files(file_type);
CREATE INDEX IF NOT EXISTS idx_files_upload_ip ON files(upload_ip);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);

-- 2. 系统配置表 - 存储各种系统配置
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,                 -- 配置键 (原KV的key)
    value TEXT NOT NULL,                  -- 配置值 (JSON格式)
    category TEXT,                        -- 配置分类 (page, security, upload, others等)
    description TEXT,                     -- 配置描述
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 为设置表创建索引
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

-- 3. 索引操作表 - 存储原子操作记录
CREATE TABLE IF NOT EXISTS index_operations (
    id TEXT PRIMARY KEY,                  -- 操作ID
    type TEXT NOT NULL,                   -- 操作类型 (add, remove, move, batch_add等)
    timestamp INTEGER NOT NULL,           -- 时间戳
    data TEXT NOT NULL,                   -- 操作数据 (JSON格式)
    processed BOOLEAN DEFAULT FALSE,      -- 是否已处理
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 为索引操作表创建索引
CREATE INDEX IF NOT EXISTS idx_index_operations_timestamp ON index_operations(timestamp);
CREATE INDEX IF NOT EXISTS idx_index_operations_processed ON index_operations(processed);
CREATE INDEX IF NOT EXISTS idx_index_operations_type ON index_operations(type);

-- 4. 索引元数据表 - 存储索引的元信息
CREATE TABLE IF NOT EXISTS index_metadata (
    key TEXT PRIMARY KEY,                 -- 元数据键 (如 'main_index')
    last_updated INTEGER,                 -- 最后更新时间
    total_count INTEGER DEFAULT 0,       -- 总文件数
    last_operation_id TEXT,               -- 最后处理的操作ID
    chunk_count INTEGER DEFAULT 0,       -- 分块数量 (保留字段，D1中可能不需要)
    chunk_size INTEGER DEFAULT 0,        -- 分块大小 (保留字段)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. 其他数据表 - 存储黑名单IP等其他数据
CREATE TABLE IF NOT EXISTS other_data (
    key TEXT PRIMARY KEY,                 -- 数据键
    value TEXT NOT NULL,                  -- 数据值
    type TEXT,                           -- 数据类型 (blacklist_ip, whitelist等)
    description TEXT,                     -- 描述
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 为其他数据表创建索引
CREATE INDEX IF NOT EXISTS idx_other_data_type ON other_data(type);

-- 6. 创建触发器来自动更新 updated_at 字段
-- 文件表触发器
CREATE TRIGGER IF NOT EXISTS update_files_updated_at 
    AFTER UPDATE ON files
    BEGIN
        UPDATE files SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- 设置表触发器
CREATE TRIGGER IF NOT EXISTS update_settings_updated_at 
    AFTER UPDATE ON settings
    BEGIN
        UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
    END;

-- 索引元数据表触发器
CREATE TRIGGER IF NOT EXISTS update_index_metadata_updated_at 
    AFTER UPDATE ON index_metadata
    BEGIN
        UPDATE index_metadata SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
    END;

-- 其他数据表触发器
CREATE TRIGGER IF NOT EXISTS update_other_data_updated_at 
    AFTER UPDATE ON other_data
    BEGIN
        UPDATE other_data SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
    END;
