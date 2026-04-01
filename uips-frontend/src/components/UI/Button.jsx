import React from 'react';
import { RefreshCw } from 'lucide-react';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  disabled = false,
  onClick,
  className = '', 
  ...props 
}) => {
  const baseStyle = "inline-flex items-center justify-center font-mono tracking-widest uppercase transition-all duration-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0e1a] focus:ring-[#3b82f6] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-[1px]";
  
  const variants = {
    primary: "bg-[#3b82f6] text-white hover:bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] border border-transparent",
    danger: "bg-[#ef4444] text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] border border-transparent",
    success: "bg-[#10b981] text-white hover:bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-transparent",
    ghost: "bg-transparent text-[#64748b] hover:text-white hover:bg-[#1e2d4a]",
    outline: "bg-transparent border border-[#1e2d4a] text-[#f1f5f9] hover:border-[#3b82f6] hover:bg-[#3b82f6]/10"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base font-bold"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || disabled}
      onClick={onClick}
      {...props}
    >
      {loading ? (
         <div className="flex items-center justify-center">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            <span>WAITING...</span>
         </div>
      ) : children}
    </button>
  );
};

export default Button;
