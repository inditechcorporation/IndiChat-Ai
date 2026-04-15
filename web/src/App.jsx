import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Devices from './pages/Devices';
import DeviceConfig from './pages/DeviceConfig';
import Admin from './pages/Admin';
import ResetPassword from './pages/ResetPassword';
import MagicLogin from './pages/MagicLogin';
import ChangeEmail from './pages/ChangeEmail';

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('indi_user')); } catch { return null; }
  });

  const login  = (u) => { localStorage.setItem('indi_user', JSON.stringify(u)); setUser(u); };
  const logout = () => { localStorage.removeItem('indi_user'); localStorage.removeItem('token'); setUser(null); };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"              element={<Home user={user} onLogin={login} onLogout={logout} />} />
        <Route path="/chat"          element={<Chat user={user} />} />
        <Route path="/devices"       element={user ? <Devices user={user} onLogout={logout} /> : <Navigate to="/" />} />
        <Route path="/device/:id"    element={user ? <DeviceConfig /> : <Navigate to="/" />} />
        <Route path="/admin"         element={user ? <Admin user={user} onLogout={logout} /> : <Navigate to="/" />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/magic-login"   element={<MagicLogin onLogin={login} />} />
        <Route path="/change-email"  element={<ChangeEmail user={user} />} />
        <Route path="/auth-callback" element={<MagicLogin onLogin={login} />} />
      </Routes>
    </BrowserRouter>
  );
}
