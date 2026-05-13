import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useJournalSettings } from '@/hooks/useJournalSettings';

interface Props {
  values: string[];
  onChange: (v: string[]) => void;
}

export function MistakeMultiSelect({ values, onChange }: Props) {
  const { settings, addMistake } = useJournalSettings();
  const [draft, setDraft] = useState('');

  function toggle(m: string) {
    if (values.includes(m)) onChange(values.filter(v => v !== m));
    else onChange([...values, m]);
  }

  function addFreeForm() {
    const v = draft.trim();
    if (!v) return;
    addMistake(v);
    if (!values.includes(v)) onChange([...values, v]);
    setDraft('');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {settings.mistakes.map(m => (
          <Badge
            key={m}
            variant={values.includes(m) ? 'destructive' : 'outline'}
            className="cursor-pointer"
            onClick={() => toggle(m)}
          >
            {values.includes(m) && <X className="h-3 w-3 mr-1" />}
            {m}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFreeForm(); } }}
          placeholder="Add custom mistake…"
          className="flex-1 px-2 py-1 border border-input bg-background rounded text-xs"
        />
      </div>
    </div>
  );
}
