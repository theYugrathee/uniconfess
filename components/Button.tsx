import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyle = "px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm sm:text-base transform transition-all duration-300 active:scale-95 hover:-translate-y-0.5";

  const variants = {
    primary: "bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:translate-y-0 disabled:scale-100",
    secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:translate-y-0 disabled:scale-100",
    danger: "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:translate-y-0 disabled:scale-100",
    ghost: "bg-transparent hover:bg-primary-50 text-slate-600 hover:text-primary-600 hover:shadow-none translate-y-0"
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${className} ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <i className="fas fa-circle-notch fa-spin"></i>}
      {children}
    </button>
  );
};

export default Button;