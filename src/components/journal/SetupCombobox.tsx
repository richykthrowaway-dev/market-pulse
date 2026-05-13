import { useState, useEffect } from 'react';
import { useJournalSettings } from '@/hooks/useJournalSettings';

interface SetupComboboxProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function SetupCombobox({ value, onChange }: SetupComboboxProps) {
  const { settings, addSetup } = useJournalSettings();
  const [draft, setDraft] = useState(value ?? '');

  // Sync external value -> internal draft
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  function commit() {
    const v = draft.trim();
    if (!v) { onChange(undefined); return; }
    addSetup(v);
    onChange(v);
  }

  return (
    <>
      <input
        list="setup-options"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        placeholder="e.g. Breakout"
        className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <datalist id="setup-options">
        {settings.setups.map(s => <option key={s} value={s} />)}
      </datalist>
    </>
  );
}
