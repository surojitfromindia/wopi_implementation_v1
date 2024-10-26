const axios = require("axios");
const { XMLParser } = require("fast-xml-parser");

const NODE_ENV = process.env.NODE_ENV;
const WOPI_DEV_DISCOVERY_ENDPOINT = 'https://ffc-onenote.officeapps.live.com/hosting/discovery';
const WOPI_PRODUCTION_DISCOVERY_ENDPOINT = 'https://onenote.officeapps.live.com/hosting/discovery';
const WOPI_DISCOVERY_ENDPOINT = NODE_ENV === 'production' ? WOPI_PRODUCTION_DISCOVERY_ENDPOINT : WOPI_DEV_DISCOVERY_ENDPOINT;
const WOPI_HOST = process.env.WOPI_HOST;
const WOPI_PORT = process.env.WOPI_PORT;
const WOPI_FILES_ENDPOINT = `${WOPI_HOST}:${WOPI_PORT}/wopi/files`;

/**
 * Class representing WopiActions.
 * @example
 * const wopiActions = new WopiActions();
 * const editAction = await wopiActions.getEditAction("xlsx");
 * const editActionUrl = editAction.getActionURL({
 *   file_identifier: "1234",
 *   options: {
 *     is_business_user: true,
 *     language: "ar",
 *   }
 * });
 * console.log("Edit action URL: ", editActionUrl);
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

    /**
     * Creates an instance of WopiActions.
     */
    constructor() {
        if (!WopiActions.instance) {
            WopiActions.instance = this;
        }
        return WopiActions.instance;
    }

    /**
     * Initializes the WopiActions instance by fetching and parsing XML data.
     * @private
     * @returns {Promise<void>}
     */
    async #init() {
        if (this.alreadyInit) {
            return;
        }
        this.alreadyInit = true;
        const xml_data = await this.#fetchXMLData();
        const apps = await this.#parseXML(xml_data);
        for (let app of apps) {
            const app_name = app['@_name'];
            const app_favIconUrl = app['@_favIconUrl'];
            const app_details = {
                favIconUrl: app_favIconUrl,
                name: app_name
            };

            for (let action of app['action']) {
                if (action['@_name'] === 'view') {
                    this.#view_actions.push(new Action(action, app_details));
                } else if (action['@_name'] === 'edit') {
                    this.#edit_actions.push(new Action(action, app_details));
                }
            }
        }
    }

    /**
     * Fetches XML data from the WOPI discovery endpoint.
     * @private
     * @returns {Promise<string>} The XML data as a string.
     */
    async #fetchXMLData() {
        const response = await axios.get(WOPI_DISCOVERY_ENDPOINT, {
            headers: {
                'Content-Type': 'application/xml',
                'Accept': 'application/xml'
            }
        });
        return response.data;
    }

    /**
     * Parses the XML data.
     * @private
     * @param {string} xml_data - The XML data to parse.
     * @returns {Promise<Object[]>} The parsed XML data as an array of app objects.
     */
    async #parseXML(xml_data) {
        const xml_parser = new XMLParser({
            attributeNamePrefix: "@_",
            ignoreAttributes: false,
        });
        let result = xml_parser.parse(xml_data);
        return result['wopi-discovery']['net-zone']["app"];
    }

    /**
     * Gets the edit action for a given file extension.
     * @param {string} file_ext - The file extension to get the edit action for.
     * @returns {Promise<Action>} The edit action.
     * @throws {Error} If the action is not found.
     * @example
     */
    async getEditAction(file_ext) {
        await this.#init();
        const action = this.#edit_actions.find(act => act.extension === file_ext);
        if (action) {
            return action;
        }
        throw new Error('Action not found');
    }

    /**
     * Gets the view action for a given file extension.
     * @param {string} file_ext - The file extension to get the view action for.
     * @returns {Promise<Action>} The view action.
     * @throws {Error} If the action is not found.
     */
    async getViewAction(file_ext) {
        await this.#init();
        const action = this.#view_actions.find(act => act.extension === file_ext);
        if (action) {
            return action;
        }
        throw new Error('Action not found');
    }

    static LanguageMapping = {
        'en': 'en-US',
        'ar': 'ar-SA',
    };
}

/**
 * Class representing an Action.
 */
class Action {
    static DEFAULT_OPTIONS = {
        is_business_user: false,
        language: 'en'
    };

    /**
     * Creates an instance of Action.
     * @param {Object} action - The action details.
     * @param {Object} app_details - The app details.
     */

    #editor_url;
    constructor(action, app_details) {
        this.name = action['@_name'];
        this.extension = action['@_ext'];
        this.app_details = app_details;
        this.#editor_url = action['@_urlsrc'];

    }

    /**
     * Gets the action URL with the specified options.
     * @param {Object} params - The parameters for the action URL.
     * @param {string} params.file_identifier - The file identifier.
     * @param {Object} [params.options=Action.DEFAULT_OPTIONS] - The options for the action URL.
     * @returns {string} The action URL.
     * @example
     * const editAction = await wopiActions.getEditAction("xlsx");
     * const editAction = action.getActionURL({
     *   file_identifier: "1234",
     *   options: {
     *     is_business_user: true,
     *     language: "ar",
     *   }
     * });
     * console.log("Action URL: ", actionUrl);
     */
    getActionURL({ file_identifier, options = Action.DEFAULT_OPTIONS }) {
        const _options = {
            ...Action.DEFAULT_OPTIONS,
            ...options,
        };

        const editor_url = new URL(this.#editor_url);
        const editor_url_origin = editor_url.origin;
        const is_edit = editor_url.searchParams.get('edit') === '1';


        /**
         * we cannot use 'editor_url' directly because it has many placeholders values that we don't have,
         * so we start from the origin and append the required parameters
         * @type {module:url.URL}
         */
        const action_url = new URL(editor_url_origin);
        if (is_edit) {
            action_url.searchParams.append('edit', '1');
        }
        action_url.searchParams.append('ui', WopiActions.LanguageMapping[_options.language]);
        action_url.searchParams.append('rs', WopiActions.LanguageMapping[_options.language]);
        action_url.searchParams.append('IsLicensedUser', _options.is_business_user ? '1' : '0');
        const wopi_src = `${WOPI_FILES_ENDPOINT}/${file_identifier}`;
        action_url.searchParams.append('wopisrc', wopi_src);
        return action_url.toString();
    }
}

module.exports = {
    WopiActions,
};