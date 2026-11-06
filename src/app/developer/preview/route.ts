import { isDeveloper } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

/**
 * A stand-in page for the developer page's preview: the real widget.js in
 * preview mode, which takes its settings from the developer page (unsaved
 * changes included) instead of the server, and never opens a real chat.
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#fff;color:#17181a;overflow:hidden}
  header{height:52px;display:flex;align-items:center;gap:10px;padding:0 18px;border-bottom:1px solid #ebe9e3}
  header b{width:26px;height:26px;border-radius:6px;background:#002349}
  header i{display:block;height:9px;border-radius:5px;background:#e6e4de}
  .hero{height:44%;background:linear-gradient(160deg,#6b7a6a,#3f4a44 55%,#2b332f);position:relative}
  .hero i{position:absolute;left:24px;bottom:24px;width:46%;height:14px;border-radius:7px;background:rgba(255,255,255,.75)}
  .hero i+i{bottom:48px;width:30%;height:20px}
  main{padding:22px 24px}
  main i{display:block;height:10px;border-radius:5px;background:#eeece6;margin:0 0 12px}
</style>
</head>
<body>
<header><b></b><i style="width:90px"></i><i style="width:60px;margin-left:auto"></i><i style="width:60px"></i></header>
<div class="hero"><i></i><i></i></div>
<main><i style="width:72%"></i><i style="width:88%"></i><i style="width:64%"></i><i style="width:80%"></i><i style="width:52%"></i></main>
<script src="/widget.js" data-site="westchesterguy" data-preview="1"></script>
</body>
</html>`;

export async function GET() {
  if (!(await isDeveloper())) return new Response("Signed out", { status: 401 });
  return new Response(PAGE, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
