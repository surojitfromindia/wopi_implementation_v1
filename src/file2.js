const {WopiActions } =require("./WopiDiscovery");

(async ()=>{

    const wopi2 = new WopiActions();
    const edit_action = await wopi2.getEditAction("xlsx");
    const edit_action_url = edit_action.getActionURL({
        file_identifier: "1234",
        options :{
            is_business_user: true,
            language: "ar",
        }
    })
    console.log("Edit action URL: ", edit_action_url);

})()