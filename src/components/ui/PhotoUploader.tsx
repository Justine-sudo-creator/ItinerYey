'use client';

import React, { useState, useEffect } from 'react';
import { compressImage } from '@/utils/imageCompression';
import { Label, FieldError, TextInput } from './Inputs';

export type PhotoData = {
  id: string; // temp id for React keys or DB id
  file?: File;
  previewUrl: string;
  caption: string;
  isHero: boolean;
  isExisting?: boolean;
};

type PhotoUploaderProps = {
  photos: PhotoData[];
  onChange: (photos: PhotoData[]) => void;
  maxPhotos?: number;
  minPhotos?: number;
  error?: string;
};

export function PhotoUploader({
  photos,
  onChange,
  maxPhotos = 10,
  minPhotos = 3,
  error,
}: PhotoUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Clean up object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      photos.forEach(p => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const newFiles = Array.from(e.target.files);
    
    if (photos.length + newFiles.length > maxPhotos) {
      alert(`You can only upload a maximum of ${maxPhotos} photos.`);
      return;
    }

    setIsProcessing(true);
    
    const newPhotoData: PhotoData[] = [];
    
    for (const file of newFiles) {
      // Compress
      const compressed = await compressImage(file, 1200, 0.85);
      
      // Check size (fallback if compression didn't get it under 5MB)
      if (compressed.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large even after compression (max 5MB).`);
        continue;
      }
      
      newPhotoData.push({
        id: Math.random().toString(36).substr(2, 9),
        file: compressed,
        previewUrl: URL.createObjectURL(compressed),
        caption: '',
        isHero: photos.length === 0 && newPhotoData.length === 0, // First photo is hero
      });
    }

    onChange([...photos, ...newPhotoData]);
    setIsProcessing(false);
    
    // Reset input
    e.target.value = '';
  };

  const removePhoto = (id: string) => {
    const updated = photos.filter(p => p.id !== id);
    // Ensure one is hero if not empty
    if (updated.length > 0 && !updated.find(p => p.isHero)) {
      updated[0].isHero = true;
    }
    onChange(updated);
  };

  const updateCaption = (id: string, caption: string) => {
    onChange(photos.map(p => p.id === id ? { ...p, caption } : p));
  };

  const setHero = (id: string) => {
    onChange(photos.map(p => ({ ...p, isHero: p.id === id })));
  };

  const dragItem = React.useRef<number | null>(null);
  const dragOverItem = React.useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const _photos = [...photos];
      const draggedItemContent = _photos.splice(dragItem.current, 1)[0];
      _photos.splice(dragOverItem.current, 0, draggedItemContent);
      onChange(_photos);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Photos ({photos.length} / {maxPhotos}) *</Label>
        <p className="text-xs text-secondary mb-2">
          Minimum {minPhotos} photos. (Max 5MB each)
        </p>
        
        <div className="relative overflow-hidden w-full h-32 border-2 border-dashed border-border-dark bg-surface flex flex-col items-center justify-center hover:bg-accent-yellow/20 transition-colors cursor-pointer rounded-sm">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            onChange={handleFileSelect}
            disabled={isProcessing || photos.length >= maxPhotos}
          />
          <span className="font-bold text-primary">
            {isProcessing ? 'Processing images...' : 'Click to add photos here'}
          </span>
        </div>
        <FieldError error={error} />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {photos.map((photo, idx) => (
            <div 
              key={photo.id} 
              className="border-2 border-border-dark bg-surface p-2 flex flex-col gap-2 relative cursor-move hover:shadow-hard-sm transition-shadow"
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="relative h-40 bg-gray-100 border-2 border-border-dark overflow-hidden pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt={`Preview ${idx + 1}`} className="object-cover w-full h-full" />
                {photo.isHero && (
                  <div className="absolute top-2 left-2 bg-accent-yellow border-2 border-border-dark px-2 py-1 text-xs font-bold shadow-hard">
                    COVER
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute top-4 right-4 bg-accent-coral border-2 border-border-dark px-2 py-1 text-xs font-bold text-white shadow-hard hover:translate-y-[2px] hover:shadow-none transition-all z-10"
              >
                X
              </button>
              
              {!photo.isHero && (
                <button
                  type="button"
                  onClick={() => setHero(photo.id)}
                  className="text-xs text-primary underline text-left hover:text-accent-blue z-10"
                >
                  Set as cover
                </button>
              )}

              <TextInput
                placeholder="Add a caption (optional)"
                value={photo.caption}
                onChange={(e) => updateCaption(photo.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
