const axios = require("axios");


const node_env = process.env.NODE_ENV;
const wopi_dev_discovery_endpoint = 'https://ffc-onenote.officeapps.live.com/hosting/discovery';
const wopi_prod_discovery_endpoint = 'https://onenote.officeapps.live.com/hosting/discovery';
const wopi_discovery_endpoint = node_env === 'production' ? wopi_prod_discovery_endpoint : wopi_dev_discovery_endpoint;



async function fetchXMLData() {
    const response = await axios.get(wopi_discovery_endpoint,{
        headers: {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml'
        }
    });
    console.log(response.data);
}



fetchXMLData().catch((error)=>{
    console.log(error);
})


