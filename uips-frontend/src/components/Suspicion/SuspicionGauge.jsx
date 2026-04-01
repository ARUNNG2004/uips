import React from 'react';

const SuspicionGauge = ({ score = 0, size = "md", animated = true }) => {
  const val = Math.min(Math.max(score, 0), 100);
  const sizeMap = { sm: 80, md: 120, lg: 160 };
  const d = sizeMap[size] || 120;
  
  // ViewBox is 120x120, radius 50
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (val / 100) * circumference;

  let colorHex = '#10b981';
  let lbl = 'LOW';
  if (val >= 30 && val <= 70) {
    colorHex = '#f59e0b';
    lbl = 'MEDIUM';
  } else if (val > 70) {
    colorHex = '#ef4444';
    lbl = 'HIGH';
  }

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: d, height: d }}>
        <svg 
            width={d} height={d} 
            viewBox="0 0 120 120" 
            className="transform -rotate-90 absolute inset-0"
        >
          {/* Background Track */}
          <circle
            cx="60" cy="60" r={radius}
            fill="transparent"
            stroke="#1e2d4a"
            strokeWidth="12"
          />
          {/* Foreground Arc */}
          <circle
            cx="60" cy="60" r={radius}
            fill="transparent"
            stroke={colorHex}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`${animated ? 'transition-all duration-1000 ease-in-out' : ''}`}
          />
        </svg>

        <div className="relative z-10 flex flex-col items-center justify-center h-full pt-1">
           <span className="font-mono font-bold tracking-tighter" style={{ fontSize: d * 0.25, color: val > 70 ? 'white' : 'white', lineHeight: 1 }}>
               {Math.round(val)}
           </span>
           <span className="font-mono uppercase tracking-widest mt-1" style={{ fontSize: d * 0.08, color: colorHex }}>
               {lbl}
           </span>
        </div>
    </div>
  );
};

export default SuspicionGauge;
