import React from 'react';
import { cn } from '../../lib/utils';

export const Table = React.forwardRef(function Table({ className, ...props }, ref) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
});

export const TableHeader = React.forwardRef(function TableHeader({ className, ...props }, ref) {
  return <thead ref={ref} className={cn('[&_tr]:border-b [&_tr]:border-slate-200', className)} {...props} />;
});

export const TableBody = React.forwardRef(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
});

export const TableRow = React.forwardRef(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn('border-b border-slate-100 transition-colors hover:bg-slate-50/70 data-[state=selected]:bg-slate-50', className)}
      {...props}
    />
  );
});

export const TableHead = React.forwardRef(function TableHead({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn('h-10 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-500', className)}
      {...props}
    />
  );
});

export const TableCell = React.forwardRef(function TableCell({ className, ...props }, ref) {
  return <td ref={ref} className={cn('p-4 align-middle', className)} {...props} />;
});

