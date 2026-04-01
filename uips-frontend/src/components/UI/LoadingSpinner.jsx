import React from 'react';

const LoadingSpinner = ({ size = 'md', center = false, className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-[3px]',
    lg: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-4'
  };

  const spinner = (
    <div 
      className={`animate-spin rounded-full ${sizes[size]} border-t-[#3b82f6] border-r-[#1e2d4a] border-b-[#1e2d4a] border-l-[#1e2d4a] shadow-[0_0_15px_rgba(59,130,246,0.3)] ${className}`}
    />
  );

  if (center) {
     return (
        <div className="flex flex-col justify-center items-center h-full min-h-[200px] w-full">
           {spinner}
           <span className="mt-4 font-mono tracking-widest text-[#64748b] text-xs uppercase animate-pulse">
              System Loading
           </span>
        </div>
     );
  }

  return spinner;
};

export default LoadingSpinner;
