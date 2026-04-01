import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated && user) {
    if (user.role === 'student') return <Navigate to="/student/waiting-room" replace />;
    if (user.role === 'admin') return <Navigate to="/admin/exams" replace />;
    return <Navigate to="/invigilator/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Fill in all credentials");
    
    setLoading(true);
    setError('');
    const res = await login(email, password);
    setLoading(false);
    
    if (res.success) {
       const u = JSON.parse(sessionStorage.getItem('uips_user')) || {};
       if (u.role === 'student') navigate('/student/waiting-room');
       else if (u.role === 'admin') navigate('/admin/exams');
       else navigate('/invigilator/dashboard');
    } else {
       setError(res.error || 'Network error.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background radial highlight */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 50% 10%, #3b82f6 0%, transparent 40%)'}} />

      <div className="w-full max-w-md z-10 relative">
        <div className="text-center mb-10 flex flex-col items-center relative">
            <h1 className="text-6xl font-mono font-bold tracking-tight text-white mb-2 relative" style={{ textShadow: '0 0 20px rgba(59,130,246,0.6)' }}>
               UIPS
               {/* Scanning Line Animation nested locally! */}
               <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-400 opacity-80" 
                    style={{ 
                      boxShadow: '0 0 10px #3b82f6', 
                      animation: 'scan 2s ease-in-out infinite alternate' 
                    }} />
            </h1>
            <p className="font-mono text-[10px] tracking-widest text-[#64748b] uppercase">Unified Intelligent Proctoring System</p>
        </div>

        <div className="bg-[#151d35] backdrop-blur-md bg-opacity-95 p-8 border border-[#1e2d4a] rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.15)]">
           <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-[#ef4444]/10 border border-[#ef4444] text-[#ef4444] px-4 py-3 rounded text-sm text-center">
                   {error}
                </div>
              )}
              
              <Input 
                label="Identifier / Email" 
                type="email"
                placeholder="system@uips.local"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
              
              <Input 
                label="Passcode" 
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />

              <Button type="submit" loading={loading} className="w-full mt-8 font-mono tracking-widest uppercase">
                 ACCESS SYSTEM
              </Button>
           </form>

           <div className="mt-8 pt-6 border-t border-[#1e2d4a] text-center">
             <span className="text-xs text-[#64748b] font-mono tracking-widest">Demo: admin@uips.com / admin123</span>
           </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(60px); }
        }
      `}</style>
    </div>
  );
};

export default Login;
