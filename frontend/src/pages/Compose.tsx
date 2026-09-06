import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Paperclip, Clock, Upload, AlertCircle,
  Undo, Redo, Type, Bold, Italic, Underline, AlignLeft, AlignCenter,
  List, ListOrdered, Indent, Quote, Link as LinkIcon, Strikethrough,
  ChevronDown, X, File
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { Sender } from '../types';

interface Attachment {
  filename: string;
  content: string;
  contentType: string;
}

const ToolbarButton = ({ icon: Icon, onClick }: { icon: React.ElementType, onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
  >
    <Icon size={16} />
  </button>
);

export const Compose: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [senderId, setSenderId] = useState('');
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delay, setDelay] = useState<number | ''>('');
  const [hourlyLimit, setHourlyLimit] = useState<number | ''>('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSchedulePopupOpen, setIsSchedulePopupOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  
  const [validationError, setValidationError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Email Validation Logic
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const recipientArray = recipients.split(',').map(r => r.trim()).filter(Boolean);
  const invalidEmailList = recipientArray.filter(email => !emailRegex.test(email));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const tokens = text.split(/[\r\n,;]+/).map(t => t.trim()).filter(Boolean);
      if (tokens.length > 0 && tokens[0].toLowerCase() === 'email') {
        tokens.shift();
      }
      const uniqueTokens = Array.from(new Set(tokens));

      if (uniqueTokens.length > 0) {
        setRecipients(prev => {
          const existing = prev.split(',').map(e => e.trim()).filter(Boolean);
          const combined = Array.from(new Set([...existing, ...uniqueTokens]));
          return combined.join(', ');
        });
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setAttachments(prev => [...prev, {
            filename: file.name,
            content, // Base64 Data URI
            contentType: file.type || 'application/octet-stream'
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const { data: senders } = useQuery({
    queryKey: ['senders'],
    queryFn: async () => {
      const res = await apiClient.get<Sender[]>('/api/senders');
      return res.data;
    },
  });

  const activeSenders = senders?.filter(s => s.active) || [];

  React.useEffect(() => {
    const active = senders?.filter(s => s.active) || [];
    if (active.length > 0 && !senderId) {
      setSenderId(active[0].id);
    }
  }, [senders, senderId]);

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/api/campaigns', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['emailStats'] });
      navigate('/scheduled');
    },
    onError: (err: any) => {
      setValidationError(err.response?.data?.error || 'Failed to create campaign');
    }
  });

  const handleSend = (isImmediate: boolean) => {
    setValidationError('');

    if (!senderId) return setValidationError('Please select a sender');
    if (!recipients) return setValidationError('Please add at least one recipient');
    if (!subject) return setValidationError('Subject is required');
    if (!body) return setValidationError('Body is required');
    
    if (recipientArray.length === 0) return setValidationError('Please add valid email recipients');
    if (invalidEmailList.length > 0) return setValidationError(`Please fix invalid emails before sending.`);

    let finalStartTime = new Date().toISOString();
    if (!isImmediate) {
      if (!scheduleDate) return setValidationError('Please pick a date and time to schedule.');
      finalStartTime = new Date(scheduleDate).toISOString();
      if (new Date(finalStartTime) < new Date()) {
        return setValidationError('Scheduled time must be in the future.');
      }
    }

    const payload: any = {
      senderId,
      subject,
      body,
      recipients: recipientArray,
      attachments,
      startTime: finalStartTime,
    };

    if (delay !== '' && delay > 0) payload.delayBetweenEmails = delay;
    if (hourlyLimit !== '' && hourlyLimit > 0) payload.hourlyLimit = hourlyLimit;

    createMutation.mutate(payload);
  };

  const insertFormat = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);

    const newText = before + prefix + selected + suffix + after;
    setBody(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };


  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[17px] font-medium text-slate-800 tracking-tight">Compose New Email</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-slate-500 relative">
            <input type="file" multiple className="hidden" ref={attachmentInputRef} onChange={handleAttachmentUpload} />
            <button onClick={() => attachmentInputRef.current?.click()} className="flex items-center justify-center hover:opacity-80 transition-opacity" title="Attachments">
              <Paperclip size={18} className="stroke-[2]" />
              {attachments.length > 0 && (
                <span className="text-[10px] bg-slate-100 text-slate-500 rounded-full w-3.5 h-3.5 flex items-center justify-center relative -ml-1 -top-1.5">{attachments.length}</span>
              )}
            </button>
            <div className="relative">
              <button onClick={() => setIsSchedulePopupOpen(!isSchedulePopupOpen)} className="hover:opacity-80 transition-opacity" title="Schedule">
                <Clock size={18} className="stroke-[2]" />
              </button>
              
              {/* Send Later Popover */}
              {isSchedulePopupOpen && (
                <div className="absolute top-8 right-0 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50 p-4">
                  <h3 className="font-medium text-slate-800 mb-4 text-[13px]">Send Later</h3>
                  
                  <div className="flex items-center border-b border-slate-100 pb-2 mb-3">
                    <input 
                      type="datetime-local" 
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      className="text-xs text-slate-500 w-full focus:outline-none border-none p-0 cursor-pointer" 
                    />
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    {['Tomorrow', 'Tomorrow, 10:00 AM', 'Tomorrow, 11:00 AM', 'Tomorrow, 3:00 PM'].map(opt => {
                      const dt = new Date();
                      dt.setDate(dt.getDate() + 1);
                      if (opt.includes('10:00')) dt.setHours(10, 0, 0, 0);
                      else if (opt.includes('11:00')) dt.setHours(11, 0, 0, 0);
                      else if (opt.includes('3:00')) dt.setHours(15, 0, 0, 0);
                      else dt.setHours(9, 0, 0, 0); // Default Tomorrow 9AM
                      
                      // Formatting YYYY-MM-DDTHH:mm
                      const tzOffset = dt.getTimezoneOffset() * 60000;
                      const localISOTime = (new Date(dt.getTime() - tzOffset)).toISOString().slice(0, 16);

                      return (
                        <div 
                          key={opt} 
                          onClick={() => setScheduleDate(localISOTime)}
                          className="text-xs text-slate-600 hover:text-green-600 cursor-pointer"
                        >
                          {opt}
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-end gap-4 mt-2">
                    <button onClick={() => setIsSchedulePopupOpen(false)} className="text-xs font-medium text-slate-800">Cancel</button>
                    <button 
                      onClick={() => { setIsSchedulePopupOpen(false); handleSend(false); }} 
                      disabled={createMutation.isPending || activeSenders.length === 0 || !scheduleDate}
                      className="text-xs font-medium text-green-600 border border-green-500 rounded-full px-4 py-1.5 hover:bg-green-50 disabled:opacity-50 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <button 
            onClick={() => handleSend(true)} 
            disabled={createMutation.isPending || activeSenders.length === 0}
            className="text-green-600 bg-white border border-green-500 hover:bg-green-50 disabled:opacity-50 px-5 py-1.5 rounded-full text-[13px] font-medium transition-colors"
          >
            {createMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Main Form Area */}
      <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="max-w-[700px] mx-auto space-y-6">
          
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
              <AlertCircle size={18} />
              <p className="font-medium text-sm">{validationError}</p>
            </div>
          )}

          {/* Form Fields container */}
          <div className="space-y-4">
            
            {/* From */}
            <div className="flex items-center">
              <div className="w-24 shrink-0 text-sm font-medium text-slate-700">From</div>
              <div className="relative">
                <select
                  value={senderId}
                  onChange={e => setSenderId(e.target.value)}
                  className="appearance-none bg-slate-100 border-none rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer"
                >
                  <option value="" disabled>Select sender...</option>
                  {activeSenders.map(s => (
                    <option key={s.id} value={s.id}>{s.email}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            {/* To */}
            <div className="flex items-start border-b border-slate-100 pb-3">
              <div className="w-24 shrink-0 text-sm font-medium text-slate-700 pt-1">To</div>
              <div className="flex-1 flex items-start justify-between">
                <div className="flex-1">
                  <textarea
                    value={recipients}
                    onChange={e => setRecipients(e.target.value)}
                    placeholder="recipient@example.com"
                    rows={1}
                    className="w-full bg-transparent border-none p-0 text-sm text-slate-600 focus:ring-0 resize-none placeholder-slate-300"
                    style={{ minHeight: '24px' }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    {invalidEmailList.length > 0 ? (
                      <p className="text-[11px] text-red-500 font-medium">
                        Invalid: {invalidEmailList.join(', ')}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        Separate multiple emails with commas.
                      </p>
                    )}
                    {recipientArray.length > 0 && (
                      <p className="text-[11px] font-medium text-green-600 shrink-0 ml-4">
                        {recipientArray.length - invalidEmailList.length} valid email(s)
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="shrink-0 ml-4">
                  <input type="file" accept=".csv,.txt" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs flex items-center gap-1.5 text-green-500 hover:text-green-600 font-medium pt-1"
                  >
                    <Upload size={14} /> Upload List
                  </button>
                </div>
              </div>
            </div>

            {/* Subject */}
            <div className="flex items-center border-b border-slate-100 pb-3">
              <div className="w-24 shrink-0 text-sm font-medium text-slate-700">Subject</div>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 bg-transparent border-none p-0 text-sm text-slate-600 focus:ring-0 placeholder-slate-300"
              />
            </div>

            {/* Attachments Chips Display */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 border-b border-slate-100 pb-3">
                {attachments.map((att, index) => (
                  <div key={index} className="flex items-center gap-2 bg-slate-100 rounded pl-2 pr-1.5 py-1 max-w-[200px]">
                    <File size={12} className="text-slate-500 shrink-0" />
                    <span className="text-[11px] text-slate-600 font-medium truncate">{att.filename}</span>
                    <button onClick={() => removeAttachment(index)} className="text-slate-400 hover:text-red-500">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Scheduling Controls */}
            <div className="flex items-center gap-8 border-b border-slate-100 pb-4 pt-1">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-slate-700">Delay between 2 emails</label>
                <input
                  type="number"
                  value={delay}
                  onChange={e => setDelay(e.target.value === '' ? '' : Number(e.target.value))}
                  min="0"
                  placeholder="00"
                  className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-center focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-slate-700">Hourly Limit</label>
                <input
                  type="number"
                  value={hourlyLimit}
                  onChange={e => setHourlyLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  min="1"
                  placeholder="00"
                  className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-center focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                />
              </div>
            </div>

          </div>

          {/* Rich Text Editor Simulation */}
          <div className="bg-slate-50/50 rounded-xl flex flex-col mt-4" style={{ minHeight: '340px' }}>
            <div className="px-5 py-4 flex-1 flex flex-col">
              <textarea
                ref={textareaRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Type Your Reply..."
                className="w-full flex-1 bg-transparent border-none p-0 text-[15px] text-slate-700 placeholder-slate-300 focus:ring-0 resize-none"
              />
              
              {/* Toolbar */}
              <div className="flex items-center gap-1.5 pt-4 mt-auto">
                <ToolbarButton icon={Undo} />
                <ToolbarButton icon={Redo} />
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <ToolbarButton icon={Type} />
                <ToolbarButton icon={Bold} onClick={() => insertFormat('**', '**')} />
                <ToolbarButton icon={Italic} onClick={() => insertFormat('*', '*')} />
                <ToolbarButton icon={Underline} onClick={() => insertFormat('<u>', '</u>')} />
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <ToolbarButton icon={AlignLeft} />
                <ToolbarButton icon={AlignCenter} />
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <ToolbarButton icon={ListOrdered} onClick={() => insertFormat('1. ')} />
                <ToolbarButton icon={List} onClick={() => insertFormat('- ')} />
                <ToolbarButton icon={Indent} />
                <ToolbarButton icon={Quote} onClick={() => insertFormat('> ')} />
                <ToolbarButton icon={LinkIcon} onClick={() => insertFormat('[', '](url)')} />
                <ToolbarButton icon={Strikethrough} onClick={() => insertFormat('~~', '~~')} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
