'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { uploadTripPhoto } from '@/utils/supabase/storage';
import { LocationAutocomplete, StructuredLocation } from '@/components/ui/LocationAutocomplete';
import { PhotoUploader, PhotoData } from '@/components/ui/PhotoUploader';
import { TextInput, TextAreaInput, SelectInput } from '@/components/ui/Inputs';
import { PrimaryButton } from '@/components/ui/Button';

import { User } from '@/types/supabase';

type LocalTipFormProps = {
  returnTo: string;
  userProfile: Partial<User> | null;
};

const CATEGORIES = [
  'Food',
  'Transport',
  'Accommodation',
  'Activity',
  'Safety',
  'Budget Tip',
  'Other',
];

export default function LocalTipForm({ returnTo, userProfile }: LocalTipFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [destination, setDestination] = useState('');
  const [destinationRegion, setDestinationRegion] = useState('');
  const [destStructured, setDestStructured] = useState<StructuredLocation | null>(null);
  const [title, setTitle] = useState('');
  const [tip, setTip] = useState('');
  const [cost, setCost] = useState('');
  const [category, setCategory] = useState('');
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!destination || !destinationRegion) return setError('Destination and Region are required.');
    if (!title) return setError('Tip title is required.');
    if (!tip || tip.length < 10) return setError('Please provide a descriptive local tip.');
    if (!category) return setError('Please select a category.');

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in.');

      const currentMonthYear = new Date().toISOString().substring(0, 7) + '-01'; // YYYY-MM-01 format for travel_date
      const parsedCost = parseInt(cost) || 0;

      // 1. Insert into trips
      const payload = {
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
        origin_place_id: null,
        origin_lat: null,
        origin_lng: null,
        origin_city: null,
        origin_province: null,
        origin_country: null,
        travel_date: currentMonthYear,
        group_size: 1,
        group_type: 'Local',
        trip_type: 'Local Tip',
        duration_days: 1,
        cost_per_person: parsedCost,
        transport_cost: 0,
        food_cost: 0,
        activities_cost: parsedCost,
        accommodation_cost: 0,
        tip: tip,
        honest_warning: null,
        would_return: true,
        travel_style: 'Local',
        submission_tier: 'quick',
        trip_summary: `[${category}] ${title}`,
        is_approved: false,
      };
      
      console.log('--- DEBUG: INSERTING LOCAL TIP PAYLOAD ---', payload);
      
      const { data: tripData, error: tripError } = await supabase.from('trips').insert(payload).select().single();

      if (tripError) throw tripError;

      // 2. Upload Photos
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (p.file) {
          const publicUrl = await uploadTripPhoto(user.id, tripData.id, p.file);
          
          const { error: photoError } = await supabase.from('trip_photos').insert({
            trip_id: tripData.id,
            photo_url: publicUrl,
            caption: p.caption || null,
            is_hero: p.isHero,
            display_order: i,
          });

          if (photoError) {
            console.error("Photo DB Insert Error:", photoError);
            throw photoError;
          }
        }
      }

      // 3. Unlock user access
      const { error: userError } = await supabase.from('users').update({
        has_contributed: true,
        access_expires_at: null,
      }).eq('id', user.id);

      if (userError) throw userError;

      // 4. Success UI
      setIsSuccess(true);
      window.scrollTo(0, 0);
      
    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message || 'Your tip could not be saved. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-surface border border-border-dark/15 rounded-lg p-8 shadow-sm text-center flex flex-col items-center justify-center min-h-[40vh]">
        <div className="text-6xl mb-4">💡</div>
        <h2 className="font-brand font-black text-3xl mb-4 text-accent-yellow">Tip Submitted!</h2>
        <p className="text-lg font-bold mb-2">Your local tip was successfully saved.</p>
        <p className="mb-6 max-w-md opacity-80 leading-relaxed">
          It is currently <strong>pending admin approval</strong> and will appear on the public feed shortly. Full access to ItinerYey is now unlocked!
        </p>
        <PrimaryButton onClick={() => router.push(returnTo || '/')}>
          Return to App
        </PrimaryButton>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="bg-surface border border-border-dark/15 rounded-lg p-4 shadow-sm">
        <h3 className="bg-accent-yellow inline-block px-2 py-1 font-bold text-sm border border-border-dark/15 rounded mb-4 shadow-sm">
          Location
        </h3>
        <LocationAutocomplete
          label="Destination"
          placeholder="Where did you go?"
          value={destination}
          onChange={(d, r, struct) => { setDestination(d); setDestinationRegion(r || d); setDestStructured(struct); }}
        />
      </div>

      <div className="bg-surface border border-border-dark/15 rounded-lg p-4 shadow-sm">
        <h3 className="bg-accent-yellow inline-block px-2 py-1 font-bold text-sm border border-border-dark/15 rounded mb-4 shadow-sm">
          Tip Details
        </h3>
        <div className="flex flex-col gap-4">
          <SelectInput
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={CATEGORIES.map(c => ({ value: c, label: c }))}
            required
          />
          <TextInput
            label="Tip Title"
            placeholder="e.g. Cheaper food near Burnham Park"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <TextAreaInput
            label="The Local Tip"
            placeholder="Share what you know to help others..."
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            rows={4}
            required
          />
          <TextInput
            label="Approximate Cost (₱) - Optional"
            type="number"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-surface border border-border-dark/15 rounded-lg p-4 shadow-sm">
        <h3 className="bg-accent-yellow inline-block px-2 py-1 font-bold text-sm border border-border-dark/15 rounded mb-4 shadow-sm">
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
        <div className="bg-accent-coral border border-border-dark/15 rounded-lg p-3 text-white font-bold shadow-sm">
          {error}
        </div>
      )}

      <PrimaryButton type="submit" disabled={loading} className="py-4 text-lg">
        {loading ? 'Submitting...' : 'Submit Local Tip'}
      </PrimaryButton>
    </form>
  );
}
