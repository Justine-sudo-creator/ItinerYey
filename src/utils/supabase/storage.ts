import { uploadToCloudinary } from '../cloudinary';

export const uploadTripPhoto = async (
  userId: string,
  tripId: string,
  file: File
): Promise<string> => {
  // Directly upload compressed photo to Cloudinary
  return uploadToCloudinary(file, `trip-photos/${userId}/${tripId}`);
};

export const deleteTripPhotos = async (): Promise<void> => {
  // Optional/No-op: Since Cloudinary storage is extremely large (25GB) on free tier, 
  // we do not need to strictly delete files to save space immediately.
  return;
};
