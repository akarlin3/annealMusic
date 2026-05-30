import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Trash2 } from 'lucide-react';

interface ReplHistoryItem {
  id: string;
  type: 'input' | 'output' | 'error';
  text: string;
}

interface REPLProps {
  onExecute: (
    code: string,
  ) => Promise<{ success: boolean; result?: string; error?: string }>;
  onClearOutput: () => void;
}

export const REPL: React.FC<REPLProps> = ({ onExecute, onClearOutput }) => {
  const [history, setHistory] = useState<ReplHistoryItem[]>([
    {
      id: 'init-1',
      type: 'output',
      text: 'AnnealMusic Interactive REPL Console v5.4.0\nType standard Python code. Access live state using "import anneal".\n',
    },
  ]);
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleClear = () => {
    setHistory([]);
    onClearOutput();
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Up arrow: Previous command
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      const nextIndex = historyIndex + 1;
      if (nextIndex < commandHistory.length) {
        setHistoryIndex(nextIndex);
        setInput(commandHistory[commandHistory.length - 1 - nextIndex] || '');
      }
    }
    // 2. Down arrow: Next command
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setInput(commandHistory[commandHistory.length - 1 - nextIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
    // 3. Tab: 4 spaces indent
    else if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue =
        input.substring(0, start) + '    ' + input.substring(end);
      setInput(newValue);
      // reset selection target
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.selectionStart = inputRef.current.selectionEnd =
            start + 4;
        }
      }, 0);
    }
    // 4. Enter: Execute (unless Shift is pressed for multiline)
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await executeCommand();
    }
  };

  const executeCommand = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Append command to visual log
    const cmdId = Math.random().toString(36).substring(2, 9);
    setHistory((prev) => [
      ...prev,
      { id: cmdId, type: 'input', text: `>>> ${input}` },
    ]);

    // Append to keys history
    setCommandHistory((prev) => [...prev, input]);
    setHistoryIndex(-1);
    setInput('');

    // Call execution
    const res = await onExecute(input);

    // Append outputs
    const resId = Math.random().toString(36).substring(2, 9);
    if (res.success) {
      const outputText = res.result;
      if (outputText) {
        setHistory((prev) => [
          ...prev,
          { id: resId, type: 'output', text: outputText },
        ]);
      }
    } else if (res.error) {
      setHistory((prev) => [
        ...prev,
        {
          id: resId,
          type: 'error',
          text: `Traceback (most recent call last):\n  File "<stdin>", line 1, in <module>\n${res.error}`,
        },
      ]);
    }
  };

  return (
    <div className="flex-1 flex flex-col border border-stone-900 bg-stone-950/20 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md min-h-[300px]">
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-900 bg-stone-900/30">
        <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-2">
          <Terminal size={14} className="text-amber-500" />
          Interactive REPL Terminal
        </span>
        <button
          onClick={handleClear}
          className="p-1 rounded bg-stone-900 hover:text-stone-200 text-stone-500 border border-stone-850 hover:bg-stone-850 transition-all"
          title="Clear REPL output logs"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Output Console Streams */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-1.5 scrollbar-thin max-h-[350px]">
        {history.map((item) => {
          let textStyle = 'text-stone-300';
          if (item.type === 'input') {
            textStyle = 'text-amber-400 font-semibold';
          } else if (item.type === 'error') {
            textStyle =
              'text-rose-400 bg-rose-950/10 p-1 rounded border border-rose-950/20';
          }
          return (
            <pre
              key={item.id}
              className={`whitespace-pre-wrap break-all ${textStyle}`}
            >
              {item.text}
            </pre>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input Prompt Card */}
      <div className="border-t border-stone-900 bg-stone-950/60 p-3 flex gap-2.5 items-end">
        <span className="text-amber-500 font-semibold text-xs font-mono pt-1">
          &gt;&gt;&gt;
        </span>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={Math.min(5, input.split('\n').length)}
          placeholder="Type python command and press Enter..."
          className="flex-1 bg-transparent border-0 focus:ring-0 p-0 text-xs font-mono text-stone-200 placeholder-stone-600 focus:outline-none resize-none"
        />
        <button
          onClick={executeCommand}
          disabled={!input.trim()}
          className="p-2 rounded-lg bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-amber-500/10"
        >
          <Send size={12} fill="currentColor" />
        </button>
      </div>
    </div>
  );
};
