'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { Bus, MapPin, Plus, Trash2, Map } from 'lucide-react';
import { User, Route, RouteSegment } from '@/types/supabase';
import { MapPickerModal } from '@/components/ui/MapPickerModal';
import { validateTip, countTipWords, MAX_TIP_WORDS } from '@/lib/routeDisplay';
import { MONTH_NAMES } from '@/lib/constants';

interface RouteSegmentInput {
  id: string;
  transport_type: string;
  signboard: string;
  fare: string;
  boarding_name: string;
  boarding_lat: number | null;
  boarding_lng: number | null;
  boarding_tip: string;
  drop_off_name: string;
  drop_off_lat: number | null;
  drop_off_lng: number | null;
  drop_off_tip: string;
  estimated_duration: string;
}

type MapTarget = 
  | { type: 'origin' }
  | { type: 'destination' }
  | { type: 'boarding' | 'drop_off', segmentId: string };

function segmentToInput(seg: RouteSegment): RouteSegmentInput {
  return {
    id: seg.id,
    transport_type: seg.transport_type,
    signboard: seg.signboard || '',
    fare: String(seg.fare ?? ''),
    boarding_name: seg.boarding_name || '',
    boarding_lat: seg.boarding_lat,
    boarding_lng: seg.boarding_lng,
    boarding_tip: seg.boarding_tip || '',
    drop_off_name: seg.drop_off_name || '',
    drop_off_lat: seg.drop_off_lat,
    drop_off_lng: seg.drop_off_lng,
    drop_off_tip: seg.drop_off_tip || '',
    estimated_duration: seg.estimated_duration || '',
  };
}

interface SubmitRouteFormProps {
  userProfile: User | null;
  existingRoute?: Route;
  existingSegments?: RouteSegment[];
}

