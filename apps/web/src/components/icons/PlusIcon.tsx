import type { SVGAttributes } from 'react';

type Props = SVGAttributes<SVGSVGElement> & { size?: number };

export default function PlusIcon({ size = 16, ...rest }: Props) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" {...rest}>
      <path d="M7.75 1a.75.75 0 0 1 .75.75V7h5.25a.75.75 0 0 1 0 1.5H8.5v5.25a.75.75 0 0 1-1.5 0V8.5H1.75a.75.75 0 0 1 0-1.5H7V1.75A.75.75 0 0 1 7.75 1Z" />
    </svg>
  );
}
