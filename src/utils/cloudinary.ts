import { compressImage } from './imageCompressor';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dfrcdutb3';
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'nq7hgxmb';

/**
 * Uploads a file to Cloudinary directly from client side.
 * Compresses the image client-side first to minimize bandwidth and upload times.
 *
 * @param file The raw file to upload.
 * @param folder Optional subfolder in Cloudinary.
 * @returns The public URL of the uploaded image.
 */
export async function uploadToCloudinary(file: File, folder = 'itineryey'): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are supported');
  }

  // 1. Compress image client side (max 1000px, 80% quality)
  let fileToUpload = file;
  try {
    fileToUpload = await compressImage(file, 1000, 0.8);
  } catch (error) {
    console.error('Cloudinary: Error compressing image, uploading original instead', error);
  }

  // 2. Prepare FormData
  const formData = new FormData();
  formData.append('file', fileToUpload);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  // 3. Request direct upload to Cloudinary API
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to upload to Cloudinary');
  }

  const data = await response.json();
  
  // Return secure URL
  return data.secure_url;
}
