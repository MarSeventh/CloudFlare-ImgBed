/**
 * Metadata 管理端视图工具
 * 负责生成管理端可展示的 metadata，过滤敏感字段并按当前渠道配置补齐派生字段
 */
import { findConfiguredChannel, loadChannelConfig } from './channelConfig.js';
import { stripConfigDerivedMetadata, stripSensitiveMetadata } from './metadataSecurity.js';
import { buildWebDAVUrl } from '../storage/webdavAPI.js';

/* ========== 主要函数 ========== */

// 创建复用的视图上下文，避免批量序列化时重复读取上传配置
export async function createMetadataViewContext(db, env) {
  return {
    db,
    env,
    uploadConfig: await loadChannelConfig(db, env, 'metadata view'),
  };
}

// 构建管理端可见 metadata，过滤敏感字段并补齐可展示链接
export async function buildFileMetadataForManagement(db, env, metadata = {}, viewContext = null) {
  const context = viewContext || await createMetadataViewContext(db, env);
  const view = stripConfigDerivedMetadata(stripSensitiveMetadata(metadata));

  // 管理端展示字段从当前渠道配置实时补齐，不依赖旧 metadata 中保存的派生值
  enrichS3Metadata(context, metadata, view);
  enrichHuggingFaceMetadata(context, metadata, view);
  enrichWebDAVMetadata(context, metadata, view);

  return view;
}

// 将文件记录序列化为管理端列表接口使用的安全结构
export async function serializeFileRecordForManagement(db, env, file, viewContext = null) {
  return {
    name: file.id || file.name,
    metadata: await buildFileMetadataForManagement(db, env, file.metadata, viewContext),
  };
}

/* ========== 关键函数 ========== */

// 根据当前 S3 渠道配置补齐访问位置和 CDN URL
function enrichS3Metadata(context, sourceMetadata, view) {
  if (sourceMetadata?.Channel !== 'S3') return;

  try {
    const channel = findConfiguredChannel(context.uploadConfig, 's3', sourceMetadata);
    if (!channel) return;

    const credentials = {
      endpoint: channel.endpoint,
      region: channel.region || 'auto',
      bucketName: channel.bucketName,
      pathStyle: channel.pathStyle || false,
      cdnDomain: channel.cdnDomain || '',
      key: sourceMetadata.S3FileKey,
    };

    if (!credentials.key) return;

    if (credentials.endpoint && credentials.bucketName) {
      view.S3Location = buildS3Location(credentials, credentials.key);
    }

    if (credentials.cdnDomain) {
      view.S3CdnFileUrl = buildCdnFileUrl(credentials.cdnDomain, credentials.key);
    }
  } catch (error) {
    console.warn('Failed to enrich S3 metadata:', error.message);
  }
}

// 根据当前 HuggingFace 渠道配置补齐文件访问 URL
function enrichHuggingFaceMetadata(context, sourceMetadata, view) {
  if (sourceMetadata?.Channel !== 'HuggingFace') return;

  try {
    const channel = findConfiguredChannel(context.uploadConfig, 'huggingface', sourceMetadata);
    if (!channel) return;

    if (channel.repo && sourceMetadata.HfFilePath) {
      view.HfFileUrl = `https://huggingface.co/datasets/${channel.repo}/resolve/main/${sourceMetadata.HfFilePath}`;
    }
  } catch (error) {
    console.warn('Failed to enrich HuggingFace metadata:', error.message);
  }
}

// 根据当前 WebDAV 渠道配置补齐公开访问 URL
function enrichWebDAVMetadata(context, sourceMetadata, view) {
  if (sourceMetadata?.Channel !== 'WebDAV') return;

  try {
    const channel = findConfiguredChannel(context.uploadConfig, 'webdav', sourceMetadata);
    if (!channel) return;

    if (channel.publicUrl && sourceMetadata.WebDAVFilePath) {
      view.WebDAVPublicUrl = buildWebDAVUrl(channel.publicUrl, sourceMetadata.WebDAVFilePath);
    }
  } catch (error) {
    console.warn('Failed to enrich WebDAV metadata:', error.message);
  }
}

/* ========== 工具函数 ========== */

// 构建 S3 对象的源站访问地址
export function buildS3Location(credentials, key) {
  const endpointHost = stripEndpointProtocol(credentials.endpoint);
  if (!endpointHost || !credentials.bucketName || !key) return '';

  // 同时支持 path-style 与 virtual-hosted-style 两种 S3 访问形式
  if (credentials.pathStyle) {
    return `https://${endpointHost}/${credentials.bucketName}/${key}`;
  }

  return `https://${credentials.bucketName}.${endpointHost}/${key}`;
}

// 构建渠道 CDN 域名下的文件访问地址
export function buildCdnFileUrl(cdnDomain, key) {
  if (!cdnDomain || !key) return '';
  return `${String(cdnDomain).replace(/\/+$/, '')}/${key}`;
}

// 去掉 endpoint 的协议和尾部斜杠，便于拼接 S3 地址
function stripEndpointProtocol(endpoint) {
  return String(endpoint || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}
