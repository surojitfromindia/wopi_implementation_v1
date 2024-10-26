const axios = require("axios");
const {XMLParser} = require("fast-xml-parser")


const node_env = process.env.NODE_ENV;
const wopi_dev_discovery_endpoint = 'https://ffc-onenote.officeapps.live.com/hosting/discovery';
const wopi_prod_discovery_endpoint = 'https://onenote.officeapps.live.com/hosting/discovery';
const wopi_discovery_endpoint = node_env === 'production' ? wopi_prod_discovery_endpoint : wopi_dev_discovery_endpoint;



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
    #update_actions = [];
    /**
     * @type {Action[]}
     */
    #other_actions = [];
    constructor() {
        if(!WopiActions.instance){
            console.log("called in constructor")
            WopiActions.instance = this;
        }
        return WopiActions.instance;
    }

    async #init () {
        if(this.alreadyInit){
            return;
        }
        this.alreadyInit = true;
        // fetch the xml data
        const xml_data = await this.#fetchXMLData();
        // parse the xml data
        const apps = await this.#parseXML(xml_data);
        // get the actions
        for (let app of apps) {
            for (let action of app['action']) {
                if (action['@_name'] === 'view') {
                    this.#view_actions.push(new Action(action));
                } else if (action['@_name'] === 'edit') {
                    this.#update_actions.push(new Action(action));
                } else {
                    this.#other_actions.push(new Action(action));
                }
            }

        }
    }

    async getOtherAction(file_ext, action_name) {
        await this.#init();
        // depending on the file extension and action name, return the action
        const action = this.#other_actions.find(act => act.name===action_name && act.extension === file_ext);
        if(action){
            return action;
        }
        throw new Error('Action not found');
    }
    async getUpdatedAction(file_ext) {
        await this.#init();

        // get the updated action
        const action = this.#update_actions.find(act => act.extension === file_ext);
        if(action){
            return action;
        }
        throw new Error('Action not found');
    }
    async getViewAction(file_ext) {
        await this.#init();

        // get the view action
        const action = this.#view_actions.find(act => act.extension === file_ext);
        if(action){
            return action;
        }
        throw new Error('Action not found');
    }
    async  #fetchXMLData() {
        const response = await axios.get(wopi_discovery_endpoint,{
            headers: {
                'Content-Type': 'application/xml',
                'Accept': 'application/xml'
            }
        });
        // console.log(response.data);
        return response.data;
    }
    async #parseXML(xml_data) {
        const xml_parser = new XMLParser({
            attributeNamePrefix : "@_",
            ignoreAttributes: false,

        });
        let result = xml_parser.parse(xml_data);
        return result['wopi-discovery']['net-zone']["app"];
    }

}
class Action {
    constructor(action) {
        this.name = action['@_name'];
        this.extension = action['@_ext'];
        this.url_src = action['@_urlsrc'];
    }
}


module.exports = {
    WopiActions,
}