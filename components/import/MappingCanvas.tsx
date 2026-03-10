import React, { useState, useEffect, useRef } from 'react';
import { ColumnAnalysis, ColumnMapping } from '../../services/importService';
import { ArrowRight, Check, ChevronDown, Sparkles } from 'lucide-react';

interface MappingCanvasProps {
  analyses: ColumnAnalysis[];
  initialMapping?: Partial<ColumnMapping>;
  onMappingChange: (mapping: ColumnMapping) => void;
  onComplete: () => void;
}

type RequirementType = 'mandatory' | 'oneOf';
const SYSTEM_FIELDS: { key: keyof ColumnMapping | 'amount_combined'; label: string; required?: RequirementType; description: string }[] = [
  { key: 'dateIndex', label: 'Date', required: 'mandatory', description: 'Transaction Date' },
  { key: 'timeIndex', label: 'Time', description: 'Transaction Time (Optional)' },
  { key: 'memoIndex', label: 'Description', required: 'mandatory', description: 'Details or Merchant' },
  { key: 'amountIndex', label: 'Amount', required: 'oneOf', description: 'Single amount column' },
  { key: 'amountInIndex', label: 'Income', required: 'oneOf', description: 'Deposits' },
  { key: 'amountOutIndex', label: 'Expense', required: 'oneOf', description: 'Withdrawals' },
  { key: 'categoryIndex', label: 'Category', description: 'Type of transaction' },
  { key: 'assetIndex', label: 'Account', description: 'Target Asset' },
  { key: 'merchantIndex', label: 'Merchant', description: 'Store name' },
  { key: 'tagIndex', label: 'Tags', description: 'Labels' },
  { key: 'installmentIndex', label: 'Installment', description: 'Months' },
];

