import { v2 as cloudinary } from 'cloudinary';

// Lazy configuration to ensure dotenv has already run
function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials are not properly configured in environment variables');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
}

/**
 * Uploads an image buffer directly to Cloudinary without writing to disk.
 * @param {Buffer} buffer - The image buffer from multer memory storage
 * @param {number|string} userId - ID of the user for unique public_id
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export async function uploadAvatarStream(buffer, userId) {
  const cld = configureCloudinary();

  return new Promise((resolve, reject) => {
    const uploadStream = cld.uploader.upload_stream(
      {
        folder: 'regional_t/avatars',
        public_id: `user_${userId}`,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 300, height: 300, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          return reject(new Error(error.message || 'Error uploading image to Cloudinary'));
        }
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary did not return a valid secure_url'));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Deletes an avatar from Cloudinary by user ID.
 * @param {number|string} userId
 * @returns {Promise<boolean>}
 */
export async function deleteAvatarByUserId(userId) {
  const cld = configureCloudinary();
  try {
    const publicId = `regional_t/avatars/user_${userId}`;
    const result = await cld.uploader.destroy(publicId, { resource_type: 'image' });
    return result.result === 'ok';
  } catch (err) {
    console.warn('Failed to delete avatar from Cloudinary:', err.message);
    return false;
  }
}
