import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../../components/UI/Badge';
import Button from '../../components/UI/Button';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { ChevronLeft, ShieldAlert, Activity, Clock, FileWarning, Search } from 'lucide-react';

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket(user?.id);

  const [session, setSession] = useState(null);
  const [exam, setExam] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [analysing, setAnalysing] = useState(false);
  const [duration, setDuration] = useState('00:00:00');

   useEffect(() => {
    client.get(`/api/sessions/${id}`)
      .then(res => {
               const sessionData = res.data;
               setSession(sessionData);
               setHistory(Array.from({ length: 20 }, (_, i) => ({ time: i + 1, score: sessionData.suspicion_index })));
               fetchAlerts(sessionData.student_id);
               return client.get(`/api/exams/${sessionData.exam_id}`);
      })
         .then((res) => setExam(res.data))
      .catch(() => navigate('/invigilator/dashboard'));
   }, [id, navigate]);

   useEffect(() => {
      if (!session?.student_id) return;
      const tableIntv = setInterval(() => {
         fetchAlerts(session.student_id);
      }, 10000);

      return () => clearInterval(tableIntv);
   }, [session?.student_id]);

   const fetchAlerts = (studentId) => {
       if (!studentId) return;
       client.get(`/api/monitor/${studentId}/alerts`)
       .then(res => setAlerts(res.data))
       .catch(console.error);
  }

  useEffect(() => {
     if(!session?.started_at) return;
     const start = new Date(session.started_at).getTime();
     const t = setInterval(() => {
        const diff = Math.floor((Date.now() - start)/1000);
        const h = Math.floor(diff/3600).toString().padStart(2, '0');
        const m = Math.floor((diff%3600)/60).toString().padStart(2, '0');
        const s = (diff%60).toString().padStart(2, '0');
        setDuration(`${h}:${m}:${s}`);
     }, 1000);
     return () => clearInterval(t);
  }, [session?.started_at]);

  useEffect(() => {
    if (socket) {
      socket.on('score_update', (data) => {
        if (data.session_id === parseInt(id)) {
           setSession(prev => prev ? { ...prev, suspicion_index: data.suspicion_index } : prev);
           setHistory(prev => {
              const newArr = [...prev, { time: Date.now(), score: data.suspicion_index }];
              if(newArr.length > 20) return newArr.slice(newArr.length - 20);
              return newArr;
           });
        }
      });
         socket.on('alert', () => fetchAlerts(session?.student_id));
    }
    return () => {
      if(socket){ socket.off('score_update'); socket.off('alert'); }
    };
   }, [socket, id, session?.student_id]);

  const forceAnalysis = async () => {
     setAnalysing(true);
     try {
       const res = await client.post(`/api/monitor/analyse/${id}`);
          alert(`Analysis generated. Score: ${res.data.suspicion_index.toFixed(1)}`);
     } catch (e) {
          alert('Analysis failed. Please try again.');
     } finally {
       setAnalysing(false);
     }
  };

  const updateSessionStatus = async (newStatus) => {
     try {
       await client.patch(`/api/monitor/session/${id}/status`, { status: newStatus });
       setSession(prev => ({ ...prev, status: newStatus }));
       alert(`Session ${newStatus === 'completed' ? 'ended' : 'resumed'} successfully.`);
     } catch (e) {
       alert(`Failed to update session status.`);
     }
  };

  if (!session) return <LoadingSpinner className="h-full" size="lg" />;

  const val = Math.round(session.suspicion_index);
  const isHigh = val > 70;
  const isMed = val >= 30 && val <= 70;
  const colorHex = isHigh ? '#ef4444' : isMed ? '#f59e0b' : '#10b981';

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex justify-between items-center border-b border-uips-border pb-5">
         <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/invigilator/dashboard')} className="p-2 border border-uips-border rounded bg-uips-surface hover:bg-uips-primary/20 transition-colors">
               <ChevronLeft className="w-5 h-5 text-white" strokeWidth={2} />
            </button>
            <div>
               <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold font-mono text-white tracking-widest uppercase">Student #{session.student_id}</h1>
                  <Badge variant={session.status === 'ongoing' ? 'success' : 'warning'}>{session.status}</Badge>
               </div>
               <p className="text-uips-muted font-mono tracking-widest text-xs mt-1 uppercase leading-none">
                  Exam: {exam?.title || `Exam ${session.exam_id}`}
               </p>
            </div>
         </div>
         <div className="flex space-x-3">
            {session.status === 'ongoing' && (
               <Button variant="danger" size="sm" onClick={() => updateSessionStatus('completed')} className="font-mono text-xs tracking-widest">
                  End Exam
               </Button>
            )}
            {session.status === 'completed' && (
               <Button variant="success" size="sm" onClick={() => updateSessionStatus('ongoing')} className="font-mono text-xs tracking-widest">
                  Resume Exam
               </Button>
            )}
         </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="bg-uips-card border border-uips-border p-5 rounded-lg shadow-glow">
            <span className="text-xs font-mono tracking-widest text-uips-muted flex items-center mb-2"><Activity className="w-4 h-4 mr-2"/> Current Score</span>
            <div className={`text-4xl font-mono font-bold`} style={{ color: colorHex }}>{val}</div>
         </div>
         <div className="bg-uips-card border border-uips-border p-5 rounded-lg shadow-glow">
            <span className="text-xs font-mono tracking-widest text-uips-muted flex items-center mb-2"><FileWarning className="w-4 h-4 mr-2"/> Alerts</span>
            <div className={`text-4xl font-mono font-bold text-white`}>{alerts.length}</div>
         </div>
         <div className="bg-uips-card border border-uips-border p-5 rounded-lg shadow-glow">
            <span className="text-xs font-mono tracking-widest text-uips-muted flex items-center mb-2"><Clock className="w-4 h-4 mr-2"/> Session Time</span>
            <div className={`text-4xl font-mono font-bold text-uips-primary`}>{duration}</div>
         </div>
         <div className="bg-uips-card border border-uips-border p-5 rounded-lg shadow-glow relative overflow-hidden">
            <span className="text-xs font-mono tracking-widest text-uips-muted flex items-center mb-2"><ShieldAlert className="w-4 h-4 mr-2"/> Risk Level</span>
            <div className="text-3xl font-mono font-bold mt-2 tracking-widest" style={{ color: colorHex }}>{isHigh ? 'HIGH' : isMed ? 'MEDIUM' : 'LOW'}</div>
            <div className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: colorHex }} />
         </div>
      </div>

      {/* Score chart */}
      <div className="bg-uips-card border border-uips-border rounded-lg p-6 shadow-glow">
         <div className="flex justify-between items-center mb-6">

            <h2 className="font-mono tracking-widest font-bold text-sm uppercase text-uips-muted">Suspicion Score Timeline</h2>
            <Button size="sm" onClick={forceAnalysis} loading={analysing} className="font-mono text-xs tracking-widest"><Search className="w-3 h-3 mr-2"/> Run Analysis</Button>
         </div>
         <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
               <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 100]} stroke="#64748b" ticMargin={10} width={30} tick={{ fontSize: 12, fontFamily: 'monospace' }} />
                  <RechartsTooltip
                     contentStyle={{ backgroundColor: '#0f1629', borderColor: '#1e2d4a', borderRadius: '8px' }}
                     itemStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                     formatter={(v) => [v.toFixed(1), 'Score']}
                     labelFormatter={() => 'Update'}
                  />
                  <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" />
                  <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" />
                  <Line
                     type="monotone"
                     dataKey="score"
                     stroke={colorHex}
                     strokeWidth={3}
                     dot={false}
                     isAnimationActive={true}
                     animationDuration={500}
                  />
               </LineChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* Alerts table */}
      <div className="bg-uips-card border border-uips-border rounded-lg shadow-glow overflow-hidden">
         <div className="p-4 border-b border-uips-border bg-uips-surface">
             <h2 className="font-mono tracking-widest font-bold text-sm uppercase text-uips-muted">Recent Alerts</h2>
         </div>
         <div className="overflow-x-auto">
             <table className="w-full text-left font-mono text-sm border-collapse">
                <thead className="bg-[#0f1629] text-[#64748b] border-b border-[#1e2d4a]">
                   <tr>
                      <th className="px-6 py-3 tracking-widest font-normal uppercase">Time</th>
                      <th className="px-6 py-3 tracking-widest font-normal uppercase">Event</th>
                      <th className="px-6 py-3 tracking-widest font-normal uppercase">Severity</th>
                      <th className="px-6 py-3 tracking-widest font-normal uppercase">Score Change</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-uips-border">
                   {alerts.length===0 && (
                      <tr><td colSpan="4" className="text-center py-10 text-uips-muted tracking-widest">No alerts available.</td></tr>
                   )}
                   {alerts.map((a, i) => (
                      <tr key={i} className={`hover:bg-uips-surface/50 transition-colors ${a.severity === 'high' ? 'bg-[#ef4444]/5' : ''}`}>
                         <td className="px-6 py-3 text-uips-muted">{new Date(a.timestamp).toLocaleTimeString()}</td>
                         <td className="px-6 py-3 text-white capitalize">{a.event_type.replace('_', ' ')}</td>
                         <td className="px-6 py-3"><Badge variant={a.severity==='high'?'danger': a.severity==='medium' ? 'warning' : 'success'}>{a.severity.toUpperCase()}</Badge></td>
                         <td className="px-6 py-3 font-bold text-[#ef4444]">{a.score_delta > 0 ? `+${a.score_delta}` : a.score_delta || 0}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
         </div>
      </div>

    </div>
  );
};

export default StudentDetail;
