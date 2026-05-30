import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { Play, Square, Save, RotateCcw } from 'lucide-react';

interface ScriptEditorProps {
  code: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onStop: () => void;
  onSave: () => void;
  onReset: () => void;
  isRunning: boolean;
  isSaving: boolean;
  scriptName: string;
  onScriptNameChange: (name: string) => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  code,
  onChange,
  onRun,
  onStop,
  onSave,
  onReset,
  isRunning,
  isSaving,
  scriptName,
  onScriptNameChange,
}) => {
  return (
    <div className="flex-1 flex flex-col border border-stone-900 bg-stone-950/40 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-900 bg-stone-900/30">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={scriptName}
            onChange={(e) => onScriptNameChange(e.target.value)}
            placeholder="script_name.py"
            className="bg-transparent border-b border-stone-800 hover:border-stone-700 focus:border-amber-500 focus:outline-none text-xs font-mono text-stone-200 py-0.5 px-1 max-w-[200px]"
          />
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="p-1.5 rounded bg-stone-900/60 border border-stone-850 text-stone-400 hover:text-stone-200 transition-all flex items-center gap-1.5 text-[10px] font-mono uppercase"
            title="Reset code to default template"
          >
            <RotateCcw size={12} />
            Reset
          </button>

          <button
            onClick={onSave}
            disabled={isSaving}
            className="p-1.5 rounded bg-stone-900/60 border border-stone-850 text-stone-400 hover:text-stone-200 disabled:opacity-40 transition-all flex items-center gap-1.5 text-[10px] font-mono uppercase"
            title="Save script to storage"
          >
            <Save size={12} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          <span className="h-4 w-px bg-stone-800 mx-1" />

          {isRunning ? (
            <button
              onClick={onStop}
              className="px-3 py-1.5 rounded bg-stone-900 border border-rose-950 text-rose-400 hover:bg-rose-950/20 transition-all flex items-center gap-1.5 text-[10px] font-mono uppercase font-semibold animate-pulse"
            >
              <Square size={12} fill="currentColor" />
              Stop
            </button>
          ) : (
            <button
              onClick={onRun}
              className="px-3 py-1.5 rounded bg-amber-500 text-stone-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 text-[10px] font-mono uppercase font-semibold shadow-md shadow-amber-500/10"
            >
              <Play size={12} fill="currentColor" />
              Run Script
            </button>
          )}
        </div>
      </div>

      {/* CodeMirror Workspace */}
      <div className="flex-1 overflow-auto text-xs font-mono scrollbar-thin">
        <CodeMirror
          value={code}
          height="100%"
          extensions={[python()]}
          theme="dark"
          onChange={(value) => onChange(value)}
          className="h-full focus-within:outline-none"
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: false,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
          }}
        />
      </div>
    </div>
  );
};
