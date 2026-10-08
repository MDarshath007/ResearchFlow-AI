import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, ShieldCheck, MessageSquare, BarChart3, UserCog, GraduationCap, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <aside className="rse-sidebar d-flex flex-column py-4">
      <div className="px-4 mb-4">
        <div className="d-flex align-items-center gap-2 p-2 bg-body-tertiary rounded-3 border">
          <GraduationCap size={20} className="text-primary" />
          <div style={{ minWidth: 0 }}>
            <div className="fw-semibold text-truncate" style={{ fontSize: '14px' }}>RSE Assistant</div>
            <div className="text-muted text-truncate" style={{ fontSize: '11px' }}>Standard Best Practices</div>
          </div>
        </div>
      </div>

      <nav className="flex-grow-1">
        <NavLink to="/dashboard" className={({ isActive }) => `rse-sidebar-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/projects" className={({ isActive }) => `rse-sidebar-link ${isActive ? 'active' : ''}`}>
          <FolderKanban size={18} />
          <span>Projects</span>
        </NavLink>

        <NavLink to="/assessments" className={({ isActive }) => `rse-sidebar-link ${isActive ? 'active' : ''}`}>
          <ShieldCheck size={18} />
          <span>Assessments</span>
        </NavLink>

        <NavLink to="/learning" className={({ isActive }) => `rse-sidebar-link ${isActive ? 'active' : ''}`}>
          <BookOpen size={18} />
          <span>Learning Modules</span>
        </NavLink>

        <NavLink to="/mentor" className={({ isActive }) => `rse-sidebar-link ${isActive ? 'active' : ''}`}>
          <MessageSquare size={18} />
          <span>AI Research Mentor</span>
        </NavLink>

        <NavLink to="/analytics" className={({ isActive }) => `rse-sidebar-link ${isActive ? 'active' : ''}`}>
          <BarChart3 size={18} />
          <span>Analytics</span>
        </NavLink>

        <NavLink to="/profile" className={({ isActive }) => `rse-sidebar-link ${isActive ? 'active' : ''}`}>
          <UserCog size={18} />
          <span>My Profile</span>
        </NavLink>
      </nav>

      <div className="px-4 mt-auto">
        <div className="p-3 bg-primary-subtle text-primary-emphasis rounded-3 border border-primary-subtle text-center" style={{ fontSize: '12px' }}>
          <div className="fw-semibold mb-1">Maturity Level</div>
          <span className="badge bg-primary px-2.5 py-1.5" style={{ fontSize: '10px' }}>
            MERN STACK ACTIVE
          </span>
        </div>
      </div>
    </aside>
  );
}
