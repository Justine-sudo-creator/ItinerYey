'use client';

import React, { useState, useRef, useEffect } from 'react';
import { TextInput } from './Inputs';

export type StructuredLocation = {
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  province: string | null;
  country: string | null;
};

type LocationAutocompleteProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string, region: string, structured: StructuredLocation | null) => void;
  error?: string;
  isOriginMode?: boolean;
};

type Option = {
  id: string;
  name: string;
  region: string;
  source: 'local' | 'api' | 'custom';
  structured?: StructuredLocation;
};

export function LocationAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  error,
  isOriginMode = false
}: LocationAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchOptions = async (query: string) => {
    if (!query || query.length < 2) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}${isOriginMode ? '&isOrigin=true' : ''}`);
      if (response.ok) {
        const results = await response.json();
        const mappedOptions: Option[] = results.map((res: { id: string; name: string; region: string; source: string; shortName: string; structured?: { city?: string | null; province?: string | null } }) => {
          let name = res.name;
          let displayRegion = res.region;
          
          if (isOriginMode && res.source === 'osm') {
            name = res.shortName;
            displayRegion = res.structured?.city || res.structured?.province || res.region;
          }
          
          return {
            id: res.id,
            name: name,
            region: displayRegion,
            source: res.source === 'psgc' ? 'local' : 'api',
            structured: res.structured
          };
        });
        setOptions(mappedOptions);
      }
    } catch (error) {
      console.error('Failed to fetch locations', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val, '', null); // Update parent state immediately with what they type
    setIsOpen(true);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (val.length < 2) {
      setOptions([]);
    } else {
      debounceRef.current = setTimeout(() => {
        fetchOptions(val);
      }, 300); // 300ms debounce — same for both origin and destination
    }
  };

  const handleSelect = (opt: Option) => {
    onChange(opt.name, opt.region, opt.structured || null);
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col gap-4" ref={wrapperRef}>
      <div className="relative">
        <TextInput
          label={label}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true);
            if (!options.length && value) fetchOptions(value);
          }}
          error={error}
          autoComplete="off"
        />
        
        {isOpen && value && (
          <div className="absolute z-10 w-full mt-1 bg-surface border-2 border-border-dark shadow-hard max-h-60 overflow-y-auto">
            {options.length > 0 ? (
              <ul className="py-1">
                {options.map((opt) => (
                  <li
                    key={opt.id + opt.source}
                    className="px-4 py-2 hover:bg-accent-blue hover:text-white cursor-pointer transition-colors"
                    onClick={() => handleSelect(opt)}
                  >
                    <div className="font-bold text-sm">
                       {opt.source === 'api' ? '📍 ' : '⭐ '}{opt.name}
                    </div>
                    {opt.region && <div className="text-xs opacity-80">{opt.region}</div>}
                  </li>
                ))}
                {loading && (
                   <li className="px-4 py-2 text-xs italic opacity-70">Searching Map API...</li>
                )}
              </ul>
            ) : (
              <ul className="py-1">
                {loading ? (
                   <li className="px-4 py-2 text-xs italic opacity-70">Searching Map API...</li>
                ) : (
                  <li className="px-4 py-2 text-xs text-secondary italic opacity-70">
                    No results found. Try a different spelling or a more specific name.
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
