export const compressImage = async (
  file: File,
  maxWidth = 1200,
  quality = 0.85
): Promise<File> => {
  return new Promise((resolve) => {
    // Only process images
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file); // fallback
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export to WebP if supported, fallback to JPEG
        const mimeType = 'image/jpeg'; // More universal for old Safari
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newFile = new File([blob], file.name, {
                type: mimeType,
                lastModified: Date.now(),
              });
              
              // Only use compressed if it's actually smaller
              if (newFile.size < file.size) {
                resolve(newFile);
              } else {
                resolve(file);
              }
            } else {
              resolve(file); // fallback
            }
          },
          mimeType,
          quality
        );
      };
      img.onerror = () => resolve(file); // fallback
    };
    reader.onerror = () => resolve(file); // fallback
  });
};
