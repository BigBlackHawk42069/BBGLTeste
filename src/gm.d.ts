interface GmXmlHttpRequestDetails {
  method: string;
  url: string;
  onload: (res: { status: number; responseText: string }) => void;
  onerror: () => void;
}

declare function GM_xmlhttpRequest(details: GmXmlHttpRequestDetails): void;

interface Window {
  __BBGL_LOADED__?: boolean;
  _bbglScrubbing?: boolean;
  initDevTools?: () => void;
  TooltipController?: { hide: () => void };
}
