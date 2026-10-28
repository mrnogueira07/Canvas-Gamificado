import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Trash2,
  RotateCcw,
  ArrowRight,
  Calendar,
  Clock,
  FolderInput,
} from "lucide-react";
import type { Project } from "../../types";

interface ProjectCardProps {
  project: Project | (Project & { deletedAt: string });
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRestore?: (id: string, e: React.MouseEvent) => void;
  onDeletePermanent?: (id: string, e: React.MouseEvent) => void;
  onClick?: (id: string) => void;
  isTrash?: boolean;
  displayMode?: "grid" | "compact" | "list";
  folders?: { id: string; name: string; color: string }[];
  onMoveToFolder?: (project: Project) => void;
  onDropOnProject?: (targetId: string, itemType: "project" | "folder", itemId: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onDelete,
  onRestore,
  onDeletePermanent,
  onClick,
  isTrash = false,
  displayMode = "grid",
  folders = [],
  onMoveToFolder,
  onDropOnProject,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const title = project.title || "Novo Planejamento";
  const subject = project.formData?.subject || "Matéria não definida";
  const grade = project.formData?.gradeLevel || "Nível não definido";
  const gameType = project.formData?.gameType || "N/A";

  const isList = displayMode === "list";
  const isCompact = displayMode === "compact";

  // Formatting date
  const formatDate = (dateValue: any) => {
    if (!dateValue) return "N/A";
    try {
      let d: Date;
      if (dateValue instanceof Date) {
        d = dateValue;
      } else if (typeof dateValue === "object" && (dateValue as any).seconds) {
        d = new Date((dateValue as any).seconds * 1000);
      } else {
        d = new Date(dateValue);
      }
      return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("pt-BR");
    } catch {
      return "N/A";
    }
  };

  const createdStr = formatDate(project.createdAt);
  const updatedStr = formatDate(project.updatedAt);
  const deletedStr = isTrash ? formatDate((project as any).deletedAt) : "";

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`flex ${isCompact ? "w-full" : "h-full"}`}
    >
      <div
        onClick={() => !isTrash && onClick?.(project.id)}
        draggable={!isTrash}
        onDragStart={(e) => {
          if (isTrash || !project.id) return;
          e.dataTransfer.setData("application/json", JSON.stringify({ type: "project", id: project.id }));
          e.dataTransfer.effectAllowed = "move";
          
          setTimeout(() => {
            setIsDragging(true);
          }, 0);
        }}
        onDragEnd={() => setIsDragging(false)}
        onDragOver={(e) => {
          if (isTrash) return;
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
          e.dataTransfer.dropEffect = "move";
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          if (isTrash || !project.id) return;
          try {
            const dataStr = e.dataTransfer.getData("application/json");
            if (!dataStr) return;
            const data = JSON.parse(dataStr);
            if (data.type && data.id && data.id !== project.id) {
              onDropOnProject?.(project.id, data.type, data.id);
            }
          } catch (err) {
            console.error(err);
          }
        }}
        className={`group relative w-full bg-[#15171e] transition-all duration-300 cursor-pointer overflow-hidden border ${isDragOver ? "border-violet-500 scale-[1.02]" : "border-[#232632]"} flex ${
          isList
            ? "flex-row items-center p-3 rounded-2xl shadow-sm hover:shadow-md hover:border-[#383c4e]"
            : isCompact 
               ? "flex-col h-full p-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.25)] hover:shadow-[0_16px_36px_rgba(0,0,0,0.5)] hover:border-[#383c4e]"
               : "flex-col h-full p-6 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:border-[#383c4e]"
        } ${isDragging ? "opacity-0" : "opacity-100"}`}
      >
        {isList ? (
// LIST LAYOUT
          <>

            
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9.9px] font-black uppercase tracking-widest truncate">
                  {gameType}
                </span>
              </div>
              <h3 className="text-sm font-black text-white truncate leading-tight uppercase">
                {title}
              </h3>
            </div>

            <div className="hidden md:flex flex-col gap-1 shrink-0 px-4 border-l border-[#202330] min-w-[120px]">
              {isTrash ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8.8px] font-black text-slate-500 uppercase tracking-widest">Excluido em</span>
                  <span className="text-[11px] font-black text-rose-400 uppercase">{deletedStr}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8.8px] font-black text-slate-500 uppercase tracking-widest">Editado em</span>
                  <span className="text-[11px] font-black text-violet-400 uppercase">{updatedStr}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              {isTrash ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRestore?.(project.id, e); }}
                    className="p-2 bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600 hover:text-white transition-all cursor-pointer relative z-10"
                    title="Restaurar"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeletePermanent?.(project.id, e); }}
                    className="p-2 bg-rose-950/40 text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-600 hover:text-white transition-all cursor-pointer relative z-10"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  {onMoveToFolder && folders.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveToFolder(project as Project); }}
                      className="p-2 bg-violet-950/40 text-violet-300 border border-violet-500/30 hover:bg-violet-600 hover:text-white rounded-lg transition-all cursor-pointer relative z-10"
                      title="Mover"
                    >
                      <FolderInput className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(project.id, e); }}
                    className="p-2 bg-rose-950/40 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white rounded-lg transition-all cursor-pointer relative z-10"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
