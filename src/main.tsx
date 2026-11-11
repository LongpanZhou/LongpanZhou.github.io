import { isMobile } from './utils/isMobile';

// A phone or tablet is shown a notice that is already written in index.html, and nothing more is
// downloaded for it. Everything else (React, the router, the map) is the desktop site.
if (!isMobile()) import('./desktop');
