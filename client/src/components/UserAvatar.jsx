import React from 'react';
import { User } from 'lucide-react';

export default function UserAvatar({ user, src, name, size = 38, className = '', style = {} }) {
  const rawAvatar = src || user?.avatar;
  const displayName = name || user?.username || 'User';

  const serverUrl = import.meta.env.VITE_SERVER_URL;
  const fullSrc = rawAvatar && rawAvatar.startsWith('/uploads')
    ? `${serverUrl}${rawAvatar}`
    : rawAvatar;

  if (fullSrc) {
    return (
      <img
        src={fullSrc}
        alt={displayName}
        className={`rounded-circle border ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'cover',
          flexShrink: 0,
          ...style
        }}
        onError={(e) => {
          // If image fails to load, clear src to trigger fallback plain avatar
          e.target.style.display = 'none';
        }}
      />
    );
  }

  // Plain Fallback Avatar with Initial letter
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '';

  return (
    <div
      className={`rounded-circle border d-inline-flex align-items-center justify-content-center fw-bold bg-primary-subtle text-primary border-primary-subtle ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.max(12, Math.floor(size * 0.45))}px`,
        lineHeight: 1,
        userSelect: 'none',
        flexShrink: 0,
        ...style
      }}
      title={displayName}
    >
      {initial || <User size={Math.floor(size * 0.5)} />}
    </div>
  );
}
