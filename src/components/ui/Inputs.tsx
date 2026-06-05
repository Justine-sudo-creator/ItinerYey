import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function Label({ children, className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`font-bold text-sm text-primary mb-1 block ${className}`} {...props}>
      {children}
    </label>
  );
}

export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-accent-coral text-xs font-bold mt-1">{error}</p>;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function TextInput({ label, error, className = '', type, ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`flex flex-col ${className}`}>
      {label && <Label>{label}</Label>}
      <div className="relative w-full flex items-center">
        <input
          type={inputType}
          className="w-full bg-surface border-2 border-border-dark rounded-sm pl-2 md:pl-3 pr-10 py-1.5 md:py-2 text-xs md:text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue transition-shadow"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 text-secondary/60 hover:text-primary transition-colors focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
      <FieldError error={error} />
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function SelectInput({ label, error, options, className = '', ...props }: SelectProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && <Label>{label}</Label>}
      <select
        className="bg-surface border-2 border-border-dark rounded-sm px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue transition-shadow"
        {...props}
      >
        <option value="" disabled>Select option</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <FieldError error={error} />
    </div>
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function TextAreaInput({ label, error, className = '', ...props }: TextAreaProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && <Label>{label}</Label>}
      <textarea
        className="bg-surface border-2 border-border-dark rounded-sm px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue transition-shadow"
        {...props}
      />
      <FieldError error={error} />
    </div>
  );
}
