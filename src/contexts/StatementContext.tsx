import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { parseStatementFile, type ParsedStatement } from '@/services/parser';

const STORAGE_KEY = 'portfolio-statement-v1';

interface StatementContextType {
  parsedStatement: ParsedStatement | null;
  fileName: string | null;
  isParsingFile: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  clearStatement: () => void;
}

const StatementContext = createContext<StatementContextType | undefined>(undefined);

function loadPersistedStatement(): { statement: ParsedStatement; fileName: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.statement && parsed?.fileName) return parsed;
  } catch { /* ignore corrupt data */ }
  return null;
}

export function StatementProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersistedStatement();
  const [parsedStatement, setParsedStatement] = useState<ParsedStatement | null>(persisted?.statement ?? null);
  const [fileName, setFileName] = useState<string | null>(persisted?.fileName ?? null);
  const [isParsingFile, setIsParsingFile] = useState(false);

  // Persist to localStorage whenever statement changes
  useEffect(() => {
    if (parsedStatement && fileName) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ statement: parsedStatement, fileName }));
      } catch { /* storage full – silently fail */ }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [parsedStatement, fileName]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingFile(true);
    try {
      const result = await parseStatementFile(file);
      setParsedStatement(result);
      setFileName(file.name);
    } catch (err) {
      console.error('Failed to parse statement:', err);
    } finally {
      setIsParsingFile(false);
    }
    e.target.value = '';
  }, []);

  const clearStatement = useCallback(() => {
    setParsedStatement(null);
    setFileName(null);
  }, []);

  return (
    <StatementContext.Provider value={{ parsedStatement, fileName, isParsingFile, handleFileUpload, clearStatement }}>
      {children}
    </StatementContext.Provider>
  );
}

export function useStatement() {
  const ctx = useContext(StatementContext);
  if (!ctx) throw new Error('useStatement must be used within StatementProvider');
  return ctx;
}
