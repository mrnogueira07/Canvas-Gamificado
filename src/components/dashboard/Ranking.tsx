
import { Trophy, X } from "lucide-react";
import { motion } from "framer-motion";
import { isMasterUser } from "../../lib/studioNavigation";

export interface RankingEntry {
  userId: string;
  displayName: string;
  photoURL: string | null;
  count: number;
  email: string;
  disabled?: boolean;
}

const medalColors = [
  "from-amber-400 to-yellow-500 ring-amber-400",
  "from-slate-300 to-slate-400 ring-slate-300",
  "from-amber-700 to-amber-800 ring-amber-700",
];

function Avatar({
  entry,
  rankIdx,
  ring = false,
}: {
  entry: RankingEntry;
  rankIdx?: number;
  ring?: boolean;
}) {
  const hasRank = typeof rankIdx === "number" && rankIdx >= 0 && rankIdx < 3;
  const ringClass = hasRank
    ? `ring-2 ${medalColors[rankIdx!]} shadow-lg`
    : ring
      ? "ring-2 ring-violet-400 shadow-md"
      : "ring-1 ring-white/20";

  return (
    <div className={`w-10 h-10 rounded-full overflow-hidden shrink-0 bg-white/10 flex items-center justify-center relative ${ringClass}`}>
      {entry.photoURL ? (
        <img
          src={entry.photoURL}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600/50 to-fuchsia-600/50">
          <span className="text-white font-black text-base drop-shadow">
            {(entry.displayName || entry.email || "U")[0].toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}

export function RankingPanel({
  top3,
  currentUserPos,
  loading,
  currentUserId,
  isSidebar = false,
  onClose,
}: {
  top3: RankingEntry[];
  currentUserPos: { position: number; entry: RankingEntry } | null;
  loading: boolean;
  currentUserId: string | null;
  isSidebar?: boolean;
  onClose?: () => void;
}) {
  const medalEmoji = ["🥇", "🥈", "🥉"];

  const content = (
    <>
      <style>{`
        @keyframes scrollName {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-scrollName {
          display: flex;
          width: max-content;
          white-space: nowrap;
          animation: scrollName 8s linear infinite;
        }
      `}</style>
      {/* Background ambient glow inside the panel */}
      {!isSidebar && (
        <>
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-violet-600/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-fuchsia-600/25 blur-3xl pointer-events-none" />
        </>
      )}

      {!isSidebar && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white transition-all cursor-pointer shadow-sm border border-rose-500/30"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-center gap-3 mb-6 relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 border border-amber-500/30">
          <Trophy className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2
            style={{ fontFamily: "'Teachers', sans-serif" }}
            className="text-xl leading-none tracking-wider drop-shadow-md flex items-center gap-2 text-white"
          >
            RaNKiNG
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          </h2>
          <p className="text-[9.9px] font-bold uppercase tracking-widest mt-1 text-slate-400">
            Destaques Pedagógicos
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 mb-5 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-8 h-8 border-3 rounded-full animate-spin border-violet-500/20 border-t-violet-400" />
            <p className="text-[11px] uppercase font-bold tracking-widest text-slate-400">Carregando...</p>
          </div>
        ) : top3.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-slate-400">Nenhum educador com roteiros</p>
          </div>
        ) : (
          top3.map((entry, idx) => {
            const isMe = entry.userId === currentUserId;
            const isMaster = isMasterUser(entry.displayName, entry.email);
            return (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className={`flex items-center gap-3.5 p-3 rounded-2xl border transition-all ${
                  isSidebar
                    ? isMe ? "bg-[#221c38] border-violet-500/50 shadow-md" : "bg-[#191b24] border-[#252837] hover:bg-[#1e202b]"
                    : isMe ? "bg-white/12 border-white/25 shadow-md" : "bg-white/5 border-white/5 hover:bg-white/8"
                }`}
              >
                <div className="flex items-center justify-center w-6 text-center">
                  <span className="text-xl">{medalEmoji[idx]}</span>
                </div>

                <Avatar entry={entry} rankIdx={idx} ring={isMe} />

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="w-full overflow-hidden relative" style={{ containerType: "inline-size", maskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)" }}>
                    <div className="animate-scrollName">
                      {[0, 1].map((i) => (
                        <div key={i} className="flex items-center" style={{ paddingRight: "100cqw" }}>
                          <p className={`text-xs font-black inline-flex items-center ${
                            isSidebar 
                              ? isMe ? "text-violet-200" : "text-white"
                              : isMe ? "text-white" : "text-white/90"
                          }`}>
                            {entry.displayName}
                            {isMaster && (
                              <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/25 text-amber-300 border border-amber-400/40 shadow-sm inline-flex items-center gap-1">
                                👑 MASTER
                              </span>
                            )}
                            {entry.disabled && (
                              <span className="ml-1.5 text-[8.8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-500/25 text-rose-300 border border-rose-400/40 shadow-sm inline-flex items-center gap-1">
                                🚫 Desativado
                              </span>
                            )}
                            {isMe && <span className={`ml-1.5 text-[8.8px] uppercase tracking-wider px-1 py-0.5 rounded-md ${isSidebar ? "bg-violet-500/30 text-violet-300" : "bg-violet-500/40 text-violet-200"}`}>Você</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-[9.9px] truncate font-medium text-slate-400">{entry.email}</p>
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 text-amber-400 bg-amber-400/10 border border-amber-400/20">
                      {entry.count} {entry.count === 1 ? "roteiro" : "roteiros"}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {!loading && currentUserPos && currentUserPos.position > 3 && !isSidebar && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-3.5 border-t border-white/10 mt-auto"
        >
          <p className="text-white/50 text-[9.9px] font-black uppercase tracking-widest mb-2 px-1">Sua Posição</p>
          <div className="flex items-center gap-3.5 p-3 bg-violet-950/40 border border-violet-500/20 rounded-2xl">
            <div className="flex items-center justify-center w-6 text-center text-white/80 font-black text-sm">
              #{currentUserPos.position}
            </div>
            <Avatar entry={currentUserPos.entry} ring />
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="w-full overflow-hidden relative" style={{ containerType: "inline-size", maskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)" }}>
                <div className="animate-scrollName">
                  {[0, 1].map((i) => (
                    <div key={i} className="flex items-center" style={{ paddingRight: "100cqw" }}>
                      <p className="text-xs font-black text-white inline-flex items-center">
                        {currentUserPos.entry.displayName}
                        {isMasterUser(currentUserPos.entry.displayName, currentUserPos.entry.email) && (
                          <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/25 text-amber-300 border border-amber-400/40 shadow-sm inline-flex items-center gap-1">
                            👑 MASTER
                          </span>
                        )}
                        <span className="ml-1.5 text-[8.8px] uppercase tracking-wider bg-violet-500/40 text-violet-200 px-1 py-0.5 rounded-md">Você</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[9.9px] text-white/45 truncate font-medium">{currentUserPos.entry.email}</p>
                <span className="text-[11px] font-black text-violet-300 bg-violet-400/10 px-2 py-0.5 rounded-full shrink-0">
                  {currentUserPos.entry.count} {currentUserPos.entry.count === 1 ? "roteiro" : "roteiros"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {!loading && (
        <div className="mt-3.5 text-center">
          <p className="text-[9.9px] font-bold italic leading-snug text-slate-400">
            {currentUserPos && currentUserPos.position <= 3
              ? "Parabéns! Você está no pódio. 🥇"
              : "Crie mais roteiros para alcançar o pódio! ✨"}
          </p>
        </div>
      )}
    </>
  );

  if (isSidebar) {
    return (
      <div className="w-full h-fit max-h-[85vh] bg-[#15171e] border border-[#232632] rounded-[1.5rem] p-5 shadow-2xl relative overflow-hidden flex flex-col">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative flex flex-col">
      {content}
    </div>
  );
}

export function RankingModal({
  onClose,
  top3,
  currentUserPos,
  loading,
  currentUserId,
}: {
  onClose: () => void;
  top3: RankingEntry[];
  currentUserPos: { position: number; entry: RankingEntry } | null;
  loading: boolean;
  currentUserId: string | null;
}) {
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 15 }}
        transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative w-full max-w-md bg-gradient-to-b from-[#1e1b4b] to-[#3b0764] border border-white/10 rounded-[2rem] shadow-2xl p-6 overflow-hidden z-10"
      >
        <RankingPanel
          top3={top3}
          currentUserPos={currentUserPos}
          loading={loading}
          currentUserId={currentUserId}
          isSidebar={false}
          onClose={onClose}
        />
      </motion.div>
    </div>
  );
}
