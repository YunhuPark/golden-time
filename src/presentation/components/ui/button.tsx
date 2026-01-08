import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

/**
 * Button Variants Configuration (shadcn/ui inspired)
 * Emergency Control Center themed button styles
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // Emergency variants (glow effect applied via CSS for dark mode only)
        emergency:
          'bg-critical text-white font-bold hover:scale-105 data-[theme=dark]:shadow-glow-critical',
        safe: 'bg-safe text-black font-bold hover:scale-105 data-[theme=dark]:shadow-glow-safe',
        warning:
          'bg-warning text-black font-bold hover:scale-105 data-[theme=dark]:shadow-glow-warning',
        info: 'bg-info text-black font-bold hover:scale-105 data-[theme=dark]:shadow-glow-info',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        xl: 'h-14 rounded-lg px-10 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/**
 * Button Component (shadcn/ui inspired)
 * Emergency-optimized with neon glow variants
 *
 * @example
 * <Button variant="emergency" size="xl">
 *   🚨 119 구급대 호출
 * </Button>
 *
 * <Button variant="safe" size="lg">
 *   ✅ 병상 가능
 * </Button>
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
