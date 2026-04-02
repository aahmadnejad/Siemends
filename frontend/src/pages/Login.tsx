import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setCredentials } from '../store/authSlice';
import api from '../api/axiosConfig';

import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (error) setError(null);
  }, [username, password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); 
    
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/api/auth/login', { username, password });
      
      dispatch(setCredentials({
        user: { id: response.data.id, username, role: response.data.role },
        token: response.data.access_token
      }));
      navigate('/dashboard');

    } catch (err: any) {
      const msg = err.response?.data?.detail || "Invalid Credentials";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="login-card"
      >
        <div className="login-header">
          <div className="login-icon-wrapper">
            <Shield className="login-main-icon" />
          </div>
          <h1 className="login-title">SIEMENDS</h1>
          <p className="login-subtitle">Open-Source SIEM</p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="error-container"
            >
              <div className="error-box">
                <AlertCircle className="error-icon" />
                <span>{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label className="input-label">Identity</label>
            <div className="input-wrapper">
              <User className="input-icon" />
              <input 
                type="text" 
                required
                className="input-field"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Access Key</label>
            <div className="input-wrapper">
              <Lock className="input-icon" />
              <input 
                type="password" 
                required
                className="input-field"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" disabled={isLoading} className="login-button">
            {isLoading ? <Loader2 className="spinner" /> : "INITIALIZE SESSION"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;