const _DEFAULT_BRANCH = 'master';
const _DEFAULT_REPO = 'The-Modding-Tree';

function selectMod(form) {
    const params = new URLSearchParams();
    params.append('user', form[0].value);

    const repo = form[1].value;
    if (repo !== _DEFAULT_REPO) {
        params.append('repo', repo);
    }

    const branch = form[2].value;
    if (branch !== _DEFAULT_BRANCH) {
        params.append('branch', branch);
    }

    window.location.assign(`${window.location.origin}${window.location.pathname}?${params}`);
    return false;
}

function loadMod() {
    const params = new URLSearchParams(window.location.search);
    const user = params.get('user');
    const repo = params.get('repo') || _DEFAULT_REPO;
    const branch = params.get('branch') || _DEFAULT_BRANCH;
    return Promise.resolve()
        .then(async () => {
            if (!user) {
                throw new Error('GitHub user not specified');
            }
            // Fetch data about the specified branch from the GitHub API.
            const response = await fetch(`https://api.github.com/repos/${user}/${repo}/branches/${branch}`);
            const data = await response.json();
            if (data['message']) {
                throw Error(`Failed fetching GitHub branch: ${data['message']}`);
            }
            const commit = data['commit']['sha'];
            // Use JSDelivr stable URL for the last commit in the branch as base URL.
            const baseUrl = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${commit}/`;
            await loadFullMod(baseUrl);
        })
        .catch((err) => {
            console.error(err);
            document.getElementById('loading-error').innerHTML = '' + err;
            document.getElementById('loading-section').style = 'display: none';
            document.getElementById('mod-selector').style = null;
            document.getElementById('user').value = user;
            document.getElementById('repo').value = repo;
            document.getElementById('branch').value = branch;
        });
  
}

async function loadFullMod(baseUrl) {
    // Parse the index.html of the mod as HTML.
    const indexResponse = await fetch(new URL('index.html', baseUrl));
    const indexText = await indexResponse.text();
    const htmlParser = new DOMParser();
    const html = htmlParser.parseFromString(indexText, 'text/html');

    // Create a <base /> element in the head so that all relative URLS are rooted at the specified
    // base URL.
    const base = document.createElement('base');
    base.href = baseUrl;
    document.head.appendChild(base);

    // List all non-script elements and scripts to be appended.
    const elemToAppend = [];
    const scriptToAppend = [];
    for (const elem of html.head.children) {
        if (elem.tagName == 'SCRIPT') {
            scriptToAppend.push(elem.attributes.src.value);
        } else {
            elemToAppend.push(elem);
        }
    }

    // Actually append all non-script elements.
    for (const elem of elemToAppend) {
        document.head.appendChild(elem);
    }

    // And append all scripts 1 by 1.
    for (const script of scriptToAppend) {
        await appendScript(script);
    }

    // Now completely replace this document's body by the parsed index's body.
    // We also remove attributes that are set in our index to make sure they are replaced.
    document.body.removeAttribute('style');
    document.body.removeAttribute('onload');
    document.body.innerHTML = html.body.innerHTML;
    for (const attr of html.body.attributes) {
        document.body.setAttribute(attr.name, attr.value);
    }

    // Then finally call the load function (from the body's onload in case that was changed to
    // another function).
    if (document.body.onload) {
        document.body.onload();
    }
}

function appendScript(path) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = path;
        script.async = false;
        script.onload = resolve;
        script.onerror = (e) => reject(Error(`${url} failed to load`));
        document.head.appendChild(script);
    });
}
