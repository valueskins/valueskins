import { Html, Head, Main, NextScript } from 'next/document';

// G7: dark is the default theme. The palette in globals.css already defaults
// dark on a bare :root, so a no-JS render is dark. This blocking script runs
// before first paint and stamps a stored 'light' preference (or a 'system'
// preference that resolves light) onto <html>, so someone who chose light
// never sees a dark frame first. Kept tiny and inline on purpose — deferring
// it would reintroduce the flash it exists to prevent.
const THEME_BOOT = `(function(){try{
var p=localStorage.getItem('vs_theme')||'dark';
var t=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;
if(t!=='dark'&&t!=='light')t='dark';
document.documentElement.setAttribute('data-theme',t);
document.documentElement.style.colorScheme=t;
}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function Document() {
  return (
    <Html lang="en" data-theme="dark">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
