import type { SVGAttributes } from 'react';

type Props = SVGAttributes<SVGSVGElement> & {
  name: string;
  size?: number;
};

const FILE_FILL: Record<string, string> = {
  image: '#a371f7',
  video: '#db6d28',
  audio: '#cf222e',
  archive: '#656d76',
};

function fileType(name: string): string {
  if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(name)) return 'image';
  if (/\.(mp4|avi|mov|mkv)$/i.test(name)) return 'video';
  if (/\.(mp3|wav|flac|aac)$/i.test(name)) return 'audio';
  if (/\.(zip|tar|gz|rar|7z)$/i.test(name)) return 'archive';
  return 'default';
}

export default function FileIcon({ name, size = 16, fill, className, ...rest }: Props) {
  const color = fill ?? FILE_FILL[fileType(name)] ?? '#0969da';
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill={color}
      {...rest}
    >
      <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z" />
    </svg>
  );
}
