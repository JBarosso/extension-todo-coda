import { useEffect, useRef } from 'react';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function InfoModal({ isOpen, onClose }: InfoModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            <div
                ref={modalRef}
                className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        Configuration API
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-6">
                    {/* Coda Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">📄</span>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Coda Todo</h3>
                        </div>

                        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                            <div>
                                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">1. Filtres</h4>
                                <p className="text-xs">
                                    Utilisez le filtre <strong>Day</strong> (ou Group) pour sélectionner le jour (ex: "Lundi"). L'extension tente de sélectionner le jour actuel automatiquement.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">2. Configuration</h4>
                                <p className="text-xs">
                                    Cliquez sur <strong>Config</strong> pour changer les colonnes mappées. Assurez-vous que les colonnes <strong>Comments</strong> et <strong>Progress</strong> sont bien sélectionnées pour que la synchro fonctionne.
                                </p>
                            </div>
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                                <p className="text-[10px] text-blue-600 dark:text-blue-300">
                                    Le rafraîchissement est automatique toutes les 5 minutes.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Lovable/Tasks Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">⚡</span>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Lovable Tasks</h3>
                        </div>

                        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                            <div>
                                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Connexion Supabase</h4>
                                <p className="text-xs">
                                    Entrez l'URL de votre projet et la clé <code>anon</code>. L'extension scannera vos tables pour trouver celle des tâches.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Row Level Security (RLS)</h4>
                                <p className="text-xs">
                                    Pour que l'édition fonctionne, votre table Supabase doit avoir des politiques RLS permettant l'`UPDATE` pour le rôle <code>anon</code> (ou être publique).
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 text-sm font-medium rounded-lg
                       bg-blue-500 hover:bg-blue-600 text-white
                       transition-colors"
                    >
                        Compris !
                    </button>
                </div>
            </div>
        </div>
    );
}