export default function SubmitRouteForm({
  userProfile,
  existingRoute,
  existingSegments,
}: SubmitRouteFormProps) {
  const isEditMode = !!existingRoute;
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [origin, setOrigin] = useState(existingRoute?.origin ?? '');
  const [originLat, setOriginLat] = useState<number | null>(existingRoute?.origin_lat ?? null);
  const [originLng, setOriginLng] = useState<number | null>(existingRoute?.origin_lng ?? null);

  const [destination, setDestination] = useState(existingRoute?.destination ?? '');
  const [destLat, setDestLat] = useState<number | null>(existingRoute?.destination_lat ?? null);
  const [destLng, setDestLng] = useState<number | null>(existingRoute?.destination_lng ?? null);

  const [month, setMonth] = useState<string>(
    existingRoute?.travel_date_month?.toString() ?? (new Date().getMonth() + 1).toString()
  );
  const [year, setYear] = useState<string>(
    existingRoute?.travel_date_year?.toString() ?? new Date().getFullYear().toString()
  );
  const [duration, setDuration] = useState(existingRoute?.estimated_duration ?? '');
  const [communityNotes, setCommunityNotes] = useState(existingRoute?.community_notes ?? '');
  const [destinationTip, setDestinationTip] = useState(existingRoute?.destination_tip ?? '');
  
  const [segments, setSegments] = useState<RouteSegmentInput[]>(() => {
    if (existingSegments && existingSegments.length > 0) {
      return [...existingSegments]
        .sort((a, b) => a.display_order - b.display_order)
        .map(segmentToInput);
    }
    return [
      { 
        id: '1', transport_type: 'Jeep', signboard: '', fare: '', 
        boarding_name: '', boarding_lat: null, boarding_lng: null, boarding_tip: '',
        drop_off_name: '', drop_off_lat: null, drop_off_lng: null, drop_off_tip: '',
        estimated_duration: ''
      }
    ];
  });

  // Map Picker State
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null);

  const addSegment = () => {
    setSegments([
      ...segments,
      { 
        id: Date.now().toString(), transport_type: 'Jeep', signboard: '', fare: '', 
        boarding_name: '', boarding_lat: null, boarding_lng: null, boarding_tip: '',
        drop_off_name: '', drop_off_lat: null, drop_off_lng: null, drop_off_tip: '',
        estimated_duration: ''
      }
    ]);
  };

  const removeSegment = (id: string) => {
    if (segments.length === 1) return;
    setSegments(segments.filter(s => s.id !== id));
  };

  const updateSegment = (id: string, field: keyof RouteSegmentInput, value: any) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const updateSegmentFields = (id: string, updates: Partial<RouteSegmentInput>) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleMapSelect = (lat: number, lng: number) => {
    if (!mapTarget) return;

    if (mapTarget.type === 'origin') {
      setOriginLat(lat);
      setOriginLng(lng);
    } else if (mapTarget.type === 'destination') {
      setDestLat(lat);
      setDestLng(lng);
    } else if (mapTarget.type === 'boarding') {
      updateSegmentFields(mapTarget.segmentId, { boarding_lat: lat, boarding_lng: lng });
    } else if (mapTarget.type === 'drop_off') {
      updateSegmentFields(mapTarget.segmentId, { drop_off_lat: lat, drop_off_lng: lng });
    }
  };

  const getInitialMapCoords = () => {
    if (!mapTarget) return { lat: null, lng: null, label: '' };
    if (mapTarget.type === 'origin') return { lat: originLat, lng: originLng, label: origin || 'Origin' };
    if (mapTarget.type === 'destination') return { lat: destLat, lng: destLng, label: destination || 'Destination' };
    
    const seg = segments.find(s => s.id === mapTarget.segmentId);
    if (!seg) return { lat: null, lng: null, label: '' };
    
    if (mapTarget.type === 'boarding') return { lat: seg.boarding_lat, lng: seg.boarding_lng, label: seg.boarding_name || 'Boarding Landmark' };
    if (mapTarget.type === 'drop_off') return { lat: seg.drop_off_lat, lng: seg.drop_off_lng, label: seg.drop_off_name || 'Drop-off Landmark' };
    return { lat: null, lng: null, label: '' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    
    // Validation for map pins
    if (originLat === null || originLng === null) {
      setError('Please pin the Origin location on the map.');
      return;
    }
    if (destLat === null || destLng === null) {
      setError('Please pin the Destination location on the map.');
      return;
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.boarding_lat === null || seg.boarding_lng === null) {
        setError(`Please pin the Boarding Landmark on the map for Segment ${i + 1}.`);
        return;
      }
      if (seg.drop_off_lat === null || seg.drop_off_lng === null) {
        setError(`Please pin the Drop-off Landmark on the map for Segment ${i + 1}.`);
        return;
      }
      if (!validateTip(seg.boarding_tip) || !validateTip(seg.drop_off_tip)) {
        setError(`Arrival tips must be ${MAX_TIP_WORDS} words or fewer (Segment ${i + 1}).`);
        return;
      }
    }
    if (!validateTip(destinationTip)) {
      setError(`Destination tip must be ${MAX_TIP_WORDS} words or fewer.`);
      return;
    }

    const parsedYear = parseInt(year, 10);
    if (!year.trim() || isNaN(parsedYear) || parsedYear < 1) {
      setError('Please enter a valid year.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const totalFare = segments.reduce((sum, s) => sum + (parseFloat(s.fare) || 0), 0);

      const routePayload = {
        origin,
        destination,
        origin_lat: originLat,
        origin_lng: originLng,
        destination_lat: destLat,
        destination_lng: destLng,
        travel_date_month: parseInt(month),
        travel_date_year: parsedYear,
        estimated_duration: duration.trim() || null,
        total_fare: totalFare,
        community_notes: communityNotes,
        destination_tip: destinationTip.trim() || null,
      };

      let routeId: string;

      if (isEditMode && existingRoute) {
        const { error: routeError } = await supabase
          .from('routes')
          .update(routePayload)
          .eq('id', existingRoute.id)
          .eq('user_id', userProfile!.id);

        if (routeError) throw routeError;

        const { error: deleteError } = await supabase
          .from('route_segments')
          .delete()
          .eq('route_id', existingRoute.id);

        if (deleteError) throw deleteError;

        routeId = existingRoute.id;
      } else {
        const { data: routeData, error: routeError } = await supabase
          .from('routes')
          .insert({
            ...routePayload,
            user_id: userProfile!.id,
            confidence_score: 50,
          })
          .select()
          .single();

        if (routeError) throw routeError;
        routeId = routeData.id;
      }

      const segmentsData = segments.map((seg, idx) => ({
        route_id: routeId,
        transport_type: seg.transport_type,
        signboard: seg.signboard,
        fare: parseFloat(seg.fare) || 0,
        boarding_name: seg.boarding_name,
        boarding_lat: seg.boarding_lat,
        boarding_lng: seg.boarding_lng,
        boarding_tip: seg.boarding_tip.trim() || null,
        drop_off_name: seg.drop_off_name,
        drop_off_lat: seg.drop_off_lat,
        drop_off_lng: seg.drop_off_lng,
        drop_off_tip: seg.drop_off_tip.trim() || null,
        estimated_duration: seg.estimated_duration.trim() || null,
        display_order: idx + 1
      }));

      const { error: segError } = await supabase
        .from('route_segments')
        .insert(segmentsData);

      if (segError) throw segError;

      router.push(`/route/${routeId}`);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const mapData = getInitialMapCoords();

  const getExistingPins = () => {
    const pins: Array<{ lat: number; lng: number; label: string; role: 'origin' | 'destination' | 'boarding' | 'drop_off' }> = [];
    
    // Add origin if pinned AND not the active target
    if (originLat && originLng && !(mapTarget?.type === 'origin')) {
      pins.push({ lat: originLat, lng: originLng, label: origin || 'Origin', role: 'origin' });
    }
    
    // Add destination if pinned AND not the active target
    if (destLat && destLng && !(mapTarget?.type === 'destination')) {
      pins.push({ lat: destLat, lng: destLng, label: destination || 'Destination', role: 'destination' });
    }
    
    // Add segments if pinned AND not the active target
    segments.forEach((seg, idx) => {
      const isBoardingTarget = mapTarget?.type === 'boarding' && (mapTarget as any).segmentId === seg.id;
      const isDropOffTarget = mapTarget?.type === 'drop_off' && (mapTarget as any).segmentId === seg.id;
      
      if (seg.boarding_lat && seg.boarding_lng && !isBoardingTarget) {
        pins.push({
          lat: seg.boarding_lat,
          lng: seg.boarding_lng,
          label: seg.boarding_name ? `Seg ${idx + 1} Boarding: ${seg.boarding_name}` : `Seg ${idx + 1} Boarding`,
          role: 'boarding'
        });
      }
      if (seg.drop_off_lat && seg.drop_off_lng && !isDropOffTarget) {
        pins.push({
          lat: seg.drop_off_lat,
          lng: seg.drop_off_lng,
          label: seg.drop_off_name ? `Seg ${idx + 1} Drop-off: ${seg.drop_off_name}` : `Seg ${idx + 1} Drop-off`,
          role: 'drop_off'
        });
      }
    });
    
    return pins;
  };

  const getCopyOptions = (excludeSegmentId: string, excludeType: 'boarding' | 'drop_off') => {
    const options: { label: string; lat: number; lng: number; name: string }[] = [];
    
    if (originLat && originLng) {
      options.push({ label: 'Origin', lat: originLat, lng: originLng, name: origin || 'Origin' });
    }
    if (destLat && destLng) {
      options.push({ label: 'Destination', lat: destLat, lng: destLng, name: destination || 'Destination' });
    }
    
    segments.forEach((s, idx) => {
      if (s.boarding_lat && s.boarding_lng && !(s.id === excludeSegmentId && excludeType === 'boarding')) {
        options.push({ label: `Seg ${idx + 1} Boarding`, lat: s.boarding_lat, lng: s.boarding_lng, name: s.boarding_name });
      }
      if (s.drop_off_lat && s.drop_off_lng && !(s.id === excludeSegmentId && excludeType === 'drop_off')) {
        options.push({ label: `Seg ${idx + 1} Drop-off`, lat: s.drop_off_lat, lng: s.drop_off_lng, name: s.drop_off_name });
      }
    });
    
    return options;
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl mx-auto bg-surface border-2 border-border-dark p-6 rounded-md shadow-hard">
        <h1 className="text-3xl font-display font-black text-primary mb-2">Share a Commute Route</h1>
        
        {error && <div className="bg-red-100 text-red-700 p-3 rounded border border-red-200 text-sm font-bold">{error}</div>}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-secondary mb-1 flex justify-between">
              Origin * 
              {originLat ? <span className="text-green-600 text-xs">✓ Pinned</span> : <span className="text-red-500 text-xs">Pin required</span>}
            </label>
            <div className="flex gap-2">
              <input 
                required 
                placeholder="e.g. UP Diliman" 
                value={origin} 
                onChange={e => setOrigin(e.target.value)}
                className="w-full bg-soft-beige border-2 border-border-dark rounded p-2" 
              />
              <button 
                type="button" 
                onClick={() => setMapTarget({ type: 'origin' })}
                className="shrink-0 px-3 border-2 border-border-dark rounded bg-white hover:bg-gray-50 flex items-center justify-center text-primary"
                title="Pin Origin on Map"
              >
                <MapPin className="w-5 h-5 text-accent-coral" />
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-bold text-secondary mb-1 flex justify-between">
              Destination *
              {destLat ? <span className="text-green-600 text-xs">✓ Pinned</span> : <span className="text-red-500 text-xs">Pin required</span>}
            </label>
            <div className="flex gap-2">
              <input 
                required 
                placeholder="e.g. Cubao" 
                value={destination} 
                onChange={e => setDestination(e.target.value)}
                className="w-full bg-soft-beige border-2 border-border-dark rounded p-2" 
              />
              <button 
                type="button" 
                onClick={() => setMapTarget({ type: 'destination' })}
                className="shrink-0 px-3 border-2 border-border-dark rounded bg-white hover:bg-gray-50 flex items-center justify-center text-primary"
                title="Pin Destination on Map"
              >
                <MapPin className="w-5 h-5 text-secondary" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-secondary mb-1">
              Est. Total Duration <span className="font-normal text-secondary/60">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 45 mins, 1–2 hours"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="w-full bg-soft-beige border-2 border-border-dark rounded p-2 text-sm"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-sm font-bold text-secondary mb-1">Month *</label>
            <select value={month} onChange={e => setMonth(e.target.value)} className="w-full bg-soft-beige border-2 border-border-dark rounded p-2">
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-28">
            <label className="block text-sm font-bold text-secondary mb-1">Year *</label>
            <input
              required
              type="number"
              placeholder="e.g. 2026"
              value={year}
              onChange={e => setYear(e.target.value)}
              className="w-full bg-soft-beige border-2 border-border-dark rounded p-2 text-sm"
            />
          </div>
        </div>

        <div className="border-t-2 border-border-dark pt-6 mt-2">
          <h2 className="text-xl font-display font-bold text-primary mb-4 flex items-center gap-2">
            <Bus className="w-5 h-5" />
            Transport Segments
          </h2>
          
          <div className="flex flex-col gap-6">
            {segments.map((seg, idx) => (
              <div key={seg.id} className="relative bg-soft-beige border border-border-dark p-4 rounded-md shadow-sm">
                <div className="absolute top-2 right-2">
                  {segments.length > 1 && (
                    <button type="button" onClick={() => removeSegment(seg.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <h3 className="font-bold text-sm text-secondary mb-3">Segment {idx + 1}</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-bold text-secondary mb-1">Transport Type *</label>
                    <select 
                      value={seg.transport_type} 
                      onChange={e => updateSegment(seg.id, 'transport_type', e.target.value)}
                      className="w-full bg-white border border-border-dark rounded p-1.5 text-sm"
                    >
                      <option value="Jeep">Jeep</option>
                      <option value="Bus">Bus</option>
                      <option value="LRT">LRT</option>
                      <option value="MRT">MRT</option>
                      <option value="UV Express">UV Express</option>
                      <option value="Tricycle">Tricycle</option>
                      <option value="Walk">Walk</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-secondary mb-1">Signboard / Route Name *</label>
                    <input 
                      required 
                      placeholder="e.g. Cubao-Arayat" 
                      value={seg.signboard} 
                      onChange={e => updateSegment(seg.id, 'signboard', e.target.value)}
                      className="w-full bg-white border border-border-dark rounded p-1.5 text-sm" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-bold text-secondary mb-1 flex justify-between">
                      Boarding Landmark *
                      {seg.boarding_lat ? <span className="text-green-600 text-[10px]">✓ Pinned</span> : <span className="text-red-500 text-[10px]">Pin required</span>}
                    </label>
                    <div className="flex gap-1 relative">
                      <input 
                        required 
                        placeholder="e.g. Philcoa Gate" 
                        value={seg.boarding_name} 
                        onChange={e => updateSegment(seg.id, 'boarding_name', e.target.value)}
                        className="w-full bg-white border border-border-dark rounded p-1.5 text-sm" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setMapTarget({ type: 'boarding', segmentId: seg.id })}
                        className="shrink-0 px-2 border border-border-dark rounded bg-white hover:bg-gray-50 flex items-center text-primary"
                        title="Pin Boarding Landmark on Map"
                      >
                        <Map className="w-4 h-4 text-accent-coral" />
                      </button>
                    </div>
                    {getCopyOptions(seg.id, 'boarding').length > 0 && (
                      <div className="mt-1">
                        <select
                          value=""
                          onChange={e => {
                            const val = e.target.value;
                            if (!val) return;
                            const [latStr, lngStr, name] = val.split('|');
                            updateSegmentFields(seg.id, {
                              boarding_name: name,
                              boarding_lat: parseFloat(latStr),
                              boarding_lng: parseFloat(lngStr)
                            });
                          }}
                          className="w-full text-xs bg-white border border-border-dark rounded p-1 text-secondary focus:outline-none focus:ring-1 focus:ring-accent-coral cursor-pointer"
                        >
                          <option value="">📋 Copy coordinates from another pin...</option>
                          {getCopyOptions(seg.id, 'boarding').map((opt, oIdx) => (
                            <option key={oIdx} value={`${opt.lat}|${opt.lng}|${opt.name}`}>
                              {opt.label}: {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary mb-1 flex justify-between">
                      Drop-off Landmark *
                      {seg.drop_off_lat ? <span className="text-green-600 text-[10px]">✓ Pinned</span> : <span className="text-red-500 text-[10px]">Pin required</span>}
                    </label>
                    <div className="flex gap-1 relative">
                      <input 
                        required 
                        placeholder="e.g. Arayat Market" 
                        value={seg.drop_off_name} 
                        onChange={e => updateSegment(seg.id, 'drop_off_name', e.target.value)}
                        className="w-full bg-white border border-border-dark rounded p-1.5 text-sm" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setMapTarget({ type: 'drop_off', segmentId: seg.id })}
                        className="shrink-0 px-2 border border-border-dark rounded bg-white hover:bg-gray-50 flex items-center text-primary"
                        title="Pin Drop-off Landmark on Map"
                      >
                        <Map className="w-4 h-4 text-secondary" />
                      </button>
                    </div>
                    {getCopyOptions(seg.id, 'drop_off').length > 0 && (
                      <div className="mt-1">
                        <select
                          value=""
                          onChange={e => {
                            const val = e.target.value;
                            if (!val) return;
                            const [latStr, lngStr, name] = val.split('|');
                            updateSegmentFields(seg.id, {
                              drop_off_name: name,
                              drop_off_lat: parseFloat(latStr),
                              drop_off_lng: parseFloat(lngStr)
                            });
                          }}
                          className="w-full text-xs bg-white border border-border-dark rounded p-1 text-secondary focus:outline-none focus:ring-1 focus:ring-accent-coral cursor-pointer"
                        >
                          <option value="">📋 Copy coordinates from another pin...</option>
                          {getCopyOptions(seg.id, 'drop_off').map((opt, oIdx) => (
                            <option key={oIdx} value={`${opt.lat}|${opt.lng}|${opt.name}`}>
                              {opt.label}: {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-bold text-secondary mb-1 flex justify-between">
                      Boarding Arrival Tip <span className="font-normal text-secondary/60">(optional)</span>
                      <span className={`text-[10px] ${countTipWords(seg.boarding_tip) > MAX_TIP_WORDS ? 'text-red-500' : 'text-secondary/50'}`}>
                        {countTipWords(seg.boarding_tip)}/{MAX_TIP_WORDS} words
                      </span>
                    </label>
                    <input
                      placeholder="e.g. Trike terminal is beside Puregold"
                      value={seg.boarding_tip}
                      onChange={e => updateSegment(seg.id, 'boarding_tip', e.target.value)}
                      className="w-full bg-white border border-border-dark rounded p-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary mb-1 flex justify-between">
                      Drop-off Arrival Tip <span className="font-normal text-secondary/60">(optional)</span>
                      <span className={`text-[10px] ${countTipWords(seg.drop_off_tip) > MAX_TIP_WORDS ? 'text-red-500' : 'text-secondary/50'}`}>
                        {countTipWords(seg.drop_off_tip)}/{MAX_TIP_WORDS} words
                      </span>
                    </label>
                    <input
                      placeholder="e.g. Use the north exit"
                      value={seg.drop_off_tip}
                      onChange={e => updateSegment(seg.id, 'drop_off_tip', e.target.value)}
                      className="w-full bg-white border border-border-dark rounded p-1.5 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-secondary mb-1">Fare (₱) *</label>
                    <input 
                      required 
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="e.g. 15" 
                      value={seg.fare} 
                      onChange={e => updateSegment(seg.id, 'fare', e.target.value)}
                      className="w-full bg-white border border-border-dark rounded p-1.5 text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary mb-1">
                      Est. Time <span className="font-normal text-secondary/60">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 5 mins, 1 hour"
                      value={seg.estimated_duration}
                      onChange={e => updateSegment(seg.id, 'estimated_duration', e.target.value)}
                      className="w-full bg-white border border-border-dark rounded p-1.5 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <SecondaryButton type="button" onClick={addSegment} className="w-full py-2 border-dashed">
              <Plus className="w-4 h-4 mr-2 inline-block" /> Add Another Transport Segment
            </SecondaryButton>
          </div>
        </div>

        <div className="border-t-2 border-border-dark pt-6 mt-2">
          <label className="block text-sm font-bold text-secondary mb-1 flex justify-between">
            Destination Arrival Tip <span className="font-normal text-secondary/60">(optional)</span>
            <span className={`text-xs ${countTipWords(destinationTip) > MAX_TIP_WORDS ? 'text-red-500' : 'text-secondary/50'}`}>
              {countTipWords(destinationTip)}/{MAX_TIP_WORDS} words
            </span>
          </label>
          <p className="text-xs text-secondary/70 mb-2">One short actionable tip for when you reach the final destination.</p>
          <input
            placeholder="e.g. Enter through Gate 2"
            value={destinationTip}
            onChange={e => setDestinationTip(e.target.value)}
            className="w-full bg-soft-beige border-2 border-border-dark rounded p-2 text-sm mb-4"
          />

          <label className="block text-sm font-bold text-secondary mb-1">Extra Notes</label>
          <p className="text-xs text-secondary/70 mb-2">Share tips, queue times, warnings, or detailed directions to the boarding point.</p>
          <textarea 
            rows={4}
            placeholder="e.g. Stand beside Jollibee Philcoa near the overpass. Avoid the Kalayaan route jeep because it drops farther. High queue between 5-7 PM." 
            value={communityNotes} 
            onChange={e => setCommunityNotes(e.target.value)}
            className="w-full bg-soft-beige border-2 border-border-dark rounded p-2 text-sm" 
          />
        </div>

        <PrimaryButton type="submit" disabled={loading} className="w-full py-3 mt-4 text-lg">
          {loading ? (isEditMode ? 'Saving...' : 'Publishing...') : (isEditMode ? 'Save Changes' : 'Publish Commute Route')}
        </PrimaryButton>
      </form>

      <MapPickerModal
        isOpen={!!mapTarget}
        onClose={() => setMapTarget(null)}
        onSelect={handleMapSelect}
        initialLat={mapData.lat}
        initialLng={mapData.lng}
        label={mapData.label}
        existingPins={getExistingPins()}
      />
    </>
  );
}
