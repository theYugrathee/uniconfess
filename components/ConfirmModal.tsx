
import React from 'react';
import Button from './Button';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onClose: () => void;
    type?: 'danger' | 'info';
}

const ConfirmModal = ({ isOpen, title, message, onConfirm, onClose, type = 'danger' }: ConfirmModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scale-in border border-white/20" onClick={e => e.stopPropagation()}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 mx-auto text-2xl shadow-sm ${type === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                    <i className={`fas ${type === 'danger' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`}></i>
                </div>
                <h3 className="text-xl font-black text-center text-slate-900 mb-2">{title}</h3>
                <p className="text-center text-slate-500 text-sm mb-8 leading-relaxed font-medium">{message}</p>
                <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1 rounded-xl py-3" onClick={onClose}>Cancel</Button>
                    <Button
                        className={`flex-1 rounded-xl py-3 shadow-lg ${type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30' : 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/30'}`}
                        onClick={() => { onConfirm(); onClose(); }}
                    >
                        Confirm
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
