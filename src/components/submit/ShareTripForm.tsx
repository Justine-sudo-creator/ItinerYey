'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { uploadTripPhoto, deleteTripPhotos } from '@/utils/supabase/storage';
import { LocationAutocomplete, StructuredLocation } from '@/components/ui/LocationAutocomplete';
import { PhotoUploader, PhotoData } from '@/components/ui/PhotoUploader';
import { TextInput, TextAreaInput, SelectInput, Label } from '@/components/ui/Inputs';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { TRIP_TYPES, TRAVEL_STYLES } from '@/lib/constants';
import { User, Trip, TripStop, TripPhoto, TripDay } from '@/types/supabase';
import { Award } from 'lucide-react';


type ShareTripFormProps = {
  returnTo: string;
  userProfile: Partial<User> | null;
  mode?: 'create' | 'edit';
  initialData?: Partial<Trip> & { trip_stops?: TripStop[], trip_photos?: TripPhoto[], trip_days?: TripDay[] };
  isAdmin?: boolean;
};

type ItineraryBlock = {
  id: string;
  time_label: string;
  activity: string;
  cost: string;
};

type ItineraryDay = {
  id: string;
  blocks: ItineraryBlock[];
};

export default function ShareTripForm({ returnTo, userProfile, mode = 'create', initialData, isAdmin = false }: ShareTripFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const isEdit = mode === 'edit';

  // Section 1
  const [tripName, setTripName] = useState(initialData?.trip_name || '');
  const [destination, setDestination] = useState(initialData?.destination || '');
  const [destinationRegion, setDestinationRegion] = useState(initialData?.destination_region || '');
  const [destStructured, setDestStructured] = useState<StructuredLocation | null>(
    initialData?.destination_place_id ? {
      place_id: initialData.destination_place_id ?? null,
      lat: initialData.destination_lat ?? null,
      lng: initialData.destination_lng ?? null,
      city: initialData.destination_city ?? null,
      province: initialData.destination_province ?? null,
      country: initialData.destination_country ?? null
    } : null
  );
  
  const [originRegion, setOriginRegion] = useState(initialData?.origin_region || userProfile?.region || '');
  const [origStructured, setOrigStructured] = useState<StructuredLocation | null>(
    initialData?.origin_place_id ? {
      place_id: initialData.origin_place_id ?? null,
      lat: initialData.origin_lat ?? null,
      lng: initialData.origin_lng ?? null,
      city: initialData.origin_city ?? null,
      province: initialData.origin_province ?? null,
      country: initialData.origin_country ?? null
    } : null
  );
  const [originAreaState, setOriginAreaState] = useState(initialData?.origin_area || '');
  const [endAreaState, setEndAreaState] = useState(initialData?.end_area || '');
  const [routeContextInput, setRouteContextInput] = useState(initialData?.route_context || '');
  
  type TripStopInput = { id: string, name: string, note: string };
  const [tripStops, setTripStops] = useState<TripStopInput[]>(
    initialData?.trip_stops?.map((s: TripStop) => ({ id: Math.random().toString(36).substr(2, 9), name: s.stop_name, note: s.stop_note || '' })) || []
  );

  const addTripStop = () => setTripStops([...tripStops, { id: Math.random().toString(36).substr(2, 9), name: '', note: '' }]);
  const removeTripStop = (id: string) => setTripStops(tripStops.filter(s => s.id !== id));
  const updateTripStop = (id: string, field: 'name' | 'note', val: string) => setTripStops(tripStops.map(s => s.id === id ? { ...s, [field]: val } : s));
  
  const [travelDate, setTravelDate] = useState(initialData?.travel_date || '');
  const [groupSize, setGroupSize] = useState(initialData?.group_size?.toString() || '1');
  const [costScope, setCostScope] = useState<'individual' | 'group_total'>(initialData?.cost_scope || 'individual');
  const [tripType, setTripType] = useState(initialData?.trip_type || '');
  const [durationDays, setDurationDays] = useState(initialData?.duration_days?.toString() || '1');
  const [tripDurationLabel, setTripDurationLabel] = useState(initialData?.trip_duration_label || '');

  // Section 2
  const [isDetailedCost, setIsDetailedCost] = useState(initialData ? !!initialData.detailed_costs : true);
  const [transportCost, setTransportCost] = useState(initialData?.transport_cost?.toString() || '');
  const [foodCost, setFoodCost] = useState(initialData?.food_cost?.toString() || '');
  const [activitiesCost, setActivitiesCost] = useState(initialData?.activities_cost?.toString() || '');
  const [accommodationCost, setAccommodationCost] = useState(initialData?.accommodation_cost?.toString() || '');
  const [detailedCosts, setDetailedCosts] = useState<{id: string; category: string; label: string; amount: string}[]>(
    initialData?.detailed_costs || []
  );
  const [targetBudget, setTargetBudget] = useState(initialData?.cost_per_person?.toString() || '');
  const [showCategoryEstimates, setShowCategoryEstimates] = useState(
    initialData ? !!(initialData.transport_cost || initialData.food_cost || initialData.activities_cost || initialData.accommodation_cost || initialData.detailed_costs) : false
  );

  // Section 3
  const [summary, setSummary] = useState(initialData?.trip_summary || '');
  const [tip, setTip] = useState(initialData?.tip || '');
  const [travelStyle, setTravelStyle] = useState(initialData?.travel_style || userProfile?.travel_style || '');

  // Section 4
  const [photos, setPhotos] = useState<PhotoData[]>(
    initialData?.trip_photos?.sort((a: TripPhoto, b: TripPhoto) => a.display_order - b.display_order).map((p: TripPhoto) => ({
      id: p.id,
      previewUrl: p.photo_url,
      caption: p.caption || '',
      isHero: p.is_hero,
      isExisting: true
    })) || []
  );

  // Section 5
  const [honestWarning, setHonestWarning] = useState(initialData?.honest_warning || '');
  
  // Admin Curation state
  const [isCurated, setIsCurated] = useState(initialData?.is_curated || false);
  const [attributionSource, setAttributionSource] = useState(initialData?.attribution_source || '');
  
  // Reconstruct days from initialData.trip_days
  const initialDays = (initialData?.trip_days?.length ?? 0) > 0 ? (() => {
    // Group blocks by day_number
    const dayMap = new Map<number, ItineraryBlock[]>();
    initialData?.trip_days?.forEach((d: TripDay) => {
      if (!dayMap.has(d.day_number)) dayMap.set(d.day_number, []);
      dayMap.get(d.day_number)!.push({
        id: Math.random().toString(36).substr(2, 9),
        time_label: d.time_of_day,
        activity: d.activity,
        cost: d.cost?.toString() || ''
      });
    });
    
    // Build days array in order
    const numDays = Math.max(...Array.from(dayMap.keys()));
    const daysArr: ItineraryDay[] = [];
    for (let i = 1; i <= numDays; i++) {
      if (dayMap.has(i)) {
        daysArr.push({
          id: Math.random().toString(36).substr(2, 9),
          blocks: dayMap.get(i)!
        });
      } else {
        daysArr.push({
          id: Math.random().toString(36).substr(2, 9),
          blocks: [{ id: Math.random().toString(36).substr(2, 9), time_label: '', activity: '', cost: '' }]
        });
      }
    }
    return daysArr;
  })() : [{
    id: Math.random().toString(36).substr(2, 9),
    blocks: [{ id: Math.random().toString(36).substr(2, 9), time_label: '', activity: '', cost: '' }]
  }];

  const [days, setDays] = useState<ItineraryDay[]>(initialDays);
  const [showItinerary, setShowItinerary] = useState(!!initialData?.trip_days?.length);
  const [showAdvancedRoute, setShowAdvancedRoute] = useState(false);
  const [showHumanLayer, setShowHumanLayer] = useState(isEdit);
  const [isPublic, setIsPublic] = useState(initialData?.is_public !== undefined ? !!initialData.is_public : true);
  const [isSnapshot, setIsSnapshot] = useState(initialData?.submission_tier === 'basic' || false);

  // Auto-Save Draft to LocalStorage (for create mode only)
  React.useEffect(() => {
    if (isEdit) return;
    try {
      const savedDraft = localStorage.getItem('itineryey_new_trip_draft');
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft.tripName) setTripName(draft.tripName);
        if (draft.destination) setDestination(draft.destination);
        if (draft.destinationRegion) setDestinationRegion(draft.destinationRegion);
        if (draft.destStructured) setDestStructured(draft.destStructured);
        if (draft.originRegion) setOriginRegion(draft.originRegion);
        if (draft.origStructured) setOrigStructured(draft.origStructured);
        if (draft.originAreaState) setOriginAreaState(draft.originAreaState);
        if (draft.endAreaState) setEndAreaState(draft.endAreaState);
        if (draft.routeContextInput) setRouteContextInput(draft.routeContextInput);
        if (draft.tripStops) setTripStops(draft.tripStops);
        if (draft.travelDate) setTravelDate(draft.travelDate);
        if (draft.groupSize) setGroupSize(draft.groupSize);
        if (draft.tripType) setTripType(draft.tripType);
        if (draft.durationDays) setDurationDays(draft.durationDays);
        if (draft.tripDurationLabel) setTripDurationLabel(draft.tripDurationLabel);
        if (draft.isDetailedCost !== undefined) setIsDetailedCost(draft.isDetailedCost);
        if (draft.costScope) setCostScope(draft.costScope);
        if (draft.transportCost) setTransportCost(draft.transportCost);
        if (draft.foodCost) setFoodCost(draft.foodCost);
        if (draft.activitiesCost) setActivitiesCost(draft.activitiesCost);
        if (draft.accommodationCost) setAccommodationCost(draft.accommodationCost);
        if (draft.detailedCosts) setDetailedCosts(draft.detailedCosts);
        if (draft.targetBudget) setTargetBudget(draft.targetBudget);
        if (draft.showCategoryEstimates !== undefined) setShowCategoryEstimates(draft.showCategoryEstimates);
        if (draft.summary) setSummary(draft.summary);
        if (draft.tip) setTip(draft.tip);
        if (draft.travelStyle) setTravelStyle(draft.travelStyle);
        if (draft.honestWarning) setHonestWarning(draft.honestWarning);
        if (draft.days) setDays(draft.days);
        if (draft.showItinerary !== undefined) setShowItinerary(draft.showItinerary);
        if (draft.isPublic !== undefined) setIsPublic(draft.isPublic);
        if (draft.isSnapshot !== undefined) setIsSnapshot(draft.isSnapshot);
      }
    } catch (e) {
      console.error('Failed to load draft from localStorage', e);
    }
  }, [isEdit]);

  React.useEffect(() => {
    if (isEdit) return;
    try {
      const draftData = {
        tripName,
        destination,
        destinationRegion,
        destStructured,
        originRegion,
        origStructured,
        originAreaState,
        endAreaState,
        routeContextInput,
        tripStops,
        travelDate,
        groupSize,
        tripType,
        durationDays,
        tripDurationLabel,
        isDetailedCost,
        costScope,
        transportCost,
        foodCost,
        activitiesCost,
        accommodationCost,
        detailedCosts,
        targetBudget,
        showCategoryEstimates,
        summary,
        tip,
        travelStyle,
        honestWarning,
        days,
        showItinerary,
        isPublic,
        isSnapshot
      };
      localStorage.setItem('itineryey_new_trip_draft', JSON.stringify(draftData));
    } catch (e) {
      console.error('Failed to save draft to localStorage', e);
    }
  }, [
    travelDate, groupSize, costScope, tripType, durationDays, tripDurationLabel, isDetailedCost,
    transportCost, foodCost, activitiesCost, accommodationCost, detailedCosts,
    targetBudget, showCategoryEstimates, summary, tip, travelStyle, honestWarning,
    days, showItinerary, isPublic, isSnapshot
  ]);

  const clearDraft = () => {
    if (!isEdit) {
      localStorage.removeItem('itineryey_new_trip_draft');
    }
  };

  // Submission State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [newTripId, setNewTripId] = useState<string | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(false);

  const addDetailedCost = () => {
    setDetailedCosts([...detailedCosts, { id: Math.random().toString(36).substr(2, 9), category: 'Transport', label: '', amount: '' }]);
  };

  const removeDetailedCost = (id: string) => {
    setDetailedCosts(detailedCosts.filter(c => c.id !== id));
  };

  const updateDetailedCost = (id: string, field: string, val: string) => {
    setDetailedCosts(detailedCosts.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const addDay = () => {
    setDays([...days, {
      id: Math.random().toString(36).substr(2, 9),
      blocks: [
        { id: Math.random().toString(36).substr(2, 9), time_label: '', activity: '', cost: '' }
      ]
    }]);
  };

  const removeDay = (id: string) => {
    setDays(days.filter(d => d.id !== id));
  };

  const addBlock = (dayId: string) => {
    setDays(days.map(d => {
      if (d.id !== dayId) return d;
      return { ...d, blocks: [...d.blocks, { id: Math.random().toString(36).substr(2, 9), time_label: '', activity: '', cost: '' }] };
    }));
  };
  
  const removeBlock = (dayId: string, blockId: string) => {
    setDays(days.map(d => {
      if (d.id !== dayId) return d;
      return { ...d, blocks: d.blocks.filter(b => b.id !== blockId) };
    }));
  };

  const updateBlock = (dayId: string, blockId: string, field: keyof ItineraryBlock, val: string) => {
    setDays(days.map(d => {
      if (d.id !== dayId) return d;
      const newBlocks = d.blocks.map(b => b.id === blockId ? { ...b, [field]: val } : b);
      return { ...d, blocks: newBlocks };
    }));
  };

  // Helper to check if a location matches a key destination
  const getDestinationBaseline = (dest: string): number => {
    const d = dest.toLowerCase();
    if (d.includes('tagaytay')) return 2500;
    if (d.includes('union') || d.includes('elyu') || d.includes('san juan')) return 5000;
    if (d.includes('baguio')) return 4500;
    if (d.includes('bgc') || d.includes('bonifacio') || d.includes('manila') || d.includes('makati') || d.includes('ortigas') || d.includes('pasay')) return 1200;
    
    // Check if international
    if (destStructured?.country && destStructured.country !== 'Philippines') {
      return 7000;
    }
    return 2000; // General domestic fallback
  };

  const getMatipidScore = (): { percentage: number; isWais: boolean; baseline: number } => {
    const baseline = getDestinationBaseline(destination);
    const days = parseInt(durationDays) || 1;
    const cost = parseInt(targetBudget) || detailedCosts.reduce((sum, c) => sum + (parseInt(c.amount) || 0), 0);
    
    let totalCost = cost;
    // If it's group scope, divide by group size to compare per-head
    if (costScope === 'group_total') {
      const size = parseInt(groupSize) || 1;
      totalCost = cost / size;
    }
    
    const dailyCost = totalCost / days;
    
    if (dailyCost < baseline) {
      const diff = baseline - dailyCost;
      const pct = Math.round((diff / baseline) * 100);
      return { percentage: pct, isWais: true, baseline };
    }
    return { percentage: 0, isWais: false, baseline };
  };

  const fillDevMockData = () => {
    setTripName('Tagaytay Quick Snapshot');
    setDestination('Tagaytay');
    setDestinationRegion('Calabarzon');
    setDestStructured({
      place_id: 'mock-tagaytay',
      lat: 14.1153,
      lng: 120.9621,
      city: 'Tagaytay',
      province: 'Cavite',
      country: 'Philippines'
    });
    setOriginRegion('Metro Manila');
    setOrigStructured({
      place_id: 'mock-manila',
      lat: 14.5995,
      lng: 120.9842,
      city: 'Manila',
      province: 'Metro Manila',
      country: 'Philippines'
    });
    setTravelDate('2026-06-01');
    setGroupSize('2');
    setCostScope('individual');
    setTripType('Road Trip');
    setDurationDays('1');
    setTripDurationLabel('Whole day');
    setIsSnapshot(true);
    setTargetBudget('1200');
    setSummary('Quick Tagaytay bulalo roadtrip under budget!');
    setTip('Eat at Maharlika Highway stalls for cheaper bulalo.');
    setHonestWarning('Traffic going back on Sunday afternoon is terrible.');
    setPhotos([
      {
        id: 'mock-photo-1',
        previewUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80',
        caption: 'Bulalo view',
        isHero: true,
        isExisting: false,
        file: new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'mock.jpg', { type: 'image/jpeg' }) // Valid non-empty dummy byte array File
      }
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowGuidelines(true);

    // Validation
    if (isPublic) {
      if (!destination || !destinationRegion || !originRegion || !travelDate || !groupSize || !tripType || !durationDays) {
        return setError('Please fill out all required Basics fields.');
      }
      
      const minPhotosRequired = isSnapshot ? 1 : 3;
      if (!isEdit && photos.length < minPhotosRequired) {
        return setError(`Please upload at least ${minPhotosRequired} photo${minPhotosRequired > 1 ? 's' : ''}.`);
      }

      // Cost validation
      let totalInputCost = 0;
      if (isSnapshot) {
        totalInputCost = parseInt(targetBudget) || 0;
      } else if (isDetailedCost) {
        totalInputCost = detailedCosts.reduce((sum, c) => sum + (parseInt(c.amount) || 0), 0);
      } else {
        totalInputCost = (parseInt(transportCost) || 0) + (parseInt(foodCost) || 0) + (parseInt(activitiesCost) || 0) + (parseInt(accommodationCost) || 0);
      }
      if (totalInputCost <= 0) {
        return setError('Please enter at least one cost or expense. Public trips cannot have a total cost of ₱0.');
      }

      if (summary && summary.length > 180) {
        return setError('Trip summary cannot exceed 180 characters.');
      }
      if (tip && tip.length > 300) {
        return setError('One tip cannot exceed 300 characters.');
      }
    } else {
      if (!destination) {
        return setError('Please enter a Destination to save your private draft.');
      }
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in.');

      // Date is now YYYY-MM-DD from type="date"
      const formattedDate = travelDate || new Date().toISOString().split('T')[0];

      // Determine submission tier
      const hasRouteBasis = !!(originAreaState || routeContextInput.trim() || (isDetailedCost && detailedCosts.some(c => c.category === 'Transport' && (parseInt(c.amount) || 0) > 0)));
      const hasCostBreakdown = isDetailedCost && !isSnapshot;
      const itineraryBlocksCount = isSnapshot ? 0 : days.reduce((acc, d) => acc + d.blocks.filter(b => b.activity.trim() !== '').length, 0);
      const submissionTier = isSnapshot
        ? 'basic'
        : (isPublic
          ? ((tripDurationLabel && hasRouteBasis && hasCostBreakdown && (itineraryBlocksCount >= 2 || tripStops.filter(s => s.name.trim()).length >= 2)) ? 'full' : 'basic')
          : 'draft');

      let tCost = 0, fCost = 0, aCost = 0, accCost = 0;
      if (isSnapshot) {
        // No splits in snapshot, total is targetBudget
      } else if (isDetailedCost) {
        detailedCosts.forEach(c => {
          const amt = parseInt(c.amount) || 0;
          if (c.category === 'Transport') tCost += amt;
          if (c.category === 'Food') fCost += amt;
          if (c.category === 'Activities') aCost += amt;
          if (c.category === 'Accommodation') accCost += amt;
        });
      } else {
        tCost = parseInt(transportCost) || 0;
        fCost = parseInt(foodCost) || 0;
        aCost = parseInt(activitiesCost) || 0;
        accCost = parseInt(accommodationCost) || 0;
      }
      
      const sumOfCosts = tCost + fCost + aCost + accCost;
      const calculatedTotalCost = isSnapshot
        ? parseInt(targetBudget) || 0
        : ((!isPublic && !showCategoryEstimates && targetBudget) 
          ? parseInt(targetBudget) || 0 
          : sumOfCosts);

      let finalOriginArea = originAreaState || null;
      let finalRouteContext = null;

      if (routeContextInput.trim()) {
        const words = routeContextInput.trim().split(' ').length;
        if (words < 6 && !routeContextInput.includes(';') && !routeContextInput.includes('.')) {
          finalOriginArea = finalOriginArea ? `${finalOriginArea}, ${routeContextInput}` : routeContextInput;
        } else {
          finalRouteContext = routeContextInput;
        }
      }

      const finalEndArea = endAreaState || null;

      // 1. Insert Trip
      const payload = {
        user_id: user.id,
        trip_name: tripName || null,
        destination,
        destination_region: destinationRegion || destination,
        destination_place_id: destStructured?.place_id || null,
        destination_lat: destStructured?.lat || null,
        destination_lng: destStructured?.lng || null,
        destination_city: destStructured?.city || null,
        destination_province: destStructured?.province || null,
        destination_country: destStructured?.country || null,
        origin_region: originRegion || userProfile?.region || 'Manila',
        origin_place_id: origStructured?.place_id || null,
        origin_lat: origStructured?.lat || null,
        origin_lng: origStructured?.lng || null,
        origin_city: origStructured?.city || null,
        origin_province: origStructured?.province || null,
        origin_country: origStructured?.country || null,
        origin_area: finalOriginArea,
        end_area: finalEndArea,
        route_context: finalRouteContext,
        travel_date: formattedDate,
        group_size: parseInt(groupSize) || 1,
        group_type: parseInt(groupSize) === 1 ? 'Solo' : 'Group',
        trip_type: tripType || 'Day Trip',
        duration_days: parseInt(durationDays) || 1,
        trip_duration_label: tripDurationLabel || null,
        cost_per_person: calculatedTotalCost,
        transport_cost: tCost,
        transport_cost_scope: null,
        food_cost: fCost,
        activities_cost: aCost,
        accommodation_cost: accCost,
        detailed_costs: (isDetailedCost && !isSnapshot) ? detailedCosts : null,
        cost_scope: costScope,
        tip: tip || null,
        honest_warning: honestWarning || null,
        travel_style: travelStyle || 'Budget',
        submission_tier: submissionTier,
        trip_summary: summary,
        is_approved: false,
        is_public: isPublic,
        is_curated: isCurated,
        attribution_source: attributionSource || null,
      };
      
      if (isEdit && initialData) {
        // 1. Process Photos
        const existingPhotoIds = photos.filter(p => p.isExisting).map(p => p.id);
        const removedPhotos = initialData?.trip_photos?.filter((p: TripPhoto) => !existingPhotoIds.includes(p.id)) || [];
        
        if (removedPhotos.length > 0) {
          const filesToRemove = removedPhotos.map((p: TripPhoto) => {
            const urlParts = p.photo_url.split('/trip-photos/');
            return urlParts.length > 1 ? urlParts[1] : null;
          }).filter((f): f is string => f !== null);
          
          if (filesToRemove.length > 0) {
            await deleteTripPhotos();
          }
          await supabase.from('trip_photos').delete().in('id', removedPhotos.map((p: TripPhoto) => p.id));
        }

        for (let i = 0; i < photos.length; i++) {
          const p = photos[i];
          if (p.isExisting) {
            const { error: updateError } = await supabase.from('trip_photos').update({
              caption: p.caption || null,
              is_hero: p.isHero,
              display_order: i,
            }).eq('id', p.id);
            
            if (updateError) {
              console.error('Failed to update existing photo:', updateError);
            }
          } else if (p.file) {
            // Check if mock file from Dev Auto-Fill to skip upload or upload mock
            const publicUrl = await uploadTripPhoto(user.id, initialData.id!, p.file);
            await supabase.from('trip_photos').insert({
              trip_id: initialData.id!,
              photo_url: publicUrl,
              caption: p.caption || null,
              is_hero: p.isHero,
              display_order: i,
            });
          }
        }

        // Prepare stops payload
        const stopsPayload = isSnapshot ? [] : tripStops.filter(s => s.name.trim() !== '').map((s, i) => ({
          stop_name: s.name.trim(),
          stop_note: s.note.trim() || null,
          display_order: i
        }));

        // Prepare days payload
        const daysPayload: Omit<TripDay, 'id' | 'trip_id'>[] = [];
        if (!isSnapshot && itineraryBlocksCount > 0) {
          for (let i = 0; i < days.length; i++) {
            const d = days[i];
            for (let bIdx = 0; bIdx < d.blocks.length; bIdx++) {
              const b = d.blocks[bIdx];
              if (b.activity.trim() === '') continue;
              daysPayload.push({
                day_number: i + 1,
                time_of_day: b.time_label || '',
                activity: b.activity,
                cost: b.cost ? parseInt(b.cost) : null,
                display_order: bIdx,
              });
            }
          }
        }

        const res = await fetch(`/api/trip/${initialData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            stops: stopsPayload,
            days: daysPayload
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to update trip.');
        }

        clearDraft();
        router.push(`/trip/${initialData.id}`);
        router.refresh();
        return;
      }
      
      console.log('--- DEBUG: INSERTING TRIP PAYLOAD ---', payload);
      
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

      // 2.5 Insert Trip Stops
      if (!isSnapshot && tripStops.length > 0) {
        for (let i = 0; i < tripStops.length; i++) {
          const s = tripStops[i];
          if (s.name.trim() === '') continue;
          const { error: stopError } = await supabase.from('trip_stops').insert({
            trip_id: tripData.id,
            stop_name: s.name.trim(),
            stop_note: s.note.trim() || null,
            display_order: i,
          });
          if (stopError) {
            console.error("Stop DB Insert Error:", stopError);
            throw stopError;
          }
        }
      }

      // 3. Insert Itinerary Days
      if (!isSnapshot && itineraryBlocksCount > 0) {
        for (let i = 0; i < days.length; i++) {
          const d = days[i];
          for (let bIdx = 0; bIdx < d.blocks.length; bIdx++) {
            const b = d.blocks[bIdx];
            if (b.activity.trim() === '') continue; // Skip empty blocks
            const { error: dayError } = await supabase.from('trip_days').insert({
              trip_id: tripData.id,
              day_number: i + 1,
              time_of_day: b.time_label || '',
              activity: b.activity,
              cost: b.cost ? parseInt(b.cost) : null,
              display_order: bIdx,
            });

            if (dayError) {
              console.error("Day DB Insert Error:", dayError);
              throw dayError;
            }
          }
        }
      }

      // 4. Unlock user access
      const { error: userError } = await supabase.from('users').update({
        has_contributed: true,
        access_expires_at: null,
      }).eq('id', user.id);

      if (userError) throw userError;

      // 5. Redirect / Success UI
      clearDraft();
      setNewTripId(tripData.id);
      setIsSuccess(true);
      window.scrollTo(0, 0);

    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message || 'Your submission could not be saved. Please check database permissions.');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    const matipid = getMatipidScore();
    return (
      <div className="bg-surface border border-border-dark/15 rounded-lg p-8 shadow-sm text-center flex flex-col items-center justify-center min-h-[40vh]">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-black uppercase tracking-tight">
            {isPublic ? (isEdit ? 'Edit Trip' : 'Yey!') : (isEdit ? 'Edit Draft' : 'Save Private Draft')}
          </h2>
          <p className="text-secondary font-medium mt-1">
            {isPublic 
              ? (isEdit ? 'Update your submitted byahe. Major edits may need review again.' : 'Your trip is currently pending admin approval and will appear on the public feed shortly.')
              : 'Your private trip planner. Keep it here or publish it to the community later.'}
          </p>
        </div>
        <h2 className="font-brand font-black text-3xl mb-4 text-accent-green">
          {isPublic ? 'Trip Submitted!' : 'Draft Saved!'}
        </h2>
        
        {/* Matipid Score Section */}
        {isPublic && matipid.isWais && (
          <div className="mb-6 p-4 bg-accent-yellow/15 border-2 border-dashed border-accent-yellow rounded-lg max-w-md flex flex-col items-center gap-2">
            <Award className="w-8 h-8 text-accent-coral" />
            <h4 className="text-lg font-black text-accent-coral uppercase tracking-tight">Wais Traveler Unlocked!</h4>
            <p className="text-sm font-bold mt-1">
              Your daily spend is <span className="text-accent-coral text-base font-black">{matipid.percentage}% cheaper</span> than the average baseline daily spend of ₱{matipid.baseline.toLocaleString()} for this destination!
            </p>
          </div>
        )}


        <p className="text-lg font-bold mb-2">
          {isPublic ? 'Your travel map has been updated with your new destination province.' : 'Your plan has been saved to your Locker.'}
        </p>
        <p className="mb-6 max-w-md opacity-80 leading-relaxed text-sm">
          {isPublic ? (
            <>Keep submitting trips to fill your map and gain bragging rights for how many places you've been!</>
          ) : (
            <>This trip is 100% private to you in your Locker. You can view, edit, or publish it to the community feed whenever you are ready.</>
          )
          }
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-md mt-2">
          <PrimaryButton 
            onClick={() => router.push(isPublic ? '/profile' : (returnTo || '/'))}
            className="w-full text-center flex items-center justify-center py-3"
          >
            {isPublic ? 'View My Map' : 'Return to Locker'}
          </PrimaryButton>
          <SecondaryButton 
            onClick={() => router.push('/')}
            className="w-full text-center flex items-center justify-center py-3"
          >
            Go to Feed
          </SecondaryButton>
        </div>

      </div>
    );
  }

  // Helper statuses for guidelines completion
  const isBasicsCompleted = !!(destination && destinationRegion && originRegion && travelDate && groupSize && tripType && durationDays);
  const isPhotosCompleted = isEdit || photos.length >= (isSnapshot ? 1 : 3);
  const isCostsCompleted = isSnapshot
    ? (parseInt(targetBudget) || 0) > 0
    : (isDetailedCost 
      ? detailedCosts.some(c => (parseInt(c.amount) || 0) > 0)
      : ((parseInt(transportCost) || 0) > 0 || (parseInt(foodCost) || 0) > 0 || (parseInt(activitiesCost) || 0) > 0 || (parseInt(accommodationCost) || 0) > 0));
  const isSubmissionCompleted = isPublic
    ? (isBasicsCompleted && isPhotosCompleted && isCostsCompleted)
    : !!destination;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 relative">
      {/* Dev Auto-Fill Helper Button (Dev/Admin only, but exposed absolutely here for ease of testing) */}
      <button 
        type="button" 
        onClick={fillDevMockData}
        className="absolute top-[-48px] right-0 bg-accent-coral border-2 border-border-dark text-white font-black text-xs px-3 py-1.5 rounded-md hover:bg-accent-coral/95 transition-all shadow-[4px_4px_0px_#1E1E1E] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#1E1E1E]"
      >
        ⚡ Dev Auto-Fill (Tagaytay)
      </button>

      {/* Consolidated Publishing & Submission Format Panel */}
      <div className="flex flex-col gap-4 bg-surface p-4 border border-border-dark/15 rounded-lg shadow-sm">
        {/* Toggle 1: Publish Checkbox */}
        <label className="flex items-center gap-3 cursor-pointer select-none border-b border-border-dark/10 pb-3">
          <input 
            type="checkbox" 
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-5 h-5 accent-primary border border-border-dark/15 rounded cursor-pointer"
          />
          <span className="font-bold text-sm sm:text-base leading-none text-primary">
            Publish to Community Feed
          </span>
        </label>
        
        {!isPublic ? (
          <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-md p-3 text-xs font-bold text-primary">
            🔒 Draft Mode: Just enter a destination to save a private planner draft in your Locker.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <span className="font-bold text-xs uppercase tracking-wider text-secondary">Submission Format</span>
            
            <div className="flex flex-col gap-3">
              {/* Option A: Quick Snapshot */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="radio"
                  name="submissionTier"
                  checked={isSnapshot}
                  onChange={() => setIsSnapshot(true)}
                  className="w-4 h-4 mt-1 accent-primary border border-border-dark/15 cursor-pointer flex-shrink-0"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-primary">
                    Quick Snapshot <span className="text-xs font-normal text-secondary">(Fastest way to contribute. You can always edit this trip later to add details.)</span>
                  </span>
                </div>
              </label>

              {/* Option B: Detailed Guide */}
              <label className="flex items-start gap-3 cursor-pointer select-none border-t border-border-dark/10 pt-3">
                <input
                  type="radio"
                  name="submissionTier"
                  checked={!isSnapshot}
                  onChange={() => setIsSnapshot(false)}
                  className="w-4 h-4 mt-1 accent-primary border border-border-dark/15 cursor-pointer flex-shrink-0"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-primary">
                    Detailed Guide <span className="text-xs font-normal text-secondary">(Help other travelers fully copy your trip by adding cost breakdowns, itinerary, specific stops, and notes.)</span>
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>


      {/* SECTION 1 */}
      <div className="bg-surface border border-border-dark/15 rounded-lg p-4 shadow-sm">
        <h3 className="bg-accent-yellow inline-block px-2 py-1 font-bold text-sm border border-border-dark/15 rounded mb-4 shadow-sm">
          Trip Basics
        </h3>
        <div className="flex flex-col gap-4">
          <TextInput
            label="Trip Name (Optional)"
            placeholder="e.g. Gala sa Eastwood, Chill afternoon at BGC"
            value={tripName}
            onChange={e => setTripName(e.target.value)}
          />
          <LocationAutocomplete
            label="Destination"
            placeholder={isPublic ? "Where did you go?" : "Where are you planning to go?"}
            value={destination}
            onChange={(d, r, struct) => { 
              setDestination(d); 
              setDestinationRegion(r || d); 
              setDestStructured(struct);
            }}
          />
          
          {/* Hide Stops in Quick Snapshot Mode */}
          {!isSnapshot && (
            <div className="flex flex-col gap-2 border border-border-dark/15 rounded-lg p-4 bg-white/50 animate-in fade-in">
              <Label>{isPublic ? 'Places Visited / Stops' : 'Places to Visit / Stops'} (Optional)</Label>
              <p className="text-xs text-secondary italic">
                {isPublic ? 'Add specific restaurants, cafes, malls, parks, or attractions you visited. This helps others copy your trip.' : 'Add specific restaurants, cafes, malls, parks, or attractions you want to visit.'}
              </p>
              
              {tripStops.map((s) => (
                <div key={s.id} className="relative border-b-2 border-border-dark pb-3 mb-2 pr-10">
                  <button 
                    type="button" 
                    onClick={() => removeTripStop(s.id)}
                    className="absolute right-0 bottom-3 bg-accent-coral text-white font-bold w-8 h-[42px] border border-border-dark/15 rounded-md shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center text-sm"
                    aria-label="Remove stop"
                  >
                    X
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <TextInput 
                      label="Stop Name" 
                      placeholder="e.g. Market Market" 
                      value={s.name} 
                      onChange={e => updateTripStop(s.id, 'name', e.target.value)}
                    />
                    <TextInput 
                      label="Note (Optional)" 
                      placeholder="e.g. Best place for dinner" 
                      value={s.note} 
                      onChange={e => updateTripStop(s.id, 'note', e.target.value)}
                    />
                  </div>
                </div>
              ))}
              
              <button 
                type="button" 
                onClick={addTripStop}
                className="mt-2 py-2 px-4 bg-accent-blue text-white border border-border-dark/15 rounded-md shadow-sm font-bold text-sm self-start hover:-translate-y-0.5 active:translate-y-0 transition-all"
              >
                + Add Stop
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="flex flex-col gap-1 col-span-2">
              <LocationAutocomplete
                label="Origin City / Province"
                placeholder="Where are you from?"
                value={originRegion}
                onChange={(v, _r, struct) => {
                  if (struct && (struct.city || struct.province)) {
                     const broad = struct.city || struct.province || v;
                     setOriginRegion(broad);
                     if (v.length > broad.length && v !== broad && !originAreaState) {
                       setOriginAreaState(v.replace(`, ${broad}`, '').replace(broad, '').replace(/^,\s*/, '').trim()); 
                     }
                  } else {
                     setOriginRegion(v);
                  }
                  setOrigStructured(struct);
                }}
                isOriginMode={true}
              />
              <p className="text-xs text-secondary">Choose the city/province you started from. Do not enter your exact home address.</p>
            </div>
            
            {/* Hide Route details Toggle in Quick Snapshot Mode */}
            {!isSnapshot && (
              <div className="flex flex-col justify-center mt-2 md:mt-0 col-span-2">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="advancedRouteToggle"
                    checked={showAdvancedRoute}
                    onChange={(e) => setShowAdvancedRoute(e.target.checked)}
                    className="w-5 h-5 accent-primary border border-border-dark/15 rounded flex-shrink-0"
                  />
                  <label htmlFor="advancedRouteToggle" className="font-bold text-sm cursor-pointer leading-tight">
                    I want to add advanced route and duration details
                  </label>
                </div>
              </div>
            )}

            {!isSnapshot && showAdvancedRoute && (
              <>
                <div className="flex flex-col gap-1">
                  <TextInput
                    label="Starting Area / Route Start"
                    placeholder="e.g. Ateneo / Katipunan area"
                    value={originAreaState}
                    onChange={(e) => setOriginAreaState(e.target.value)}
                  />
                  <p className="text-xs text-secondary">General area only, not exact home address.</p>
                </div>

                <div className="flex flex-col gap-1">
                  <TextInput
                    label="Ending Area / Route End (Optional)"
                    placeholder="e.g. Bagong Silangan, Cubao"
                    value={endAreaState}
                    onChange={(e) => setEndAreaState(e.target.value)}
                  />
                  <p className="text-xs text-secondary">Optional, but useful if you did not return to the same starting point.</p>
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <TextInput
                    label="Route Context (Optional)"
                    placeholder="e.g. Started at Ateneo, went to BGC, then returned through Cubao to Bagong Silangan."
                    value={routeContextInput}
                    onChange={(e) => setRouteContextInput(e.target.value)}
                  />
                </div>
              </>
            )}

            <TextInput label={`Travel Date ${!isPublic ? '(Optional)' : ''}`} type="date" value={travelDate} onChange={e => setTravelDate(e.target.value)} required={isPublic} />
            <TextInput label={`Group Size (Pax) ${!isPublic ? '(Optional)' : ''}`} type="number" min="1" value={groupSize} onChange={e => setGroupSize(e.target.value)} required={isPublic} />
            <SelectInput label={`Trip Type ${!isPublic ? '(Optional)' : ''}`} value={tripType} onChange={e => setTripType(e.target.value)} options={TRIP_TYPES.map(r => ({ value: r, label: r }))} required={isPublic} />
            
            <div className="flex flex-col gap-1">
              <SelectInput 
                label={isPublic ? "How long did the trip take?" : "How long will the trip take?"} 
                value={tripDurationLabel} 
                onChange={e => setTripDurationLabel(e.target.value)} 
                options={[
                  { value: '', label: 'Select duration...' },
                  { value: '1–2 hours', label: '1–2 hours' },
                  { value: '2–3 hours', label: '2–3 hours' },
                  { value: 'Half-day', label: 'Half-day' },
                  { value: 'Whole day', label: 'Whole day' },
                  { value: 'Night trip', label: 'Night trip' },
                  { value: 'Overnight', label: 'Overnight' },
                  { value: '2 days', label: '2 days' },
                  { value: '3 days+', label: '3 days+' },
                  { value: 'Not sure', label: 'Not sure' }
                ]}
              />
              <p className="text-xs text-secondary">Estimate the actual time spent, including travel time if possible.</p>
            </div>
            
            {/* Calendar Days input only shows for Detailed when showAdvancedRoute is checked. In Snapshot, we assume it is estimated by tripDurationLabel (defaulting to 1 day) */}
            {!isSnapshot && showAdvancedRoute && (
              <div className="flex flex-col gap-1">
                <TextInput label={`Duration (Calendar Days) ${!isPublic ? '(Optional)' : ''}`} type="number" min="1" value={durationDays} onChange={e => setDurationDays(e.target.value)} required={isPublic} />
                {((['1–2 hours', '2–3 hours', 'Half-day', 'Whole day', 'Night trip'].includes(tripDurationLabel) && parseInt(durationDays) > 1) || 
                  (tripDurationLabel === 'Overnight' && parseInt(durationDays) === 1) || 
                  (tripDurationLabel === '2 days' && parseInt(durationDays) !== 2) ||
                  (tripDurationLabel === '3 days+' && parseInt(durationDays) < 3)) && (
                  <p className="text-[10px] font-bold text-accent-coral uppercase tracking-wide">
                    Check duration: you selected &quot;{tripDurationLabel}&quot; but duration is set to {durationDays} day(s).
                  </p>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* SECTION 2 (Costs) */}
      <div className="bg-surface border border-border-dark/15 rounded-lg p-4 shadow-sm">
        <h3 className="bg-accent-yellow inline-block px-2 py-1 font-bold text-sm border border-border-dark/15 rounded mb-4 shadow-sm">
          {isPublic ? 'Real Costs' : 'Estimated Budget'}
        </h3>

        {/* Cost Scope Selector */}
        <div className="flex flex-col gap-2 mb-4 bg-white/40 p-3 border border-border-dark/15 rounded-md">
          <label className="font-bold text-xs uppercase tracking-wider text-secondary">
            Cost Type / Scope
          </label>
          <div className="flex flex-col sm:flex-row gap-4 mt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="costScope"
                value="individual"
                checked={costScope === 'individual'}
                onChange={() => setCostScope('individual')}
                className="w-4 h-4 accent-primary border border-border-dark/15 cursor-pointer"
              />
              <span className="text-sm font-bold text-primary">
                My personal spend only
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="costScope"
                value="group_total"
                checked={costScope === 'group_total'}
                onChange={() => setCostScope('group_total')}
                className="w-4 h-4 accent-primary border border-border-dark/15 cursor-pointer"
              />
              <span className="text-sm font-bold text-primary">
                Total combined group costs <span className="text-xs font-normal text-secondary">(Representing total group spend, not per head)</span>
              </span>
            </label>
          </div>
        </div>
        
        {/* If Snapshot mode, just show a single budget input */}
        {isSnapshot ? (
          <div className="flex flex-col gap-4 animate-in fade-in">
            <TextInput 
              label={costScope === 'individual' ? "Overall Budget (per person) ₱" : "Overall Budget (Group Total) ₱"}
              type="number" 
              min="0" 
              value={targetBudget} 
              onChange={e => setTargetBudget(e.target.value)} 
            />
          </div>
        ) : (
          !isPublic && !showCategoryEstimates ? (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <TextInput 
                label="Overall Target Budget (per person) ₱" 
                type="number" 
                min="0" 
                value={targetBudget} 
                onChange={e => setTargetBudget(e.target.value)} 
              />
              <button
                type="button"
                onClick={() => setShowCategoryEstimates(true)}
                className="text-sm font-bold text-secondary underline self-start hover:text-primary transition-colors"
              >
                [+] I want to estimate by category (Transport, Food, etc.)
              </button>
            </div>
          ) : (
            <div className="animate-in fade-in">
              {!isPublic && (
                <button
                  type="button"
                  onClick={() => setShowCategoryEstimates(false)}
                  className="text-sm font-bold text-secondary underline mb-4 hover:text-primary transition-colors block"
                >
                  [-] Just use a single target budget
                </button>
              )}

              <div className="flex items-center gap-2 mb-4">
                <input 
                  type="checkbox" 
                  id="detailedCostToggle"
                  checked={isDetailedCost}
                  onChange={(e) => setIsDetailedCost(e.target.checked)}
                  className="w-5 h-5 accent-primary border border-border-dark/15 rounded"
                />
                <label htmlFor="detailedCostToggle" className="font-bold text-sm cursor-pointer">
                  I want to enter specific costs (e.g. Bus fare, Train, Lunch)
                </label>
              </div>

              {!isDetailedCost ? (
                <>
                  <p className="text-xs text-secondary mb-4 italic">Breakdown does not need to match exactly if costs were shared unevenly. Select if you are entering your personal spend or the group total.</p>
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <TextInput label="Transport cost ₱" type="number" min="0" value={transportCost} onChange={e => setTransportCost(e.target.value)} />
                      <TextInput label="Food cost ₱" type="number" min="0" value={foodCost} onChange={e => setFoodCost(e.target.value)} />
                      <TextInput label="Activities and entrance fees ₱" type="number" min="0" value={activitiesCost} onChange={e => setActivitiesCost(e.target.value)} />
                      <TextInput label="Accommodation cost ₱ (Enter 0 if day trip)" type="number" min="0" value={accommodationCost} onChange={e => setAccommodationCost(e.target.value)} />
                    </div>
                    
                    <div className="mt-4 p-4 bg-accent-blue/10 border border-accent-blue/30 rounded-md flex flex-col md:flex-row justify-between items-center gap-2">
                      <span className="font-bold text-primary">
                        {costScope === 'individual'
                          ? (isPublic ? 'Personal Spend:' : 'Estimated Personal Spend:')
                          : (isPublic ? 'Group Total Spend:' : 'Estimated Group Total Spend:')}
                      </span>
                      <span className="text-2xl font-black text-accent-blue">
                        ₱{Math.round((parseInt(transportCost) || 0) + (parseInt(foodCost) || 0) + (parseInt(activitiesCost) || 0) + (parseInt(accommodationCost) || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4 border border-border-dark/15 rounded-lg p-4 bg-white/50">
                  <p className="text-xs text-secondary mb-2 italic">List down your specific costs below. We will aggregate them into the respective categories automatically.</p>
                  
                  {detailedCosts.map((c) => (
                    <div key={c.id} className="relative border-b border-border-dark/10 pb-4 mb-3 pr-10">
                      <button 
                        type="button" 
                        onClick={() => removeDetailedCost(c.id)}
                        className="absolute right-0 bottom-4 bg-accent-coral text-white font-bold w-8 h-[42px] border border-border-dark/15 rounded-md shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center text-sm"
                        aria-label="Remove cost item"
                      >
                        X
                      </button>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                        <div className="col-span-1 md:col-span-1">
                          <SelectInput 
                            label="Category" 
                            value={c.category} 
                            onChange={e => updateDetailedCost(c.id, 'category', e.target.value)}
                            options={[
                              {value: 'Transport', label: 'Transport'},
                              {value: 'Food', label: 'Food'},
                              {value: 'Activities', label: 'Activities'},
                              {value: 'Accommodation', label: 'Accommodation'},
                            ]}
                          />
                        </div>
                        <div className="col-span-1 md:col-span-1 md:order-3">
                          <TextInput 
                            label="Amount ₱" 
                            type="number"
                            min="0"
                            placeholder="0" 
                            value={c.amount} 
                            onChange={e => updateDetailedCost(c.id, 'amount', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2 md:col-span-2 md:order-2">
                          <TextInput 
                            label="Description" 
                            placeholder="e.g. Bus to terminal" 
                            value={c.label} 
                            onChange={e => updateDetailedCost(c.id, 'label', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    type="button" 
                    onClick={addDetailedCost}
                    className="mt-2 py-2 px-4 bg-accent-yellow border border-border-dark/15 rounded-md shadow-sm font-bold text-sm self-start hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  >
                    + Add Specific Cost
                  </button>

                  <div className="mt-4 p-4 bg-accent-blue/10 border border-accent-blue/30 rounded-md flex flex-col md:flex-row justify-between items-center gap-2">
                    <span className="font-bold text-primary">
                      {costScope === 'individual'
                        ? (isPublic ? 'Personal Spend:' : 'Estimated Personal Spend:')
                        : (isPublic ? 'Group Total Spend:' : 'Estimated Group Total Spend:')}
                    </span>
                    <span className="text-2xl font-black text-accent-blue">
                      ₱{Math.round(detailedCosts.reduce((sum, c) => sum + (parseInt(c.amount) || 0), 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Missing Route Basis Warning */}
              {((isDetailedCost 
                ? detailedCosts.filter(c => c.category === 'Transport').reduce((sum, c) => sum + (parseInt(c.amount) || 0), 0)
                : parseInt(transportCost) || 0) > 0 && !originAreaState && !endAreaState && !routeContextInput.trim() && !(isDetailedCost && detailedCosts.some(c => c.category === 'Transport' && (parseInt(c.amount) || 0) > 0))) && (
                <div className="mt-4 p-4 bg-accent-yellow/15 border border-accent-yellow/30 rounded-md flex flex-col gap-1">
                  <span className="font-bold text-primary">Missing Route Basis</span>
                  <span className="text-sm font-medium text-secondary">
                    Help others understand this fare. Add a general starting area, ending area, route context, or transport steps.
                  </span>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* SECTION 3 (Photos) */}
      <div className="bg-surface border border-border-dark/15 rounded-lg p-4 shadow-sm">
        <h3 className="bg-accent-yellow inline-block px-2 py-1 font-bold text-sm border border-border-dark/15 rounded mb-4 shadow-sm">
          Photos {!isPublic && '(Optional)'}
        </h3>
        {!isPublic && (
          <p className="text-xs text-secondary mb-4 italic">
            Add inspiration photos, screenshots of maps, or booking references to help you plan!
          </p>
        )}
        <PhotoUploader photos={photos} onChange={setPhotos} minPhotos={isPublic ? (isSnapshot ? 1 : 3) : 0} maxPhotos={10} />
      </div>

      {/* SECTION 4 (Summary, Tips, Style) */}
      {isPublic && (
        <div className="bg-surface border border-border-dark/15 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between cursor-pointer mb-4" onClick={() => setShowHumanLayer(!showHumanLayer)}>
            <h3 className="bg-accent-yellow inline-block px-2 py-1 font-bold text-sm border border-border-dark/15 rounded shadow-sm">
              Description
            </h3>
            <span className="font-bold border border-border-dark/15 rounded px-2">{showHumanLayer ? '-' : '+'}</span>
          </div>
          
          {showHumanLayer && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
              <TextInput label="Short trip summary (Optional)" placeholder="Example: 1-day Rizal trip from QC with cheap food stops and easy commute." value={summary} onChange={e => setSummary(e.target.value)} maxLength={180} />
              <TextAreaInput label="One tip you wish you knew before going (Optional)" placeholder="e.g. Rent a habal-habal instead of hiring a tour van — saves ₱200 per head." value={tip} onChange={e => setTip(e.target.value)} maxLength={300} />
              <SelectInput label="Travel style (Optional)" value={travelStyle} onChange={e => setTravelStyle(e.target.value)} options={[{ value: '', label: 'Select travel style...' }, ...TRAVEL_STYLES.map(r => ({ value: r, label: r }))]} />
            </div>
          )}
        </div>
      )}

      {/* SECTION 5 (Detailed Trip Notes / Itinerary) - Hide in Quick Snapshot Mode */}
      {!isSnapshot && (
        <div className="bg-surface border border-border-dark/15 rounded-lg p-4 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between cursor-pointer mb-4" onClick={() => setShowItinerary(!showItinerary)}>
            <h3 className="bg-accent-yellow inline-block px-2 py-1 font-bold text-sm border border-border-dark/15 rounded shadow-sm">
              {isPublic ? 'Detailed Trip Notes' : 'Planned Itinerary'}
            </h3>
            <span className="font-bold border border-border-dark/15 rounded px-2">{showItinerary ? '-' : '+'}</span>
          </div>
          
          {showItinerary && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
              <p className="text-sm font-bold text-primary bg-primary/10 p-2 border-l-4 border-primary">
                Optional, but this helps others copy your trip.
              </p>
              <TextAreaInput label={isPublic ? "One thing that didn’t go as planned" : "Notes or concerns"} placeholder={isPublic ? "e.g. Don't eat at the port stalls — overpriced and slow" : "Things to watch out for..."} value={honestWarning} onChange={e => setHonestWarning(e.target.value)} />

              <div className="mt-4 flex flex-col gap-6">
                {days.map((day, idx) => (
                  <div key={day.id} className="border border-border-dark/15 rounded-lg p-3 bg-white relative shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold">Day {idx + 1}</h4>
                      {days.length > 1 && (
                        <button type="button" onClick={() => removeDay(day.id)} className="text-xs text-accent-coral font-bold underline">Remove Day</button>
                      )}
                    </div>
                    <div className="flex flex-col gap-3">
                       {day.blocks.map((block) => (
                        <div key={block.id} className="relative w-full pr-8 pb-3 mb-2 border-b border-border-dark border-dashed">
                          {day.blocks.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => removeBlock(day.id, block.id)} 
                              className="absolute right-0 bottom-3 bg-accent-coral text-white font-bold w-6 h-[38px] border border-border-dark/15 rounded-md shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center text-xs"
                              aria-label="Remove activity"
                            >
                              X
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <TextInput placeholder="e.g. 10:00 AM" label="Time / Label" value={block.time_label} onChange={e => updateBlock(day.id, block.id, 'time_label', e.target.value)} />
                            <TextInput placeholder="Activity..." label="Activity" value={block.activity} onChange={e => updateBlock(day.id, block.id, 'activity', e.target.value)} />
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => addBlock(day.id)} className="text-sm font-bold text-accent-blue underline self-start mt-2">+ Add stop/activity</button>
                    </div>
                  </div>
                ))}
                <SecondaryButton type="button" onClick={addDay} className="w-fit">
                  + Add Day
                </SecondaryButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin Curation Tools */}
      {isAdmin && (
        <div className="bg-accent-yellow/10 border border-dashed border-accent-yellow/40 rounded-lg p-4 shadow-sm flex flex-col gap-4 mt-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-accent-yellow text-primary px-2 py-0.5 border border-border-dark/15 rounded shadow-sm">Admin Controls</span>
            <span className="text-xs font-bold text-secondary">Seed / Curation Settings</span>
          </div>
          
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isCurated}
              onChange={(e) => setIsCurated(e.target.checked)}
              className="w-5 h-5 accent-accent-coral border border-border-dark/15 rounded"
            />
            <span className="font-bold text-sm">Is this a curated/seeded trip? (Option B Growth Loop)</span>
          </label>

          {isCurated && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="attributionSource">Attribution Source</Label>
              <TextInput
                id="attributionSource"
                placeholder="e.g. Facebook Group, TikTok @username, Travel Blog URL"
                value={attributionSource}
                onChange={(e) => setAttributionSource(e.target.value)}
              />
              <span className="text-[10px] font-bold text-secondary uppercase">This will be shown on the clean neon banner so authors can claim this trip!</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-accent-coral border border-border-dark/15 rounded-lg p-3 text-white font-bold shadow-sm">
          {error}
        </div>
      )}

      {/* Required fields helper subtext */}
      {showGuidelines && !isSubmissionCompleted && (
        <div className="bg-soft-beige/40 border border-border-dark/10 border-dashed p-4 text-xs text-primary mt-2 rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span className="font-black uppercase tracking-wider text-secondary block mb-2">📋 Submission Guidelines</span>
          {isPublic ? (
            <ul className="list-disc pl-4 space-y-1.5 font-medium leading-relaxed">
              <li className={isBasicsCompleted ? "text-secondary line-through opacity-60 decoration-2" : "text-primary font-bold"}>
                <strong>Basics section:</strong> Destination, Origin, Travel Date, Group Size, Trip Type, and Duration are all required.
              </li>
              {!isEdit && (
                <li className={isPhotosCompleted ? "text-secondary line-through opacity-60 decoration-2" : "text-primary font-bold"}>
                  <strong>Trip Photos:</strong> Upload at least <strong>{isSnapshot ? '1 photo' : '3 photos'}</strong> to share the vibe!
                </li>
              )}
              <li className={isCostsCompleted ? "text-secondary line-through opacity-60 decoration-2" : "text-primary font-bold"}>
                <strong>Real Costs:</strong> {isSnapshot ? 'Enter an overall budget.' : 'Enter at least one transport, food, accommodation, or activity expense.'} Public budgets cannot be ₱0.
              </li>
              {!isSnapshot && (
                <li className="text-secondary opacity-90">
                  <strong>Summary & Tips (Optional):</strong> Adding a summary and a practical tip helps others and contributes towards the premium <strong>Full Access</strong> badge!
                </li>
              )}
            </ul>
          ) : (
            <p className="font-medium leading-relaxed">
              <strong>Draft Mode:</strong> Only the <strong>Destination</strong> is required to save a private draft in your Locker.
            </p>
          )}
        </div>
      )}

      <PrimaryButton type="submit" disabled={loading} className="py-4 text-lg mt-2">
        {isPublic ? (
          loading ? 'Submitting & Uploading...' : (isEdit ? 'Update Trip' : 'Submit Trip')
        ) : (
          loading ? 'Saving Draft...' : (isEdit ? 'Save Changes' : 'Save Draft')
        )}
      </PrimaryButton>
    </form>
  );
}

