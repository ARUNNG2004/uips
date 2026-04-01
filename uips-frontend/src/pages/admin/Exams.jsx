import React, { useEffect, useRef, useState } from 'react';
import client from '../../api/client';
import Card from '../../components/UI/Card';
import Table from '../../components/UI/Table';
import Button from '../../components/UI/Button';
import Badge from '../../components/UI/Badge';
import Modal from '../../components/UI/Modal';
import Input from '../../components/UI/Input';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { MonitorPlay, Clock, CheckCircle, Database } from 'lucide-react';

const normalizeTimeForApi = (value) => {
   if (!value) return value;
   return value.length === 5 ? `${value}:00` : value;
};

const timeToSeconds = (value) => {
   if (!value) return 0;
   const parts = value.split(':').map(Number);
   const [hours = 0, minutes = 0, seconds = 0] = parts;
   return (hours * 3600) + (minutes * 60) + seconds;
};

const formatTimeForDisplay = (value) => {
   if (!value) return '-';

   const asString = String(value).trim();
   const timeOnlyMatch = asString.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
   if (timeOnlyMatch) {
      return `${timeOnlyMatch[1]}:${timeOnlyMatch[2]}`;
   }

   const parsed = new Date(asString);
   if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
   }

   return asString;
};

const Exams = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
   const inFlightRef = useRef(false);
   const retryTimeoutRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [mode, setMode] = useState('online');

  useEffect(() => {
     fetchExams();
       const intv = setInterval(fetchExams, 60000); // 60s refresh to reduce rate-limit pressure
       return () => {
          clearInterval(intv);
          if (retryTimeoutRef.current) {
             clearTimeout(retryTimeoutRef.current);
          }
       };
  }, []);

   const fetchExams = () => {
       if (inFlightRef.current) return;
       inFlightRef.current = true;

       client.get('/api/exams')
         .then(res => {
               setExams(res.data);
               setError(null);
         })
         .catch(err => {
            const status = err.response?.status;
            if (status === 429) {
               const retryAfterRaw = err.response?.headers?.['retry-after'];
               const retryAfterSec = Number(retryAfterRaw);
               const retryMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 30000;

               setError(`Too many requests. Retrying in ${Math.ceil(retryMs / 1000)}s...`);

               if (retryTimeoutRef.current) {
                  clearTimeout(retryTimeoutRef.current);
               }
               retryTimeoutRef.current = setTimeout(() => {
                  fetchExams();
               }, retryMs);
               return;
            }

            setError(err.response?.data?.error || err.message);
         })
         .finally(() => {
            inFlightRef.current = false;
            setLoading(false);
         });
  };

  const handleDelete = async (id) => {
     if (!window.confirm('Delete this exam? This will also remove related sessions.')) return;
     try {
        await client.delete(`/api/exams/${id}`);
        fetchExams();
     } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete exam.');
     }
  };

  const handleUpdateStatus = async (id, status) => {
     await client.patch(`/api/exams/${id}`, { status }).then(fetchExams).catch(console.error);
  };

  const handleSubmit = async (e) => {
     e.preventDefault();
     if (timeToSeconds(end) <= timeToSeconds(start)) {
        return alert('End time must be after start time');
     }
     setSubmitting(true);
     try {
       await client.post('/api/exams', {
          title, description: desc,
          start_time: normalizeTimeForApi(start),
          end_time: normalizeTimeForApi(end),
          mode
       });
       setOpen(false);
       setTitle(''); setDesc(''); setStart(''); setEnd(''); setMode('online');
       fetchExams();
     } catch(err) {
          alert(err.response?.data?.error || 'Failed to create exam');
     } finally {
       setSubmitting(false);
     }
  };

  const activeCount = exams.filter(e => e.status === 'active').length;
  const completedCount = exams.filter(e => e.status === 'completed').length;

  const columns = [
    { header: 'Title', accessor: 'title' },
    { header: 'Mode', render: (row) => (
         <Badge variant={row.mode==='online'?'info':'warning'}>{row.mode.toUpperCase()}</Badge>
    )},
    { header: 'Status', render: (row) => (
         <div className="flex items-center space-x-2">
            {row.status==='active' && <div className="w-2 h-2 rounded-full bg-uips-success animate-pulse" />}
            <span className={`font-mono text-xs tracking-widest uppercase ${row.status==='active'?'text-uips-success':row.status==='completed'?'text-uips-primary':'text-uips-muted'}`}>
                {row.status}
            </span>
         </div>
    )},
   { header: 'Start Time', render: (row) => formatTimeForDisplay(row.start_time) },
   { header: 'End Time', render: (row) => formatTimeForDisplay(row.end_time) },
    { header: 'Author ID', render: (row) => <span className="text-uips-muted font-mono">{row.created_by}</span> },
    { header: 'Actions', render: (row) => (
       <div className="flex space-x-2">
          {row.status === 'scheduled' && <Button size="sm" onClick={() => handleUpdateStatus(row.id, 'active')} className="text-[10px] tracking-widest font-mono p-1">SET ACTIVE</Button>}
           {row.status === 'active' && <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(row.id, 'completed')} className="text-[10px] tracking-widest font-mono p-1">MARK COMPLETE</Button>}
           <Button size="sm" variant="danger" onClick={() => handleDelete(row.id)} className="text-[10px] tracking-widest font-mono p-1">DELETE</Button>
       </div>
    )}
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
         {error && (
            <div className="p-4 rounded-md border border-uips-warning/40 bg-uips-warning/10 text-uips-warning text-sm font-mono">
               Unable to load exams: {error}
            </div>
         )}

       <div className="flex justify-between items-center border-b border-uips-border pb-5">
         <div>
            <h1 className="text-3xl font-mono font-bold text-white mb-2">EXAM MANAGEMENT</h1>
                  <p className="text-uips-muted">Create and manage exams for monitored sessions.</p>
         </div>
             <Button onClick={() => setOpen(true)} className="font-mono tracking-widest">+ CREATE EXAM</Button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card glow={false} className="flex items-center space-x-4 border-l-4 border-l-uips-border">
             <div className="p-3 bg-uips-surface rounded-lg"><Database className="w-6 h-6 text-uips-muted" /></div>
             <div><span className="text-xs font-mono text-uips-muted block">TOTAL EXAMS</span><span className="text-3xl font-bold font-mono text-white">{exams.length}</span></div>
          </Card>
          <Card glow={false} className="flex items-center space-x-4 border-l-4 border-l-uips-success">
             <div className="p-3 bg-uips-success/10 rounded-lg"><MonitorPlay className="w-6 h-6 text-uips-success" /></div>
             <div><span className="text-xs font-mono text-uips-muted block">ACTIVE EXAMS</span><span className="text-3xl font-bold font-mono text-uips-success">{activeCount}</span></div>
          </Card>
          <Card glow={false} className="flex items-center space-x-4 border-l-4 border-l-uips-primary">
             <div className="p-3 bg-uips-primary/10 rounded-lg"><CheckCircle className="w-6 h-6 text-uips-primary" /></div>
             <div><span className="text-xs font-mono text-uips-muted block">COMPLETED EXAMS</span><span className="text-3xl font-bold font-mono text-white">{completedCount}</span></div>
          </Card>
       </div>

       <Card header={<span className="font-mono tracking-widest text-sm font-bold text-uips-text">EXAMS</span>}>
         {loading ? <LoadingSpinner size="md" className="py-10" /> : (
            exams.length === 0 ? (
               <div className="py-16 text-center border-2 border-dashed border-uips-border rounded-lg bg-uips-surface/50">
                   <p className="text-uips-muted font-mono tracking-widest uppercase">No exams created yet</p>
               </div>
            ) : (
               <Table columns={columns} data={exams} keyField="id" />
            )
         )}
       </Card>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Create New Exam">
           <form onSubmit={handleSubmit} className="space-y-5">
         <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advanced CS Final" required />

              <div className="flex flex-col space-y-1.5">
                 <label className="text-sm font-medium text-uips-muted">Description</label>
                 <textarea
                    className="w-full bg-uips-surface border border-uips-border text-uips-text text-sm rounded-md px-4 py-2.5 outline-none focus:ring-1 focus:ring-uips-primary"
                    rows="3" value={desc} onChange={e => setDesc(e.target.value)} required
                 />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <Input label="Start Time" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
                 <Input label="End Time" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
              </div>

              <div className="flex space-x-4">
                 <label className="flex items-center space-x-2 text-uips-text cursor-pointer">
                    <input type="radio" value="online" checked={mode === 'online'} onChange={e => setMode(e.target.value)} className="text-uips-primary bg-uips-surface border-uips-border form-radio focus:ring-uips-primary focus:ring-offset-uips-bg" />
                    <span>Online</span>
                 </label>
                 <label className="flex items-center space-x-2 text-uips-text cursor-pointer">
                    <input type="radio" value="classroom" checked={mode === 'classroom'} onChange={e => setMode(e.target.value)} className="text-uips-primary bg-uips-surface border-uips-border form-radio focus:ring-uips-primary focus:ring-offset-uips-bg" />
                    <span>Classroom</span>
                 </label>
              </div>

              <Button type="submit" loading={submitting} className="w-full mt-4 font-mono tracking-widest">CREATE EXAM</Button>
           </form>
       </Modal>
    </div>
  );
};

export default Exams;
