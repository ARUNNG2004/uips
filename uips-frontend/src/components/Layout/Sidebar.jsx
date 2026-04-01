import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, Monitor, Users, FileText, Activity } from 'lucide-react';

const Sidebar = ({ role = 'student', isOpen, toggleSidebar }) => {

  const getLinks = () => {
    switch (role) {
      case 'admin':
        return [
          { name: 'Dashboard', path: '/invigilator/dashboard', icon: <Activity className="w-5 h-5" /> },
          { name: 'Exams', path: '/admin/exams', icon: <Monitor className="w-5 h-5" /> },
          { name: 'Users', path: '/admin/users', icon: <Users className="w-5 h-5" /> },
          { name: 'Reports', path: '/admin/reports', icon: <FileText className="w-5 h-5" /> },
        ];
      case 'invigilator':
        return [
          { name: 'Live Dashboard', path: '/invigilator/dashboard', icon: <Activity className="w-5 h-5" /> },
          { name: 'Reports', path: '/invigilator/reports', icon: <FileText className="w-5 h-5" /> },
        ];
      case 'student':
      default:
        return [
          { name: 'Waiting Room', path: '/student/waiting-room', icon: <Shield className="w-5 h-5" /> }
        ];
    }
  };

  const links = getLinks();

  return (
    <>
       {/* Mobile Overlay */}
       {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={toggleSidebar} />}

       <aside className={`fixed md:relative top-14 md:top-0 left-0 h-[calc(100vh-56px)] md:h-full w-60 bg-[#0f1629] border-r border-[#1e2d4a] flex-shrink-0 flex flex-col pt-6 z-40 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

         <div className="flex-1 overflow-y-auto px-3 space-y-1">
           {links.map((link, idx) => (
             <NavLink
               key={idx}
               to={link.path}
               onClick={() => {
                 if (window.innerWidth < 768 && toggleSidebar) toggleSidebar();
               }}
               className={({ isActive }) =>
                 `flex items-center space-x-3 px-3 py-2.5 rounded-md font-mono text-sm tracking-widest uppercase transition-colors duration-200
                  ${isActive
                    ? 'bg-[#1e2d4a] text-[#3b82f6] border-l-4 border-[#3b82f6] pl-2'
                    : 'text-[#64748b] hover:bg-[#151d35] hover:text-white border-l-4 border-transparent pl-2'}`
               }
             >
               {link.icon}
               <span>{link.name}</span>
             </NavLink>
           ))}
         </div>

         <div className="p-4 border-t border-[#1e2d4a] mt-auto">
             <div className="flex items-center space-x-2 text-xs font-mono tracking-widest uppercase text-[#64748b] mb-1">
                 <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
                 <span>System Online</span>
             </div>
             <div className="text-[10px] text-[#64748b]/50 font-mono tracking-widest pl-4">v1.2.4-CORE</div>
         </div>
       </aside>
    </>
  );
};

export default Sidebar;
