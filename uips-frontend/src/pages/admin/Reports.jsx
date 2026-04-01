import React, { useEffect, useState, useMemo } from 'react';
import client from '../../api/client';
import Card from '../../components/UI/Card';
import Table from '../../components/UI/Table';
import Badge from '../../components/UI/Badge';
import Button from '../../components/UI/Button';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download, FileBox, ShieldCheck, Search, Activity } from 'lucide-react';

const Reports = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
   const [exportingAll, setExportingAll] = useState(false);

  useEffect(() => {
     client.get('/api/exams')
      .then(res => setExams(res.data.filter(e => e.status === 'completed')))
      .catch(console.error);
  }, []);

  const loadReports = (examId) => {
     setSelectedExamId(examId);
     setLoading(true);
     setError(null);
     client.get(`/api/reports/${examId}`)
        .then(res => setReports(res.data))
        .catch(err => setError(err.response?.data?.error || 'Error loading reports'))
        .finally(() => setLoading(false));
  };

  const handleGenerate = async (sessionId) => {
     try {
        await client.get(`/api/reports/generate/${sessionId}`);
        window.open(`${client.defaults.baseURL}/api/reports/download/${sessionId}`, '_blank');
        alert('Report generated and download started.');
        if (selectedExamId) loadReports(selectedExamId);
     } catch (e) {
        alert('Report generation failed.');
     }
  };

  const exportAll = () => {
       if (!selectedExamId) {
          alert('Please select an exam first.');
          return;
       }

       setExportingAll(true);
       try {
          window.open(`${client.defaults.baseURL}/api/reports/download/exam/${selectedExamId}`, '_blank');
       } finally {
          setTimeout(() => setExportingAll(false), 800);
       }
  };

  const columns = [
    { header: 'Applicant', accessor: 'student_name' },
    { header: 'Score', render: r => <span className={`font-mono font-bold ${r.suspicion_index > 70 ? 'text-uips-danger' : 'text-white'}`}>{r.suspicion_index.toFixed(1)}/100</span> },
    { header: 'Risk', render: r => (
         <Badge variant={r.risk_level==='High'?'danger':r.risk_level==='Medium'?'warning':'success'}>{r.risk_level.toUpperCase()}</Badge>
    )},
    { header: 'Alerts', render: r => <span className="text-uips-muted font-mono">{r.anomalies_count || 0}</span> },
    { header: 'Duration', render: r => {
         if(!r.ended_at || !r.started_at) return "N/A";
         const min = Math.floor((new Date(r.ended_at) - new Date(r.started_at))/60000);
         return <span className="font-mono text-sm">{min} min</span>;
    }},
    { header: 'Actions', render: r => (
       <div className="flex space-x-2">
          <Button size="sm" onClick={() => handleGenerate(r.session_id)} className="text-[10px] tracking-widest font-mono p-1">GENERATE PDF</Button>
          {r.report_url && (
            <Button size="sm" onClick={() => window.open(client.defaults.baseURL + r.report_url, '_blank')} variant="outline" className="text-[10px] tracking-widest font-mono p-1">VIEW REPORT</Button>
          )}
       </div>
    )}
  ];

  // Derive charts logic from reports array
  const { chartData, avg, dist } = useMemo(() => {
      let sum = 0;
      let d = { low: 0, med: 0, high: 0 };
      const cd = reports.map(r => {
         sum += r.suspicion_index;
         if(r.risk_level==='Low') d.low++;
         else if(r.risk_level==='Medium') d.med++;
         else d.high++;

         return {
            name: r.student_name,
            score: parseFloat(r.suspicion_index.toFixed(1)),
            risk: r.risk_level
         };
      });
      return {
         chartData: cd,
         avg: reports.length ? (sum/reports.length).toFixed(1) : 0,
         dist: d
      };
  }, [reports]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 flex flex-col h-full overflow-hidden pb-10">

       <div className="flex justify-between items-center border-b border-uips-border pb-5 shrink-0">
         <div>
            <h1 className="text-3xl font-mono font-bold text-white mb-2 uppercase">Reports</h1>
            <p className="text-uips-muted">View exam session summaries and generated reports.</p>
         </div>
         <div className="flex items-center space-x-4">
             <select
               className="bg-uips-surface border border-uips-border text-uips-text text-sm rounded-md px-4 py-2 outline-none focus:ring-1 focus:ring-uips-primary min-w-[200px]"
               value={selectedExamId}
               onChange={(e) => loadReports(e.target.value)}
             >
                      <option value="" disabled>Select an exam</option>
               {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
             </select>

             <Button variant="outline" onClick={exportAll} disabled={reports.length===0 || exportingAll} loading={exportingAll} className="font-mono tracking-widest text-xs hidden sm:flex">
                <Download className="w-4 h-4 mr-2"/> Export All
             </Button>
         </div>
       </div>

       {loading && <LoadingSpinner size="lg" className="py-20" />}
      {error && <div className="text-uips-danger text-center mt-10 p-10 bg-uips-card border border-uips-danger/50 rounded-md">Unable to load reports: {error}</div>}

       {!loading && !error && selectedExamId && reports.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-uips-border rounded-lg bg-uips-surface/50">
             <FileBox className="w-16 h-16 text-uips-muted mb-4 opacity-50" />
             <p className="text-uips-muted font-mono tracking-widest uppercase">No reports available for this exam.</p>
          </div>
       )}

       {!loading && !error && reports.length > 0 && (
          <div className="flex-1 flex flex-col overflow-hidden space-y-6">

             {/* STATS */}
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-shrink-0">

                <Card className="lg:col-span-4 flex flex-col justify-center items-center text-center">
                   <span className="font-mono text-xs tracking-widest text-uips-muted mb-2 uppercase block w-full"><Activity className="w-4 h-4 inline mr-1"/> Average Suspicion Score</span>
                   <div className="text-5xl font-mono font-bold text-white">{avg}</div>
                   <div className="flex space-x-2 mt-4 text-xs font-mono font-bold">
                      <span className="px-2 py-1 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/50 rounded">{dist.low} LOW</span>
                      <span className="px-2 py-1 bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/50 rounded">{dist.med} MED</span>
                      <span className="px-2 py-1 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/50 rounded">{dist.high} HIGH</span>
                   </div>
                </Card>

                <Card className="lg:col-span-8 p-4">
                  <span className="font-mono text-xs tracking-widest text-uips-muted mb-4 block">Score Distribution</span>
                    <div className="w-full h-32">
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                             <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                             <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 10}} tickLine={false} axisLine={false} />
                             <RechartsTooltip
                                contentStyle={{ backgroundColor: '#0f1629', borderColor: '#1e2d4a', borderRadius: '4px' }}
                                itemStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                                cursor={{fill: '#1e2d4a', opacity: 0.4}}
                             />
                             <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                   <Cell key={`cell-${index}`} fill={entry.risk === 'High' ? '#ef4444' : entry.risk === 'Medium' ? '#f59e0b' : '#3b82f6'} />
                                ))}
                             </Bar>
                          </BarChart>
                       </ResponsiveContainer>
                    </div>
                </Card>

             </div>

             {/* TABLE */}
             <div className="flex-1 overflow-auto bg-uips-card border border-uips-border rounded-lg shadow-glow">
                <Table columns={columns} data={reports} keyField="session_id" />
             </div>

          </div>
       )}

    </div>
  );
};

export default Reports;
