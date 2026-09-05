import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2, Mail, Trash2, Clock, Star, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { SearchResult, EmailJob } from '../types';

export const Dashboard: React.FC<{ defaultFilter?: string }> = ({ defaultFilter = 'ALL' }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const statusFilter = defaultFilter;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/emails/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['emailStats'] });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiClient.delete('/api/emails/bulk', { data: { ids } });
    },
    onSuccess: () => {
      setSelectedEmails(new Set());
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['emailStats'] });
    }
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['emails', query, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      params.append('limit', '50');

      const res = await apiClient.get<SearchResult>(`/api/emails/search?${params.toString()}`);
      return res.data;
    },
    refetchInterval: 3000,
  });

  const formatTime = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString(undefined, {
      weekday: 'short', 
      hour: 'numeric', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && data?.data) {
      setSelectedEmails(new Set(data.data.map((email: EmailJob) => email.id)));
    } else {
      setSelectedEmails(new Set());
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top Search Bar */}
      <div className="flex items-center justify-between gap-6 px-8 py-5 border-b border-slate-100">
        <div className="relative flex-1 max-w-3xl flex items-center gap-4">
          <input 
             type="checkbox"
             checked={Boolean(data?.data?.length) && data!.data!.length > 0 && selectedEmails.size === data!.data!.length}
             onChange={handleSelectAll}
             className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer border-slate-300"
          />
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-full focus:outline-none focus:ring-1 focus:ring-slate-200 transition-all text-sm text-slate-600 placeholder:text-slate-400"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-5 text-slate-400">
          {selectedEmails.size > 0 && (
            <button 
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete ${selectedEmails.size} selected email(s)? This action cannot be undone.`)) {
                  bulkDeleteMutation.mutate(Array.from(selectedEmails));
                }
              }}
              disabled={bulkDeleteMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
            >
              {bulkDeleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Delete ({selectedEmails.size})
            </button>
          )}
          <button onClick={() => refetch()} className="hover:text-slate-600 transition-colors">
            <RefreshCw size={18} className={isFetching ? 'animate-spin text-blue-500' : ''} />
          </button>
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-500 text-sm">
            Failed to load emails.
          </div>
        ) : data?.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 text-center">
            <Mail className="w-8 h-8 text-slate-300 mb-3" />
            <p className="text-sm">No emails found.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {data?.data?.map((email: EmailJob) => (
              <div 
                key={email.id} 
                onClick={() => navigate(`/emails/${email.id}`)}
                className={`flex items-center gap-4 px-8 py-3.5 hover:bg-slate-50 transition-colors group cursor-pointer ${selectedEmails.has(email.id) ? 'bg-slate-50/80' : ''}`}
              >
                
                {/* Selection Checkbox */}
                <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox"
                    checked={selectedEmails.has(email.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedEmails);
                      if (e.target.checked) newSet.add(email.id);
                      else newSet.delete(email.id);
                      setSelectedEmails(newSet);
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Recipient */}
                <div className="w-64 shrink-0 truncate">
                  <span className="text-sm font-semibold text-slate-700">To: {email.recipient}</span>
                </div>

                {/* Status/Time Pill */}
                <div className="shrink-0 w-48">
                  {email.status.toLowerCase() === 'sent' ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium">
                      <Clock size={12} />
                      {formatTime(email.sentAt)}
                    </div>
                  ) : email.status.toLowerCase() === 'failed' ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                      <Clock size={12} />
                      Failed
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50/50 border border-orange-200/60 text-orange-600 text-xs font-medium">
                      <Clock size={12} />
                      {formatTime(email.scheduledAt)}
                    </div>
                  )}
                </div>

                {/* Subject & Body Snippet */}
                <div className="flex-1 min-w-0 truncate text-sm">
                  <span className="font-semibold text-slate-800">{email.subject}</span>
                  <span className="text-slate-400 ml-2">
                    - {email.delayReason ? `[Delayed: ${email.delayReason}] ` : ''}Scheduled via {email.status.toLowerCase()} pipeline...
                  </span>
                </div>

                {/* Actions */}
                <div 
                  className="shrink-0 flex items-center gap-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()} // Prevent row click when clicking actions
                >
                  <button 
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this email? This action cannot be undone.")) {
                        deleteMutation.mutate(email.id);
                      }
                    }}
                    disabled={deleteMutation.isPending && deleteMutation.variables === email.id}
                    className="hover:text-red-500 transition-colors"
                  >
                    {deleteMutation.isPending && deleteMutation.variables === email.id ? (
                      <Loader2 size={16} className="animate-spin text-red-500" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                  <button className="hover:text-yellow-400 transition-colors">
                    <Star size={16} />
                  </button>
                </div>
                {/* Default visible star if not hovering (to match design) */}
                <div className="shrink-0 text-slate-300 group-hover:hidden">
                  <Star size={16} />
                </div>
                
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
