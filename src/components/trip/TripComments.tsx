'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TripComment } from '@/types/supabase';
import { PrimaryButton } from '@/components/ui/Button';
import { RetroPanel } from '@/components/ui/Cards';
import { Trash2, MessageCircle, Edit2, CornerUpLeft, X, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function TripComments({ tripId, userId, onCountChange }: { tripId: string; userId: string | null; onCountChange?: (count: number) => void }) {
  const [comments, setComments] = useState<TripComment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyTo, setReplyTo] = useState<TripComment | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const PAGE_SIZE = 5;

  useEffect(() => {
    if (onCountChange) {
      onCountChange(totalCount);
    }
  }, [totalCount, onCountChange]);

  useEffect(() => {
    fetchComments(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const fetchComments = async (pageIndex: number) => {
    if (pageIndex === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const { data, error, count } = await supabase
        .from('trip_comments')
        .select('*, users!user_id(display_name, avatar_url), parent:reply_to_id(content, users!user_id(display_name))', { count: 'exact' })
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true })
        .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      
      if (pageIndex === 0) {
        setComments(data || []);
      } else {
        setComments(prev => [...prev, ...(data || [])]);
      }
      
      if (count !== null) setTotalCount(count);
      setPage(pageIndex);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userId) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('trip_comments')
        .insert({
          trip_id: tripId,
          user_id: userId,
          content: newComment.trim(),
          reply_to_id: replyTo?.id || null
        })
        .select('*, users!user_id(display_name, avatar_url), parent:reply_to_id(content, users!user_id(display_name))')
        .single();

      if (error) throw error;
      if (data) {
        setComments([...comments, data as any]);
        setTotalCount(prev => prev + 1);
        setNewComment('');
        setReplyTo(null);
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
      alert('Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!userId) return;
    
    try {
      const { error } = await supabase
        .from('trip_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId);

      if (error) throw error;
      setComments(comments.filter(c => c.id !== commentId));
      setTotalCount(prev => prev - 1);
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert('Failed to delete comment.');
    }
  };

  const handleEdit = (comment: TripComment) => {
    setEditingMessageId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId) return;
    if (editContent.trim() !== '') {
      setComments(prev => prev.map(c => c.id === editingMessageId ? { ...c, content: editContent.trim() } : c));
      await supabase.from('trip_comments').update({ content: editContent.trim() }).eq('id', editingMessageId);
    }
    setEditingMessageId(null);
    setEditContent('');
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + 
           d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <RetroPanel className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle className="w-6 h-6 text-primary" />
        <h3 className="font-display font-bold text-2xl uppercase">Discussion</h3>
        <span className="bg-soft-beige border-2 border-border-dark px-2 py-0.5 text-xs font-bold rounded-sm">
          {totalCount}
        </span>
      </div>

      <div className="flex flex-col mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {loading ? (
          <p className="text-secondary font-bold text-sm">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-secondary font-medium text-sm italic">No comments yet. Be the first to start the discussion!</p>
        ) : (
          comments.map((comment, index) => {
            const prevComment = index > 0 ? comments[index - 1] : null;
            const isConsecutive = prevComment &&
              comment.user_id === prevComment.user_id &&
              Math.abs(new Date(comment.created_at).getTime() - new Date(prevComment.created_at).getTime()) < 5 * 60 * 1000;
            const showActions = activeCommentId === comment.id;

            return (
              <div 
                key={comment.id} 
                className={`flex gap-3 group ${isConsecutive ? 'mt-1' : 'mt-4'}`}
                onClick={() => setActiveCommentId(activeCommentId === comment.id ? null : comment.id)}
              >
                {!isConsecutive ? (
                  <div className="w-10 h-10 shrink-0 bg-accent-yellow border-2 border-border-dark rounded-full flex items-center justify-center font-bold text-primary uppercase text-sm overflow-hidden">
                    {comment.users?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={comment.users.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      (comment.users?.display_name || 'Traveler').charAt(0)
                    )}
                  </div>
                ) : (
                  <div className="w-10 shrink-0" />
                )}
                
                <div className="flex-1 flex flex-col gap-0.5">
                  {!isConsecutive && (
                    <div className="flex justify-between items-baseline">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-sm text-primary">
                          {comment.users?.display_name ? `@${comment.users.display_name}` : 'Traveler'}
                        </span>
                        <span className="text-[10px] font-bold text-secondary tracking-wide uppercase">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {comment.parent && (
                    <div className="mb-1 pl-3 border-l-2 border-border-dark text-xs text-secondary bg-soft-beige p-2">
                      <span className="font-bold block mb-1">@{comment.parent.users?.display_name || 'Traveler'}</span>
                      <p className="truncate opacity-80">{comment.parent.content}</p>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-2">
                    <div className="cursor-pointer max-w-[85%]">
                      {editingMessageId === comment.id ? (
                        <div className="flex flex-col gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full text-sm bg-white border-2 border-border-dark p-2 focus:outline-none focus:border-primary resize-none"
                            autoFocus
                            rows={3}
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingMessageId(null)} className="text-[10px] font-bold uppercase tracking-wider text-secondary hover:text-primary">Cancel</button>
                            <button onClick={handleSaveEdit} className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-accent-blue">Save</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-primary whitespace-pre-wrap leading-relaxed">
                          {comment.content}
                        </p>
                      )}
                    </div>

                    <div className={`flex items-center gap-1 shrink-0 transition-opacity duration-150 ${showActions ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100 pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto'}`} onClick={(e) => e.stopPropagation()}>
                      {userId && (
                        <button 
                          onClick={() => setReplyTo(comment)}
                          className="p-1 text-secondary hover:text-accent-blue transition-colors"
                          title="Reply"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                      
                      {userId === comment.user_id && (
                        <div className="relative">
                          <button 
                            onClick={() => setOpenMenuId(openMenuId === comment.id ? null : comment.id)}
                            className="p-1 text-secondary/50 hover:text-primary transition-colors"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                          
                          {openMenuId === comment.id && (
                            <div className="absolute bottom-full right-0 mb-1 w-32 bg-white border border-border-dark/20 shadow-md z-10 flex flex-col rounded-md overflow-hidden">
                              <button onClick={() => { handleEdit(comment); setOpenMenuId(null); }} className="px-3 py-2 text-xs font-bold text-left hover:bg-soft-beige flex items-center gap-2 text-accent-blue">
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </button>
                              <button onClick={() => { handleDelete(comment.id); setOpenMenuId(null); }} className="px-3 py-2 text-xs font-bold text-left hover:bg-soft-beige flex items-center gap-2 text-accent-coral">
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {comments.length > 0 && comments.length < totalCount && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => fetchComments(page + 1)}
              disabled={loadingMore}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wide border-2 border-border-dark bg-white shadow-hard-sm hover:bg-soft-beige transition-colors"
            >
              {loadingMore ? 'Loading...' : `Load older comments (${totalCount - comments.length})`}
            </button>
          </div>
        )}
      </div>

      {/* Comment Form */}
      {userId ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t-2 border-border-dark pt-6">
          {replyTo && (
            <div className="flex items-center justify-between p-2 bg-accent-blue/10 border-2 border-border-dark border-dashed">
              <div className="flex items-center gap-2 text-xs truncate">
                <CornerUpLeft className="w-3 h-3 text-secondary shrink-0" />
                <span className="font-bold text-primary">Replying to @{replyTo.users?.display_name}:</span>
                <span className="text-secondary truncate">{replyTo.content}</span>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} className="p-1 text-secondary hover:text-accent-coral shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Ask a question or share your thoughts..."
            className="w-full min-h-[100px] p-3 border-2 border-border-dark bg-surface font-medium focus:outline-none focus:ring-0 placeholder:text-secondary/60 resize-y"
            maxLength={1000}
            required
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-secondary uppercase">
              {1000 - newComment.length} characters left
            </span>
            <PrimaryButton type="submit" disabled={submitting || !newComment.trim()}>
              {submitting ? 'Posting...' : 'Post Comment'}
            </PrimaryButton>
          </div>
        </form>
      ) : (
        <div className="border-t-2 border-border-dark pt-6 text-center">
          <p className="text-sm font-medium text-secondary mb-3">Join the community to share your thoughts.</p>
          <button
            onClick={() => router.push(`/login?returnTo=/trip/${tripId}`)}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wide border-2 border-border-dark bg-white shadow-hard-sm hover:bg-soft-beige transition-colors"
          >
            Log in to comment
          </button>
        </div>
      )}
    </RetroPanel>
  );
}
