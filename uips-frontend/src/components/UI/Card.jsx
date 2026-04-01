import React from 'react';

const Card = ({ title, actions, glow = false, children, className = '' }) => {
  return (
    <div className={`bg-[#151d35] border border-[#1e2d4a] rounded-lg flex flex-col transition-shadow duration-300 ${glow ? 'hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]' : ''} ${className}`}>
      {/* Header section */}
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-[#1e2d4a] flex justify-between items-center bg-[#0f1629] rounded-t-lg shrink-0">
          {title && <h3 className="text-sm font-mono tracking-widest text-[#f1f5f9] uppercase font-bold">{title}</h3>}
          {actions && <div className="flex space-x-2">{actions}</div>}
        </div>
      )}
      
      {/* Content section */}
      <div className={`flex-1 min-h-0 ${title ? 'p-6' : className.includes('p-') ? '' : 'p-6'}`}>
        {children}
      </div>
    </div>
  );
};

export default Card;
