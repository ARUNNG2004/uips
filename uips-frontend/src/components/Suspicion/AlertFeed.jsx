import React, { useEffect, useRef } from 'react';
import Badge from '../UI/Badge';
import { CheckCircle } from 'lucide-react';

const AlertFeed = ({ alerts = [], maxHeight = "300px" }) => {
  const feedEndRef = useRef(null);

  useEffect(() => {
    if (feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [alerts]);

  const TimeAgo = ({ time }) => {
     const diff = Math.floor((Date.now() - new Date(time).getTime())/1000);
     let str = 'just now';
     if(diff > 60) str = `${Math.floor(diff/60)}m ago`;
     else if(diff > 0) str = `${diff}s ago`;
     return <span className="text-xs text-[#64748b] font-mono whitespace-nowrap">{str}</span>
  };

  if (alerts.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-6 bg-[#0f1629] border border-dashed border-[#1e2d4a] rounded-lg" style={{ height: maxHeight }}>
         <CheckCircle className="w-8 h-8 text-[#10b981] mb-3 opacity-80" strokeWidth={1.5} />
         <span className="font-mono tracking-widest text-[#10b981] text-xs uppercase text-center opacity-80">
            NO ALERTS — SYSTEM NOMINAL
         </span>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto pr-2 bg-[#0f1629] rounded-lg border border-[#1e2d4a] relative" style={{ maxHeight }}>
      <div className="p-3 space-y-3">
          {alerts.map((alert, i) => (
            <div 
              key={alert.id || i} 
              className="flex items-center space-x-3 p-3 bg-[#151d35] border border-[#1e2d4a] rounded-md"
              style={{ animation: 'slideInRight 0.3s ease-out forwards' }}
            >
              {/* Dot */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${alert.severity === 'high' ? 'bg-[#ef4444]' : alert.severity === 'medium' ? 'bg-[#f59e0b]' : 'bg-[#10b981]'}`} />
              
              {/* Center */}
              <div className="flex-1 min-w-0 flex flex-col relative">
                  <div className="flex items-center space-x-2">
                     <span className="text-sm font-bold text-white truncate">{alert.student_name || 'Target'}</span>
                     <TimeAgo time={alert.timestamp} />
                  </div>
                  <span className="text-xs text-[#64748b] truncate capitalize">{(alert.event_type || alert.type || 'Event').replace('_', ' ')}</span>
              </div>

              {/* Right */}
              <Badge variant={alert.severity === 'high' ? 'danger' : alert.severity === 'medium' ? 'warning' : 'info'} size="sm">
                 {(alert.severity || 'info').toUpperCase()}
              </Badge>
            </div>
          ))}
          <div ref={feedEndRef} />
      </div>

      <style>{`
         @keyframes slideInRight {
           from { opacity: 0; transform: translateX(20px); }
           to { opacity: 1; transform: translateX(0); }
         }
      `}</style>
    </div>
  );
};

export default AlertFeed;
