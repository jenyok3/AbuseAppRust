import React from 'react';

interface BlockedIconProps {
  className?: string;
  size?: number | string;
}

export function BlockedIcon({ className = "w-5 h-5", size }: BlockedIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M8 12L16 12M12 8L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
