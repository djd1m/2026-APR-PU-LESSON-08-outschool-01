import { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary';
}

const variantStyles: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-700',
  secondary: 'bg-gray-100 text-gray-700',
};

export function Badge({
  variant = 'primary',
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
      {...props}
    />
  );
}
