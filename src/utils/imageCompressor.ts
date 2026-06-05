/**
 * Utility to compress and resize images client-side using HTML5 Canvas.
 */
export async function compressImage(
  file: File,
  maxWidth = 1000,
  quality = 0.8
): Promise<File> {
  // If the file is not an image, return it as is
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Calculate new dimensions keeping the aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        // Create canvas and draw the resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2d context from canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export canvas content to a JPEG Blob at the specified quality
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas conversion to blob failed'));
              return;
            }
            // Construct a new File object
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => {
        reject(err);
      };
    };
    reader.onerror = (err) => {
      reject(err);
    };
  });
}
