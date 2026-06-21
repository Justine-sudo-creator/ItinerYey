'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Route, RouteSegment } from '@/types/supabase';
import { ShieldCheck, MapPin, Calendar, AlertTriangle, CheckCircle, ThumbsUp, Lightbulb, Pencil } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { TripSummaryCard } from './TripSummaryCard';
import { RouteLegCard } from './RouteLegCard';
import { TransferConnector } from './TransferConnector';
import { RouteMapCollapsible } from './RouteMapCollapsible';
import { buildTripSummary, sortSegments } from '@/lib/routeSummary';
import { getNextStepText, getFinalArrivalText } from '@/lib/routeDisplay';

interface RouteDetailViewProps {
  route: Route;
  segments: RouteSegment[];
  currentUserId: string | null;
}

export function RouteDetailView({ route, segments, currentUserId }: RouteDetailViewProps) {
  const supabase = createClient();
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(!!currentUserId);

  const isOwner = !!currentUserId && currentUserId === route.user_id;
  const loginReturnTo = `/login?returnTo=${encodeURIComponent(`/route/${route.id}`)}`;

  const [activeAction, setActiveAction] = useState<'fare_changed' | 'boarding_point_changed' | 'unavailable' | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!currentUserId) {
      setIsVerified(false);
      setCheckingVerification(false);
      return;
    }

    let cancelled = false;

    const checkExistingVerification = async () => {
      const { data } = await supabase
        .from('route_verifications')
        .select('id')
        .eq('route_id', route.id)
        .eq('user_id', currentUserId)
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setIsVerified(!!data);
        setCheckingVerification(false);
      }
    };

    checkExistingVerification();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, route.id, supabase]);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const verifiedMonth = route.travel_date_month ? monthNames[route.travel_date_month - 1] : '';
  const verifiedYear = route.travel_date_year || '';

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100 border-green-200';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const confidenceClass = getConfidenceColor(route.confidence_score || 50);

  const sortedSegments = useMemo(() => sortSegments(segments), [segments]);
  const tripSummary = useMemo(() => buildTripSummary(route, segments), [route, segments]);

  const groupedLegs = useMemo(() => {
    const legs: { segments: RouteSegment[], startIndex: number }[] = [];
    if (sortedSegments.length === 0) return legs;

    let currentLeg: RouteSegment[] = [sortedSegments[0]];
    let currentStartIndex = 0;

    for (let i = 1; i < sortedSegments.length; i++) {
      const seg = sortedSegments[i];
      const prevSeg = currentLeg[currentLeg.length - 1];

      if (seg.transport_type === prevSeg.transport_type && seg.signboard === prevSeg.signboard) {
        currentLeg.push(seg);
      } else {
        legs.push({ segments: currentLeg, startIndex: currentStartIndex });
        currentLeg = [seg];
        currentStartIndex = i;
      }
    }
    legs.push({ segments: currentLeg, startIndex: currentStartIndex });

    return legs;
  }, [sortedSegments]);

  // Precompute coordinate grouping for segment circles to match map markers
  const pointsMap: {
    [key: string]: {
      roles: Array<{ role: 'origin' | 'destination' | 'boarding' | 'drop_off'; segmentIndex?: number }>;
    }
  } = {};

  const addPointToMap = (
    lat: number | null | undefined,
    lng: number | null | undefined,
    role: 'origin' | 'destination' | 'boarding' | 'drop_off',
    segmentIndex?: number
  ) => {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return;
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (!pointsMap[key]) {
      pointsMap[key] = { roles: [] };
    }
    pointsMap[key].roles.push({ role, segmentIndex });
  };

  addPointToMap(route.origin_lat, route.origin_lng, 'origin');
  segments.forEach((seg, idx) => {
    addPointToMap(seg.boarding_lat, seg.boarding_lng, 'boarding', idx);
    addPointToMap(seg.drop_off_lat, seg.drop_off_lng, 'drop_off', idx);
  });
  addPointToMap(route.destination_lat, route.destination_lng, 'destination');

  const getMarkerStyleAndText = (
    lat: number | null | undefined,
    lng: number | null | undefined,
    defaultRole: 'boarding' | 'drop_off',
    defaultIndex: number
  ) => {
    const roleColors = {
      origin: '#3B82F6',       // Blue
      destination: '#8B5CF6',  // Purple
      boarding: '#F59E0B',     // Yellow
      drop_off: '#FF5A5F'      // Coral
    };

    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      return {
        background: roleColors[defaultRole],
        text: String(defaultIndex + 1)
      };
    }

    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const point = pointsMap[key];
    if (!point) {
      return {
        background: roleColors[defaultRole],
        text: String(defaultIndex + 1)
      };
    }

    // Determine background style
    const uniqueColors = Array.from(new Set(point.roles.map(r => roleColors[r.role])));
    let background = '';
    if (uniqueColors.length === 1) {
      background = uniqueColors[0];
    } else if (uniqueColors.length === 2) {
      background = `linear-gradient(135deg, ${uniqueColors[0]} 50%, ${uniqueColors[1]} 50%)`;
    } else {
      background = `conic-gradient(${uniqueColors.map((c, i) => `${c} ${i * (360 / uniqueColors.length)}deg ${(i + 1) * (360 / uniqueColors.length)}deg`).join(', ')})`;
    }

    // Determine display text
    const labelSet = new Set<string>();
    point.roles.forEach(r => {
      if (r.role === 'origin') labelSet.add('O');
      else if (r.role === 'destination') labelSet.add('D');
      else if (r.role === 'boarding' || r.role === 'drop_off') {
        labelSet.add(String(r.segmentIndex! + 1));
      }
    });
    const text = Array.from(labelSet).join('•');

    return { background, text };
  };

  // Generate Google Maps Directions URL for the entire commute by sequencing points chronologically
  const coordList: { lat: number; lng: number }[] = [];
  
  if (route.origin_lat && route.origin_lng) {
    coordList.push({ lat: route.origin_lat, lng: route.origin_lng });
  }
  
  sortedSegments.forEach(seg => {
    if (seg.boarding_lat && seg.boarding_lng) {
      coordList.push({ lat: seg.boarding_lat, lng: seg.boarding_lng });
    }
    if (seg.drop_off_lat && seg.drop_off_lng) {
      coordList.push({ lat: seg.drop_off_lat, lng: seg.drop_off_lng });
    }
  });

  if (route.destination_lat && route.destination_lng) {
    coordList.push({ lat: route.destination_lat, lng: route.destination_lng });
  }

  // Deduplicate consecutive identical coordinates
  const uniqueCoords: { lat: number; lng: number }[] = [];
  coordList.forEach(coord => {
    if (uniqueCoords.length === 0) {
      uniqueCoords.push(coord);
    } else {
      const last = uniqueCoords[uniqueCoords.length - 1];
      const isIdentical = Math.abs(last.lat - coord.lat) < 0.0001 && Math.abs(last.lng - coord.lng) < 0.0001;
      if (!isIdentical) {
        uniqueCoords.push(coord);
      }
    }
  });

  // Construct URL using deduplicated coordinates
  let googleMapsUrl = '';
  if (uniqueCoords.length >= 2) {
    const origin = uniqueCoords[0];
    const destination = uniqueCoords[uniqueCoords.length - 1];
    const waypoints = uniqueCoords.slice(1, -1);
    const waypointsParam = waypoints.map(w => `${w.lat},${w.lng}`).join('|');
    googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointsParam ? `&waypoints=${waypointsParam}` : ''}`;
  } else if (uniqueCoords.length === 1) {
    googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${uniqueCoords[0].lat},${uniqueCoords[0].lng}`;
  }

  const requireAuthForFeedback = (): boolean => {
    if (currentUserId) return true;
    setErrorMsg('Please sign in to submit feedback on this route.');
    return false;
  };

  const handleImmediateVerification = async (type: 'accurate') => {
    if (!requireAuthForFeedback()) return;

    setSubmittingVerification(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('route_verifications').insert({
        route_id: route.id,
        user_id: currentUserId,
        verification_type: type,
        new_fare: null,
        notes: 'Verified accurate by commuter'
      });

      if (error) throw error;

      setIsVerified(true);
      setVerificationFeedback('Thank you! Your feedback has been recorded.');
      setTimeout(() => setVerificationFeedback(''), 5000);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Failed to record verification: ' + ((err as Error).message || String(err)));
    } finally {
      setSubmittingVerification(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAction) return;
    if (!requireAuthForFeedback()) return;

    setSubmittingVerification(true);
    setErrorMsg('');
    try {
      let newFare: number | null = null;
      let notes: string | null = null;

      if (activeAction === 'fare_changed') {
        const parsed = parseFloat(inputValue);
        if (isNaN(parsed) || parsed < 0) {
          setErrorMsg('Please enter a valid numeric fare.');
          setSubmittingVerification(false);
          return;
        }
        newFare = parsed;
      } else {
        const trimmed = inputValue.trim();
        if (!trimmed) {
          setErrorMsg('Please write a brief explanation to help others.');
          setSubmittingVerification(false);
          return;
        }
        notes = trimmed;
      }

      const { error } = await supabase.from('route_verifications').insert({
        route_id: route.id,
        user_id: currentUserId,
        verification_type: activeAction,
        new_fare: newFare,
        notes: notes
      });

      if (error) throw error;

      setIsVerified(true);
      setActiveAction(null);
      setInputValue('');
      setVerificationFeedback('Thank you! Your feedback has been recorded.');
      setTimeout(() => setVerificationFeedback(''), 5000);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Failed to record verification: ' + ((err as Error).message || String(err)));
    } finally {
      setSubmittingVerification(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-12 pt-6">
      
      {/* Header Section */}
      <div className="bg-surface border border-border-dark p-6 rounded-xl shadow-hard relative">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col gap-2 min-w-0">
            <h1 className="font-display font-black text-2xl md:text-3xl text-primary leading-tight flex items-center flex-wrap gap-2">
              <MapPin className="w-7 h-7 text-accent-coral shrink-0" />
              <span>{route.origin}</span>
              <span className="text-secondary opacity-50">{"\u2192"}</span>
              <span>{route.destination}</span>
            </h1>
          </div>
          
          <div className={`px-3 py-2 rounded-lg border shadow-sm flex items-center gap-2 shrink-0 ${confidenceClass}`}>
            <ShieldCheck className="w-4 h-4" />
            <div className="flex flex-col">
              <span className="font-black text-sm leading-none">{route.confidence_score || 50}%</span>
              <span className="text-[9px] uppercase font-bold tracking-wider leading-none opacity-80 mt-0.5">Confidence</span>
            </div>
          </div>
        </div>

        <TripSummaryCard summary={tripSummary} />

        <div className="pt-3 mt-3 border-t border-border-dark/10 flex flex-wrap items-center justify-between gap-2 text-xs text-secondary font-medium">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Last verified on <strong className="text-primary">{verifiedMonth} {verifiedYear}</strong></span>
          </div>
          {isOwner && (
            <Link
              href={`/route/${route.id}/edit`}
              className="inline-flex items-center gap-1.5 text-xs font-bold border-2 border-border-dark px-3 py-1.5 bg-accent-yellow hover:bg-accent-yellow/80 text-primary rounded-sm shadow-hard-sm transition-all"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit Route
            </Link>
          )}
        </div>
      </div>

      {/* Segments Breakdown — primary content, above map */}
      <div>
        <h2 className="text-xl font-display font-black text-primary mb-3">Route Breakdown</h2>
        <div className="flex flex-col gap-2 relative">
          <div className="absolute left-6 top-6 bottom-6 w-1 bg-border-dark/20 z-0 hidden sm:block" />

          {groupedLegs.map((leg, legIdx) => {
            const isLastLeg = legIdx === groupedLegs.length - 1;
            const lastSegmentInLeg = leg.segments[leg.segments.length - 1];

            return (
              <React.Fragment key={`leg-${leg.startIndex}`}>
                <RouteLegCard
                  legSegments={leg.segments}
                  startIndex={leg.startIndex}
                  getMarkerIndicator={getMarkerStyleAndText}
                />
                {isLastLeg && (
                  <TransferConnector
                    text={getFinalArrivalText(route.destination, lastSegmentInLeg)}
                  />
                )}
              </React.Fragment>
            );
          })}

          {route.destination_tip && (
            <div className="mt-2 flex gap-2 items-start bg-accent-yellow/10 border border-accent-yellow/40 rounded-lg px-4 py-3 ml-0 sm:ml-16">
              <Lightbulb className="w-4 h-4 shrink-0 text-accent-yellow mt-0.5" />
              <div>
                <p className="text-[10px] uppercase font-bold text-secondary tracking-wider">Destination Tip</p>
                <p className="text-sm font-semibold text-primary leading-snug">{route.destination_tip}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Route Map — demoted, collapsible */}
      <RouteMapCollapsible route={route} segments={segments} googleMapsUrl={googleMapsUrl} />

      {/* Community Notes */}
      {route.community_notes && (
        <div>
          <h2 className="text-lg font-display font-black text-primary mb-3">Extra Notes</h2>
          <div className="bg-[#E5D3C3] border-4 border-[#785942] rounded-lg p-4 md:p-5 shadow-hard bg-[radial-gradient(#cbb09c_2px,transparent_2px)] [background-size:16px_16px]">
            <div className="bg-[#FAFAF9] text-[#292524] p-4 shadow-md border border-black/10 rotate-[-1deg] font-medium text-sm leading-relaxed whitespace-pre-wrap relative">
              <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 z-20 text-sm drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.35)] select-none">
                📌
              </div>
              {route.community_notes}
            </div>
          </div>
        </div>
      )}

      {/* Crowdsourced Verification / Help Out */}
      <div className="mt-4">
        {!currentUserId ? (
          <div className="bg-soft-beige border-2 border-border-dark p-6 rounded-md shadow-hard text-center">
            <h3 className="font-display font-black text-lg text-primary mb-2">
              Took this route recently?
            </h3>
            <p className="text-sm font-medium text-secondary mb-4">
              Sign in to verify fares, flag changes, or confirm this route is still accurate.
            </p>
            <Link href={loginReturnTo}>
              <PrimaryButton className="py-2.5 px-6">Sign in to give feedback</PrimaryButton>
            </Link>
          </div>
        ) : checkingVerification ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border-dark" />
          </div>
        ) : isVerified ? (
          <div className="flex flex-col items-center justify-center p-4">
            {verificationFeedback && (
              <div className="mb-3 bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded font-bold text-sm flex items-center gap-2 animate-pulse">
                <ThumbsUp className="w-4 h-4" /> {verificationFeedback}
              </div>
            )}
            <button
              onClick={() => {
                setIsVerified(false);
                setActiveAction(null);
                setInputValue('');
              }}
              className="text-xs font-bold text-secondary hover:text-primary underline flex items-center gap-1.5 bg-soft-beige/50 border border-border-dark/20 px-4 py-2 rounded-sm transition-all hover:bg-soft-beige active:translate-y-[1px]"
            >
              Update or Verify Route Status Again
            </button>
          </div>
        ) : (
          <div className="bg-soft-beige border-2 border-border-dark p-6 rounded-md shadow-hard">
            <h3 className="font-display font-black text-xl text-primary mb-2 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Did you take this route recently?
            </h3>
            <p className="text-sm font-medium text-secondary mb-6">
              Help the community by verifying if this route is still active, or if any fares/boarding spots changed.
            </p>

            {verificationFeedback && (
              <div className="mb-4 bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded font-bold text-sm flex items-center gap-2">
                <ThumbsUp className="w-4 h-4" /> {verificationFeedback}
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded font-bold text-xs">
                ⚠️ {errorMsg}
              </div>
            )}

            {activeAction === null ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PrimaryButton 
                  disabled={submittingVerification}
                  onClick={() => handleImmediateVerification('accurate')} 
                  className="flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 border-green-800 text-white shadow-hard-sm"
                >
                  <ShieldCheck className="w-5 h-5" /> Route is still accurate
                </PrimaryButton>
                
                <SecondaryButton 
                  disabled={submittingVerification}
                  onClick={() => { setActiveAction('fare_changed'); setInputValue(''); setErrorMsg(''); }}
                  className="flex items-center justify-center gap-2 py-3"
                >
                  <AlertTriangle className="w-4 h-4 text-accent-coral" /> Fare changed
                </SecondaryButton>
                
                <SecondaryButton 
                  disabled={submittingVerification}
                  onClick={() => { setActiveAction('boarding_point_changed'); setInputValue(''); setErrorMsg(''); }}
                  className="flex items-center justify-center gap-2 py-3"
                >
                  <MapPin className="w-4 h-4 text-accent-yellow" /> Boarding spot moved
                </SecondaryButton>
                
                <SecondaryButton 
                  disabled={submittingVerification}
                  onClick={() => { setActiveAction('unavailable'); setInputValue(''); setErrorMsg(''); }}
                  className="flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                >
                  <AlertTriangle className="w-4 h-4 text-red-600" /> Route no longer valid
                </SecondaryButton>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="bg-white border-2 border-border-dark p-5 rounded-md shadow-hard-sm animate-in fade-in zoom-in-95 duration-200">
                <p className="font-bold text-sm mb-3 text-primary">
                  {activeAction === 'fare_changed' 
                    ? "What is the new total fare for this complete commute?" 
                    : activeAction === 'boarding_point_changed'
                    ? "Provide details about where the boarding landmark moved:" 
                    : "Briefly explain why this route is no longer valid/available:"}
                </p>
                
                {activeAction === 'fare_changed' ? (
                  <div className="relative w-full max-w-xs mb-4">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-secondary text-sm">₱</span>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="0.00"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full bg-soft-beige border-2 border-border-dark rounded-sm pl-8 pr-3 py-2 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-accent-coral"
                    />
                  </div>
                ) : (
                  <textarea
                    required
                    rows={3}
                    placeholder={activeAction === 'boarding_point_changed' 
                      ? "e.g., The terminal has transferred across the street in front of the bakery..." 
                      : "e.g., The modern jeeps serving this line are currently on strike/restructured..."}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full bg-soft-beige border-2 border-border-dark rounded-sm p-3 text-sm font-medium mb-4 focus:outline-none focus:ring-1 focus:ring-accent-coral"
                  />
                )}

                <div className="flex gap-2">
                  <PrimaryButton 
                    type="submit" 
                    disabled={submittingVerification}
                    className="py-1.5 px-5 text-xs font-bold"
                  >
                    {submittingVerification ? 'Submitting...' : 'Submit Update'}
                  </PrimaryButton>
                  <SecondaryButton 
                    type="button" 
                    onClick={() => { setActiveAction(null); setErrorMsg(''); setInputValue(''); }}
                    className="py-1.5 px-5 text-xs font-bold"
                  >
                    Cancel
                  </SecondaryButton>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
