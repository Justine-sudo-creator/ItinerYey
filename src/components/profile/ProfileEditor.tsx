'use client';

import React, { useState } from 'react';
import { User } from '@/types/supabase';
import { createClient } from '@/utils/supabase/client';
import { TextInput, SelectInput } from '@/components/ui/Inputs';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { ORIGIN_REGIONS, TRAVEL_STYLES } from '@/lib/constants';

type ProfileEditorProps = {
  profile: User;
  onCancel: () => void;
  onSuccess: () => void;
};

export default function ProfileEditor({ profile, onCancel, onSuccess }: ProfileEditorProps) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [region, setRegion] = useState(profile.region || '');
  const [travelStyle, setTravelStyle] = useState(profile.travel_style || '');
  const [typicalBudget, setTypicalBudget] = useState(profile.typical_budget || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const supabase = createClient();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let finalAvatarUrl = profile.avatar_url || '';
      
      if (avatarFile) {
        const { uploadToCloudinary } = await import('@/utils/cloudinary');
        finalAvatarUrl = await uploadToCloudinary(avatarFile, `avatars/${profile.id}`);
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: displayName,
          avatar_url: finalAvatarUrl,
          region,
          travel_style: travelStyle,
          typical_budget: typicalBudget,
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;
      onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <h3 className="font-bold border-b-2 border-border-dark pb-2 mb-2">Edit Profile</h3>
      
      <div className="flex flex-col gap-2">
        <label className="font-bold text-sm uppercase tracking-wide">Profile Picture</label>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="w-16 h-16 shrink-0 bg-accent-yellow border-2 border-border-dark rounded-full flex items-center justify-center overflow-hidden">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <span className="font-black text-2xl text-primary">{displayName ? displayName.charAt(0).toUpperCase() : '?'}</span>
            )}
          </div>
          <div className="w-full min-w-0">
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setAvatarFile(e.target.files[0]);
                  setAvatarPreview(URL.createObjectURL(e.target.files[0]));
                }
              }}
              className="w-full text-xs sm:text-sm font-medium file:mr-2 sm:file:mr-4 file:py-1.5 file:px-3 file:border-2 file:border-border-dark file:bg-white file:font-bold file:uppercase file:text-[10px] sm:file:text-xs hover:file:bg-soft-beige file:transition-colors cursor-pointer"
            />
          </div>
        </div>
      </div>
      
      <TextInput 
        label="Display Name" 
        value={displayName} 
        onChange={(e) => setDisplayName(e.target.value)} 
        placeholder="e.g. TravelLover99"
      />
      
      <SelectInput 
        label="Region" 
        value={region} 
        onChange={(e) => setRegion(e.target.value)} 
        options={ORIGIN_REGIONS.map(r => ({ value: r, label: r }))} 
      />
      
      <SelectInput 
        label="Travel Style" 
        value={travelStyle} 
        onChange={(e) => setTravelStyle(e.target.value)} 
        options={TRAVEL_STYLES.map(r => ({ value: r, label: r }))} 
      />
      
      <TextInput 
        label="Typical Budget" 
        value={typicalBudget} 
        onChange={(e) => setTypicalBudget(e.target.value)} 
        placeholder="e.g. ₱5,000 per trip"
      />

      {error && (
        <div className="bg-accent-coral border-2 border-border-dark p-2 text-white font-bold text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <PrimaryButton type="submit" disabled={loading} className="flex-1">
          {loading ? 'Saving...' : 'Save'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel} disabled={loading} className="flex-1">
          Cancel
        </SecondaryButton>
      </div>
    </form>
  );
}
