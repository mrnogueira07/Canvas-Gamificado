import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, RotateCcw, ArrowRight, BookOpen } from 'lucide-react';
import type { Project } from '../../types';

interface ProjectCardProps {
    project: Project | (Project & { deletedAt: string });
    onDelete: (id: string, e: React.MouseEvent) => void;
    onRestore?: (id: string, e: React.MouseEvent) => void;
    onDeletePermanent?: (id: string, e: React.MouseEvent) => void;
    onClick?: (id: string) => void;
    isTrash?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
    project,
    onDelete,
    onRestore,
    onDeletePermanent,
    onClick,
    isTrash = false,
}) => {
    const title = project.title || 'Novo Planejamento';
    const subject = project.formData?.subject || 'Matéria não definida';
    const grade = project.formData?.gradeLevel || 'Nível não definido';

    // Formatting date
    let dateStr = 'Data não disponível';
    try {
        const dateObj = isTrash ? (project as any).deletedAt : project.createdAt;
        if (dateObj) {
            let d: Date;
            if (dateObj instanceof Date) {
                d = dateObj;
            } else if (typeof dateObj === 'object' && 'seconds' in dateObj) {
                // Handle Firebase Timestamp
                d = new Date((dateObj as any).seconds * 1000);
            } else {
                d = new Date(dateObj);
            }

            if (!isNaN(d.getTime())) {
                dateStr = d.toLocaleDateString('pt-BR');
            }
        }
    } catch (e) {
        console.error("Erro ao formatar data", e);
    }

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="h-full"
        >
            <div
                onClick={() => !isTrash && onClick?.(project.id)}
                className="group relative h-full bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(79,70,229,0.1)] transition-all duration-500 cursor-pointer overflow-hidden border border-slate-100"
            >
                <div className="flex flex-col h-full relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                            <BookOpen className="w-5 h-5" />
                        </div>

                        <div className="flex gap-2">
                            {isTrash ? (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRestore?.(project.id, e); }}
                                        className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                                        title="Restaurar"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeletePermanent?.(project.id, e); }}
                                        className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                                        title="Excluir permanentemente"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(project.id, e); }}
                                    className="p-2.5 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all cursor-pointer"
                                    title="Mover para lixeira"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1">
                        <h3 className="text-lg font-black text-slate-900 mb-4 line-clamp-2 leading-tight tracking-tight uppercase">
                            {title}
                        </h3>
                        <div className="flex flex-col gap-2 mb-8">
                            <span className="inline-flex w-fit px-3 py-1 bg-slate-50 text-slate-400 border border-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                {subject}
                            </span>
                            <span className="inline-flex w-fit px-3 py-1 bg-indigo-50 text-indigo-500 border border-indigo-100/50 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                {grade}
                            </span>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                {isTrash ? 'Excluído em' : 'Criado em'}
                            </span>
                            <span className="text-[11px] font-black text-slate-500 uppercase">{dateStr}</span>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all duration-300">
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
