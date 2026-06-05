'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { uploadTripPhoto } from '@/utils/supabase/storage';
import { LocationAutocomplete, StructuredLocation } from '@/components/ui/LocationAutocomplete';
import { PhotoUploader, PhotoData } from '@/components/ui/PhotoUploader';
import { TextAreaInput, SelectInput } from '@/components/ui/Inputs';
import { PrimaryButton } from '@/components/ui/Button';

import { User } from '@/types/supabase';

type InfoUpdateFormProps = {
  returnTo: string;
  userProfile: Partial<User> | null;
};

const UPDATE_CATEGORIES = [
  'Price Update',
  'Route Update',
  'Closed / Moved Place',
  'Schedule Update',
  'Safety Warning',
  'Other',
];

export default function InfoUpdateForm({ returnTo, userProfile }: InfoUpdateFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [destination, setDestination] = useState('');
  const [destinationRegion, setDestinationRegion] = useState('');
  const [destStructured, setDestStructured] = useState<StructuredLocation | null>(null);
  const [category, setCategory] = useState('');
  const [whatChanged, setWhatChanged] = useState('');
  const [evidence, setEvidence] = useState('');
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!destination || !destinationRegion) return setError('Destination and Region are required.');
    if (!category) return setError('Please select an update category.');
    if (!whatChanged) return setError('Please specify what changed.');

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in.');

      const currentMonthYear = new Date().toISOString().substring(0, 7) + '-01';
      
      const combinedTip = evidence 
        ? `${whatChanged}\n\nContext: ${evidence}`
        : whatChanged;

      // 1. Insert into trips
      const { data: tripData, error: tripError } = await supabase.from('trips').insert({
        user_id: user.id,
        destination,
        destination_region: destinationRegion,
        destination_place_id: destStructured?.place_id || null,
        destination_lat: destStructured?.lat || null,
        destination_lng: destStructured?.lng || null,
        destination_city: destStructured?.city || null,
        destination_province: destStructured?.province || null,
        destination_country: destStructured?.country || null,
        origin_region: userProfile?.region || 'Unknown',
        travel_date: currentMonthYear,
        group_size: 1,
        group_type: 'Solo',
        trip_type: 'Mixed',
        duration_days: 1,
        cost_per_person: 0,
        transport_cost: 0,
        food_cost: 0,
        activities_cost: 0,
        accommodation_cost: 0,
        tip: combinedTip,
        honest_warning: null,
        would_return: true,
        travel_style: 'Budget',
        submission_tier: 'quick',
        trip_summary: `Update: ${category}`,
        is_approved: false,
        view_count: 0,
      }).select().single();

      if (tripError) throw tripError;

      // 2. Upload photos
      if (photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          const p = photos[i];
          if (p.file) {
            const publicUrl = await uploadTripPhoto(user.id, tripData.id, p.file);
            
            await supabase.from('trip_photos').insert({
              trip_id: tripData.id,
              photo_url: publicUrl,
              caption: p.caption || null,
              is_hero: p.isHero,
              display_order: i,
            });
          }
        }
      }

      // 3. Unlock user access
      const { error: userError } = await supabase.from('users').update({
        has_contributed: true,
        access_expires_at: null,
      }).eq('id', user.id);

      if (userError) throw userError;

      // 4. Redirect
      if (returnTo) {
        alert('Update submitted! Full access unlocked.');
        router.push(returnTo);
      } else {
        router.push('/');
      }
      
    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message || 'An error occurred. Please check database permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="bg-surface border-2 border-border-dark p-4 shadow-hard">
        <h3 className="bg-accent-yellow inline-block px-2 py-1 font-bold text-sm border-2 border-border-dark mb-4 shadow-hard">
          Location
        </h3>
        <LocationAutocomplete
          label="Destination"
          placeholder="Where did you go?"
          value={destination}
          onChange={(d, r, struct) => { setDestination(d); setDestinationRegion(r || d); setDestStructured(struct); }}
        />
      </div>

      <div className="bg-surface border-2 border-border-dark p-4 shadow-hard">
        <h3 className="bg-accent-yellow inline-block px-2 py-1 font-bold text-sm border-2 border-border-dark mb-4 shadow-hard">
          What changed?
        </h3>
        <div className="flex flex-col gap-4">
          <SelectInput
            label="Update Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={UPDATE_CATEGORIES.map(c => ({ value: c, label: c }))}
            required
          />
          <TextAreaInput
            label="Details of the change"
            placeholder="e.g. The bus terminal moved to the new public market..."
            value={whatChanged}
            onChange={(e) => setWhatChanged(e.target.value)}
            rows={3}
            required
          />
          <TextAreaInput
            label="Evidence / Context (Optional)"
            placeholder="e.g. We went last May 2026 and the entrance fee was already ₱150."
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div className="bg-surface border-2 border-border-dark p-4 shadow-hard">
        <h3 className="bg-accent-yellow inline-block px-2 py-1 font-bold text-sm border-2 border-border-dark mb-4 shadow-hard">
          Photo Evidence (Optional but helpful)
        </h3>
        <PhotoUploader
          photos={photos}
          onChange={setPhotos}
          minPhotos={0}
          maxPhotos={3}
        />
      </div>

      {error && (
        <div className="bg-accent-coral border-2 border-border-dark p-3 text-primary font-bold shadow-hard">
          {error}
        </div>
      )}

      <PrimaryButton type="submit" disabled={loading} className="py-4 text-lg">
        {loading ? 'Submitting...' : 'Submit Update'}
      </PrimaryButton>
    </form>
  );
}
