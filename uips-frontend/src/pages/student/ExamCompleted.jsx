import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const ExamCompleted = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Get exam data from sessionStorage if available
  const examData = sessionStorage.getItem('uips_exam_completion');

  useEffect(() => {
    // Clear session storage on completion page
    sessionStorage.removeItem('uips_session_id');
    sessionStorage.removeItem('uips_exam_id');
  }, []);

  const handleExitToLogin = async () => {
    // Logout and redirect to login
    await logout();
    sessionStorage.removeItem('uips_exam_completion');
    navigate('/login');
  };

  return (
    <div className="h-screen bg-[#0a0e1a] text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-[#151d35] border border-[#1e2d4a] rounded-lg p-12 shadow-[0_0_30px_rgba(59,130,246,0.2)] text-center space-y-8">

        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-[#10b981]/20 rounded-full flex items-center justify-center border-2 border-[#10b981]">
            <span className="text-6xl">✓</span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-4xl font-mono font-bold mb-2 tracking-widest">EXAM COMPLETED</h1>
          <p className="text-[#64748b] font-mono text-sm tracking-wider">Session successfully submitted and stored</p>
        </div>

        {/* Status Box */}
        <div className="bg-[#0f1629] border border-[#10b981]/30 rounded-lg p-6 space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-[#64748b] font-mono text-sm">SESSION STATUS</span>
            <span className="text-[#10b981] font-bold font-mono">COMPLETED</span>
          </div>
          <div className="w-full h-px bg-[#1e2d4a]"></div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[#64748b] font-mono text-sm">INTEGRITY REPORT</span>
            <span className="text-[#3b82f6] font-bold font-mono">GENERATED</span>
          </div>
          <div className="w-full h-px bg-[#1e2d4a]"></div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[#64748b] font-mono text-sm">DATA STORED</span>
            <span className="text-[#10b981] font-bold font-mono">VERIFIED</span>
          </div>
        </div>

        {/* Message */}
        <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg p-4">
          <p className="text-[#f1f5f9] text-sm leading-relaxed">
            Your exam responses and integrity analysis have been securely recorded.
            Your invigilator will review the session data and provide feedback.
          </p>
        </div>

        {/* Exit Button */}
        <button
          onClick={handleExitToLogin}
          className="w-full py-4 px-6 bg-[#3b82f6] hover:bg-blue-600 text-white font-mono font-bold tracking-widest uppercase rounded-md transition-colors shadow-[0_0_20px_rgba(59,130,246,0.15)]"
        >
          EXIT TO LOGIN
        </button>

        {/* Footer Text */}
        <p className="text-xs text-[#64748b] font-mono tracking-wider">
          Session ID: {sessionStorage.getItem('uips_completion_session_id') || 'N/A'}
        </p>
      </div>
    </div>
  );
};

export default ExamCompleted;
