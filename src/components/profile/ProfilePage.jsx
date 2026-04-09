import { useState } from 'react';
import '../../assets/styles/colors.css';
import '../../assets/styles/dashboard.css';
import { supabase } from '../../api/supabaseClient';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'ZAR'];
const TIMEZONES  = [
  'UTC', 'Africa/Johannesburg', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Dubai',
  'Australia/Sydney',
];

/**
 * ProfilePage
 *
 * Props:
 *   user             — Supabase user object
 *   profile          — current profile row from App state
 *   onProfileUpdate  — callback(updatedProfile) to push changes up to App
 *   showDemoData     — bool from hook via App (source of truth is Postgres)
 *   onToggleDemoData — calls hook's toggleDemoData (optimistic, persisted to DB)
 */
export default function ProfilePage({
  user,
  profile,
  onProfileUpdate,
  showDemoData,
  onToggleDemoData,
}) {
  const [values, setValues] = useState({
    initial_balance:       profile?.initial_balance        ?? 5000,
    profit_target:         profile?.profit_target          ?? 30,
    weekly_default_target: profile?.weekly_default_target  ?? 500,
    currency:              profile?.currency               ?? 'USD',
    timezone:              profile?.timezone               ?? 'UTC',
  });
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const set = (key, val) => setValues(v => ({ ...v, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const payload = {
        initial_balance:       Number(values.initial_balance),
        profit_target:         Number(values.profit_target),
        weekly_default_target: Number(values.weekly_default_target),
        currency:              values.currency,
        timezone:              values.timezone,
      };
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user?.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      onProfileUpdate?.(data);
      setSaveMsg('saved');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      setSaveMsg(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <div style={{ width: '100%' }}>

      {/* Page title */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.03em', margin: 0 }}>
          Profile Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
          Configure your account defaults. Changes apply globally to all calculations.
        </p>
      </div>

      {/* ── Section: Account ───────────────────────────────────── */}
      <Section title="Account" subtitle="Your trading account parameters">
        <Field label="Initial Balance" hint="Starting balance used to compute returns">
          <NumberInput
            value={values.initial_balance}
            onChange={v => set('initial_balance', v)}
            prefix="$"
            min={0}
          />
        </Field>
        <Field label="Currency" hint="Display currency for all P&L figures">
          <SelectInput
            value={values.currency}
            onChange={v => set('currency', v)}
            options={CURRENCIES}
          />
        </Field>
        <Field label="Timezone" hint="Used to bucket trades into trading days">
          <SelectInput
            value={values.timezone}
            onChange={v => set('timezone', v)}
            options={TIMEZONES}
          />
        </Field>
      </Section>

      {/* ── Section: Targets ────────────────────────────────────── */}
      <Section title="Targets" subtitle="Goal thresholds shown on the dashboard and calendar">
        <Field label="Profit Target" hint="% gain from initial balance — shown on the dashboard gauge">
          <NumberInput
            value={values.profit_target}
            onChange={v => set('profit_target', v)}
            suffix="%"
            min={1}
            max={1000}
          />
        </Field>
        <Field label="Weekly Default Target" hint="Default P&L target per week on the calendar. Can be overridden per-week.">
          <NumberInput
            value={values.weekly_default_target}
            onChange={v => set('weekly_default_target', v)}
            prefix="$"
            min={0}
          />
        </Field>
      </Section>

      {/* ── Section: Demo Data ───────────────────────────────────── */}
      <Section title="Demo Data" subtitle="Control visibility of the sample data loaded on first sign-in">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          background: 'var(--bg-main)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>
              Show demo trades
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              {showDemoData
                ? 'Demo data is visible across the dashboard and calendar.'
                : 'Demo data is hidden. Only your real trades are shown.'}
            </div>
          </div>
          {/* Toggle — calls hook's toggleDemoData which persists to Postgres */}
          <button
            onClick={onToggleDemoData}
            style={{
              width: '44px',
              height: '24px',
              borderRadius: '12px',
              background: showDemoData ? 'var(--accent-lime)' : 'var(--border-color)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute',
              top: '3px',
              left: showDemoData ? '22px' : '3px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: showDemoData ? '#0a0a0f' : '#555',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </Section>

      {/* ── Save bar ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '2rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '11px 28px',
            background: saving ? 'rgba(200,241,53,0.5)' : 'var(--accent-lime)',
            border: 'none',
            borderRadius: '8px',
            color: '#0a0a0f',
            fontSize: '1rem',
            fontWeight: '700',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.2px',
            transition: 'opacity 0.15s',
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {saveMsg === 'saved' && (
          <span style={{ fontSize: '0.9rem', color: 'var(--accent-lime)', fontWeight: '600' }}>
            ✓ Changes saved
          </span>
        )}
        {saveMsg && saveMsg !== 'saved' && (
          <span style={{ fontSize: '0.9rem', color: 'var(--color-loss)' }}>
            ⚠ {saveMsg}
          </span>
        )}
      </div>

      </div>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function Section({ title, subtitle, children }) {
  return (
    <div style={{
      marginBottom: '2rem',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      overflow: 'hidden',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '3px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ padding: '8px 0' }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 20px',
      gap: '24px',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-main)' }}>
          {label}
        </div>
        {hint && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {hint}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, minWidth: '160px' }}>
        {children}
      </div>
    </div>
  );
}

function NumberInput({ value, onChange, prefix, suffix, min, max }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {prefix && (
        <span style={{
          position: 'absolute', left: '10px',
          fontSize: '15px', color: 'var(--text-muted)', pointerEvents: 'none',
        }}>{prefix}</span>
      )}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '7px',
          color: 'var(--text-main)',
          fontSize: '15px',
          padding: `9px ${suffix ? '28px' : '10px'} 9px ${prefix ? '24px' : '10px'}`,
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          textAlign: 'right',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent-lime)'}
        onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
      />
      {suffix && (
        <span style={{
          position: 'absolute', right: '10px',
          fontSize: '15px', color: 'var(--text-muted)', pointerEvents: 'none',
        }}>{suffix}</span>
      )}
    </div>
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        background: 'var(--bg-main)',
        border: '1px solid var(--border-color)',
        borderRadius: '7px',
        color: 'var(--text-main)',
        fontSize: '15px',
        padding: '9px 10px',
        outline: 'none',
        fontFamily: 'inherit',
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: '28px',
      }}
      onFocus={e => e.target.style.borderColor = 'var(--accent-lime)'}
      onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}