import React from 'react';

interface AppIconProps {
  className?: string;
  size?: number | string;
}

export function AppIcon({ className = "w-6 h-6", size }: AppIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Основний контур - шестикутник */}
      <path 
        d="M12 2L5 6V18L12 22L19 18V6L12 2Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        fill="currentColor" 
        opacity="0.9"
      />
      
      {/* Внутрішня частина - захист */}
      <path 
        d="M12 6L8 9V15L12 18L16 15V9L12 6Z" 
        fill="currentColor" 
        opacity="0.3"
      />
      
      {/* Центральна емблема - галочка/check */}
      <path 
        d="M10 12L11 13L14 10" 
        stroke="white" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* Декоративні елементи - кутики */}
      <circle cx="8" cy="6" r="1" fill="currentColor" opacity="0.7"/>
      <circle cx="16" cy="6" r="1" fill="currentColor" opacity="0.7"/>
      <circle cx="8" cy="18" r="1" fill="currentColor" opacity="0.7"/>
      <circle cx="16" cy="18" r="1" fill="currentColor" opacity="0.7"/>
      
      {/* Додаткові декоративні лінії */}
      <path 
        d="M7 4L17 4M7 20L17 20" 
        stroke="currentColor" 
        strokeWidth="1" 
        opacity="0.4"
      />
    </svg>
  );
}
