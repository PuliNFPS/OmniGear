import type { ConnectedPeripheral } from '@gearhub/shared';
import { Badge } from '@gearhub/ui/components/badge';
import { Button } from '@gearhub/ui/components/button';
import { cn } from '@gearhub/ui/lib/utils';
import { LoaderCircle, Plus } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { DeviceIcon } from './DeviceIcon';

export function Sidebar({
  devices,
  selectedId,
  discovering,
  onSelect,
  onConnect,
}: {
  devices: ConnectedPeripheral[];
  selectedId: string | null;
  discovering: boolean;
  onSelect(id: string): void;
  onConnect(): void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <BrandMark />
        <Badge className="bg-status/10 text-status">Beta</Badge>
      </div>
      <div className="flex-1 px-3 py-5">
        <div className="mb-3 flex items-center justify-between px-2">
          <span className="eyebrow">Connected devices</span>
          <span className="text-xs tabular-nums text-muted-foreground">{devices.length}</span>
        </div>
        <nav aria-label="Connected devices" className="space-y-1">
          {devices.length === 0 && (
            <p className="px-2 py-4 text-sm leading-6 text-muted-foreground">
              Connect a device to begin configuring it.
            </p>
          )}
          {devices.map((device) => (
            <button
              key={device.id}
              onClick={() => onSelect(device.id)}
              className={cn(
                'device-nav-item',
                selectedId === device.id && 'device-nav-item-active',
              )}
              aria-current={selectedId === device.id ? 'page' : undefined}
            >
              <span className="device-nav-icon">
                <DeviceIcon type={device.type} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">{device.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {device.manufacturer} · {device.type}
                </span>
              </span>
              <span className="size-1.5 rounded-full bg-status" aria-label="Connected" />
            </button>
          ))}
        </nav>
      </div>
      <div className="border-t border-border p-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onConnect}
          disabled={discovering}
        >
          {discovering ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {discovering ? 'Looking for devices…' : 'Connect device'}
        </Button>
      </div>
    </aside>
  );
}
