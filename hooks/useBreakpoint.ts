import { config } from '@/tailwind.config';
import { useMediaQuery } from 'react-responsive';
import resolveConfig from 'tailwindcss/resolveConfig';

const fullConfig = resolveConfig(config);
const breakpoints = fullConfig.theme?.screens;

type BreakpointKey = keyof typeof breakpoints;

export function useBreakpoint(breakpointKey: BreakpointKey) {
  if (breakpoints) {
    return useMediaQuery({
      query: `(min-width: ${breakpoints[breakpointKey]})`,
    });
  } else {
    throw new Error('Breakpoint not exists');
  }
}
