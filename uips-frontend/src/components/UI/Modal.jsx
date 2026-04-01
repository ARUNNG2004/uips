import React, { useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = 'hidden';
    } else {
      setTimeout(() => setMounted(false), 200); // Wait for transition
      document.body.style.overflow = 'unset';
    }
    
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => { 
        document.body.style.overflow = 'unset'; 
        window.removeEventListener('keydown', h);
    };
  }, [isOpen, onClose]);

  if (!isOpen && !mounted) return null;

  const sizeMap = {
     sm: 'max-w-md',
     md: 'max-w-lg',
     lg: 'max-w-3xl'
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Panel */}
      <div 
         className={`relative bg-[#151d35] border border-[#1e2d4a] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full overflow-hidden transform transition-all duration-200 ${sizeMap[size]} ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[#0f1629] border-b border-[#1e2d4a]">
          <h3 className="text-lg font-mono tracking-widest text-white font-bold uppercase">{title}</h3>
          <button onClick={onClose} className="text-[#64748b] hover:text-[#ef4444] transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-[#ef4444]">
            <XCircle className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 text-[#f1f5f9]">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
