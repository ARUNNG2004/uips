import React from 'react';

const Input = ({ label, error, suffix, className = '', ...props }) => {
  return (
    <div className={`flex flex-col space-y-2 relative ${className}`}>
      {label && <label className="text-xs font-mono tracking-widest uppercase font-medium text-[#64748b]">{label}</label>}
      <div className="relative">
          <input 
            className={`w-full bg-[#0f1629] border text-[#f1f5f9] text-sm rounded-md px-4 py-3 
              transition-colors duration-200 outline-none
              ${error 
                ? 'border-[#ef4444] focus:ring-1 focus:ring-[#ef4444] focus:border-[#ef4444]' 
                : 'border-[#1e2d4a] focus:ring-1 focus:ring-[#3b82f6] focus:border-[#3b82f6] placeholder:text-[#64748b]/50'
              }
              ${suffix ? 'pr-10' : ''}`}
            {...props}
          />
          {suffix && (
             <div className="absolute inset-y-0 right-0 flex items-center pr-3">
               {suffix}
             </div>
          )}
      </div>
      {error && <span className="text-[10px] font-mono tracking-widest uppercase text-[#ef4444] mt-1">{error}</span>}
    </div>
  );
};

export default Input;
