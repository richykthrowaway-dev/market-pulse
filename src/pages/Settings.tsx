import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Bell, Globe, Lock, User, Settings as SettingsIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProfileForm {
  firstName: string;
  lastName:  string;
  phone:     string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Component ─────────────────────────────────────────────────────────────────

const Settings = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted]       = useState(false);

  // Auth state
  const [email,       setEmail]       = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Profile form — controlled state seeded from user_metadata
  const [form,    setForm]    = useState<ProfileForm>({ firstName: '', lastName: '', phone: '' });
  const [dirty,   setDirty]   = useState(false);
  const [status,  setStatus]  = useState<SaveStatus>('idle');
  const [errMsg,  setErrMsg]  = useState('');

  // Load real user data on mount
  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email ?? '');
        setIsAnonymous(!!user.is_anonymous);
        const m = user.user_metadata ?? {};
        setForm({
          firstName: m.first_name ?? m.full_name?.split(' ')[0] ?? '',
          lastName:  m.last_name  ?? m.full_name?.split(' ').slice(1).join(' ') ?? '',
          phone:     m.phone      ?? '',
        });
      }
      setAuthLoading(false);
    });
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  function handleField(field: keyof ProfileForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    setStatus('idle');
  }

  async function handleSave() {
    setStatus('saving');
    setErrMsg('');
    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: form.firstName.trim(),
        last_name:  form.lastName.trim(),
        phone:      form.phone.trim(),
      },
    });
    if (error) {
      setStatus('error');
      setErrMsg(error.message);
    } else {
      setStatus('saved');
      setDirty(false);
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  function handleCancel() {
    // Re-seed from current auth state
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const m = user.user_metadata ?? {};
        setForm({
          firstName: m.first_name ?? '',
          lastName:  m.last_name  ?? '',
          phone:     m.phone      ?? '',
        });
      }
      setDirty(false);
      setStatus('idle');
    });
  }

  return (
    <PageLayout title="Settings">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Sidebar nav ── */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-lg p-6 shadow">
            <h2 className="text-xl font-semibold mb-4">Settings</h2>
            <nav className="space-y-2">
              <Button variant="ghost" className="w-full justify-start" size="lg">
                <User className="mr-2 h-5 w-5" />
                Account
              </Button>
              <Button variant="ghost" className="w-full justify-start" size="lg">
                <Bell className="mr-2 h-5 w-5" />
                Notifications
              </Button>
              <Button variant="ghost" className="w-full justify-start" size="lg">
                <Lock className="mr-2 h-5 w-5" />
                Security
              </Button>
              <Button variant="ghost" className="w-full justify-start" size="lg">
                <Globe className="mr-2 h-5 w-5" />
                Regional Settings
              </Button>
              <Button variant="ghost" className="w-full justify-start" size="lg">
                <SettingsIcon className="mr-2 h-5 w-5" />
                Preferences
              </Button>
            </nav>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Account Settings */}
          <div className="bg-card rounded-lg p-6 shadow">
            <h2 className="text-xl font-semibold mb-6">Account Settings</h2>

            <div className="space-y-6">

              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-medium mb-4">Personal Information</h3>

                {authLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading account details…
                  </div>
                ) : isAnonymous ? (
                  <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    You're browsing as a guest. <a href="/settings" className="underline text-foreground">Create an account</a> to save personal information.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="firstName">
                        First Name
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        value={form.firstName}
                        onChange={e => handleField('firstName', e.target.value)}
                        placeholder="Your first name"
                        autoComplete="given-name"
                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="lastName">
                        Last Name
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        value={form.lastName}
                        onChange={e => handleField('lastName', e.target.value)}
                        placeholder="Your last name"
                        autoComplete="family-name"
                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="email">
                        Email
                      </label>
                      {/* Email is the auth identifier — read-only to prevent accidental changes.
                          Changing email requires re-verification; direct users to Supabase auth flow. */}
                      <input
                        id="email"
                        type="email"
                        value={email}
                        readOnly
                        disabled
                        autoComplete="email"
                        className="w-full px-3 py-2 border border-input bg-muted/40 text-muted-foreground rounded-md cursor-not-allowed"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Email cannot be changed here. Contact support to update it.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="phone">
                        Phone <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={e => handleField('phone', e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        autoComplete="tel"
                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Display Settings */}
              <div>
                <h3 className="text-lg font-medium mb-4">Display Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Dark Mode</p>
                      <p className="text-sm text-muted-foreground">Switch between light and dark theme</p>
                    </div>
                    <Switch
                      checked={isDark}
                      onCheckedChange={checked => setTheme(checked ? 'dark' : 'light')}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Compact View</p>
                      <p className="text-sm text-muted-foreground">Show more data with less spacing</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>

              {/* Save / Cancel — only shown when there are unsaved personal info changes */}
              {!isAnonymous && !authLoading && (
                <div className="pt-4 border-t flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={!dirty || status === 'saving'}
                  >
                    {status === 'saving' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {status === 'saving' ? 'Saving…' : 'Save Changes'}
                  </Button>

                  {dirty && (
                    <Button variant="outline" onClick={handleCancel} disabled={status === 'saving'}>
                      Cancel
                    </Button>
                  )}

                  {status === 'saved' && (
                    <span className="flex items-center gap-1.5 text-sm text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      Saved
                    </span>
                  )}

                  {status === 'error' && (
                    <span className="flex items-center gap-1.5 text-sm text-danger">
                      <AlertCircle className="h-4 w-4" />
                      {errMsg || 'Failed to save — please try again.'}
                    </span>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </PageLayout>
  );
};

export default Settings;
