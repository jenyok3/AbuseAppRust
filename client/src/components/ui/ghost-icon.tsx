import React from 'react';

interface GhostIconProps {
  className?: string;
}

export const GhostIcon: React.FC<GhostIconProps> = ({ className }) => {
  return (
    <img 
      src="/ghost-icon.png" 
      alt="Ghost Icon" 
      className={className}
      style={{ width: '24px', height: '24px', objectFit: 'contain' }}
    />
  );
};
