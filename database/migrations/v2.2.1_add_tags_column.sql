-- 添加 tags 字段到 files 表
-- 如果字段已存在，此操作会失败，可以忽略

-- 检查并添加 tags 字段
ALTER TABLE files ADD COLUMN tags TEXT;

-- 为 tags 字段创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_files_tags ON files(tags);

-- 说明：
-- tags 字段用于存储文件标签，格式为 JSON 数组
-- 例如：["风景", "旅行", "2024"]
