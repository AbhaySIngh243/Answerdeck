import React from 'react';
import { cn } from '../../lib/utils';

export const Card = React.forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn('rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm', className)}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5', className)} {...props} />;
});

export const CardTitle = React.forwardRef(function CardTitle({ className, ...props }, ref) {
  return <h3 ref={ref} className={cn('text-sm font-semibold text-slate-900', className)} {...props} />;
});

export const CardDescription = React.forwardRef(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn('text-xs text-slate-500', className)} {...props} />;
});

export const CardContent = React.forwardRef(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />;
});

export const CardFooter = React.forwardRef(function CardFooter({ className, ...props }, ref) {
  return <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />;
});
