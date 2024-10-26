const axios = require("axios");
const {XMLParser} = require("fast-xml-parser")


const NODE_ENV = process.env.NODE_ENV;
const WOPI_DEV_DISCOVERY_ENDPOINT = 'https://ffc-onenote.officeapps.live.com/hosting/discovery';
const WOPI_PRODUCTION_DISCOVERY_ENDPOINT = 'https://onenote.officeapps.live.com/hosting/discovery';
const WOPI_DISCOVERY_ENDPOINT = NODE_ENV === 'production' ? WOPI_PRODUCTION_DISCOVERY_ENDPOINT : WOPI_DEV_DISCOVERY_ENDPOINT;
const WOPI_HOST = process.env.WOPI_HOST
const WOPI_PORT = process.env.WOPI_PORT
const WOPI_FILES_ENDPOINT = `${WOPI_HOST}:${WOPI_PORT}/wopi/files`

/**
 * @type {WopiActions}
 */
class WopiActions {


    static instance = null;
    alreadyInit = false;
    /**
     * @type {Action[]}
     */
    #view_actions = [];
    /**
     * @type {Action[]}
     */
    #edit_actions = [];


    // store the app wise details
    /**
     *
     * @type {{[key: string]: {
     *     favIconUrl: string,
     *     name: string,
     * }}}
     */
    #appWiseDetails = {}


    constructor() {
        if (!WopiActions.instance) {
            WopiActions.instance = this;
        }
        return WopiActions.instance;
    }

    async #init() {
        if (this.alreadyInit) {
            return;
        }
        this.alreadyInit = true;
        // fetch the xml data
        const xml_data = await this.#fetchXMLData();
        // parse the xml data
        const apps = await this.#parseXML(xml_data);
        // get the actions
        for (let app of apps) {
            // store the app details for future reference
            const app_name = app['@_name'];
            const app_favIconUrl = app['@_favIconUrl'];

            const app_details = {
                favIconUrl: app_favIconUrl, name: app_name
            }
            this.#appWiseDetails[app_name] = app_details;

            // parse the actions
            for (let action of app['action']) {
                // update the extension to app mapping
                if (action['@_name'] === 'view') {
                    // we need to provide each action with the app details and the action details
                    this.#view_actions.push(new Action(action, app_details));
                } else if (action['@_name'] === 'edit') {
                    this.#edit_actions.push(new Action(action, app_details));
                }
            }

        }

    }


    async getEditAction(file_ext) {
        await this.#init();

        // get the edit action
        const action = this.#edit_actions.find(act => act.extension === file_ext);
        if (action) {
            return action;
        }
        throw new Error('Action not found');
    }

    async getViewAction(file_ext) {
        await this.#init();

        // get the view action
        const action = this.#view_actions.find(act => act.extension === file_ext);
        if (action) {
            return action;
        }
        throw new Error('Action not found');
    }

    async #fetchXMLData() {
        const response = await axios.get(WOPI_DISCOVERY_ENDPOINT, {
            headers: {
                'Content-Type': 'application/xml', 'Accept': 'application/xml'
            }
        });
        // console.log(response.data);
        return response.data;
    }

    async #parseXML(xml_data) {
        const xml_parser = new XMLParser({
            attributeNamePrefix: "@_", ignoreAttributes: false,

        });
        let result = xml_parser.parse(xml_data);
        return result['wopi-discovery']['net-zone']["app"];
    }


    static LanguageMapping = {
        'en': 'en-US', 'ar': 'ar-SA',
    }

}

Action = class {

    // this will be the default options
    static DEFAULT_OPTIONS = {
        is_business_user: false, language: 'en'
    }

    constructor(action, app_details) {
        this.name = action['@_name']
        this.extension = action['@_ext'];
        /**
         *  "urlsrc" also holds some placeholders, but we only need the url part
         *  so we split the string and get the first part
         * https://FFC-excel.officeapps.live.com/x/_layouts/xlviewerinternal.aspx?edit=1&<ui=UI_LLCC&><rs=DC_LLCC&><dchat=DISABLE_CHAT&>
         */
        this.editor_url = action['@_urlsrc'].split('&')[0];
        this.app_details = app_details;

    }

    getActionURL({file_identifier, options = Action.DEFAULT_OPTIONS}) {
        // override the default options
        const _options = {
            ...Action.DEFAULT_OPTIONS, ...options,
        }

        const url = new URL(this.editor_url)
        // for more visit:
        // https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online/discovery#action-urls
        // ui language
        url.searchParams.append('ui', WopiActions.LanguageMapping[_options.language]);
        // language to use in calculation and other in-editor operations
        url.searchParams.append('rs', WopiActions.LanguageMapping[_options.language]);
        // if business user is true
        url.searchParams.append('IsLicensedUser', _options.is_business_user ? '1' : '0');

        // note: wopi_src= "[host server wopi end point] / file id that is unique to the file(file_identifier)"
        // e.g. wopi_src = "[https://localhost:5000/wopi/files]/[1234]"
        const wopi_src = `${WOPI_FILES_ENDPOINT}/${file_identifier}`;
        url.searchParams.append('wopisrc', wopi_src);
        return url.toString();
    }
}


module.exports = {
    WopiActions,
}