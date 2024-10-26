const {WopiActions} = require("./WopiDiscovery");

(async () => {

    const wopi = new WopiActions();
    const edit_action = await wopi.getEditAction("xlsx");
    const edit_action_url = edit_action.getActionURL({
        file_identifier: "1234",
        options: {
            is_business_user: true,
            language: "ar",
        }
    })
    console.log("Edit action URL: ", edit_action_url);

    const view_action = await wopi.getViewAction("xlsx");
    const view_action_url = view_action.getActionURL({
            file_identifier: "1234",
            options: {
                is_business_user: true,
            }
        }
    )
    console.log("View action URL: ", view_action_url);


})()