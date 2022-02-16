function selectMod(form) {
    const user = form[0].value;
    const repo = form[1].value;
    const branch = form[2].value;
    window.location = (
        `${window.location.origin}${window.location.pathname}` +
    `?user=${user}&repo=${repo}&branch=${branch}`
    );
    return false;
}

function loadMod() {
    const params = new URLSearchParams(window.location.search);
    const user = params.get('user');
    const repo = params.get('repo') || 'The-Modding-Tree';
    const branch = params.get('branch') || 'master';
    return Promise.resolve()
        .then(async () => {
            if (!user) {
                throw new Error('GitHub user not specified');
            }
            const response = await fetch(`https://api.github.com/repos/${user}/${repo}/branches/${branch}`);
            const data = await response.json();
            if (data['message']) {
                throw Error(`Failed fetching GitHub branch: ${data['message']}`);
            }
            const commit = data['commit']['sha'];
            const baseUrl = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${commit}/`;
            await loadFullMod(baseUrl);
        })
        .catch((err) => {
            console.error(err);
            setTimeout(() => { // Run in timeout to make sure the document is ready
                document.getElementById('loading-error').innerHTML = '' + err;
                document.getElementById('loading-section').style = 'display: none';
                document.getElementById('mod-selector').style = null;
                document.getElementById('user').value = user;
                document.getElementById('repo').value = repo;
                document.getElementById('branch').value = branch;
            }, 0);
        });
  
}

async function loadFullMod(baseUrl) {
    const indexResponse = await fetch(new URL('index.html', baseUrl));
    const indexText = await indexResponse.text();
    const htmlParser = new DOMParser();
    const html = htmlParser.parseFromString(indexText, 'text/html');

    const toAppend = [];
    for (const elem of html.head.children) {
        if (elem.tagName != 'SCRIPT') {
            rewriteElementUrl(elem, baseUrl);
            toAppend.push(elem);
        }
    }
    for (const elem of toAppend) {
        document.head.appendChild(elem);
    }

    const beforeFiles = [];
    const afterFiles = [];
    let isBefore = true;
    for (const script of html.head.getElementsByTagName('script')) {
        const src = script.attributes.src.value;
        if (src === 'js/technical/loader.js') {
            isBefore = false;
            // And do not load that file or it will try to load wrong files
        } else if (isBefore) {
            beforeFiles.push(src);
        } else {
            afterFiles.push(src);
        }
    }

    await appendAllScripts(baseUrl, beforeFiles);
    const modFiles = modInfo['modFiles'];
    if (modFiles) { // old mods don't have this, so just skip it
        await appendAllScripts(new URL('js/', baseUrl), modFiles);
    }
    await appendAllScripts(baseUrl, afterFiles);

    rewriteUrls(html.body, baseUrl);

    document.body.style = null;
    document.body.outerHTML = html.body.outerHTML;
    rewriteLayers(htmlParser, baseUrl);
    load();
}

function rewriteLayers(htmlParser, baseUrl) {
    for (const layer of Object.keys(layers)) {
    // probably more things to fix
        layers[layer]['symbol'] = rewriteTextMaybeHtml(
            layers[layer]['symbol'], htmlParser, baseUrl);
    }
}

function rewriteTextMaybeHtml(text, htmlParser, baseUrl) {
    if (!text) {
        return text;
    }
    const parsed = htmlParser.parseFromString(text, 'text/html');
    if (parsed.body.children.length == 0) {
        return text;
    }
    const elem = parsed.body.children[0];
    rewriteElementUrl(elem, baseUrl);
    return elem.outerHTML;
}

function rewriteUrls(elem, baseUrl) {
    rewriteElementUrl(elem, baseUrl);
    for (const child of elem.children) {
        rewriteUrls(child, baseUrl);
    }
}

function rewriteElementUrl(elem, baseUrl) {
    for (const attr of ['src', 'href']) {
        if (elem.attributes[attr] && elem.attributes[attr].value) {
            elem[attr] = new URL(elem.attributes[attr].value, baseUrl);
        }
    }
}

function appendAllScripts(baseUrl, paths) {
    const promises = [];
    for (const path of paths) {
        promises.push(appendScript(baseUrl, path));
    }
    return Promise.all(promises);
}


function appendScript(baseUrl, path) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const script = document.createElement('script');
        script.src = url;
        script.async = false;
        script.onload = resolve;
        script.onerror = (e) => reject(Error(`${url} failed to load`));
        document.head.appendChild(script);
    });
}

loadMod();
