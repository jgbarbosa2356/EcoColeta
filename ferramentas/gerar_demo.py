"""Gera uma demonstracao HTML autocontida a partir das fontes do aplicativo."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "aplicativo" / "web"
html = (WEB / "index.html").read_text(encoding="utf-8")
html = html.replace('<link rel="stylesheet" href="style.css">',
                    '<style>' + (WEB / "style.css").read_text(encoding="utf-8") + '</style>')
for name in ("core.js", "transport.js", "app.js"):
    html = html.replace('<script src="' + name + '"></script>',
                        '<script>' + (WEB / name).read_text(encoding="utf-8") + '</script>')
target = ROOT / "aplicativo" / "EcoColeta_demonstracao.html"
target.write_text(html, encoding="utf-8")
print(target)
