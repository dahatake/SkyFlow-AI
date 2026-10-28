"""Builds src/data/changi/routes.json from the Wikipedia 'Changi Airport' article (CC BY-SA 4.0).

Usage: python scripts/fetch-changi-routes.py
"""
import json, re, urllib.request, pathlib, datetime

URL = 'https://en.wikipedia.org/w/api.php?action=parse&page=Changi_Airport&section=16&prop=wikitext&format=json'
req = urllib.request.Request(URL, headers={'User-Agent': 'SkyFlowAI/0.1 (dahatake)'})
text = json.load(urllib.request.urlopen(req))['parse']['wikitext']['*']

def clean(s):
    s = re.sub(r'<ref[^>]*/>', '', s)
    s = re.sub(r'<ref[^>]*>.*?</ref>', '', s, flags=re.S)
    return re.sub(r'<!--.*?-->', '', s, flags=re.S)

def dests(cell):
    out = []
    for part in re.split(r'<br\s*/?>', cell):
        seasonal = 'seasonal' in part.lower()
        for m in re.finditer(r'\[\[([^\]]+)\]\]', part):
            name = m.group(1).split('|')[-1].split(',')[0].strip()
            if name.lower().startswith('file:'):
                continue
            out.append({'destination': name, 'seasonal': seasonal})
    return out

airlines = []
for row in re.split(r'\n\|\s*(?=\[\[)', clean(text)):
    m = re.match(r'\[\[([^\]]+)\]\]\s*\|\s*(.*)', row, flags=re.S)
    if not m:
        continue
    d = dests(m.group(2))
    if d:
        airlines.append({'airline': m.group(1).split('|')[-1].strip(), 'routes': d})

out = {
    'source': 'https://en.wikipedia.org/wiki/Changi_Airport#Airlines_and_destinations',
    'license': 'CC BY-SA 4.0',
    'retrieved': datetime.date.today().isoformat(),
    'note': 'Route-level data only (airline -> destination). Not a timetable.',
    'airlines': airlines,
}
path = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'data' / 'changi' / 'routes.json'
path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(airlines), 'airlines', sum(len(a['routes']) for a in airlines), 'routes')
