import { getUploadConfig } from '../../api/manage/sysConfig/upload.js';
import { sanitizeFileMetadata } from './metadataSecurity.js';
import { buildWebDAVUrl } from '../storage/webdavAPI.js';

export async function createMetadataViewContext(db, env) {
  return {
    db,
    env,
    uploadConfig: await loadUploadConfig(db, env),
  };
}

export async function buildFileMetadataForManagement(db, env, metadata = {}, viewContext = null) {
  const context = viewContext || await createMetadataViewContext(db, env);
  const view = sanitizeFileMetadata(metadata);

  enrichS3Metadata(context, metadata, view);
  enrichHuggingFaceMetadata(context, metadata, view);
  enrichWebDAVMetadata(context, metadata, view);

  return view;
}

export async function serializeFileRecordForManagement(db, env, file, viewContext = null) {
  return {
    name: file.id || file.name,
    metadata: await buildFileMetadataForManagement(db, env, file.metadata, viewContext),
  };
}

function enrichS3Metadata(context, sourceMetadata, view) {
  if (sourceMetadata?.Channel !== 'S3') return;

  try {
    const channel = findChannel(context, 's3', sourceMetadata.ChannelName);
    const credentials = channel
      ? {
        endpoint: channel.endpoint,
        region: channel.region || 'auto',
        bucketName: channel.bucketName,
        pathStyle: channel.pathStyle || false,
        cdnDomain: channel.cdnDomain || '',
        key: sourceMetadata.S3FileKey,
      }
      : {
        endpoint: sourceMetadata.S3Endpoint,
        region: sourceMetadata.S3Region || 'auto',
        bucketName: sourceMetadata.S3BucketName,
        pathStyle: sourceMetadata.S3PathStyle || false,
        cdnDomain: sourceMetadata.S3CdnDomain || '',
        key: sourceMetadata.S3FileKey,
      };
    const key = credentials.key || sourceMetadata.S3FileKey;

    if (!key) return;

    if (credentials.endpoint && credentials.bucketName) {
      view.S3Location = buildS3Location(credentials, key);
    }

    if (channel) {
      delete view.S3CdnFileUrl;
    }
    if (credentials.cdnDomain) {
      view.S3CdnFileUrl = buildCdnFileUrl(credentials.cdnDomain, key);
    }
  } catch (error) {
    console.warn('Failed to enrich S3 metadata:', error.message);
  }
}

function enrichHuggingFaceMetadata(context, sourceMetadata, view) {
  if (sourceMetadata?.Channel !== 'HuggingFace') return;

  try {
    const channel = findChannel(context, 'huggingface', sourceMetadata.ChannelName);
    const credentials = channel
      ? {
        repo: channel.repo,
        filePath: sourceMetadata.HfFilePath,
      }
      : {
        repo: sourceMetadata.HfRepo,
        filePath: sourceMetadata.HfFilePath,
      };
    if (credentials.repo && credentials.filePath) {
      view.HfFileUrl = `https://huggingface.co/datasets/${credentials.repo}/resolve/main/${credentials.filePath}`;
    }
  } catch (error) {
    console.warn('Failed to enrich HuggingFace metadata:', error.message);
  }
}

function enrichWebDAVMetadata(context, sourceMetadata, view) {
  if (sourceMetadata?.Channel !== 'WebDAV') return;

  try {
    const channel = findChannel(context, 'webdav', sourceMetadata.ChannelName);
    const credentials = channel
      ? {
        publicUrl: channel.publicUrl || '',
        filePath: sourceMetadata.WebDAVFilePath,
      }
      : {
        publicUrl: sourceMetadata.WebDAVPublicBaseUrl || '',
        filePath: sourceMetadata.WebDAVFilePath,
      };
    const filePath = credentials.filePath || sourceMetadata.WebDAVFilePath;
    if (channel) {
      delete view.WebDAVPublicUrl;
    }
    if (credentials.publicUrl && filePath) {
      view.WebDAVPublicUrl = buildWebDAVUrl(credentials.publicUrl, filePath);
    }
  } catch (error) {
    console.warn('Failed to enrich WebDAV metadata:', error.message);
  }
}

async function loadUploadConfig(db, env) {
  try {
    return await getUploadConfig(db, env);
  } catch (error) {
    console.warn('Failed to load upload config for metadata view:', error.message);
    return null;
  }
}

function findChannel(context, groupName, channelName) {
  if (!channelName || !context?.uploadConfig) return null;
  const channels = context.uploadConfig[groupName]?.channels || [];
  return channels.find((channel) => channel.name === channelName) || null;
}

export function buildS3Location(credentials, key) {
  const endpointHost = stripEndpointProtocol(credentials.endpoint);
  if (!endpointHost || !credentials.bucketName || !key) return '';

  if (credentials.pathStyle) {
    return `https://${endpointHost}/${credentials.bucketName}/${key}`;
  }

  return `https://${credentials.bucketName}.${endpointHost}/${key}`;
}

export function buildCdnFileUrl(cdnDomain, key) {
  if (!cdnDomain || !key) return '';
  return `${String(cdnDomain).replace(/\/+$/, '')}/${key}`;
}

function stripEndpointProtocol(endpoint) {
  return String(endpoint || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}
