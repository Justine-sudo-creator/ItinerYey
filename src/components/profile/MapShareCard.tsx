'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { X, Download, Camera } from 'lucide-react';
import { User, Trip } from '@/types/supabase';
import { getTravelerLevel, resolveProvinceName } from './PhProvincesMap';

interface MapShareCardProps {
  userProfile: User;
  userTrips: any[];
  onClose: () => void;
}

export default function MapShareCard({ userProfile, userTrips, onClose }: MapShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  
  // Custom Photo State
  const [selectedPhoto, setSelectedPhoto] = useState<HTMLImageElement | null>(null);
  const [hasLoadedInitialPhoto, setHasLoadedInitialPhoto] = useState(false);
  
  // Profile Picture Image Element State
  const [pfpImage, setPfpImage] = useState<HTMLImageElement | null>(null);
  
  // Fullscreen Preview Overlay State
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Generate unique stats
  const { uniqueCount, levelInfo } = useMemo(() => {
    const set = new Set<string>();
    userTrips.forEach((t) => {
      const resolved = resolveProvinceName(t.destination_province || t.destination_region || t.destination);
      if (resolved) set.add(resolved);
    });
    const uniqueCount = set.size;
    const levelInfo = getTravelerLevel(uniqueCount);
    return { uniqueCount, levelInfo };
  }, [userTrips]);

  // Load user profile picture if it exists
  useEffect(() => {
    if (userProfile.avatar_url) {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Prevent canvas tainting
      img.onload = () => setPfpImage(img);
      img.src = userProfile.avatar_url;
    }
  }, [userProfile.avatar_url]);

  // Load most recent trip photo with a valid image URL as initial default
  useEffect(() => {
    if (userTrips.length > 0 && !selectedPhoto && !hasLoadedInitialPhoto) {
      const tripWithImage = [...userTrips]
        .sort((a, b) => {
          const dateA = new Date(a.travel_date || a.created_at || 0).getTime();
          const dateB = new Date(b.travel_date || b.created_at || 0).getTime();
          return dateB - dateA;
        })
        .find((t) => t.trip_photos && t.trip_photos.length > 0);

      const imageUrl = tripWithImage?.trip_photos?.[0]?.photo_url;

      if (imageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          setSelectedPhoto(img);
          setHasLoadedInitialPhoto(true);
        };
        img.src = imageUrl;
      } else {
        setHasLoadedInitialPhoto(true);
      }
    }
  }, [userTrips, selectedPhoto, hasLoadedInitialPhoto]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const img = new Image();
      img.onload = () => {
        setSelectedPhoto(img);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  // Helper helper to draw rounded rectangles
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Helper to draw text with black outline for readability
  const drawStrokedText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    letterSpacing: string = '0px',
    align: CanvasTextAlign = 'left'
  ) => {
    ctx.save();
    ctx.font = font;
    ctx.letterSpacing = letterSpacing;
    ctx.textAlign = align;
    
    // Draw black outline
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    
    // Draw white text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  const handleGenerate = () => {
    setGenerating(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Setup dimensions (1080 x 1920)
    canvas.width = 1080;
    canvas.height = 1920;

    // Clear background
    ctx.fillStyle = '#faf7f2';
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Draw Blurred Background (Full bleed, reduced blur for recognition)
    if (selectedPhoto) {
      ctx.save();
      ctx.filter = 'blur(18px) brightness(0.9)';
      ctx.drawImage(selectedPhoto, -50, -50, 1180, 2020);
      ctx.restore();
    } else {
      // Fallback elegant gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, 1920);
      grad.addColorStop(0, '#e5dec9');
      grad.addColorStop(1, '#c8bba6');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1920);
    }

    // 3. Top Header area (Rendered directly on blurred background, no white bar)
    // Header Underline (White hairline rule)
    ctx.beginPath();
    ctx.moveTo(80, 240);
    ctx.lineTo(1000, 240);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Profile Picture (Circle crop)
    const pfpX = 160;
    const pfpY = 140;
    const pfpRadius = 70;

    ctx.save();
    ctx.beginPath();
    ctx.arc(pfpX, pfpY, pfpRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (pfpImage) {
      ctx.drawImage(pfpImage, pfpX - pfpRadius, pfpY - pfpRadius, pfpRadius * 2, pfpRadius * 2);
    } else {
      // Fallback profile letter circle background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pfpX - pfpRadius, pfpY - pfpRadius, pfpRadius * 2, pfpRadius * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 50px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((userProfile.display_name || 'T').charAt(0).toUpperCase(), pfpX, pfpY);
    }
    ctx.restore();

    // Profile Outline circle
    ctx.beginPath();
    ctx.arc(pfpX, pfpY, pfpRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Traveler Display Name (Aligned vertically with PFP center)
    ctx.save();
    ctx.textBaseline = 'middle';
    drawStrokedText(
      ctx,
      userProfile.display_name || 'Traveler Name',
      260,
      140,
      'bold 52px sans-serif'
    );
    ctx.restore();

    // Elegant Joined Year (Single line aligned with name)
    const joinedYear = userProfile.created_at 
      ? `EST. ${new Date(userProfile.created_at).getFullYear()}` 
      : 'EST. 2026';
    drawStrokedText(ctx, joinedYear, 1000, 140, 'bold 36px sans-serif', '1px', 'right');

    // 4. Central Card Box (X: 100, Y: 300, W: 880, H: 1350)
    const cardX = 100;
    const cardY = 300;
    const cardW = 880;
    const cardH = 1350;
    const cardRadius = 80;

    // Draw card clipping path & sharp photo fill
    ctx.save();
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.clip();

    if (selectedPhoto) {
      const sWidth = selectedPhoto.width;
      const sHeight = selectedPhoto.height;
      const sAspect = sWidth / sHeight;
      const frameAspect = cardW / cardH;

      let drawWidth = sWidth;
      let drawHeight = sHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (sAspect > frameAspect) {
        drawWidth = sHeight * frameAspect;
        offsetX = (sWidth - drawWidth) / 2;
      } else {
        drawHeight = sWidth / frameAspect;
        offsetY = (sHeight - drawHeight) / 2;
      }

      ctx.drawImage(
        selectedPhoto,
        offsetX, offsetY, drawWidth, drawHeight,
        cardX, cardY, cardW, cardH
      );
    } else {
      // Draw aesthetic solid color inside card if no image uploaded
      const innerGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
      innerGrad.addColorStop(0, '#535d55');
      innerGrad.addColorStop(1, '#2c332e');
      ctx.fillStyle = innerGrad;
      ctx.fillRect(cardX, cardY, cardW, cardH);
    }

    // Top gradient overlay for LAKBAYER text contrast
    const topGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + 300);
    topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(cardX, cardY, cardW, 300);

    // Bottom gradient overlay for stats text contrast
    const bottomGrad = ctx.createLinearGradient(cardX, cardY + cardH - 300, cardX, cardY + cardH);
    bottomGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(cardX, cardY + cardH - 300, cardW, 300);

    ctx.restore();

    // Thick white border outline around the central card
    ctx.save();
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.restore();

    // 5. Overlays inside the sharp card (All in white text with black outlines)
    // Level Title
    drawStrokedText(
      ctx,
      levelInfo.title.toUpperCase(),
      cardX + 60,
      cardY + 160,
      '900 90px Impact, sans-serif',
      '2px'
    );

    // Stats Number (Big Bold Impact number)
    drawStrokedText(
      ctx,
      `${uniqueCount} / 82`,
      cardX + 60,
      cardY + cardH - 160,
      '900 110px Impact, sans-serif',
      '1px'
    );

    // Label under it
    drawStrokedText(
      ctx,
      'PROVINCES VISITED',
      cardX + 60,
      cardY + cardH - 110,
      'bold 28px sans-serif',
      '2px'
    );

    // Watermark under it
    drawStrokedText(
      ctx,
      'WWW.ITINERYEY.COM',
      cardX + 60,
      cardY + cardH - 60,
      'bold 20px sans-serif',
      '3px'
    );

    // 6. Layered Map SVG Stamp overlay (Floats on bottom right, spilling out)
    const mapContainer = document.querySelector('.map svg');
    if (mapContainer) {
      // Clone the SVG element so we do not mutate the live DOM
      const clonedSvg = mapContainer.cloneNode(true) as SVGElement;
      const originalPaths = mapContainer.querySelectorAll('path');
      const clonedPaths = clonedSvg.querySelectorAll('path');
      
      originalPaths.forEach((origPath, index) => {
        const clonedPath = clonedPaths[index];
        if (!clonedPath) return;
        
        const computedStyle = window.getComputedStyle(origPath);
        const currentFill = computedStyle.fill;
        const cleanFill = currentFill.replace(/\s+/g, '').toLowerCase();
        
        // Force crisp black strokes on the canvas export
        clonedPath.style.stroke = '#000000';
        clonedPath.style.strokeWidth = '1.8';
        
        // Check computed fill values to determine visited status
        // #ded8c9 is rgb(222, 216, 201), #f25c54 is rgb(242, 92, 84)
        if (cleanFill.includes('222') && cleanFill.includes('216') && cleanFill.includes('201') || cleanFill.includes('ded8c9')) {
          clonedPath.style.fill = '#ded8c9';
          clonedPath.style.fillOpacity = '0.3';
        } else if (cleanFill.includes('242') && cleanFill.includes('92') && cleanFill.includes('84') || cleanFill.includes('f25c54')) {
          clonedPath.style.fill = '#f25c54';
          clonedPath.style.fillOpacity = '1.0';
          clonedPath.style.filter = 'drop-shadow(0px 0px 8px #f25c54)';
        } else if (cleanFill !== 'none' && cleanFill !== 'transparent' && !cleanFill.includes('rgba(0,0,0,0)')) {
          clonedPath.style.fill = '#f25c54';
          clonedPath.style.fillOpacity = '1.0';
          clonedPath.style.filter = 'drop-shadow(0px 0px 8px #f25c54)';
        } else {
          clonedPath.style.fill = 'none';
        }
      });
      
      let svgString = new XMLSerializer().serializeToString(clonedSvg);

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URLObj = window.URL || window.webkitURL || window;
      const blobURL = URLObj.createObjectURL(svgBlob);
      
      const img = new Image();
      img.onload = () => {
        // Draw the SVG map scaled overlay (preserves natural aspect ratio: 480x720 contained inside card)
        ctx.save();
        
        // Use a crisp, sharp solid shadow (0 blur) for a distinct "sticker" outline effect
        ctx.shadowColor = '#1a1a1a';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 8;
        ctx.shadowOffsetY = 8;
        
        ctx.drawImage(img, 480, 880, 480, 720);
        
        ctx.restore();

        URLObj.revokeObjectURL(blobURL);
        setDownloadUrl(canvas.toDataURL('image/png'));
        setGenerating(false);
      };
      img.onerror = () => {
        setGenerating(false);
      };
      img.src = blobURL;
    } else {
      setDownloadUrl(canvas.toDataURL('image/png'));
      setGenerating(false);
    }
  };

  // Re-generate canvas anytime a new photo is loaded/uploaded or PFP changes
  useEffect(() => {
    if (canvasRef.current) {
      handleGenerate();
    }
  }, [selectedPhoto, pfpImage]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface border-2 border-border-dark p-5 max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden shadow-hard animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center border-b-2 border-border-dark pb-3 mb-4 shrink-0">
          <span className="font-black uppercase tracking-tight text-md">Share My Map</span>
          <button onClick={onClose} className="p-1 hover:bg-soft-beige border border-transparent hover:border-border-dark">
            <X className="w-5 h-5 text-primary" />
          </button>
        </div>

        {/* Scrollable Container Body */}
        <div className="flex-1 overflow-y-auto pr-1 mb-4">
          <p className="text-[11px] text-secondary font-semibold mb-4 leading-relaxed uppercase tracking-wide">
            Generate an elegant, editorial travel card (1080x1920) formatted perfectly for social media stories.
          </p>

          {/* Upload Button */}
          <div className="mb-4">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handlePhotoUpload} 
              className="hidden" 
              id="story-photo-upload" 
            />
            <label 
              htmlFor="story-photo-upload"
              className="flex items-center justify-center gap-2 w-full py-2.5 border-2 border-dashed border-border-dark bg-white hover:bg-soft-beige transition-colors font-bold text-xs uppercase tracking-wide cursor-pointer"
            >
              <Camera className="w-4 h-4 shrink-0" />
              {selectedPhoto ? 'Change Featured Photo' : 'Upload Featured Photo'}
            </label>
          </div>

          {/* Canvas for rendering */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Card Story Preview Frame */}
          <div className="border-2 border-border-dark bg-soft-beige/20 p-2 shadow-hard-sm mb-2 flex justify-center items-center overflow-y-auto max-h-[380px]">
            {downloadUrl ? (
              <div 
                className="relative group cursor-zoom-in" 
                onClick={() => setIsFullscreen(true)}
                title="Click to view full size preview"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={downloadUrl} 
                  alt="Editorial Story Preview" 
                  className="w-[200px] h-[356px] object-contain border border-border-dark shadow-hard-xs group-hover:brightness-95 transition-all" 
                />
                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="bg-white border-2 border-border-dark px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-hard-xs text-primary">
                    Preview Fullsize
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-xs font-bold text-secondary">Ready to build your social story card</p>
              </div>
            )}
          </div>
          
          {downloadUrl && (
            <p className="text-center text-[10px] text-secondary font-bold uppercase tracking-wider mt-1">
              Click photo to maximize & inspect details
            </p>
          )}
        </div>

        {/* Footer Buttons container (Flex column on mobile, row on tablet/desktop) */}
        <div className="flex flex-col sm:flex-row gap-2 shrink-0 border-t-2 border-border-dark/10 pt-3">
          {!downloadUrl ? (
            <PrimaryButton onClick={handleGenerate} disabled={generating} className="w-full sm:flex-1 py-3 text-xs">
              {generating ? 'Building Card...' : 'Build Story Card'}
            </PrimaryButton>
          ) : (
            <a 
              href={downloadUrl} 
              download={`itineryey_story_${userProfile.display_name || 'traveler'}.png`}
              className="w-full sm:flex-1"
            >
              <PrimaryButton className="w-full flex items-center justify-center gap-2 py-3 text-xs">
                <Download className="w-4 h-4 shrink-0" /> Download Card
              </PrimaryButton>
            </a>
          )}
          {downloadUrl && (
            <SecondaryButton onClick={handleGenerate} className="w-full sm:flex-1 py-3 text-xs">
              Re-generate
            </SecondaryButton>
          )}
          <SecondaryButton onClick={onClose} className="w-full sm:px-4 py-3 text-xs">
            Cancel
          </SecondaryButton>
        </div>
      </div>

      {/* Fullscreen Preview Modal Overlay */}
      {isFullscreen && downloadUrl && (
        <div 
          className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setIsFullscreen(false)}
        >
          <div className="relative max-w-full max-h-[90vh] flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={downloadUrl} 
              alt="Editorial Story Fullsize Preview" 
              className="max-w-full max-h-[80vh] sm:max-h-[85vh] object-contain border border-white shadow-2xl animate-in zoom-in-95 duration-200" 
            />
            <p className="text-white/80 text-[10px] sm:text-xs font-black uppercase tracking-widest mt-4 bg-black/40 border border-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
              Tap anywhere to close preview
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
