const fs = require('fs');

function refactor() {
    const path = 'src/components/generator/DocumentView.tsx';
    let content = fs.readFileSync(path, 'utf8');

    const singlePuzzleCode = \
const EXAMPLE_PUZZLE_URL = 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=600&q=80';

const SinglePuzzle: React.FC<{
    puzzle: any;
    pIdx: number;
    onUpdatePuzzle: (idx: number, updates: any) => void;
    onRemovePuzzle: (idx: number) => void;
    canRemove: boolean;
}> = ({ puzzle, pIdx, onUpdatePuzzle, onRemovePuzzle, canRemove }) => {
    const [placedPieces, setPlacedPieces] = React.useState<number[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const pieceCount = puzzle.pieceCount || 8;
    let COLS = 4;
    let ROWS = 2;
    if (pieceCount === 6) { COLS = 3; ROWS = 2; }
    else if (pieceCount === 9) { COLS = 3; ROWS = 3; }
    else if (pieceCount === 10) { COLS = 5; ROWS = 2; }
    const TOTAL = COLS * ROWS;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert('A imagem é muito grande. Escolha uma foto com menos de 10MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                const MAX_WIDTH = 1000;
                const MAX_HEIGHT = 1000;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                ctx.drawImage(img, 0, 0, width, height);
                const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.4);

                onUpdatePuzzle(pIdx, { imageUrl: optimizedDataUrl });
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handlePieceClick = (idx: number) => {
        if (placedPieces.includes(idx)) return;
        setPlacedPieces(prev => [...prev, idx]);
    };

    return (
        <div className="relative group/pcontainer p-6 mb-8 border-2 border-dashed border-violet-100 rounded-3xl bg-white shadow-sm hover:shadow-md transition-all">
            {canRemove && (
                <button
                    onClick={() => onRemovePuzzle(pIdx)}
                    className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-white text-slate-300 hover:text-rose-500 border border-slate-100 rounded-full shadow-md transition-all opacity-0 group-hover/pcontainer:opacity-100 z-30"
                >
                    <XCircle className="w-5 h-5" />
                </button>
            )}
            
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-violet-100">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                        <span className="text-violet-600 text-xs font-black">??</span>
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-violet-700 uppercase tracking-widest">Quebra-Cabeça \</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">Preview Interativo</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select 
                        value={puzzle.pieceCount || 8}
                        onChange={(e) => onUpdatePuzzle(pIdx, { pieceCount: Number(e.target.value) })}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-[10px] uppercase font-black tracking-widest rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
                    >
                        <option value={6}>6 Peças</option>
                        <option value={8}>8 Peças</option>
                        <option value={9}>9 Peças</option>
                        <option value={10}>10 Peças</option>
                    </select>
                    {placedPieces.length > 0 && (
                        <button
                            onClick={() => setPlacedPieces([])}
                            className="text-[9px] font-black text-violet-500 uppercase tracking-widest hover:text-rose-500 transition-colors px-3 py-1.5 bg-violet-50 rounded-lg border border-violet-100 cursor-pointer"
                        >
                            ? Reiniciar
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {/* Grid */}
                <div className="relative rounded-3xl overflow-hidden border-2 border-violet-200 shadow-xl bg-slate-200" style={{ aspectRatio: '2/1' }}>
                    <img
                        src={puzzle.imageUrl || EXAMPLE_PUZZLE_URL}
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover opacity-60"
                        style={{ objectPosition: 'center', maxWidth: 'none', maxHeight: 'none' }}
                    />
                    <div
                        className="absolute inset-0 grid"
                        style={{ gridTemplateColumns: \\\epeat(\\\, 1fr)\\\, gridTemplateRows: \\\epeat(\\\, 1fr)\\\ }}
                    >
                        {Array.from({ length: TOTAL }).map((_, idx) => {
                            const placed = placedPieces.includes(idx);
                            return (
                                <div
                                    key={idx}
                                    onClick={() => handlePieceClick(idx)}
                                    className={\\\elative cursor-pointer transition-all duration-500 group/piece overflow-hidden \\\\\\}
                                >
                                    <div className={\\\bsolute inset-0 border border-white/20 z-10 pointer-events-none \\\\\\} />
                                    {placed ? (
                                        <div className="absolute inset-0 overflow-hidden animate-in fade-in duration-500 scale-100">
                                            <div
                                                className="absolute top-0 left-0 pointer-events-none"
                                                style={{
                                                    width: \\\\\\%\\\,
                                                    height: \\\\\\%\\\,
                                                    transform: \\\	ranslate3d(-\\\%, -\\\%, 0)\\\
                                                }}
                                            >
                                                <img
                                                    src={puzzle.imageUrl || EXAMPLE_PUZZLE_URL}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    style={{ display: 'block', maxWidth: 'none', maxHeight: 'none', objectPosition: 'center' }}
                                                />
                                            </div>
                                            <div className="absolute inset-0 bg-emerald-400/10 flex items-center justify-center opacity-0 group-hover/piece:opacity-100 transition-opacity z-10">
                                                <div className="bg-emerald-500 text-white rounded-full p-2 shadow-lg transform scale-90 group-hover/piece:scale-100 transition-transform">
                                                    <Check className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="absolute inset-0 bg-violet-50/60 group-hover/piece:bg-violet-100/80 transition-all flex flex-col items-center justify-center gap-1 backdrop-blur-[2px]">
                                            <span className="text-2xl group-hover/piece:scale-110 transition-transform">??</span>
                                            <span className="text-[8px] font-black text-violet-500 uppercase tracking-widest opacity-0 group-hover/piece:opacity-100 transition-all">Encaixar</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {/* Barra de progresso */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
                        <div
                            className="h-full bg-emerald-400 transition-all duration-700 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                            style={{ width: \\\\\\%\\\ }}
                        />
                    </div>
                </div>
                
                {/* Mensagem de Vitória */}
                {placedPieces.length === TOTAL && (
                    <div className="flex items-center justify-center p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center gap-4">
                            <Award className="w-8 h-8 text-emerald-500" />
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Desafio Concluído!</p>
                                <p className="text-sm font-black text-slate-800 tracking-tight mt-1">Imagens e conceitos dominados</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload Image for this puzzle */}
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group cursor-pointer border-2 border-dashed border-violet-200 rounded-3xl overflow-hidden hover:border-violet-400 transition-all duration-300 bg-violet-50/30 hover:bg-violet-50 p-6 flex items-center justify-center gap-4 text-center"
                >
                    <span className="text-3xl">??</span>
                    <div className="text-left">
                        <p className="text-[12px] font-black text-violet-700">Substituir Imagem (Quebra-Cabeça \)</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-1">Clique para carregar foto (Máx 10MB)</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>
                
                {/* Descrição */}
                <div className="bg-white border border-violet-100 rounded-2xl p-4 shadow-sm mt-4">
                    <Field
                        label="DESCRIÇÃO DA IMAGEM / CONTEXTO"
                        value={puzzle.description || ''}
                        onChange={(val: string) => onUpdatePuzzle(pIdx, { description: val })}
                    />
                </div>
            </div>
        </div>
    );
};

const PuzzleSection: React.FC<{
    targets: any[];
    gameLogic: any;
    onEdit: (field: string, value: any) => void;
    onAdd: (path: string, item: any) => void;
    onRemove: (path: string, index: number) => void;
}> = ({ targets, gameLogic, onEdit, onAdd, onRemove }) => {
    
    const puzzles = gameLogic.puzzles || [{
        imageUrl: gameLogic.puzzleImageUrl || EXAMPLE_PUZZLE_URL,
        description: gameLogic.puzzleDescription || "Monte o quebra-cabeça e responda as questões ao encaixar cada peça!",
        pieceCount: gameLogic.puzzlePieceCount || 8
    }];

    const handleUpdatePuzzle = (idx: number, updates: any) => {
        const newPuzzles = [...puzzles];
        newPuzzles[idx] = { ...newPuzzles[idx], ...updates };
        onEdit('puzzles', newPuzzles);
    };

    const handleRemovePuzzle = (idx: number) => {
        if (puzzles.length <= 1) return;
        const newPuzzles = puzzles.filter((_: any, i: number) => i !== idx);
        onEdit('puzzles', newPuzzles);
    };

    const handleAddPuzzle = () => {
        if (puzzles.length >= 3) return;
        const newPuzzles = [...puzzles, {
            imageUrl: EXAMPLE_PUZZLE_URL,
            description: "Escreva uma descrição ou contexto para esta imagem",
            pieceCount: 8
        }];
        onEdit('puzzles', newPuzzles);
    };

    const MAX_TARGETS = puzzles.length >= 3 ? 10 : 5;

    return (
        <div className="space-y-10">
            <div>
                <div className="flex items-center justify-between pb-3 mb-6 border-b border-violet-100">
                    <div>
                        <p className="text-[11px] font-black text-violet-700 uppercase tracking-widest">
                            Imagens do Quebra-Cabeça (\/3)
                        </p>
                    </div>
                    {puzzles.length < 3 && (
                        <button
                            onClick={handleAddPuzzle}
                            className="px-4 py-2 bg-violet-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-violet-700 transition cursor-pointer flex items-center gap-2 shadow-lg shadow-violet-500/30"
                        >
                            <span className="text-lg leading-none">+</span> Adicionar Quebra-Cabeça
                        </button>
                    )}
                </div>
                
                {puzzles.map((p: any, idx: number) => (
                    <SinglePuzzle 
                        key={idx} 
                        puzzle={p} 
                        pIdx={idx} 
                        onUpdatePuzzle={handleUpdatePuzzle} 
                        onRemovePuzzle={handleRemovePuzzle} 
                        canRemove={puzzles.length > 1} 
                    />
                ))}
            </div>

            {/* Peças / Questões vinculadas */}
            <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                        Configurações e Questões (\)
                    </p>
                    <div className="flex items-center gap-4">
                        {targets.length < MAX_TARGETS && (
                            <button
                                onClick={() => {
                                    onAdd('targets', {
                                        title: \\\Questão \\\\\\,
                                        question: \\\Nova pergunta final \\\?\\\,
                                        options: ['Opção A', 'Opção B', 'Opção C'],
                                        answer: 'Opção A',
                                        isCorrect: true
                                    });
                                }}
                                className="text-[9px] flex items-center gap-1 font-black uppercase tracking-widest bg-violet-100 text-violet-600 hover:bg-violet-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                                <span className="text-lg leading-none">+</span> Questão
                            </button>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-3 max-w-2xl">
                    {targets.map((target: any, i: number) => {
                        const hasQuestion = !!target.question || (target.options && target.options.length > 0);
                        return (
                            <div key={i} className={\\\group/pz relative p-6 rounded-[2rem] border transition-all \\\ hover:shadow-xl hover:bg-white\\\}>
                                {targets.length > 3 && (
                                    <button
                                        onClick={() => onRemove('targets', i)}
                                        className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 bg-white rounded-full shadow-md z-20 transition-all opacity-0 group-hover/pz:opacity-100"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                )}

                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-sm font-black shadow-lg shadow-indigo-200">
                                            #{i + 1}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Questão {i + 1}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={\\\	ext-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border \\\\\\}>
                                            {hasQuestion ? '? Questionário' : '?? Conteúdo'}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 gap-6">
                                        <Field label="Pergunta Desafio" value={toStr(target.question || target.title)} onChange={(val: string) => {
                                            if (!targets[i]) onEdit(\\\	argets[\\\]\\\, { ...target, question: val });
                                            else onEdit(\\\	argets[\\\].question\\\, val);
                                        }} />
                                    </div>

                                    <div className="pt-4 border-t border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Alternativas e Resposta Correta (3 Opções)</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {(Array.isArray(target.options) ? target.options : ['Opção A', 'Opção B', 'Opção C']).slice(0, 3).map((opt: string, oi: number) => (
                                                <div key={oi} className={\\\elative p-1 rounded-2xl border-2 transition-all \\\\\\}>
                                                    <Field
                                                        label={\\\ALT \\\\\\}
                                                        value={toStr(opt)}
                                                        onChange={(val: string) => {
                                                            const currentTarget = targets[i] || target;
                                                            const newOpts = [...(currentTarget.options || ['Opção A', 'Opção B', 'Opção C'])];
                                                            const wasCorrect = opt === currentTarget.answer;
                                                            newOpts[oi] = val;
                                                            if (!targets[i]) onEdit(\\\	argets[\\\]\\\, { ...currentTarget, options: newOpts, answer: wasCorrect ? val : currentTarget.answer });
                                                            else {
                                                                onEdit(\\\	argets[\\\].options\\\, newOpts);
                                                                if (wasCorrect) onEdit(\\\	argets[\\\].answer\\\, val);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (!targets[i]) onEdit(\\\	argets[\\\]\\\, { ...target, answer: opt });
                                                            else onEdit(\\\	argets[\\\].answer\\\, opt);
                                                        }}
                                                        className={\\\bsolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all \\\\\\}
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <Field label="Feedback Educativo (Ao acertar)" value={toStr(target.description || target.feedback || '')} onChange={(val: string) => {
                                            if (!targets[i]) onEdit(\\\	argets[\\\]\\\, { ...target, description: val });
                                            else onEdit(\\\	argets[\\\].description\\\, val);
                                        }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
\

    const startIndex = content.indexOf("const EXAMPLE_PUZZLE_URL = 'https://images.unsplash.com/photo");
    const endIndex = content.indexOf("// --- Seção 6: Lógica do Jogo ---");
    
    if (startIndex === -1 || endIndex === -1) {
        console.error("Could not find start or end index.");
        return;
    }

    const toReplace = content.substring(startIndex, endIndex);
    content = content.replace(toReplace, singlePuzzleCode + '\n\n');

    fs.writeFileSync(path, content, 'utf8');
    console.log("Successfully replaced puzzle logic.");
}

refactor();
