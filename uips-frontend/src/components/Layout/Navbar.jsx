import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, ChevronLeft, Shield } from 'lucide-react';
import Badge from '../UI/Badge';

const Navbar = ({ title, showBack = false, toggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Dynamic title based on role
  const roleTitle = title || (user?.role === 'admin' ? 'COMMAND' : user?.role === 'invigilator' ? 'MONITOR' : 'PORTAL');

  if (!user) return null;

  return (
    <nav className="fixed top-0 inset-x-0 h-14 bg-[#0f1629] border-b border-[#1e2d4a] flex items-center justify-between px-4 z-50 shrink-0">
      
      {/* LEFT SECTION */}
      <div className="flex items-center space-x-3">
        {toggleSidebar && (
          <button onClick={toggleSidebar} className="md:hidden text-[#64748b] hover:text-white transition-colors">
             <Menu className="w-5 h-5" />
          </button>
        )}
        
        {showBack && (
          <button onClick={() => navigate(-1)} className="text-[#64748b] hover:text-white transition-colors mr-2">
             <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center space-x-2 text-white font-mono font-bold tracking-wider">
          <Shield className="w-5 h-5 text-[#3b82f6]" strokeWidth={2} />
          <span className="hidden sm:inline">UIPS<span className="text-[#3b82f6]">.</span>{roleTitle}</span>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex items-center space-x-4">
        <div className="hidden sm:flex items-center space-x-3">
          <span className="text-sm font-semibold text-white leading-tight">{user.name}</span>
          <Badge variant={user.role === 'admin' ? 'gold' : user.role === 'invigilator' ? 'purple' : 'info'} size="sm">
             {user.role.toUpperCase()}
          </Badge>
        </div>
        
        <div className="hidden sm:block w-px h-6 bg-[#1e2d4a]"></div>
        
        <button 
          onClick={logout}
          className="text-[#64748b] hover:text-[#ef4444] flex items-center transition-colors duration-200"
          title="Logout"
        >
          <span className="hidden sm:inline text-sm font-mono tracking-widest mr-2 uppercase">DISCONNECT</span>
          <LogOut className="w-5 h-5" />
        </button>
      </div>

    </nav>
  );
};

export default Navbar;