export const MappingCanvas: React.FC<MappingCanvasProps> = ({ 
    analyses, 
    initialMapping = {}, 
    onMappingChange, 
    onComplete 
}) => {
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>(initialMapping);
  const [activePopover, setActivePopover] = useState<number | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     const handleClickOutside = (event: MouseEvent) => {
         if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
             setActivePopover(null);
         }
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    onMappingChange(mapping as ColumnMapping);
  }, [mapping, onMappingChange]);

  const handleSelectMapping = (colIndex: number, fieldKey: string) => {
      const targetKey = fieldKey === 'amount_combined' ? 'amountIndex' : fieldKey as keyof ColumnMapping;
      
      setMapping(prev => {
          const next = { ...prev };
          
          // Toggle off: if the clicked field is already mapped to this column, remove it
          if (next[targetKey] === colIndex) {
              delete next[targetKey];
              return next;
          }

          // Regular selection logic:
          Object.keys(next).forEach(key => {
              if (next[key as keyof ColumnMapping] === colIndex) {
                  delete next[key as keyof ColumnMapping];
              }
          });
          next[targetKey] = colIndex;
          return next;
      });
      setActivePopover(null);
  };

  const handleRemoveMappingColumn = (colIndex: number) => {
      setMapping(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
              if (next[key as keyof ColumnMapping] === colIndex) {
                  delete next[key as keyof ColumnMapping];
              }
          });
          return next;
      });
      setActivePopover(null);
  };

  const hasMandatory = mapping.dateIndex !== undefined && mapping.dateIndex >= 0 && 
                       mapping.memoIndex !== undefined && mapping.memoIndex >= 0;
  const hasOneOfAmount = 
      (mapping.amountIndex !== undefined && mapping.amountIndex >= 0) || 
      (mapping.amountInIndex !== undefined && mapping.amountInIndex >= 0) || 
      (mapping.amountOutIndex !== undefined && mapping.amountOutIndex >= 0);
  const isComplete = hasMandatory && hasOneOfAmount;

  const getMappedFieldForColumn = (colIndex: number) => {
      for (const [key, val] of Object.entries(mapping)) {
          if (val === colIndex) {
              return SYSTEM_FIELDS.find(f => f.key === key || (key === 'amountIndex' && f.key === 'amount_combined'));
          }
      }
      return null;
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-6 duration-700 min-h-[600px] font-sans selection:bg-indigo-100 selection:text-indigo-900">
        <div className="flex items-end justify-between mb-8 px-2">
            <div>
                <h2 className="text-3xl font-medium tracking-tight text-slate-900">Map Columns</h2>
                <p className="text-sm text-slate-500 mt-2 font-light">
                    Select the role for each column. We've auto-detected some for you.
                </p>
            </div>
            
             <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-300'}`} />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    {isComplete ? 'Ready to Import' : 'Pending Required'}
                </span>
            </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-visible custom-scrollbar px-2 pb-16 pt-2">
            <div className="flex gap-4 min-w-max">
                {analyses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center w-full py-20 text-slate-400">
                        <p className="text-sm font-bold">No columns detected.</p>
                        <p className="text-xs mt-1">Please go back and re-upload your file.</p>
                    </div>
                ) : analyses.map(analysis => {
                    const mappedField = getMappedFieldForColumn(analysis.index);
                    const isMapped = !!mappedField;
                    const hasSuggestion = analysis.suggestedField && !isMapped && analysis.confidence > 0.7;
                    const suggestionField = hasSuggestion ? SYSTEM_FIELDS.find(f => f.key === analysis.suggestedField) : null;

                    return (
                        <div key={analysis.index} className="w-[200px] flex flex-col group">
                            {/* Header Slot */}
                            <div className={`relative mb-4 shrink-0 transition-z-index ${activePopover === analysis.index ? 'z-50' : 'z-10'}`}>
                                <div className="p-1 -m-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActivePopover(activePopover === analysis.index ? null : analysis.index); }}
                                        className={`
                                            w-full h-[54px] rounded-xl flex flex-col justify-center px-4 transition-all duration-300 border text-left outline-none
                                            ${isMapped 
                                                ? `border-transparent bg-slate-900 shadow-md transform group-hover:-translate-y-0.5` 
                                                : `bg-slate-50/50 backdrop-blur-md border-slate-200 hover:border-slate-300 hover:bg-white`
                                            }
                                            ${activePopover === analysis.index ? 'ring-2 ring-indigo-500 border-indigo-300 shadow-md ring-offset-1' : ''}
                                        `}
                                    >
                                        {isMapped ? (
                                            <div className="flex items-center justify-between pointer-events-none w-full">
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className="text-[10px] font-bold text-slate-400/80 uppercase tracking-wider">Column {analysis.index + 1}</span>
                                                    <span className="text-[14px] font-medium text-white truncate tracking-tight w-32">{mappedField?.label}</span>
                                                </div>
                                                <Check size={16} className="text-emerald-400 flex-shrink-0" />
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between pointer-events-none w-full">
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Column {analysis.index + 1}</span>
                                                    <span className="text-[14px] font-medium text-slate-400 truncate tracking-tight w-32">Select Role</span>
                                                </div>
                                                <ChevronDown size={14} className="text-slate-300 flex-shrink-0" />
                                            </div>
                                        )}
                                    </button>
                                </div>

                                {/* Auto-Pulse Suggestion */}
                                {!isMapped && hasSuggestion && suggestionField && activePopover !== analysis.index && (
                                    <div 
                                        className="absolute -top-3 -right-2 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm shadow-indigo-500/20 cursor-pointer flex items-center gap-1 hover:bg-indigo-600 transition-colors z-10"
                                        onClick={(e) => { e.stopPropagation(); handleSelectMapping(analysis.index, analysis.suggestedField!); }}
                                    >
                                        <Sparkles size={10} />
                                        {suggestionField.label}?
                                    </div>
                                )}

                                {/* Popover */}
                                {activePopover === analysis.index && (
                                    <div 
                                        ref={popoverRef}
                                        className="absolute top-[62px] left-0 w-[200px] bg-white/95 backdrop-blur-3xl border border-slate-100 rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.08)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                                    >
                                        <div className="p-1.5 space-y-0.5">
                                            <p className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Select Role</p>
                                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {SYSTEM_FIELDS.map(f => {
                                                    const isCurrent = mappedField?.key === f.key;
                                                    return (
                                                        <button
                                                            key={f.key}
                                                            onClick={(e) => { e.stopPropagation(); handleSelectMapping(analysis.index, f.key); }}
                                                            className={`
                                                                w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] transition-all
                                                                ${isCurrent ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                                            `}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${
                                                                    f.required === 'mandatory' ? 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]' : 
                                                                    f.required === 'oneOf' ? 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]' : 
                                                                    'bg-transparent'
                                                                }`} />
                                                                <span>{f.label}</span>
                                                            </div>
                                                            {isCurrent && <Check size={14} className="text-indigo-600" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Data Context */}
                            <div className="flex flex-col pt-3 pointer-events-none w-full">
                                {(analysis.sampleValues || []).slice(0, 20).map((sample, idx) => (
                                    <div 
                                        key={idx} 
                                        className="text-[13px] text-slate-500 font-medium tracking-tight truncate w-full h-[32px] flex items-center shrink-0 border-b border-slate-100/50 px-4 transition-colors hover:bg-slate-50"
                                    >
                                        {sample === undefined || sample === null || sample === '' ? '' : String(sample)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="mt-4 flex justify-end items-center px-2 pt-6 border-t border-slate-100/50">
            <button
                onClick={onComplete}
                disabled={!isComplete}
                className={`
                    px-8 py-3.5 rounded-full font-semibold text-sm transition-all flex items-center gap-2 border
                    ${isComplete 
                        ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800 hover:-translate-y-0.5 shadow-[0_12px_24px_rgba(0,0,0,0.15)] active:scale-95' 
                        : 'bg-white text-slate-300 border-slate-200 cursor-not-allowed'}
                `}
            >
                Confirm Mapping <ArrowRight size={16} />
            </button>
        </div>
    </div>
  );
};
export default MappingCanvas;
