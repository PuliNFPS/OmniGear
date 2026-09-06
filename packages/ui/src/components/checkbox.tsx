import * as React from 'react';
import { CheckIcon } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';

import { cn } from '#lib/utils';

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-5 shrink-0 rounded-[5px] border border-strong bg-background shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-items-center text-current"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
