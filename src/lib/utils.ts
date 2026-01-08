import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn (className) utility
 * Merges Tailwind CSS classes with proper precedence
 *
 * This is the signature utility from shadcn/ui that allows
 * conditional class merging while respecting Tailwind's specificity rules.
 *
 * @example
 * cn('px-2 py-1', condition && 'bg-red-500', 'text-white')
 * // => 'px-2 py-1 bg-red-500 text-white' (if condition is true)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
