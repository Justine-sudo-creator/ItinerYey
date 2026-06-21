'use client';

import React, { useState } from 'react';

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQAccordionItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-2 border-border-dark bg-surface shadow-hard-sm mb-3 transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left p-4 flex items-center justify-between font-bold text-primary hover:bg-accent-yellow/10 transition-colors"
      >
        <span className="text-sm md:text-base font-display">{question}</span>
        <span className="text-lg md:text-xl font-mono ml-4 select-none">
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen && (
        <div className="p-4 border-t-2 border-border-dark bg-soft-beige/30 text-xs md:text-sm text-primary/80 leading-relaxed font-semibold">
          {answer}
        </div>
      )}
    </div>
  );
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  const faqs = [
    {
      question: 'Do I need an account to browse routes?',
      answer: 'No. Anyone can search and view commute routes without signing in. You only need an account to submit routes, verify fares, or manage your contributions.',
    },
    {
      question: 'How do I submit a commute route?',
      answer: 'Sign in, go to Submit, pin your origin and destination on the map, add each transport segment with boarding/drop-off landmarks, and publish. Your route goes live immediately — no admin approval needed.',
    },
    {
      question: 'How can I edit or delete my routes?',
      answer: 'Open your Profile tab to see all routes you submitted. Use Edit to update segments, fares, or tips. Use Delete to remove a route permanently.',
    },
    {
      question: 'What does the confidence score mean?',
      answer: 'The confidence score reflects recent community feedback. When commuters confirm a route is still accurate, the score goes up. Reports of fare changes or invalid routes lower it.',
    },
    {
      question: 'Why use Street View on stops?',
      answer: 'Each boarding and drop-off point has a Street View button so you can visually confirm the landmark before or during your commute.',
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      />

      <div className="relative w-full max-w-3xl max-h-[85vh] bg-soft-beige border-4 border-border-dark shadow-hard flex flex-col z-10 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 md:p-6 border-b-4 border-border-dark bg-accent-yellow">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-border-dark bg-surface font-black text-sm shadow-hard-sm">?</span>
            <h2 className="text-xl md:text-2xl font-black font-display tracking-tight text-primary uppercase">How It Works</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 md:w-10 md:h-10 border-2 border-border-dark bg-surface shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center font-bold text-sm"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 select-text">
          <div>
            <h3 className="text-base md:text-lg font-black font-display text-primary uppercase tracking-wider mb-4 border-b-2 border-border-dark pb-1">
              How ItinerYey Works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-2 border-border-dark bg-surface p-4 shadow-hard-sm flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-accent-coral text-primary border border-border-dark rounded-sm w-fit">
                  Browse
                </span>
                <h4 className="font-bold text-sm md:text-base text-primary">Find Routes</h4>
                <p className="text-xs text-primary/80 leading-relaxed font-semibold">
                  Search crowd-sourced commute routes with fares, boarding points, and step-by-step breakdowns.
                </p>
              </div>
              <div className="border-2 border-border-dark bg-surface p-4 shadow-hard-sm flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-accent-yellow text-primary border border-border-dark rounded-sm w-fit">
                  Submit
                </span>
                <h4 className="font-bold text-sm md:text-base text-primary">Share Your Commute</h4>
                <p className="text-xs text-primary/80 leading-relaxed font-semibold">
                  Log in and publish routes instantly. Pin landmarks on the map so others know exactly where to board.
                </p>
              </div>
              <div className="border-2 border-border-dark bg-surface p-4 shadow-hard-sm flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-green-600 text-white border border-border-dark rounded-sm w-fit">
                  Verify
                </span>
                <h4 className="font-bold text-sm md:text-base text-primary">Keep Routes Accurate</h4>
                <p className="text-xs text-primary/80 leading-relaxed font-semibold">
                  Took this route recently? Confirm it&apos;s still valid or flag fare and boarding changes.
                </p>
              </div>
              <div className="border-2 border-border-dark bg-surface p-4 shadow-hard-sm flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-accent-blue text-primary border border-border-dark rounded-sm w-fit">
                  Profile
                </span>
                <h4 className="font-bold text-sm md:text-base text-primary">Manage Your Routes</h4>
                <p className="text-xs text-primary/80 leading-relaxed font-semibold">
                  Edit or delete routes you submitted. Get notified when others leave feedback on your routes.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-base md:text-lg font-black font-display text-primary uppercase tracking-wider mb-4 border-b-2 border-border-dark pb-1">
              Frequently Asked Questions
            </h3>
            <div className="space-y-1">
              {faqs.map((faq, index) => (
                <FAQAccordionItem key={index} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t-2 border-border-dark bg-surface flex justify-end gap-3">
          <button
            onClick={onClose}
            className="text-xs font-bold uppercase tracking-wider border-2 border-border-dark px-4 py-2 bg-accent-coral text-primary shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
