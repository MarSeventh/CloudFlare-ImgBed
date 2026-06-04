import { findConfiguredChannel, loadChannelConfig } from './channelConfig.js';
import { stripConfigDerivedMetadata, stripSensitiveMetadata } from './metadataSecurity.js';
import { buildWebDAVUrl } from '../storage/webdavAPI.js';

export async function createMetadataViewContext(db, env) {
  return {
    db,
    env,
    uploadConfig: await loadChannelConfig(db, env, 'metadata view'),
  };
}

export async function buildFileMetadataForManagement(db, env, metadata = {}, viewContext = null) {
  const context = viewContext || await createMetadataViewContext(db, env);
  const view = stripConfigDerivedMetadata(stripSensitiveMetadata(metadata));

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
