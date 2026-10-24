const fs = require('fs');

const gj = JSON.parse(fs.readFileSync('dados/casas_salvacao.geojson', 'utf8'));
let aj = {};
if (fs.existsSync('dados/casas_ajustadas.json')) {
    aj = JSON.parse(fs.readFileSync('dados/casas_ajustadas.json', 'utf8'));
}

const targets = new Set();
for (let i = 1012; i <= 1132; i += 10) targets.add(String(i));
for (let i = 2011; i <= 2131; i += 10) targets.add(String(i));

const houses = gj.features.filter(f => targets.has(String(f.properties.numero)));
console.log('Total houses:', houses.length);
houses.forEach(h => {
    const id = h.properties.id;
    const hasAjuste = Boolean(aj[id]);
    console.log(`Casa ${h.properties.numero} (${id}): quadra=${h.properties.quadra}, face=${h.properties.face}, aj=${hasAjuste}`);
});

