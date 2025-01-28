function startGCSDKs() {
    const console = window.console;
    return new Promise(async (resolve, reject) => {
        const appName = 'Interaction Viewer';
        const qParamLanguage = 'langTag';
        const qParamGcHostOrigin = 'gcHostOrigin';
        const qParamEnvironment = 'gcTargetEnv';
        let language = '';
        let userDetails = null;
        let gcHostOrigin = '';
        await assignConfiguration();

        const hostName = new URL(gcHostOrigin).hostname;
        const parts = hostName.split('.');
        parts.shift();
        window.environment = parts.join('.'); //example enviroment value = "mypurecloud.ie"
        console.log('window.environment in startGCSDKs:', window.environment);
        console.log('window.redirectUri in startGCSDKs:', window.redirectUri);

        const platformClient = require('platformClient');
        const client = platformClient.ApiClient.instance;

        document.addEventListener('DOMContentLoaded', function () {
            var ClientApp = window.purecloud.apps.ClientApp;
            var myClientApp = new ClientApp({
                gcHostOriginQueryParam: 'gcHostOrigin',
                gcTargetEnvQueryParam: 'gcTargetEnv'
            });
            const region = myClientApp.gcEnvironment;
        });

        const usersApi = new platformClient.UsersApi();
        let ClientApp = window.purecloud.apps.ClientApp;
        let myClientApp = new ClientApp({
            pcEnvironment: window.environment
        });
        client.setPersistSettings(true, appName);
        client.setEnvironment(window.environment);
        client.loginImplicitGrant(window.clientId, window.redirectUri)
            .then(data => usersApi.getUsersMe())
            .then(data => {
                userDetails = data;
            })
            .then(() => {
                document.addEventListener('DOMContentLoaded', () => {
                    document.getElementById('span_environment').innerText = window.environment;
                    document.getElementById('span_name').innerText = userDetails.name;
                });
                resolve(platformClient);
            })
            .catch((err) => {
                console.error("Error during setup:", err);
                reject(err);
            });

        function assignConfiguration() {
            return new Promise((resolve) => {
                let browser_url = new URL(window.location);
                let searchParams = new URLSearchParams(browser_url.search);
                if (searchParams.has(qParamLanguage)) {
                    language = searchParams.get(qParamLanguage);
                    localStorage.setItem(`${appName}_language`, language);
                    console.log('Language set from URL parameter:', language);
                } else {
                    let local_lang = localStorage.getItem(`${appName}_language`);
                    if (local_lang) {
                        language = local_lang;
                        console.log('Language set from localStorage:', language);
                    } else {
                        console.log('Language not found in both URL parameters and localStorage.');
                    }
                }
                if (searchParams.has(qParamGcHostOrigin)) {
                    gcHostOrigin = searchParams.get(qParamGcHostOrigin);
                    localStorage.setItem(`${appName}_gcHostOrigin`, gcHostOrigin);
                    console.log('gcHostOrigin set from URL parameter:', gcHostOrigin);
                } else {
                    let local_gcHostOrigin = localStorage.getItem(`${appName}_gcHostOrigin`);
                    if (local_gcHostOrigin) {
                        gcHostOrigin = local_gcHostOrigin;
                        console.log('gcHostOrigin set from localStorage:', gcHostOrigin);
                    } else {
                        console.log('gcHostOrigin not found in both URL parameters and localStorage.');
                    }
                }
                for (let pair of searchParams.entries()) {
                    console.log(pair[0] + ': ' + pair[1]);
                }
                console.log('Returning gcHostOrigin:', gcHostOrigin);
                resolve(gcHostOrigin);
            });
        }
    });
}
