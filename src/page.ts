/**
 * The one mobile page. Plain HTML, CSS and JS in a single file, no build step.
 * All server text is written with textContent, never innerHTML.
 * The script avoids backticks and dollar-brace so it can sit inside this String.raw template.
 */
export function renderPage(nonce: string): string {
  return HTML.replace('__NONCE__', nonce);
}

const HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Barhack: your block this week</title>
<meta name="description" content="A short brief for SF bar owners: new places nearby, 311 problems on your block, and one thing to do this week. English and Spanish.">
<meta name="color-scheme" content="light dark">
<style>
:root{--bg:#fff;--fg:#14171a;--muted:#55606a;--card:#f3f5f7;--line:#d5dbe0;--accent:#b4400f;--accent-fg:#fff;--err:#b00020}
@media (prefers-color-scheme:dark){:root{--bg:#101315;--fg:#eef1f3;--muted:#a3adb5;--card:#1a1f23;--line:#2c343a;--accent:#ff8a4c;--accent-fg:#1a0d04;--err:#ff8a80}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:640px;margin:0 auto;padding:16px}
header{display:flex;justify-content:space-between;align-items:center;gap:12px}
h1{font-size:1.5rem;margin:0}
h2{font-size:1.05rem;margin:20px 0 8px}
h3{font-size:.9rem;margin:16px 0 6px}
p{margin:8px 0}
.muted{color:var(--muted)}
.small{font-size:.85rem}
.err{color:var(--err)}
.lang{display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.lang button{border:0;background:transparent;color:var(--fg);padding:8px 14px;min-height:44px;font:inherit;font-weight:600;cursor:pointer}
.lang button[aria-pressed=true]{background:var(--accent);color:var(--accent-fg)}
label{display:block;font-weight:600;margin:16px 0 6px}
.row{display:flex;gap:8px}
input[type=search]{flex:1;min-width:0;font:inherit;padding:10px 12px;min-height:48px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg)}
#go{font:inherit;font-weight:600;padding:0 16px;min-height:48px;border:0;border-radius:8px;background:var(--accent);color:var(--accent-fg);cursor:pointer}
#go:disabled{opacity:.6;cursor:wait}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.stats{display:flex;gap:8px;list-style:none;padding:0;margin:12px 0}
.stats li{flex:1;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;font-size:.85rem}
.stats strong{display:block;font-size:1.7rem;line-height:1.1}
#bullets{padding-left:20px;margin:0}
#bullets li{margin-bottom:8px}
.action{background:var(--card);border-left:4px solid var(--accent);border-radius:8px;padding:12px 14px;margin-top:16px}
.action h2{margin-top:0}
.action p{margin:0}
details{margin-top:20px;border:1px solid var(--line);border-radius:8px;padding:6px 12px}
summary{cursor:pointer;font-weight:600;min-height:36px;display:flex;align-items:center}
pre{overflow-x:auto;background:var(--card);padding:10px;border-radius:6px;font-size:.75rem;line-height:1.4;margin:0}
footer{margin-top:24px}
[hidden]{display:none!important}
</style>
</head>
<body>
<main>
  <header>
    <h1>Barhack</h1>
    <div class="lang" role="group" aria-label="Language / Idioma">
      <button type="button" id="lang-en" aria-pressed="true">EN</button>
      <button type="button" id="lang-es" aria-pressed="false">ES</button>
    </div>
  </header>
  <p class="muted" data-t="tagline"></p>
  <form id="form" role="search">
    <label for="q" data-t="label"></label>
    <div class="row">
      <input id="q" name="name" type="search" autocomplete="off" autocapitalize="words" maxlength="100" required>
      <button id="go" type="submit" data-t="go"></button>
    </div>
  </form>
  <section aria-live="polite">
    <p id="status" class="muted"></p>
    <div id="result" hidden>
      <p id="matched" class="muted small"></p>
      <ul class="stats">
        <li><strong id="n311"></strong><span id="l311"></span></li>
        <li><strong id="nnew"></strong><span id="lnew"></span></li>
      </ul>
      <h2 data-t="hBlock"></h2>
      <ul id="bullets"></ul>
      <div class="action"><h2 data-t="hAction"></h2><p id="action"></p></div>
      <p id="sources" class="muted small"></p>
      <details>
        <summary data-t="how"></summary>
        <div id="how"></div>
      </details>
    </div>
  </section>
  <footer class="muted small" data-t="foot"></footer>
</main>
<script nonce="__NONCE__">
(function () {
  var T = {
    en: {
      tagline: "A short brief on your block, from SF open data.",
      label: "Your bar's name",
      placeholder: "Type the name as the city lists it",
      go: "Get my brief",
      hint: "Type your bar's name to get your brief.",
      loading: "Looking up your block...",
      matched: "Matched",
      l311: "311 reports within 300 m, last 30 days",
      lnew: "places opened within 800 m, last 12 months",
      hBlock: "On your block",
      hAction: "One thing to do this week",
      how: "How it works",
      howIntro: "We find your bar by name in Elasticsearch, run two geo queries around it, and Mistral turns the numbers into this brief.",
      stepLookup: "Find the bar",
      stepTrouble: "Trouble on the block (311, 300 m, 30 days, top 5)",
      stepNew: "New places nearby (800 m, 12 months, nearest first)",
      model: "Mistral model",
      sources: function (date, model) {
        return "Sources: SF 311 cases and SF registered business locations (data.sf.gov), searched with Elasticsearch. As of " + date + ". Brief written by Mistral Small (" + model + "). Counts come from the dataset loaded for this demo and may be partial. Written by AI from public data: check before you act.";
      },
      foot: "Barhack by Venue AI, built for the Make SF Better hack night. Public SF open data only.",
      netErr: "Could not reach the server. Check your connection and try again."
    },
    es: {
      tagline: "Un resumen corto de tu cuadra, con datos abiertos de SF.",
      label: "Nombre de tu bar",
      placeholder: "Escribe el nombre como aparece en el registro de la ciudad",
      go: "Ver mi resumen",
      hint: "Escribe el nombre de tu bar para ver tu resumen.",
      loading: "Buscando tu cuadra...",
      matched: "Encontrado",
      l311: "reportes al 311 a menos de 300 m, últimos 30 días",
      lnew: "negocios abiertos a menos de 800 m, últimos 12 meses",
      hBlock: "En tu cuadra",
      hAction: "Una cosa para hacer esta semana",
      how: "Cómo funciona",
      howIntro: "Encontramos tu bar por nombre en Elasticsearch, hacemos dos consultas geográficas a su alrededor, y Mistral convierte los números en este resumen.",
      stepLookup: "Buscar el bar",
      stepTrouble: "Problemas en la cuadra (311, 300 m, 30 días, top 5)",
      stepNew: "Negocios nuevos cerca (800 m, 12 meses, del más cercano al más lejano)",
      model: "Modelo de Mistral",
      sources: function (date, model) {
        return "Fuentes: casos del 311 de SF y registro de negocios de SF (data.sf.gov), consultados con Elasticsearch. Datos al " + date + ". Resumen escrito por Mistral Small (" + model + "). Las cifras vienen del conjunto de datos cargado para esta demo y pueden estar incompletas. Escrito con IA a partir de datos públicos: verifica antes de actuar.";
      },
      foot: "Barhack, de Venue AI, creado para el hack night Make SF Better. Solo datos abiertos de SF.",
      netErr: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
    }
  };

  var lang = "en";
  try {
    var saved = localStorage.getItem("barhack-lang");
    if (saved === "en" || saved === "es") lang = saved;
    else if ((navigator.language || "").toLowerCase().indexOf("es") === 0) lang = "es";
  } catch (e) {}

  var state = { loading: false, data: null, error: null };
  function $(id) { return document.getElementById(id); }
  function t(key, a, b) {
    var v = T[lang][key];
    return typeof v === "function" ? v(a, b) : v;
  }
  function el(tag, text) {
    var n = document.createElement(tag);
    if (text != null) n.textContent = text;
    return n;
  }

  function renderHow(d) {
    var box = $("how");
    box.textContent = "";
    box.appendChild(el("p", t("howIntro")));
    var titles = { lookup: "stepLookup", trouble: "stepTrouble", newcomers: "stepNew" };
    d.how.elasticsearch.forEach(function (s) {
      box.appendChild(el("h3", t(titles[s.step])));
      box.appendChild(el("pre", "POST /" + s.index + "/_search\n" + JSON.stringify(s.body, null, 2)));
    });
    box.appendChild(el("h3", t("model")));
    box.appendChild(el("pre", d.how.mistral.model + "  (response_format: " + d.how.mistral.response_format + ")"));
  }

  function render() {
    document.documentElement.lang = lang;
    $("lang-en").setAttribute("aria-pressed", String(lang === "en"));
    $("lang-es").setAttribute("aria-pressed", String(lang === "es"));
    document.querySelectorAll("[data-t]").forEach(function (n) { n.textContent = t(n.getAttribute("data-t")); });
    $("q").placeholder = t("placeholder");
    $("go").disabled = state.loading;

    var status = $("status");
    var result = $("result");
    status.className = "muted";
    if (state.loading) { status.textContent = t("loading"); result.hidden = true; return; }
    if (state.error) {
      status.className = "err";
      status.textContent = (state.error.message && state.error.message[lang]) || t("netErr");
      result.hidden = true;
      return;
    }
    if (!state.data) { status.textContent = t("hint"); result.hidden = true; return; }

    status.textContent = "";
    var d = state.data;
    var b = d.brief[lang];
    result.hidden = false;
    $("matched").textContent = t("matched") + ": " + d.bar.name + (d.bar.address ? ", " + d.bar.address : "");
    $("n311").textContent = String(d.data.trouble.total);
    $("l311").textContent = t("l311");
    $("nnew").textContent = String(d.data.newcomers.total);
    $("lnew").textContent = t("lnew");
    var ul = $("bullets");
    ul.textContent = "";
    b.bullets.forEach(function (x) { ul.appendChild(el("li", x)); });
    $("action").textContent = b.action;
    $("sources").textContent = t("sources", d.asOf, d.how.mistral.model);
    renderHow(d);
  }

  function setLang(next) {
    lang = next;
    try { localStorage.setItem("barhack-lang", next); } catch (e) {}
    render();
  }
  $("lang-en").addEventListener("click", function () { setLang("en"); });
  $("lang-es").addEventListener("click", function () { setLang("es"); });

  $("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("q").value.trim();
    if (!name || state.loading) return;
    state = { loading: true, data: null, error: null };
    render();
    fetch("/block?name=" + encodeURIComponent(name))
      .then(function (r) {
        return r.json().then(function (body) { return { ok: r.ok, body: body }; });
      })
      .then(function (o) {
        state = o.ok ? { loading: false, data: o.body, error: null } : { loading: false, data: null, error: o.body };
      })
      .catch(function () {
        state = { loading: false, data: null, error: {} };
      })
      .then(render);
  });

  render();
})();
</script>
</body>
</html>
`;
