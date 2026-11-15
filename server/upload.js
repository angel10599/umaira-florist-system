const cloudinary = require('./cloudinary');

const VALID_FOLDERS = new Set(['bouquets', 'products', 'pod', 'avatars', 'settings', 'disputes', 'misc']);

async function uploadToCloudinary(dataUrl, folder) {
  const f = VALID_FOLDERS.has(folder) ? folder : 'misc';
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: 'umaira-florist/' + f,
    resource_type: 'image',
  });
  return { url: result.secure_url, public_id: result.public_id };
}

module.exports = { uploadToCloudinary };
