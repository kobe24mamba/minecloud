import type { SVGAttributes } from 'react';

type Props = SVGAttributes<SVGSVGElement> & { size?: number };

export default function ShareIcon({ size = 16, ...rest }: Props) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" {...rest}>
      <path d="M11 2.5a2.5 2.5 0 1 1 .603 1.628l-5.068 2.535a2.5 2.5 0 0 1 0 1.674l5.068 2.535a2.5 2.5 0 1 1-.603 1.628l-5.068-2.535a2.5 2.5 0 1 1 0-3.93Z" />
    </svg>
  );
}