// GRID / COMPACT GRID LAYOUT
          <div className="flex flex-col h-full relative z-10 w-full">
            <div className={`flex justify-between items-start ${isCompact ? "mb-4" : "mb-6"}`}>


              <div className="flex gap-1.5">
                {isTrash ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore?.(project.id, e);
                      }}
                      className="p-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                      title="Restaurar"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePermanent?.(project.id, e);
                      }}
                      className="p-1.5 bg-rose-950/40 text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                      title="Excluir permanentemente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    {onMoveToFolder && folders.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveToFolder(project as Project);
                        }}
                        className="p-2.5 bg-violet-950/40 text-violet-300 border border-violet-500/30 hover:bg-violet-600 hover:text-white rounded-xl transition-all cursor-pointer"
                        title="Mover para pasta"
                      >
                        <FolderInput className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(project.id, e);
                      }}
                      className="p-2.5 bg-rose-950/40 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white rounded-xl transition-all cursor-pointer"
                      title="Mover para lixeira"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1">
              <div className={`flex items-center gap-2 ${isCompact ? "mb-2" : "mb-3"}`}>
                <span className={`px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg ${isCompact ? "text-[7.7px]" : "text-[8.8px]"} font-black uppercase tracking-widest flex items-center gap-1`}>
                  <img src="/logo-innyx-icon.png" alt="" className="w-2.5 h-2.5 object-contain" />
                  {gameType}
                </span>
              </div>
              <h3 className={`${isCompact ? "text-base mb-3" : "text-lg mb-4"} font-black text-white line-clamp-2 leading-tight tracking-tight uppercase`}>
                {title}
              </h3>
              <div className={`flex flex-col gap-2 ${isCompact ? "mb-6" : "mb-8"}`}>
                <span className={`inline-flex w-fit px-3 py-1 bg-[#1c1e28] text-slate-300 border border-[#272a39] rounded-lg ${isCompact ? "text-[8.8px]" : "text-[9.9px]"} font-black uppercase tracking-widest`}>
                  {subject}
                </span>
                <span className={`inline-flex w-fit px-3 py-1 bg-violet-950/40 text-violet-300 border border-violet-500/30 rounded-lg ${isCompact ? "text-[8.8px]" : "text-[9.9px]"} font-black uppercase tracking-widest`}>
                  {grade}
                </span>
              </div>
            </div>

            <div className="pt-6 border-t border-[#202330] flex items-center justify-between mt-auto">
              <div className="flex flex-col gap-2">
                {isTrash ? (
                  <div className="flex items-center gap-1.5 opacity-70">
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9.9px] font-black text-slate-500 uppercase tracking-widest">
                        Excluido em
                      </span>
                      <span className="text-[11px] font-black text-slate-400 uppercase">
                        {deletedStr}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8.8px] font-black text-slate-500 uppercase tracking-widest">
                          Criado em
                        </span>
                        <span className="text-[9.9px] font-black text-slate-400 uppercase">
                          {createdStr}
                        </span>
                      </div>
                    </div>
                    <div className="w-px h-6 bg-[#242735] mx-1" />
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-violet-400" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8.8px] font-black text-violet-400 uppercase tracking-widest">
                          Alterado em
                        </span>
                        <span className="text-[9.9px] font-black text-violet-300 uppercase">
                          {updatedStr}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="w-9 h-9 rounded-full bg-[#1c1e28] border border-[#2a2d3c] flex items-center justify-center text-slate-400 group-hover:bg-violet-600 group-hover:text-white group-hover:border-transparent transition-all duration-300 shrink-0">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
