const fs = require('fs');

const gj = JSON.parse(fs.readFileSync('dados/casas_salvacao.geojson', 'utf8'));
console.log('Props of first feature:', Object.keys(gj.features[0].properties));

const targets = new Set();
for (let i = 1012; i <= 1132; i += 10) targets.add(String(i));
for (let i = 2011; i <= 2131; i += 10) targets.add(String(i));

const matches = [];
for (const f of gj.features) {
    const props = f.properties;
    for (const [k, v] of Object.entries(props)) {
        if (targets.has(String(v))) {
            matches.push({ key: k, val: v, id: props.id || props.ID, props });
            break;
        }
    }
}
console.log('Found matches:', matches.length);
if (matches.length > 0) {
    console.log('Example match:', matches[0].key, matches[0].val, matches[0].id);
    const byKey = {};
    matches.forEach(m => byKey[m.key] = (byKey[m.key] || 0) + 1);
    console.log('Matches by property key:', byKey);
}

