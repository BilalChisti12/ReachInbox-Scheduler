import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Compose } from './pages/Compose';
import { Senders } from './pages/Senders';
import { Settings } from './pages/Settings';
import { EmailDetails } from './pages/EmailDetails';

const queryClient = new QueryClient();


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/scheduled" element={<Dashboard defaultFilter="scheduled" />} />
              <Route path="/sent" element={<Dashboard defaultFilter="sent" />} />
              <Route path="/emails/:id" element={<EmailDetails />} />
              <Route path="/compose" element={<Compose />} />
              <Route path="/senders" element={<Senders />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/" element={<Navigate to="/scheduled" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
