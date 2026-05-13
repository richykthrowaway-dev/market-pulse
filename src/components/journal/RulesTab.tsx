import { useState } from 'react';
import { useJournalSettings, JournalSettings } from '@/hooks/useJournalSettings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

export function RulesTab() {
  const { settings, setSettings, addSetup, addMistake } = useJournalSettings();
  const [newSetup, setNewSetup] = useState('');
  const [newMistake, setNewMistake] = useState('');

  function removeSetup(s: string) { setSettings({ setups: settings.setups.filter(x => x !== s) }); }
  function removeMistake(m: string) { setSettings({ mistakes: settings.mistakes.filter(x => x !== m) }); }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Account size</h3>
        <Input
          type="number"
          placeholder="$0"
          value={settings.accountSize ?? ''}
          onChange={e => setSettings({ accountSize: Number(e.target.value) || undefined })}
          className="w-48"
        />
        <p className="text-xs text-muted-foreground mt-2">Enables risk-as-% calculations across the journal.</p>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Setups (playbook)</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {settings.setups.map(s => (
            <Badge key={s} variant="outline" className="gap-1">
              {s}
              <button type="button" onClick={() => removeSetup(s)}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newSetup} onChange={e => setNewSetup(e.target.value)} placeholder="Add setup name…" />
          <Button onClick={() => { if (newSetup.trim()) { addSetup(newSetup.trim()); setNewSetup(''); } }}>Add</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Mistakes taxonomy</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {settings.mistakes.map(m => (
            <Badge key={m} variant="outline" className="gap-1">
              {m}
              <button type="button" onClick={() => removeMistake(m)}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newMistake} onChange={e => setNewMistake(e.target.value)} placeholder="Add mistake name…" />
          <Button onClick={() => { if (newMistake.trim()) { addMistake(newMistake.trim()); setNewMistake(''); } }}>Add</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Goals</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <NumGoal label="Daily target" value={settings.goals.daily} onChange={v => setSettings({ goals: { ...settings.goals, daily: v } })} />
          <NumGoal label="Weekly target" value={settings.goals.weekly} onChange={v => setSettings({ goals: { ...settings.goals, weekly: v } })} />
          <NumGoal label="Monthly target" value={settings.goals.monthly} onChange={v => setSettings({ goals: { ...settings.goals, monthly: v } })} />
          <NumGoal label="Daily max LOSS" value={settings.goals.dailyMaxLoss} onChange={v => setSettings({ goals: { ...settings.goals, dailyMaxLoss: v } })} />
        </div>
      </Card>
    </div>
  );
}

function NumGoal({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" placeholder="$0" value={value ?? ''}
        onChange={e => onChange(Number(e.target.value) || undefined)} className="text-sm" />
    </div>
  );
}
