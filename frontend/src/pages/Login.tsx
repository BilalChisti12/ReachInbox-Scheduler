import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/env';
import { apiClient } from '../api/client';
import { Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const authMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isSignUp ? '/auth/register' : '/auth/login';
      const payload = isSignUp ? { email, password, name } : { email, password };
      const { data } = await apiClient.post(endpoint, payload);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/scheduled');
    },
    onError: (error: any) => {
      setErrorMsg(error.response?.data?.error || (isSignUp ? 'Registration failed' : 'Login failed'));
    }
  });

  const handleGoogleLogin = () => {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      alert("Configuration Error: The backend API URL is missing. Please add VITE_API_URL in your Vercel project settings.");
      return;
    }
    window.location.href = `${apiUrl}/auth/google`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Email and password are required');
      return;
    }
    if (isSignUp && !name.trim()) {
      setErrorMsg('Name is required');
      return;
    }
    authMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <h1 className="text-3xl font-semibold text-slate-900 mb-8 tracking-tight">{isSignUp ? 'Sign Up' : 'Login'}</h1>
        
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-emerald-50 text-slate-700 px-4 py-3 rounded-xl hover:bg-emerald-100 transition-colors font-medium mb-6"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
          Login with Google
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-slate-100"></div>
          <button 
            type="button" 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-slate-400 font-medium hover:text-slate-600 transition-colors"
          >
            {isSignUp ? 'or login with email' : 'or sign up through email'}
          </button>
          <div className="flex-1 h-px bg-slate-100"></div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                disabled={authMutation.isPending}
                className="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none text-slate-700 placeholder-slate-400"
                required={isSignUp}
              />
            </div>
          )}
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email ID"
              disabled={authMutation.isPending}
              className="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none text-slate-700 placeholder-slate-400"
              required
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={authMutation.isPending}
              className="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none text-slate-700 placeholder-slate-400"
              required
            />
          </div>
          
          {errorMsg && (
            <p className="text-red-500 text-sm font-medium text-left px-1">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={authMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-[#00A859] hover:bg-emerald-600 text-white px-4 py-3 rounded-xl transition-colors font-medium mt-2"
          >
            {authMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignUp ? 'Create Account' : 'Login')}
          </button>
        </form>
      </div>
    </div>
  );
};
