import React, { useState } from 'react';
import { Hash, Server, Shield, ExternalLink, Loader2, User as UserIcon, Save } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { getApiUrl } from '../config/env';
import { useAuth } from '../contexts/AuthContext';

export const Settings: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const { data: slackStatus, isLoading: isCheckingSlack } = useQuery({
    queryKey: ['slackStatus'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ connected: boolean }>('/api/slack/status');
      return data;
    },
  });

  const handleConnectSlack = () => {
    window.location.href = `${getApiUrl()}/api/slack/auth`;
  };

  const handleDisconnectSlack = async () => {
    setIsDisconnecting(true);
    try {
      await apiClient.post('/api/slack/disconnect');
      await queryClient.invalidateQueries({ queryKey: ['slackStatus'] });

      // Clean up URL if it has the query param
      const url = new URL(window.location.href);
      if (url.searchParams.has('slack')) {
        url.searchParams.delete('slack');
        window.history.replaceState({}, '', url);
      }

      alert('Slack disconnected successfully');
    } catch (err) {
      alert('Failed to disconnect Slack');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleUpdateProfile = async () => {
    setProfileMessage(null);
    if (!profileName.trim()) {
      setProfileMessage({ type: 'error', text: 'Name cannot be empty' });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await apiClient.patch('/auth/profile', { name: profileName.trim() });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setProfileMessage({ type: 'success', text: 'Profile updated successfully' });
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update profile' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings & Integrations</h1>
        <p className="text-slate-500 mt-1">Configure your environment and external tools</p>
      </div>

      {/* Profile Settings */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
            <UserIcon size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Profile Settings</h2>
            <p className="text-sm text-slate-500">Manage your identity across the application.</p>
          </div>
        </div>
        <div className="p-6 bg-slate-50">
          <div className="grid gap-6 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-2">Email addresses cannot be changed.</p>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleUpdateProfile}
                disabled={isUpdatingProfile || profileName.trim() === user?.name}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl transition-colors font-medium text-sm shadow-sm"
              >
                {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
                Save Changes
              </button>

              {profileMessage && (
                <p className={`text-sm font-medium ${profileMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {profileMessage.text}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slack Notifications */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Hash size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Slack Notifications</h2>
            <p className="text-sm text-slate-500">Receive direct alerts when a sender hits a rate limit.</p>
          </div>
        </div>
        <div className="p-6 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-emerald-500" />
            <span className="text-sm font-medium text-slate-700">OAuth 2.0 Secured</span>
          </div>
          <div>
            {isCheckingSlack ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : slackStatus?.connected ? (
              <button
                onClick={handleDisconnectSlack}
                disabled={isDisconnecting}
                className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 hover:text-red-600 hover:border-red-300 px-4 py-2 rounded-xl transition-colors font-medium text-sm"
              >
                {isDisconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disconnect Workspace'}
              </button>
            ) : (
              <button
                onClick={handleConnectSlack}
                className="flex items-center gap-2 bg-[#4A154B] hover:bg-[#3b113c] text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm shadow-sm"
              >
                Connect to Slack
              </button>
            )}
          </div>
        </div>
      </div>

      {user?.isPlatformAdmin && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Server size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900">Queue Dashboard (Bull Board)</h2>
              <p className="text-sm text-slate-500">Monitor internal BullMQ email-scheduler worker performance.</p>
            </div>
          </div>
          <div className="p-6 bg-slate-50 flex items-center justify-between">
            <p className="text-sm text-slate-600">Restricted to platform administrators only.</p>
            <a
              href={`${getApiUrl()}/admin/queues`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm shadow-sm"
            >
              Launch Bull Board <ExternalLink size={16} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
