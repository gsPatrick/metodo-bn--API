// src/providers/storage/r2.js — upload de anexos para o Cloudflare R2 (S3-compatível).
// Recebe um dataURL base64, sobe o arquivo e devolve a URL pública. Se o R2 não
// estiver configurado, isEnabled() retorna false e o chamador mantém o base64.
const crypto = require('crypto');
const env = require('../../config/env');

let client = null;
function getClient() {
  if (client) return client;
  const { S3Client } = require('@aws-sdk/client-s3');
  client = new S3Client({
    region: env.R2_REGION || 'auto', // R2 = 'auto'; Supabase/B2 = região do projeto
    forcePathStyle: true, // compatível com Supabase/MinIO
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

function isEnabled() {
  return !!(env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET && env.R2_PUBLIC_URL);
}

const EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};
function extFor(mime) {
  if (EXT[mime]) return EXT[mime];
  const sub = (mime || '').split('/')[1] || 'bin';
  return (sub.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin').toLowerCase();
}

// Sobe um dataURL base64 e devolve a URL pública. Retorna null se não for dataURL.
async function uploadDataUrl(dataUrl, prefix = 'chat') {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const buffer = Buffer.from(m[2], 'base64');
  const key = `${prefix}/${crypto.randomUUID()}.${extFor(mime)}`;
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mime,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  const base = env.R2_PUBLIC_URL.replace(/\/$/, '');
  return `${base}/${key}`;
}

module.exports = { isEnabled, uploadDataUrl };
