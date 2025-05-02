import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = '#3B82F6' 
}) => {
  const sizeMap = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  };
  
  const sizeClass = sizeMap[size];
  
  return (
    <div className="flex items-center justify-center">
      <div 
        className={`${sizeClass} border-4 border-gray-200 rounded-full animate-spin`}
        style={{ 
          borderTopColor: color,
          borderLeftColor: color,
        }}
      />
    </div>
  );
};

export default LoadingSpinner;