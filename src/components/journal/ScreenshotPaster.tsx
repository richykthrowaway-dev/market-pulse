import { useEffect, useState } from 'react';
import { Clipboard, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJournalScreenshots } from '@/hooks/useJournalScreenshots';

interface Props {
  tradeId: string;
  screenshotKey?: string;
  onChange: (key: string | undefined) => void;
}

export function ScreenshotPaster({ tradeId, screenshotKey, onChange }: Props) {
  const { save, load, remove } = useJournalScreenshots();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (screenshotKey) load(screenshotKey).then(setPreviewUrl);
    else setPreviewUrl(null);
  }, [screenshotKey, load]);

  async function handleBlob(blob: Blob) {
    const key = await save(tradeId, blob);
    onChange(key);
    setPreviewUrl(URL.createObjectURL(blob));
  }

  async function handlePasteButton() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          await handleBlob(blob);
          return;
        }
      }
    } catch {}
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleBlob(f);
  }

  async function clearShot() {
    if (screenshotKey) await remove(screenshotKey);
    setPreviewUrl(null);
    onChange(undefined);
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) { handleBlob(blob); e.preventDefault(); return; }
        }
      }
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [tradeId]);

  return (
    <div className="space-y-2">
      {previewUrl ? (
        <div className="relative inline-block">
          <img src={previewUrl} alt="Trade screenshot" className="max-h-48 rounded border border-border" />
          <Button type="button" size="sm" variant="destructive" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={clearShot}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-border rounded-md p-4 text-center text-sm text-muted-foreground">
          <p>Paste chart screenshot (Ctrl/Cmd+V), upload, or drag a file</p>
          <div className="mt-2 flex gap-2 justify-center">
            <Button type="button" size="sm" variant="outline" onClick={handlePasteButton}>
              <Clipboard className="h-3 w-3 mr-1" /> Paste
            </Button>
            <label className="inline-flex items-center gap-1 text-xs cursor-pointer border border-input rounded px-2 py-1 hover:bg-muted">
              <Upload className="h-3 w-3" /> Upload
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
