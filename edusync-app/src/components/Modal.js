'use client';

import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = '480px' }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    <div
      className={`modal-overlay ${isOpen ? 'active' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="modal-box" style={{ maxWidth }}>
        {title && <h3 style={{ marginBottom: '1.5rem' }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}
