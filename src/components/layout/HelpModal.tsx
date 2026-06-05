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
      question: "What is a Vouch?",
      answer: "A vouch is a vote of confidence from other travelers. It shows that they have met you, traveled with you, or found your shared itineraries highly accurate. More vouches build your credibility index, making other travelers more confident to join your hosted meetups."
    },
    {
      question: "How is my trip's helpfulness score calculated?",
      answer: "Your trip completeness or helpfulness score is calculated dynamically based on details provided. Uploading photos adds 20%, writing honest warnings adds 20%, sharing travel tips adds 20%, itemizing costs adds 20%, and scheduling meetups/day itineraries adds the rest. Detailed trips look premium in the feed!"
    },
    {
      question: "What is the difference between a Detailed Guide and a Budget Snapshot?",
      answer: "Detailed Guides are comprehensive trip itineraries with photos, tips, itemized costs, and structured timelines. They are marked with a green checkmark icon in the feed. Budget Snapshots are minimalist guides that focus purely on the baseline cost and location details, marked with a gray dot icon."
    },
    {
      question: "Are meetup coordinates secure?",
      answer: "Yes, when you join a meetup, you gain access to the coordination board. The host can provide detailed meeting points, coordinates, and exact schedules, which are only viewable by accepted participants."
    },
    {
      question: "How can I edit my submitted itineraries?",
      answer: "Go to your Profile tab, click on any of your shared trips, and use the 'Edit' action at the top of the detail page to update budget items, descriptions, or change meetup info."
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-soft-beige border-4 border-border-dark shadow-hard flex flex-col z-10 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b-4 border-border-dark bg-accent-yellow">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-border-dark bg-surface font-black text-sm shadow-hard-sm">?</span>
            <h2 className="text-xl md:text-2xl font-black font-display tracking-tight text-primary uppercase">How It Works & FAQ</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 md:w-10 md:h-10 border-2 border-border-dark bg-surface shadow-hard-sm hover:translate-y-0.5 hover:shadow-none active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all flex items-center justify-center font-bold text-sm"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 select-text">
          
          {/* Section 1: Core Mechanics */}
          <div>
            <h3 className="text-base md:text-lg font-black font-display text-primary uppercase tracking-wider mb-4 border-b-2 border-border-dark pb-1">
              Core Platform Mechanics
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Trip Tiers */}
              <div className="border-2 border-border-dark bg-surface p-4 shadow-hard-sm flex flex-col gap-2">
                 <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-[#10B981] text-white border border-border-dark shadow-[1px_1px_0px_#000]">
                    ✓ Detailed Guide
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-white text-gray-400 border border-border-dark shadow-[1px_1px_0px_#000]">
                    • Snapshot
                  </span>
                </div>
                <h4 className="font-bold text-sm md:text-base text-primary">Visual Trip Tiers</h4>
                <p className="text-xs text-primary/80 leading-relaxed font-semibold">
                  Submit comprehensive guides with photos, tips, and itemized costs to unlock the premium green checkmark **Detailed Guide** icon. Basic submissions appear as **Budget Snapshots** with a gray dot.
                </p>
              </div>

              {/* Card 2: Vouch System */}
              <div className="border-2 border-border-dark bg-surface p-4 shadow-hard-sm flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-accent-coral text-primary border border-border-dark rounded-sm">
                    Vouches
                  </span>
                </div>
                <h4 className="font-bold text-sm md:text-base text-primary">Trust & Credibility</h4>
                <p className="text-xs text-primary/80 leading-relaxed font-semibold">
                  Get vouched by other users on your profile page to grow your credibility score. Highly vouched members receive badges and gain priority when coordinating group meetups.
                </p>
              </div>

              {/* Card 3: Meetups */}
              <div className="border-2 border-border-dark bg-surface p-4 shadow-hard-sm flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-accent-blue text-primary border border-border-dark rounded-sm">
                    Meetups
                  </span>
                </div>
                <h4 className="font-bold text-sm md:text-base text-primary">Coordinate Trips</h4>
                <p className="text-xs text-primary/80 leading-relaxed font-semibold">
                  Create public or private meetups on top of itineraries. Discuss meeting coordinates, passenger count, and schedules inside the coordination board.
                </p>
              </div>

              {/* Card 4: Badges */}
              <div className="border-2 border-border-dark bg-surface p-4 shadow-hard-sm flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-accent-yellow text-primary border border-border-dark rounded-sm">
                    Badges
                  </span>
                </div>
                <h4 className="font-bold text-sm md:text-base text-primary">Earn Reputation</h4>
                <p className="text-xs text-primary/80 leading-relaxed font-semibold">
                  Unlock achievements such as **Local Explorer**, **Budget Guru**, and **Super Host** based on how helpful your itineraries are and how active you are in the community.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Expandable FAQs */}
          <div>
            <h3 className="text-base md:text-lg font-black font-display text-primary uppercase tracking-wider mb-4 border-b-2 border-border-dark pb-1">
              Frequently Asked Questions
            </h3>
            <div className="space-y-1">
              {faqs.map((faq, index) => (
                <FAQAccordionItem 
                  key={index}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-border-dark bg-surface flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="text-xs font-bold uppercase tracking-wider border-2 border-border-dark px-4 py-2 bg-accent-coral text-primary shadow-hard-sm hover:translate-y-0.5 hover:shadow-none active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all"
          >
            Got it, thanks!
          </button>
        </div>

      </div>
    </div>
  );
}
