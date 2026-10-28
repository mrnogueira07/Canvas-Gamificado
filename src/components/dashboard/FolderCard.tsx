import React, { useState, useRef, useEffect } from "react";
import { Folder as FolderIcon, MoreVertical, Edit2, Move, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Folder } from "./folderConfig";
import { getColorConfig } from "./folderConfig";

export function FolderCard({
  folder,
  count,
  onOpen,
  onRename,
  onDelete,
  onMoveFolder,
  onDropItem,
}: {
  folder: Folder;
  count: number;
  onOpen: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onMoveFolder: (folder: Folder) => void;
  onDropItem?: (itemId: string, itemType: "project" | "folder") => void;
}) {
  const cc = getColorConfig(folder.color);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsEditing(true);
  };

  const handleRenameSubmit = () => {
    if (editName.trim() && editName !== folder.name) {
      onRename(folder.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.type && data.id) {
        if (data.type === "folder" && data.id === folder.id) return;
        onDropItem?.(data.id, data.type);
      }
    } catch (err) {
      console.error("Erro ao soltar item:", err);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "folder", id: folder.id }));
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => setIsDragging(true), 0);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className={`relative group w-full transition-all duration-200 ${isDragging ? "opacity-30 scale-95" : "opacity-100"}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      ref={menuRef}
    >
      <div
        onClick={() => {
          if (!isEditing) onOpen(folder.id);
        }}
        onContextMenu={handleContextMenu}
        className={`w-full flex items-center justify-between p-3.5 bg-white border border-slate-200/50 hover:border-violet-200 rounded-2xl transition-all cursor-pointer relative overflow-visible ${isDragOver ? "ring-2 ring-violet-500 scale-[1.02]" : "hover:shadow-md hover:bg-slate-50/50"}`}
      >
        <div className="flex items-center min-w-0 flex-1 mr-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-100 shrink-0 mr-3 shadow-sm`}>
            <FolderIcon className={`w-5 h-5 fill-current ${cc.text}`} />
          </div>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                className="w-full text-xs font-black uppercase tracking-wider leading-tight bg-white border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-violet-400"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide truncate leading-tight">
                  {folder.name}
                </span>
                <span className="text-[9.9px] text-slate-400 font-bold mt-0.5">
                  {count} item{count !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 mt-1 w-40 bg-white/95 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-xl py-1.5 z-[100] flex flex-col gap-0.5 px-1"
              >
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                  Renomear
                </button>
                <button
                  onClick={() => {
                    onMoveFolder(folder);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Move className="w-3.5 h-3.5 text-slate-400" />
                  Mover
                </button>
                <div className="h-px bg-slate-100 my-0.5 mx-1" />
                <button
                  onClick={() => {
                    onDelete(folder.id);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-left text-xs font-black transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  Excluir
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
