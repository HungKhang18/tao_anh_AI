import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Sparkles, 
  Image as ImageIcon, 
  RefreshCw, 
  Download, 
  Trash2,
  ChevronRight,
  Info,
  CheckCircle2,
  X,
  Plus
} from 'lucide-react';

interface ImageSlot {
  id: string;
  image: string | null;
}

interface Layout {
  id: string;
  name: string;
  slots: number;
  gridClass: string;
  maxUploads?: number;
}

const LAYOUTS: Layout[] = [
  { id: 'worksheet', name: 'Worksheet (2x3)', slots: 6, gridClass: 'grid-cols-2', maxUploads: 12 },
];

export default function App() {
  const [selectedLayout, setSelectedLayout] = useState<Layout>(LAYOUTS[0]);
  const [slots, setSlots] = useState<ImageSlot[]>(
    Array.from({ length: 12 }, (_, i) => ({ id: `slot-${i}`, image: null }))
  );
  const [minCount, setMinCount] = useState(1);
  const [maxCount, setMaxCount] = useState(3);
  const [isRandom, setIsRandom] = useState(true);
  const [fixedCount, setFixedCount] = useState(5);
  const [worksheetTitle, setWorksheetTitle] = useState('Counting Worksheet');
  const [titleFontSize, setTitleFontSize] = useState(48);
  const [titleColor, setTitleColor] = useState('#000000');
  const [titleAlignment, setTitleAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [titleCase, setTitleCase] = useState<'uppercase' | 'none'>('none');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [lastMax, setLastMax] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLayoutChange = (layout: Layout) => {
    setSelectedLayout(layout);
    setResultImage(null);
  };

  const handleFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).filter((f: File) => f.type.startsWith('image/'));
    let processedCount = 0;
    let updatedSlots = [...slots];

    // Ensure we have enough slots for the uploaded files
    const requiredSlots = index + fileArray.length;
    if (requiredSlots > updatedSlots.length) {
      const additionalSlotsNeeded = requiredSlots - updatedSlots.length;
      const newSlots = Array.from({ length: additionalSlotsNeeded }, (_, i) => ({
        id: `slot-${Date.now()}-${i}`,
        image: null
      }));
      updatedSlots = [...updatedSlots, ...newSlots];
    }

    fileArray.forEach((file: File, i) => {
      const targetIndex = index + i;
      const reader = new FileReader();
      reader.onload = (event) => {
        updatedSlots[targetIndex] = { ...updatedSlots[targetIndex], image: event.target?.result as string };
        processedCount++;
        if (processedCount === fileArray.length) {
          setSlots([...updatedSlots]);
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const generateImage = async () => {
    const activeSlots = slots.filter(s => s.image);
    if (activeSlots.length === 0) return;

    // Shuffle active slots for randomness
    const shuffledSlots = [...activeSlots].sort(() => Math.random() - 0.5);
    // Pick only the number of slots required by the layout
    const displaySlots = shuffledSlots.slice(0, selectedLayout.slots);

    setIsGenerating(true);
    setError(null);

    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not initialize canvas context");

      // A4-ish dimensions for high quality
      canvas.width = 1200;
      canvas.height = 1600;

      // Background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const isWorksheet = selectedLayout.id === 'worksheet';

      if (isWorksheet) {
        // Ensure font is loaded
        const fontSpec = `bold ${titleFontSize}px "Playpen Sans"`;
        await document.fonts.load(fontSpec);
        await document.fonts.load('bold 35px "Playpen Sans"');

        // Draw Worksheet Header
        ctx.fillStyle = titleColor;
        ctx.font = fontSpec;
        ctx.textAlign = titleAlignment;
        
        let titleX = canvas.width / 2;
        if (titleAlignment === 'left') titleX = 40;
        if (titleAlignment === 'right') titleX = canvas.width - 40;

        const displayTitle = titleCase === 'uppercase' ? worksheetTitle.toUpperCase() : worksheetTitle;
        const lines = displayTitle.split('\n');
        const lineHeight = titleFontSize * 1.2;
        
        lines.forEach((line, index) => {
          ctx.fillText(line, titleX, 100 + index * lineHeight);
        });
        
        const titleBottomY = 100 + (lines.length - 1) * lineHeight;
        const instructionY = Math.max(180, titleBottomY + 60);
        
        ctx.fillStyle = 'black';
        ctx.font = 'bold 35px "Playpen Sans"';
        ctx.textAlign = 'left';
        // ctx.fillText('Count the items in each box and write the number in the square.', 100, instructionY);

        const padding = 20;
        const topMargin = instructionY + 20; // Reduced top margin
        const rowHeight = (canvas.height - padding - topMargin) / 3;
        const colWidth = (canvas.width - padding * 2) / 2;

        // Shuffle positions for worksheet
        const positions = Array.from({ length: 6 }, (_, i) => i);
        const shuffledPositions = [...positions].sort(() => Math.random() - 0.5);

        // Pre-calculate counts to ensure at least one maxCount is present if random
        const worksheetCounts = displaySlots.map(() => 
          isRandom 
            ? Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount
            : fixedCount
        );

        // Force at least one slot to have the maxCount if in random mode
        if (isRandom && worksheetCounts.length > 0) {
          const randomIdx = Math.floor(Math.random() * worksheetCounts.length);
          worksheetCounts[randomIdx] = maxCount;
        }

        for (let i = 0; i < displaySlots.length; i++) {
          const slot = displaySlots[i];
          const posIdx = shuffledPositions[i];
          const row = Math.floor(posIdx / 2);
          const col = posIdx % 2;
          
          const cellX = padding + col * colWidth;
          const cellY = topMargin + row * rowHeight;

          // Load image
          const img = new Image();
          img.src = slot.image!;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });

          // Draw images in a balanced grid on the left side of the cell
          const count = worksheetCounts[i];
          
          const boxSize = 130;
          const rightPadding = 10;
          const leftPadding = 10;
          const topPadding = 10;
          
          const availableWidth = colWidth - boxSize - rightPadding - leftPadding - 10;
          const availableHeight = rowHeight - (topPadding * 2);
          
          // Calculate optimal grid (cols/rows) to fit 'count' items
          let colsInCell = Math.min(count, 4);
          if (count === 10) colsInCell = 5;
          else if (count === 4) colsInCell = 2;
          else if (count === 5) colsInCell = 3;
          else if (count === 6) colsInCell = 3;
          else if (count === 8) colsInCell = 4;
          else if (count === 9) colsInCell = 3;
          
          const rowsInCell = Math.ceil(count / colsInCell);
          
          const cellW = availableWidth / colsInCell;
          let cellH = availableHeight / rowsInCell;
          
          // Limit cellH to prevent large vertical gaps
          const maxCellH = cellW * 1.2; 
          if (cellH > maxCellH) {
            cellH = maxCellH;
          }
          
          const imgSize = Math.min(cellW, cellH) * 0.95; // 95% of cell size for spacing
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Calculate total grid height to center it vertically
          const totalGridHeight = rowsInCell * cellH;
          const verticalOffset = (availableHeight - totalGridHeight) / 2;

          for (let j = 0; j < count; j++) {
            const r = Math.floor(j / colsInCell);
            const c = j % colsInCell;
            
            // Center items in the last row if it's not full
            const itemsInThisRow = (r === rowsInCell - 1) ? (count % colsInCell || colsInCell) : colsInCell;
            const rowOffsetX = (availableWidth - itemsInThisRow * cellW) / 2;
            
            const x = cellX + leftPadding + c * cellW + (cellW - imgSize) / 2 + rowOffsetX;
            const y = cellY + topPadding + r * cellH + (cellH - imgSize) / 2 + verticalOffset;
            
            ctx.drawImage(img, x, y, imgSize, imgSize);
          }

          // Draw Box on the right side of the cell
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 6;
          ctx.strokeRect(
            cellX + colWidth - boxSize - 10, 
            cellY + rowHeight / 2 - boxSize / 2, 
            boxSize, 
            boxSize
          );
        }
      } else {
        // Standard Grid Layouts
        const padding = 10;
        const availableWidth = canvas.width - padding * 2;
        const availableHeight = canvas.height - padding * 2;

        const cols = selectedLayout.id === 'split-v' || selectedLayout.id === 'grid-2x2' ? 2 : 1;
        const rows = selectedLayout.id === 'split-h' || selectedLayout.id === 'grid-2x2' ? 2 : 1;

        const cellW = availableWidth / cols;
        const cellH = availableHeight / rows;

        // Shuffle positions for standard layouts
        const positions = Array.from({ length: selectedLayout.slots }, (_, i) => i);
        const shuffledPositions = [...positions].sort(() => Math.random() - 0.5);

        for (let i = 0; i < displaySlots.length; i++) {
          const slot = displaySlots[i];
          const posIdx = shuffledPositions[i];
          const r = Math.floor(posIdx / cols);
          const c = posIdx % cols;

          const img = new Image();
          img.src = slot.image!;
          await new Promise(res => img.onload = res);

          // Draw image centered in cell
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          const scale = Math.min(cellW / img.width, cellH / img.height) * 0.98;
          const w = img.width * scale;
          const h = img.height * scale;
          const x = padding + c * cellW + (cellW - w) / 2;
          const y = padding + r * cellH + (cellH - h) / 2;

          ctx.drawImage(img, x, y, w, h);
        }
      }

      setLastMax(isRandom ? maxCount : fixedCount);
      setResultImage(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error("Canvas generation error:", err);
      setError("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setSlots(slots.map(s => ({ ...s, image: null })));
    setResultImage(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 md:py-12">
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest"
            >
              <Sparkles className="w-3 h-3" />
              <span>Professional Worksheet Builder</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-black tracking-tighter bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent"
            >
              Hkha
            </motion.h1>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-4 text-white/40 text-sm"
          >
            <div className="flex flex-col items-end">
              <span className="font-medium text-white/60">Client-Side Engine</span>
              <span className="text-[10px] uppercase tracking-wider">Privacy First • No Server Uploads</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
          </motion.div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Step 1: Layout & Title */}
            <section className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">1</div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Layout & Title</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-1">
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-3 block">Selected Layout</span>
                  <div className="p-4 rounded-2xl border bg-emerald-500 border-emerald-500 text-black flex flex-col items-center gap-3">
                    <div className="grid gap-1 w-10 h-10 grid-cols-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-sm bg-black/40" />
                      ))}
                    </div>
                    <span className="text-[10px] font-black uppercase text-center leading-tight">Worksheet (2x3)</span>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-2">
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Worksheet Title</span>
                  <textarea 
                    value={worksheetTitle}
                    onChange={(e) => setWorksheetTitle(e.target.value)}
                    rows={3}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500 transition-all resize-y min-h-[80px]"
                    placeholder="Enter worksheet title..."
                  />
                </div>
              </div>
            </section>

            {/* Step 2: Assets */}
            <section className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">2</div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Upload Assets</h2>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSlots([...slots, { id: `slot-${Date.now()}`, image: null }])}
                    className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" />
                    Add Slot
                  </button>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3 h-3" />
                    Bulk Upload
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileUpload(0, e)}
                      className="hidden"
                    />
                  </label>
                  {slots.some(s => s.image) && (
                    <button 
                      onClick={reset}
                      className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {slots.map((slot, index) => (
                  <div key={slot.id} className="group relative">
                    {!slot.image ? (
                      <div className="aspect-square sm:aspect-video relative rounded-2xl border-2 border-dashed border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-500/50 transition-all cursor-pointer overflow-hidden">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleFileUpload(index, e)}
                          className="absolute inset-0 opacity-0 cursor-pointer z-20"
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="w-5 h-5 text-white/20 group-hover:text-emerald-400" />
                          </div>
                          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Slot {index + 1}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-square sm:aspect-video relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 group/img">
                        <img 
                          src={slot.image} 
                          alt={`Slot ${index + 1}`}
                          className="w-full h-full object-contain p-4"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button 
                            onClick={() => {
                              const newSlots = [...slots];
                              newSlots[index].image = null;
                              setSlots(newSlots);
                            }}
                            className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-110 transition-transform"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <label className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleFileUpload(index, e)}
                              className="hidden"
                            />
                            <RefreshCw className="w-5 h-5" />
                          </label>
                        </div>
                        <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10 text-[8px] font-black uppercase tracking-widest text-white/60">
                          Slot {index + 1}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Step 3: Settings */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title Settings */}
              <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-sm space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">3</div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Title Style</h2>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Size: {titleFontSize}px</span>
                        <input 
                          type="range" min="24" max="80" value={titleFontSize}
                          onChange={(e) => setTitleFontSize(parseInt(e.target.value))}
                          className="w-full accent-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Color</span>
                        <div className="flex items-center gap-3 bg-black/40 rounded-xl px-3 py-2 border border-white/5">
                          <input 
                            type="color" value={titleColor}
                            onChange={(e) => setTitleColor(e.target.value)}
                            className="w-6 h-6 rounded bg-transparent border-none cursor-pointer"
                          />
                          <span className="text-[10px] font-mono text-white/40">{titleColor.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                      {(['none', 'uppercase'] as const).map((tCase) => (
                        <button
                          key={tCase}
                          onClick={() => setTitleCase(tCase)}
                          className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                            titleCase === tCase ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          {tCase === 'none' ? 'Original' : 'Uppercase'}
                        </button>
                      ))}
                    </div>

                    <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          onClick={() => setTitleAlignment(align)}
                          className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                            titleAlignment === align ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              {/* Quantity Settings */}
              <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                      4
                    </div>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Quantity</h2>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/20 uppercase font-black">Min: {minCount}</span>
                      </div>
                      <input 
                        type="range" min="1" max={maxCount} value={minCount}
                        onChange={(e) => setMinCount(parseInt(e.target.value))}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/20 uppercase font-black">Max: {maxCount}</span>
                      </div>
                      <input 
                        type="range" min={minCount} max="20" value={maxCount}
                        onChange={(e) => setMaxCount(parseInt(e.target.value))}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                      <button
                        key={num}
                        onClick={() => setMaxCount(num)}
                        className={`w-full aspect-square rounded-lg text-[10px] sm:text-xs font-black transition-all border ${
                          maxCount === num 
                            ? 'bg-emerald-500 border-emerald-500 text-black' 
                            : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Action Button */}
            <div className="sticky bottom-8 z-40 pb-4">
              <button
                onClick={generateImage}
                disabled={!slots.some(s => s.image) || isGenerating}
                className={`w-full py-6 rounded-[2rem] font-black text-xl uppercase tracking-widest flex items-center justify-center gap-4 transition-all ${
                  !slots.some(s => s.image) || isGenerating
                    ? 'bg-white/5 text-white/10 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:scale-[1.01] active:scale-[0.99]'
                }`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-7 h-7 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-7 h-7" />
                    Generate Worksheet
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Result (5 cols) */}
          <div className="lg:col-span-5 lg:sticky lg:top-12 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-black uppercase tracking-widest text-white/40">Preview</h2>
                {lastMax && (
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest"
                  >
                    Max Items: {lastMax}
                  </motion.span>
                )}
              </div>
              {resultImage && (
                <a 
                  href={resultImage} 
                  download={`${worksheetTitle.replace(/\n/g, ' ').trim() || 'worksheet'}.png`}
                  className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              )}
            </div>

            <div className="aspect-[3/4] relative rounded-[2.5rem] border border-white/10 bg-black/60 overflow-hidden flex items-center justify-center shadow-2xl ring-1 ring-white/5">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-6"
                  >
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
                      <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-emerald-500 animate-pulse" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-bold text-white/80">Crafting Worksheet</p>
                      <p className="text-[10px] text-white/20 uppercase tracking-widest animate-pulse">Arranging elements...</p>
                    </div>
                  </motion.div>
                ) : resultImage ? (
                  <motion.img
                    key="result"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={resultImage}
                    alt="Result"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : error ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-12 text-center"
                  >
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <X className="w-8 h-8 text-red-500" />
                    </div>
                    <p className="text-red-400 font-black uppercase tracking-widest mb-2">Error</p>
                    <p className="text-white/40 text-xs leading-relaxed">{error}</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center p-12 space-y-6"
                  >
                    <div className="w-24 h-24 bg-white/[0.02] border border-white/5 rounded-full flex items-center justify-center mx-auto relative group">
                      <ImageIcon className="w-10 h-10 text-white/10 group-hover:text-emerald-500/20 transition-colors" />
                      <div className="absolute inset-0 border-2 border-dashed border-white/5 rounded-full animate-[spin_20s_linear_infinite]" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-white/40">Ready to Create</p>
                      <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] leading-relaxed">
                        Upload assets and click generate<br/>to see the preview here
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Help Card */}
            <div className="p-8 rounded-[2rem] bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 space-y-6">
              <div className="flex items-center gap-3 text-emerald-400">
                <Info className="w-5 h-5" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Quick Guide</h3>
              </div>
              <div className="space-y-4">
                {[
                  { step: '01', text: 'Select a layout template' },
                  { step: '02', text: 'Upload your target images' },
                  { step: '03', text: 'Customize title and quantity' },
                  { step: '04', text: 'Generate and download' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 group">
                    <span className="text-[10px] font-black text-white/20 group-hover:text-emerald-500 transition-colors">{item.step}</span>
                    <p className="text-xs text-white/60 font-medium">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white/40" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Worksheet Creator v2.0</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/10">
            &copy; 2024 • Built for Educators • Privacy Focused
          </p>
        </div>
      </footer>
    </div>
  );
}
