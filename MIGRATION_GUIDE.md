# CloudFlare ImgBed KV 到 D1 数据库迁移指南

本指南将帮助您将现有的 KV 存储数据迁移到 D1 数据库。

## 迁移前准备

### 1. 配置 D1 数据库

首先，您需要在 Cloudflare 控制台创建一个 D1 数据库：

```bash
# 创建 D1 数据库
wrangler d1 create imgbed-database

# 执行数据库初始化脚本
wrangler d1 execute imgbed-database --file=./database/init.sql
```

### 2. 更新 wrangler.toml

在您的 `wrangler.toml` 文件中添加 D1 数据库绑定：

```toml
[[d1_databases]]
binding = "DB"
database_name = "imgbed-database"
database_id = "your-database-id"
```

### 3. 备份现有数据

在迁移前，强烈建议备份您的现有数据：

1. 访问管理后台的系统设置 → 备份恢复
2. 点击"备份数据"下载完整备份文件
3. 保存备份文件到安全位置

## 迁移步骤

### 1. 检查迁移环境

访问迁移工具检查环境：
```
GET /api/manage/migrate?action=check
```

确保返回结果中 `canMigrate` 为 `true`。

### 2. 查看迁移状态

查看当前数据统计：
```
GET /api/manage/migrate?action=status
```

### 3. 执行迁移

开始数据迁移：
```
GET /api/manage/migrate?action=migrate
```

迁移过程包括：
- 文件元数据迁移
- 系统设置迁移
- 索引操作迁移

## 迁移后验证

### 1. 检查数据完整性

- 访问管理后台，确认文件列表正常显示
- 测试文件上传功能
- 检查系统设置是否保持不变

### 2. 性能测试

- 测试文件访问速度
- 验证管理功能正常工作

### 3. 功能验证

- 文件上传/删除
- 备份恢复功能
- 用户认证
- API Token 管理

## 数据库结构说明

迁移后的 D1 数据库包含以下表：

### files 表
存储文件元数据，包含以下字段：
- `id`: 文件ID（主键）
- `value`: 文件值（用于分块文件）
- `metadata`: JSON格式的文件元数据
- 其他索引字段：`file_name`, `file_type`, `timestamp` 等

### settings 表
存储系统配置：
- `key`: 配置键（主键）
- `value`: 配置值
- `category`: 配置分类

### index_operations 表
存储索引操作记录：
- `id`: 操作ID（主键）
- `type`: 操作类型
- `timestamp`: 时间戳
- `data`: 操作数据
- `processed`: 是否已处理

### index_metadata 表
存储索引元数据：
- `key`: 元数据键
- `last_updated`: 最后更新时间
- `total_count`: 总文件数
- `last_operation_id`: 最后操作ID

### other_data 表
存储其他数据（如黑名单IP等）：
- `key`: 数据键
- `value`: 数据值
- `type`: 数据类型

## 兼容性说明

### 向后兼容
- 系统会自动检测可用的数据库类型（D1 或 KV）
- 如果 D1 不可用，会自动回退到 KV 存储
- 所有现有的 API 接口保持不变

### 环境变量
- `DB`: D1 数据库绑定（新增）
- `img_url`: KV 存储绑定（保留作为备用）

## 故障排除

### 常见问题

1. **迁移失败**
   - 检查 D1 数据库是否正确配置
   - 确认数据库初始化脚本已执行
   - 查看迁移日志中的错误信息

2. **数据不完整**
   - 检查迁移结果中的错误列表
   - 重新运行迁移（支持增量迁移）
   - 使用备份文件恢复数据

3. **性能问题**
   - D1 数据库查询比 KV 稍慢，这是正常的
   - 确保使用了适当的索引
   - 考虑优化查询语句

### 回滚方案

如果迁移后出现问题，可以：

1. 临时禁用 D1 绑定，系统会自动回退到 KV
2. 使用备份文件恢复到迁移前状态
3. 重新配置和测试 D1 数据库

## 性能优化建议

### 1. 索引优化
D1 数据库已预设了必要的索引，包括：
- 文件时间戳索引
- 目录索引
- 文件类型索引

### 2. 查询优化
- 使用分页查询大量数据
- 避免全表扫描
- 合理使用 WHERE 条件

### 3. 监控
- 定期检查数据库性能
- 监控查询执行时间
- 关注错误日志

## 支持

如果在迁移过程中遇到问题，请：

1. 查看浏览器控制台的错误信息
2. 检查 Cloudflare Workers 的日志
3. 确认所有配置正确
4. 参考本指南的故障排除部分

迁移完成后，您的图床将使用更强大的 D1 数据库，享受更好的查询性能和数据管理能力。
