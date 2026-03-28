import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
  {
    variants: {
      variant: {
        default: 'pos-btn-tactile-primary font-semibold',
        secondary: 'pos-btn-tactile font-semibold',
        outline: 'border-2 border-zinc-200 dark:border-white/10 bg-transparent text-foreground hover:bg-zinc-100 dark:hover:bg-white/5',
        ghost: 'text-foreground hover:bg-zinc-100 dark:hover:bg-white/5',
        positive: 'pos-btn-positive font-semibold',
        info: 'pos-btn-info font-semibold',
        destructive: 'pos-btn-destructive font-semibold',
        'destructive-solid': 'pos-btn-destructive-solid font-semibold',
        utility: 'pos-btn-utility font-semibold',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
