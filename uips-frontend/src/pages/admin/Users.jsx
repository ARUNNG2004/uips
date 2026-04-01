import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import Card from '../../components/UI/Card';
import Table from '../../components/UI/Table';
import Button from '../../components/UI/Button';
import Badge from '../../components/UI/Badge';
import Modal from '../../components/UI/Modal';
import Input from '../../components/UI/Input';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { Eye, EyeOff, Users as UsersIcon, GraduationCap, Shield } from 'lucide-react';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user: currentUser } = useAuth();

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = () => {
     client.get('/api/users')
      .then(res => { setUsers(res.data); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id) => {
     if (!window.confirm('Erase this agent array target forever?')) return;
     try {
        await client.delete(`/api/users/${id}`);
        fetchUsers();
     } catch (err) {
        alert(err.response?.data?.error || 'Unable to erase this user.');
     }
  };

  const handleSubmit = async (e) => {
     e.preventDefault();
     if(password.length < 6) return alert("Secret passcodes require > 6 chars length");
     setSubmitting(true);
     try {
       await client.post('/api/users', { name, email, password, role });
       setOpen(false);
       setName(''); setEmail(''); setPassword(''); setRole('student');
       fetchUsers();
     } catch(err) {
       alert(err.response?.data?.error || 'Target deployment failed');
     } finally {
       setSubmitting(false);
     }
  };

  const filteredUsers = users.filter(u => filter === 'all' || u.role === filter);

  const columns = [
    { header: 'Agent Array', render: (row) => (
       <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-uips-surface border border-uips-border flex items-center justify-center font-mono font-bold text-uips-primary shrink-0">
             {row.name.substring(0,2).toUpperCase()}
          </div>
          <span className="font-bold text-white">{row.name}</span>
       </div>
    )},
    { header: 'Comms Email', accessor: 'email' },
    { header: 'Privileges', render: (row) => {
         const vars = { student: 'info', invigilator: 'warning', admin: 'success' };
         return <Badge variant={vars[row.role]}>{row.role.toUpperCase()}</Badge>
    }},
    { header: 'Creation Epoch', render: (row) => <span className="text-uips-muted font-mono text-xs">{new Date(row.created_at).toLocaleDateString()}</span> },
    { header: 'Directives', render: (row) => (
       <div className="flex space-x-2">
          {/* Prevent root self deletion and protect parallel admins theoretically */}
          {row.id !== currentUser.id && row.role !== 'admin' && (
             <Button size="sm" variant="danger" onClick={() => handleDelete(row.id)} className="text-[10px] tracking-widest font-mono p-1">ERASE</Button>
          )}
       </div>
    )}
  ];

  if (error) return <div className="text-uips-danger text-center mt-10 p-10 bg-uips-card border border-uips-danger/50 rounded-md">NETWORK ERROR: {error}</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">

       <div className="flex justify-between items-center border-b border-uips-border pb-5">
         <div>
            <h1 className="text-3xl font-mono font-bold text-white mb-2 uppercase">Identity Arrays</h1>
            <p className="text-uips-muted">Declare encrypted users executing platform routines.</p>
         </div>
         <Button onClick={() => setOpen(true)} className="font-mono tracking-widest">+ PROVISION ROOT AGENT</Button>
       </div>

       {/* STATS */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card glow={false} className="flex items-center space-x-4 border-l-4 border-l-uips-border p-4">
             <div className="p-3 bg-uips-surface rounded-lg"><UsersIcon className="w-6 h-6 text-uips-muted" /></div>
             <div><span className="text-xs font-mono text-uips-muted block">TOTAL ARRAYS</span><span className="text-2xl font-bold font-mono text-white">{users.length}</span></div>
          </Card>
          <Card glow={false} className="flex items-center space-x-4 border-l-4 border-l-uips-primary p-4">
             <div className="p-3 bg-uips-primary/10 rounded-lg"><GraduationCap className="w-6 h-6 text-uips-primary" /></div>
             <div><span className="text-xs font-mono text-uips-muted block">APPLICANTS</span><span className="text-2xl font-bold font-mono text-white">{users.filter(u=>u.role==='student').length}</span></div>
          </Card>
          <Card glow={false} className="flex items-center space-x-4 border-l-4 border-l-uips-warning p-4">
             <div className="p-3 bg-uips-warning/10 rounded-lg"><Shield className="w-6 h-6 text-uips-warning" /></div>
             <div><span className="text-xs font-mono text-uips-muted block">OVERSIGHT / INVIGILATORS</span><span className="text-2xl font-bold font-mono text-white">{users.filter(u=>u.role==='invigilator').length}</span></div>
          </Card>
       </div>

       <div className="flex space-x-4 border-b border-uips-border">
          {['all', 'student', 'invigilator', 'admin'].map(t => (
             <button
                key={t}
                onClick={() => setFilter(t)}
                className={`py-3 px-4 font-mono text-xs tracking-widest uppercase border-b-2 transition-colors ${filter === t ? 'border-uips-primary text-uips-primary' : 'border-transparent text-uips-muted hover:text-white'}`}
             >
               {t}
             </button>
          ))}
       </div>

       <Card className="p-0 overflow-hidden border-0" glow={false}>
         {loading ? <LoadingSpinner size="md" className="py-10" /> : (
            filteredUsers.length === 0 ? (
               <div className="py-16 text-center border-2 border-dashed border-uips-border rounded-lg bg-uips-surface/50">
                   <p className="text-uips-muted font-mono tracking-widest uppercase">No Identity Match in Filter Array.</p>
               </div>
            ) : (
               <Table columns={columns} data={filteredUsers} keyField="id" />
            )
         )}
       </Card>

       <Modal isOpen={open} onClose={() => setOpen(false)} title="DEPLOY INDIVIDUAL AGENT">
           <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Cleartext Identity" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input label="Authentication Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

              <div className="flex flex-col space-y-1.5 relative">
                 <label className="text-sm font-medium text-uips-muted">Key Passphrase</label>
                 <div className="relative">
                    <input
                      className="w-full bg-uips-surface border border-uips-border text-uips-text text-sm rounded-md px-4 py-2.5 outline-none focus:ring-1 focus:ring-uips-primary pr-10"
                      type={showPassword ? 'text' : 'password'}
                      value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-uips-muted hover:text-white">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                 </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                 <label className="text-sm font-medium text-uips-muted">Assigned Node Privilege Level</label>
                 <select
                    className="bg-uips-surface border border-uips-border text-uips-text text-sm rounded-md px-4 py-2.5 outline-none focus:ring-1 focus:ring-uips-primary"
                    value={role} onChange={(e) => setRole(e.target.value)}
                 >
                    <option value="student">STUDENT APPLICANT</option>
                    <option value="invigilator">COMMAND / INVIGILATOR</option>
                    <option value="admin">ROOT / ADMIN</option>
                 </select>
              </div>

              <Button type="submit" loading={submitting} className="w-full mt-4 font-mono tracking-widest">PROVISION NEW ARRAY IDENTITY</Button>
           </form>
       </Modal>
    </div>
  );
};

export default Users;
