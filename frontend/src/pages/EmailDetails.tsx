import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Star, Archive, Trash2, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const EmailDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [renderedBody, setRenderedBody] = useState<string>('');

  const { data: email, isLoading, error } = useQuery({
    queryKey: ['email', id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/emails/${id}`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      await apiClient.delete(`/api/emails/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['emailStats'] });
      navigate(-1);
    }
  });

  useEffect(() => {
    const renderMarkdown = async () => {
      if (email?.body) {
        // Parse markdown asynchronously (marked can be sync but parse is typed generic)
        const html = await marked.parse(email.body, { async: true });
        // Sanitize the HTML strictly
        const cleanHtml = DOMPurify.sanitize(html, {
          USE_PROFILES: { html: true }, // strict html profile
          FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'object', 'embed'],
          FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
        });
        setRenderedBody(cleanHtml);
      }
    };
    renderMarkdown();
  }, [email?.body]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-white text-slate-500">
        <p>Email not found or you do not have permission to view it.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const senderName = email.sender?.displayName || email.sender?.email?.split('@')[0] || 'Unknown';
  const senderEmail = email.sender?.email || '';
  const initial = senderName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-normal text-slate-800 tracking-tight">
            <span className="font-medium">{email.recipient}</span> | {email.subject}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <button className="p-2 rounded-full hover:bg-slate-100 transition-colors" title="Star">
            <Star size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-slate-100 transition-colors" title="Archive">
            <Archive size={18} />
          </button>
          <button 
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors" 
            title="Delete"
          >
            {deleteMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          </button>
        </div>
      </div>

      {/* Main Email Area */}
      <div className="flex-1 overflow-y-auto px-12 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold shrink-0">
                {initial}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{senderName}</span>
                  <span className="text-sm text-slate-500">&lt;{senderEmail}&gt;</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-slate-500 mt-0.5">
                  to me
                </div>
              </div>
            </div>
            <div className="text-sm text-slate-400 shrink-0">
              {formatTime(email.status === 'sent' ? email.sentAt : email.scheduledAt)}
            </div>
          </div>

          {/* Rendered Body */}
          <div 
            className="prose prose-slate max-w-none prose-p:leading-relaxed prose-a:text-blue-600 prose-img:rounded-xl whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: renderedBody }}
          />
        </div>
      </div>
    </div>
  );
};
