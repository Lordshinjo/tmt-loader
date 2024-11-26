const _DEFAULT_BRANCH = 'master';
const _DEFAULT_REPO = 'The-Modding-Tree';
const _DEFAULT_LOAD_ONLY_MOD_FILES = 'false';

const _TMT_USER = 'Acamaeda';
const _TMT_REPO = 'The-Modding-Tree';
const _TMT_BRANCH = 'master';

function selectMod(form) {
    const params = new URLSearchParams();
    params.append('user', form.user.value);

    const repo = form.repo.value;
    if (repo !== _DEFAULT_REPO) {
        params.append('repo', repo);
    }

    const branch = form.branch.value;
    if (branch !== _DEFAULT_BRANCH) {
        params.append('branch', branch);
    }

    const loadOnlyModFiles = '' + form.loadOnlyModFiles.checked;
    if (loadOnlyModFiles !== _DEFAULT_LOAD_ONLY_MOD_FILES) {
        params.append('loadOnlyModFiles', loadOnlyModFiles);
    }

    window.location.assign(`${window.location.origin}${window.location.pathname}?${params}`);
    return false;
}

function loadMod() {
    const params = new URLSearchParams(window.location.search);
    const user = params.get('user');
    const repo = params.get('repo') || _DEFAULT_REPO;
    const branch = params.get('branch') || _DEFAULT_BRANCH;
    const loadOnlyModFiles = (params.get('loadOnlyModFiles') || _DEFAULT_LOAD_ONLY_MOD_FILES) == 'true';
    return Promise.resolve()
        .then(async () => {
            if (!user) {
                throw new Error('GitHub user not specified');
            }
            const baseUrlPromise = loadOnlyModFiles ? getBaseUrl(_TMT_USER, _TMT_REPO, _TMT_BRANCH) : getBaseUrl(user, repo, branch);
            // if not loading only mod files, use an empty string so that URLs are just relative
            const modUrl = loadOnlyModFiles ? (await getBaseUrl(user, repo, branch)) : '';
            const baseUrl = await baseUrlPromise;
            await loadFullMod(baseUrl, modUrl);
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

async function getBaseUrl(user, repo, branch) {
    const response = await fetch(`https://api.github.com/repos/${user}/${repo}/branches/${branch}`);
    const data = await response.json();
    if (data['message']) {
        throw Error(`Failed fetching GitHub branch ${user}/${repo}/${branch}: ${data['message']}`);
    }
    const commit = data['commit']['sha'];
    // Use JSDelivr stable URL for the last commit in the branch as base URL.
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${commit}/`;
}

async function loadFullMod(baseUrl, modUrl) {
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

    // Append all script in 2 batches:
    // - 1st batch for all scripts before js/technical/loader.js, including mod.js which defines
    //   the mod files to load
    // - 2nd batch for all mod files and the scripts after js/technical/loader.js
    const beforeFiles = [];
    const afterFiles = [];
    let isBefore = true;
    for (const script of scriptToAppend) {
        if (script === 'js/technical/loader.js') {
            isBefore = false;
            // And do not load that file, we want to load mod files manually.
        } else if (isBefore) {
            if (script === 'js/mod.js') {
                beforeFiles.push(`${modUrl}${script}`);
            } else {
                beforeFiles.push(script);
            }
        } else {
            afterFiles.push(script);
        }
    }

    await appendAllScripts(beforeFiles);
    const modFiles = modInfo['modFiles'] ? // old mods don't have this, so just skip it
        modInfo['modFiles'].map((script) => `${modUrl}js/${script}`)
        : [];
    await appendAllScripts([...modFiles, ...afterFiles]);

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

function appendAllScripts(paths) {
    const promises = [];
    for (const path of paths) {
        promises.push(appendScript(path));
    }
    return Promise.all(promises);
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
