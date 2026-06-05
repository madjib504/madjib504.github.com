import React, { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Search from '@/pages/Search';
import DoctorProfilePage from '@/pages/DoctorProfilePage';
import PatientDashboard from '@/pages/PatientDashboard';
import DoctorDashboard from '@/pages/DoctorDashboard';
import Chat from '@/pages/Chat';
import VideoCall from '@/pages/VideoCall';
import WellnessPacks from '@/pages/WellnessPacks';
import MedicalRecord from '@/pages/MedicalRecord';
import Loyalty from '@/pages/Loyalty';
import Blog from '@/pages/Blog';
import MobileMoneyPayment from '@/pages/MobileMoneyPayment';
import BookingPage from '@/pages/BookingPage';
import AdminDashboard from '@/pages/AdminDashboard';
import Advertise from '@/pages/Advertise';
import WelcomeDoctor from '@/pages/WelcomeDoctor';
import PartnerDashboard from '@/pages/PartnerDashboard';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import EmailVerificationBanner from '@/components/EmailVerificationBanner';
import MaintenancePage from '@/pages/MaintenancePage';
import { SOSButton } from '@/components/HealthTools';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const AuthContext = React.createContext();

// Layout component to conditionally show navbar
const Layout = ({ children, user, setUser }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  
  return (
    <>
      {!isHomePage && <Navbar user={user} setUser={setUser} />}
      {!isHomePage && <EmailVerificationBanner />}
      {children}
      {!isHomePage && <SOSButton />}
    </>
  );
};

function AppContent({ user, setUser, loading }) {
  const ProtectedRoute = ({ children, allowedTypes }) => {
    if (loading) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
    if (!user) return <Navigate to="/login" />;
    if (allowedTypes && !allowedTypes.includes(user.user_type)) {
      return <Navigate to="/" />;
    }
    return children;
  };

  return (
    <Layout user={user} setUser={setUser}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login setUser={setUser} />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register setUser={setUser} />} />
        <Route path="/search" element={<Search />} />
        <Route path="/wellness-packs" element={<WellnessPacks />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/payment" element={<MobileMoneyPayment />} />
        <Route path="/booking/:doctorId" element={
          <ProtectedRoute allowedTypes={['patient']}>
            <BookingPage />
          </ProtectedRoute>
        } />
        <Route path="/medical-record" element={
          <ProtectedRoute allowedTypes={['patient']}>
            <MedicalRecord />
          </ProtectedRoute>
        } />
        <Route path="/loyalty" element={
          <ProtectedRoute>
            <Loyalty />
          </ProtectedRoute>
        } />
        <Route path="/doctor/:doctorId" element={<DoctorProfilePage />} />
        <Route path="/patient/dashboard" element={
          <ProtectedRoute allowedTypes={['patient']}>
            <PatientDashboard />
          </ProtectedRoute>
        } />
        <Route path="/doctor/dashboard" element={
          <ProtectedRoute allowedTypes={['doctor']}>
            <DoctorDashboard />
          </ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        } />
        <Route path="/chat/:userId" element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        } />
        <Route path="/video-call/:roomId" element={
          <ProtectedRoute>
            <VideoCall />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/advertise" element={<Advertise />} />
        <Route path="/welcome-doctor" element={<WelcomeDoctor />} />
        <Route path="/partner/dashboard" element={<PartnerDashboard />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Routes>
    </Layout>
  );
}

function MaintenanceGate({ children }) {
  const location = useLocation();
  const [maintenance, setMaintenance] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    axios.get(`${API}/maintenance/status`)
      .then(r => { if (active) { setMaintenance(!!r.data.enabled); setChecked(true); } })
      .catch(() => { if (active) { setChecked(true); } });
    return () => { active = false; };
  }, [location.pathname]);

  if (!checked) return null;
  // Always let /admin and /verify-email through
  const allowedPaths = ['/admin'];
  const isAllowed = allowedPaths.some(p => location.pathname.startsWith(p)) || location.pathname.startsWith('/verify-email');
  if (maintenance && !isAllowed) return <MaintenancePage />;
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(response => {
        setUser(response.data);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
          <p className="mt-4 text-stone-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <div className="App">
        <BrowserRouter>
          <MaintenanceGate>
            <AppContent user={user} setUser={setUser} loading={loading} />
          </MaintenanceGate>
          <Toaster />
        </BrowserRouter>
      </div>
    </AuthContext.Provider>
  );
}

export default App;
