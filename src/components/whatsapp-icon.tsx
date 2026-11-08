import type { SVGProps } from "react";

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z" />
      <path d="m8.2 7.2 1.5 2.2-1 1.2c.9 1.7 2.1 2.9 3.8 3.8l1.2-1 2.2 1.5c.2.2.2.5.1.8-.5 1-1.3 1.4-2.4 1.1-3.6-1-6.5-3.9-7.5-7.5-.3-1.1.1-1.9 1.1-2.4.4-.1.7 0 1 .3Z" />
    </svg>
  );
}
