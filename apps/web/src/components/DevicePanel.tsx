import type { ConnectedPeripheral, DeviceSettings } from '@gearhub/shared';
import { Badge } from '@gearhub/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gearhub/ui/components/select';
import { BatteryMedium, Check, Lightbulb, Zap } from 'lucide-react';
import { DeviceIcon } from './DeviceIcon';
import { SegmentedControl } from './SegmentedControl';
import { SettingRow } from './SettingRow';

const profiles = ['Competitive', 'Daily driver', 'Focus', 'Default'];

export function DevicePanel({
  device,
  pending,
  onUpdate,
}: {
  device: ConnectedPeripheral;
  pending: keyof DeviceSettings | null;
  onUpdate<K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]): void;
}) {
  const { capabilities: caps, settings } = device;
  return (
    <div className="content-shell">
      <header className="device-header">
        <div className="device-hero-icon">
          <DeviceIcon type={device.type} className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="eyebrow">{device.manufacturer}</span>
            <span className="size-1 rounded-full bg-status" />
            <span className="text-xs text-status">Connected</span>
          </div>
          <h1 className="truncate text-2xl font-semibold tracking-[-0.025em]">{device.name}</h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {device.type} · USB receiver
          </p>
        </div>
        {caps.battery && (
          <div className="battery-pill">
            <BatteryMedium className="size-4" />
            <span>{settings.batteryLevel}%</span>
          </div>
        )}
      </header>

      <div className="settings-group">
        <div className="settings-group-title">
          <span>Performance</span>
          <span>Changes apply instantly</span>
        </div>
        {caps.dpi && (
          <SettingRow
            title="DPI sensitivity"
            description={`Pointer resolution from ${caps.dpi.min.toLocaleString()} to ${caps.dpi.max.toLocaleString()} DPI.`}
            indicator={<Badge>Supported</Badge>}
          >
            <SegmentedControl
              label="DPI sensitivity"
              options={caps.dpi.presets}
              value={settings.dpi}
              disabled={pending === 'dpi'}
              onChange={(value) => onUpdate('dpi', value)}
            />
          </SettingRow>
        )}
        {caps.pollingRate && (
          <SettingRow
            title="Polling rate"
            description="How often the device reports its position to your computer."
          >
            <SegmentedControl
              label="Polling rate"
              options={caps.pollingRate.supported}
              value={settings.pollingRate}
              suffix="Hz"
              disabled={pending === 'pollingRate'}
              onChange={(value) => onUpdate('pollingRate', value)}
            />
          </SettingRow>
        )}
        {caps.rapidTrigger && (
          <SettingRow
            title="Rapid trigger"
            description="Reset a key as soon as it begins moving upward."
            indicator={<Zap className="size-3.5 text-primary" />}
          >
            <Toggle
              checked={Boolean(settings.rapidTrigger)}
              disabled={pending === 'rapidTrigger'}
              onChange={(value) => onUpdate('rapidTrigger', value)}
              label="Rapid trigger"
            />
          </SettingRow>
        )}
        {caps.actuation && (
          <SettingRow
            title="Actuation point"
            description="Set how far a key travels before an input is registered."
          >
            <div className="flex items-center gap-4">
              <input
                className="range"
                type="range"
                aria-label="Actuation point"
                min={caps.actuation.min}
                max={caps.actuation.max}
                step={caps.actuation.step}
                value={settings.actuation}
                disabled={pending === 'actuation'}
                onChange={(event) => onUpdate('actuation', Number(event.target.value))}
              />
              <span className="w-14 text-right text-sm font-medium tabular-nums">
                {settings.actuation?.toFixed(1)} mm
              </span>
            </div>
          </SettingRow>
        )}
        {caps.lighting && (
          <SettingRow
            title="Lighting"
            description="Use the active profile's restrained device lighting."
            indicator={<Lightbulb className="size-3.5 text-muted-foreground" />}
          >
            <Toggle
              checked={Boolean(settings.lighting)}
              disabled={pending === 'lighting'}
              onChange={(value) => onUpdate('lighting', value)}
              label="Lighting"
            />
          </SettingRow>
        )}
      </div>

      <div className="settings-group mt-6">
        <div className="settings-group-title">
          <span>Profile</span>
          <span>Stored on this computer</span>
        </div>
        <SettingRow
          title="Active profile"
          description="Switch between reusable groups of settings."
        >
          <Select
            value={settings.profile}
            onValueChange={(value) => onUpdate('profile', value)}
            disabled={pending === 'profile'}
          >
            <SelectTrigger className="w-full bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((profile) => (
                <SelectItem key={profile} value={profile}>
                  {profile}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange(value: boolean): void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`toggle ${checked ? 'toggle-on' : ''}`}
    >
      <span>{checked && <Check className="size-3" />}</span>
      <em>{checked ? 'Enabled' : 'Disabled'}</em>
    </button>
  );
}
