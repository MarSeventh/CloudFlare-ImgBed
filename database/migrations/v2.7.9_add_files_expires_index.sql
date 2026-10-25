-- 为文件有效期添加部分表达式索引
-- 到期时间只保存在 metadata 的 ExpiresAt 中，不新增列；只有设置了有效期的文件进入索引
-- 清理任务按到期时间读取已到期的文件，不扫描全表

CREATE INDEX IF NOT EXISTS idx_files_expires
    ON files(json_extract(metadata, '$.ExpiresAt'))
    WHERE json_extract(metadata, '$.ExpiresAt') IS NOT NULL;
