import React from 'react';

const Badge = ({ children, variant = 'neutral', size = 'md', pulse = false, className = '' }) => {
  const variants = {
    success: 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30',
    warning: 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30',
    danger: 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30',
    info: 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    gold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    neutral: 'bg-[#0f1629] text-[#64748b] border-[#1e2d4a]'
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs'
  };

  return (
    <span className={`inline-flex items-center rounded-full font-mono font-bold tracking-widest border transition-colors ${variants[variant]} ${sizes[size]} ${pulse ? 'animate-pulse' : ''} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
