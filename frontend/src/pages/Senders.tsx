import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, XCircle, Users, Power, PowerOff, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';
import type { Sender } from '../types';
import { Badge } from '../components/Badge';

export const Senders: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [newSenderPassword, setNewSenderPassword] = useState('');
  const [newSenderHost, setNewSenderHost] = useState('');
  const [newSenderPort, setNewSenderPort] = useState(2525);

  const { data: senders, isLoading } = useQuery({
    queryKey: ['senders'],
    queryFn: async () => {
      const res = await apiClient.get<Sender[]>('/api/senders');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      await apiClient.post('/api/senders', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
      setIsModalOpen(false);
      setNewSenderEmail('');
      setNewSenderName('');
      setNewSenderPassword('');
      setNewSenderHost('');
      setNewSenderPort(2525);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to create sender');
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      if (active) {
        await apiClient.patch(`/api/senders/${id}/deactivate`);
      } else {
        await apiClient.patch(`/api/senders/${id}/activate`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Senders</h1>
          <p className="text-slate-500 mt-1">Manage SMTP sender accounts for your campaigns</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors font-medium shadow-sm"
        >
          <Plus size={18} />
          Add Sender
        </button>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : senders?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">No senders configured</h3>
            <p className="text-sm text-slate-500 mb-6">Add a sender to start dispatching automated campaigns.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl transition-colors font-medium"
            >
              <Plus size={18} /> Add Your First Sender
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Display Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {senders?.map((sender) => (
                  <tr key={sender.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{sender.displayName}</td>
                    <td className="px-6 py-4">{sender.email}</td>
                    <td className="px-6 py-4">
                      {sender.active ? (
                        <Badge variant="success" className="gap-1"><CheckCircle2 size={12} /> Active</Badge>
                      ) : (
                        <Badge variant="neutral" className="gap-1"><XCircle size={12} /> Inactive</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 flex justify-end">
                      <button
                        onClick={() => toggleStatusMutation.mutate({ id: sender.id, active: sender.active })}
                        disabled={toggleStatusMutation.isPending}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          sender.active 
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {sender.active ? <><PowerOff size={14}/> Deactivate</> : <><Power size={14}/> Activate</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Add New Sender</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
                <input type="text" value={newSenderName} onChange={e => setNewSenderName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Acme Sales" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input type="email" value={newSenderEmail} onChange={e => setNewSenderEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="sales@acme.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SMTP Password</label>
                <input type="password" value={newSenderPassword} onChange={e => setNewSenderPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="••••••••" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">SMTP Host</label>
                  <input type="text" value={newSenderHost} onChange={e => setNewSenderHost(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="smtp.ethereal.email" />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Port</label>
                  <input type="number" value={newSenderPort} onChange={e => setNewSenderPort(parseInt(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="2525" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
              <button 
                onClick={() => createMutation.mutate({
                  email: newSenderEmail,
                  displayName: newSenderName,
                  smtpPassword: newSenderPassword,
                  smtpHost: newSenderHost,
                  smtpPort: newSenderPort,
                  smtpUsername: newSenderEmail
                })}
                disabled={createMutation.isPending || !newSenderEmail || !newSenderPassword || !newSenderHost}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Sender
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
