'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { PrimaryButton } from '@/components/ui/Button';
import { AlertCircle, X } from 'lucide-react';

type PriceAuditModalProps = {
  tripId: string;
  onClose: () => void;
  tripOwnerId?: string;
  tripDestination?: string;
};

export default function PriceAuditModal({ tripId, onClose, tripOwnerId, tripDestination }: PriceAuditModalProps) {
  const [category, setCategory] = useState<'Transport' | 'Food' | 'Activities' | 'Accommodation'>('Transport');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage({ type: 'error', text: 'You must be logged in to suggest an audit.' });
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('trip_price_suggestions')
      .insert({
        trip_id: tripId,
        suggested_by_user_id: user.id,
        category,
        suggested_amount: parseFloat(amount),
        reason
      });

    if (error) {
      setMessage({ type: 'error', text: error.message });
      setIsSubmitting(false);
    } else {
      // Notify the trip owner of the price suggestion
      if (tripOwnerId && tripOwnerId !== user.id) {
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', user.id)
            .single();

          const actorName = profile?.display_name || 'Someone';

          await supabase
            .from('notifications')
            .insert({
              user_id: tripOwnerId,
              actor_id: user.id,
              type: 'trip_price_audit',
              title: 'Price Audit Suggested!',
              message: `${actorName} suggested a price update on your trip to ${tripDestination || 'your destination'}.`,
              link: `/trip/${tripId}/edit`
            });
        } catch (notifErr) {
          console.error('Failed to insert price suggestion notification:', notifErr);
        }
      }

      setMessage({ type: 'success', text: 'Thank you! Your price audit suggestion has been submitted.' });
      setIsSubmitting(false);
      setTimeout(onClose, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface w-full max-w-md border-4 border-border-dark shadow-hard p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 p-1 hover:bg-black/10 rounded-sm transition-colors"
        >
          <X className="w-5 h-5 text-primary" />
        </button>

        <h2 className="text-xl font-black uppercase tracking-tight mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-accent-coral" /> Suggest Price Update
        </h2>
        <p className="text-xs text-secondary mb-6 font-bold uppercase tracking-wider">
          Help the community keep trip costs accurate!
        </p>

        {message?.type === 'success' ? (
          <div className="bg-accent-green/20 text-green-800 p-4 border-2 border-green-800 font-bold text-sm text-center">
            {message.text}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {message?.type === 'error' && (
              <div className="bg-accent-coral/20 text-accent-coral p-3 border-2 border-accent-coral font-bold text-xs">
                {message.text}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-primary">Category</label>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="border-2 border-border-dark px-3 py-2 text-sm focus:outline-none focus:border-primary font-medium"
              >
                <option value="Transport">Transport</option>
                <option value="Food">Food</option>
                <option value="Activities">Activities</option>
                <option value="Accommodation">Accommodation</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-primary">Suggested New Amount (₱)</label>
              <input 
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 1500"
                min="0"
                required
                className="border-2 border-border-dark px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-primary">Reason for update</label>
              <textarea 
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Bus fare recently increased from 1200 to 1500"
                required
                rows={3}
                className="border-2 border-border-dark px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="mt-2">
              <PrimaryButton type="submit" disabled={isSubmitting} className="w-full py-3">
                {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
              </PrimaryButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
